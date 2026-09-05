import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { PATHS } from "./paths.js";
import { CliError, AuthRequiredError, NetworkError } from "./errors.js";
import { USER_AGENT } from "./version.js";
import type { AuthEntry, AuthState, ServerName } from "../types/index.js";

/**
 * Swiggy MCP authentication — OAuth 2.1 Authorization Code + PKCE (S256).
 *
 * Verified against https://mcp.swiggy.com/builders/docs/start/authenticate/ and the live
 * metadata document on 2026-09-05:
 *   - Authorization server: https://mcp.swiggy.com/auth
 *     (metadata at https://mcp.swiggy.com/.well-known/oauth-authorization-server)
 *   - Dynamic Client Registration (RFC 7591) IS supported at POST /auth/register, so no
 *     pre-issued client_id is needed. `--client-id` / SWIGGY_OAUTH_CLIENT_ID still override.
 *   - Scopes: mcp:tools mcp:resources mcp:prompts
 *   - Loopback redirect URIs http://127.0.0.1 and http://localhost (any port) are allowlisted.
 *   - ONE login covers all three servers (food, instamart, dineout) — the token is shared.
 *   - Access token lifetime: 5 days. Refresh-token issuance is NOT wired in v1.0 even though the
 *     metadata advertises the grant; on expiry we re-run the browser flow.
 *   - 401 → re-auth; 419 → session revoked → re-auth.
 */

const DEFAULT_PORT = 0; // ephemeral
const DEFAULT_SCOPES = ["mcp:tools", "mcp:resources", "mcp:prompts"];
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
/** Refresh/expiry skew — the docs recommend proactively re-authenticating when ≤60s remain. */
const EXPIRY_SKEW_MS = 60_000;

async function ensureDir(file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
}

export async function loadAuth(): Promise<AuthState> {
  if (!existsSync(PATHS.authFile)) return { servers: {} };
  try {
    const parsed = JSON.parse(await readFile(PATHS.authFile, "utf8")) as Partial<AuthState>;
    return { servers: parsed.servers ?? {} };
  } catch (err) {
    throw new CliError("CONFIG_ERROR", `Failed to read auth at ${PATHS.authFile}: ${(err as Error).message}`, {
      hint: "Delete the file and run swiggy auth init again to recreate credentials.",
    });
  }
}

export async function saveAuth(state: AuthState): Promise<void> {
  await ensureDir(PATHS.authFile);
  await writeFile(PATHS.authFile, JSON.stringify(state, null, 2), { mode: 0o600 });
}

function isExpired(entry: AuthEntry | undefined): boolean {
  return Boolean(entry?.expiresAt && entry.expiresAt < Date.now() + EXPIRY_SKEW_MS);
}

/**
 * Resolve a usable bearer token for `server`.
 * Swiggy issues one session token valid for every server, so if this server has no entry we
 * fall back to any other server's valid token (and remember it for next time).
 */
export async function getAccessToken(server: ServerName): Promise<string | undefined> {
  const auth = await loadAuth();
  let entry = auth.servers[server];
  let borrowed = false;
  if (!entry?.accessToken || isExpired(entry)) {
    const donor = Object.entries(auth.servers).find(([name, e]) => name !== server && e.accessToken && !isExpired(e));
    if (donor) {
      entry = donor[1];
      borrowed = true;
    }
  }
  if (!entry?.accessToken) return undefined;
  if (isExpired(entry)) {
    if (entry.refreshToken && entry.tokenEndpoint) {
      try {
        const refreshed = await refreshAccessToken(entry);
        auth.servers[server] = { ...entry, ...refreshed };
        await saveAuth(auth);
        return refreshed.accessToken;
      } catch (err) {
        throw new CliError("AUTH_FAILED", `Stored credentials for "${server}" have expired and could not be refreshed.`, {
          hint: "Run: swiggy auth init  (Swiggy access tokens last 5 days; refresh tokens are not issued yet)",
          details: { reason: err instanceof Error ? err.message : String(err) },
        });
      }
    }
    return undefined;
  }
  if (borrowed) {
    auth.servers[server] = { ...entry };
    await saveAuth(auth);
  }
  return entry.accessToken;
}

export interface AuthLookupState {
  authFile: string;
  hasAuthFile: boolean;
  hasServerEntry: boolean;
  hasAccessToken: boolean;
  expiresAt: number | null;
}

export async function getAuthLookupState(server: ServerName): Promise<AuthLookupState> {
  const hasAuthFile = existsSync(PATHS.authFile);
  if (!hasAuthFile) {
    return { authFile: PATHS.authFile, hasAuthFile, hasServerEntry: false, hasAccessToken: false, expiresAt: null };
  }
  const auth = await loadAuth();
  const entry = auth.servers[server];
  return {
    authFile: PATHS.authFile,
    hasAuthFile,
    hasServerEntry: Boolean(entry),
    hasAccessToken: Boolean(entry?.accessToken),
    expiresAt: entry?.expiresAt ?? null,
  };
}

export async function requireAccessToken(server: ServerName): Promise<string> {
  const tok = await getAccessToken(server);
  if (!tok) throw new AuthRequiredError(server);
  return tok;
}

export async function clearAuth(server?: ServerName): Promise<void> {
  const auth = await loadAuth();
  if (server) delete auth.servers[server];
  else auth.servers = {};
  await saveAuth(auth);
}

export interface OAuthMetadata {
  issuer?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
}

interface ProtectedResourceMetadata {
  resource?: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
}

function wellKnown(base: string, suffix: string): string[] {
  // RFC 8414 §3.1: for an issuer with a path component, insert the well-known segment between
  // host and path (https://host/.well-known/oauth-authorization-server/path). Also try the
  // legacy path-suffix form and the bare origin.
  const u = new URL(base);
  const path = u.pathname.replace(/\/$/, "");
  const out = [`${u.origin}/.well-known/${suffix}${path}`, `${u.origin}/.well-known/${suffix}`];
  if (path) out.unshift(`${u.origin}${path}/.well-known/${suffix}`);
  return Array.from(new Set(out));
}

async function fetchJson<T>(url: string): Promise<{ ok: true; body: T } | { ok: false; status?: number; network?: boolean }> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": USER_AGENT } });
    if (!res.ok) return { ok: false, status: res.status };
    const ctype = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!ctype.includes("json") && !text.trim().startsWith("{")) return { ok: false, status: res.status };
    return { ok: true, body: JSON.parse(text) as T };
  } catch {
    return { ok: false, network: true };
  }
}

/**
 * Discover OAuth authorization-server metadata for an MCP server URL.
 * Order: RFC 9728 protected-resource metadata → its `authorization_servers` → RFC 8414 metadata;
 * then the legacy `<server>/.well-known/...` and origin-level fallbacks.
 */
export async function discoverOAuthMetadata(serverUrl: string): Promise<OAuthMetadata> {
  const asCandidates: string[] = [];
  let sawNetworkFailure = false;
  let lastStatus: number | undefined;

  for (const prUrl of wellKnown(serverUrl, "oauth-protected-resource")) {
    const r = await fetchJson<ProtectedResourceMetadata>(prUrl);
    if (r.ok && Array.isArray(r.body.authorization_servers)) {
      for (const as of r.body.authorization_servers) asCandidates.push(...wellKnown(as, "oauth-authorization-server"));
      break;
    }
    if (!r.ok && r.network) sawNetworkFailure = true;
  }
  asCandidates.push(...wellKnown(serverUrl, "oauth-authorization-server"));

  for (const url of Array.from(new Set(asCandidates))) {
    const r = await fetchJson<OAuthMetadata>(url);
    if (r.ok && r.body.authorization_endpoint && r.body.token_endpoint) return r.body;
    if (!r.ok) {
      if (r.network) sawNetworkFailure = true;
      else lastStatus = r.status;
    }
  }
  if (sawNetworkFailure && lastStatus === undefined) {
    throw new NetworkError(`Could not reach the OAuth metadata endpoint for ${serverUrl}. Check connectivity.`);
  }
  throw new CliError("AUTH_FAILED", `Could not discover OAuth metadata for ${serverUrl}`, {
    details: { lastStatus, tried: Array.from(new Set(asCandidates)) },
    hint: "Verify: curl https://mcp.swiggy.com/.well-known/oauth-authorization-server",
  });
}

interface OAuthClient {
  client_id: string;
  client_secret?: string;
}

async function resolveClient(
  metadata: OAuthMetadata,
  redirectUri: string,
  explicitClientId?: string,
  explicitClientSecret?: string
): Promise<OAuthClient> {
  const id = explicitClientId || process.env.SWIGGY_OAUTH_CLIENT_ID;
  if (id) return { client_id: id, client_secret: explicitClientSecret || process.env.SWIGGY_OAUTH_CLIENT_SECRET };
  if (!metadata.registration_endpoint) {
    throw new CliError("AUTH_FAILED", "No OAuth client_id available and the server does not advertise dynamic registration.", {
      hint: "Pass --client-id <id> or set SWIGGY_OAUTH_CLIENT_ID.",
    });
  }
  return registerDynamicClient(metadata.registration_endpoint, redirectUri);
}

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** Best-effort: open a URL in the user's default browser. Never throws. */
export function openInBrowser(url: string): boolean {
  if (process.env.SWIGGY_NO_BROWSER) return false;
  try {
    const p =
      process.platform === "win32"
        ? spawn("cmd", ["/c", "start", "", url.replace(/&/g, "^&")], { detached: true, stdio: "ignore", windowsHide: true })
        : process.platform === "darwin"
          ? spawn("open", [url], { detached: true, stdio: "ignore" })
          : spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    p.on("error", () => undefined);
    p.unref();
    return true;
  } catch {
    return false;
  }
}

export interface InteractiveAuthOptions {
  /** Servers to store the resulting token under. One browser flow covers all of them. */
  servers: ServerName[];
  /** Any Swiggy MCP server URL — used for metadata discovery. */
  serverUrl: string;
  port?: number;
  /** "127.0.0.1" (default, RFC 8252 recommended) or "localhost". Both are allowlisted by Swiggy. */
  redirectHost?: "127.0.0.1" | "localhost";
  clientId?: string;
  clientSecret?: string;
  /** Open the authorization URL in the default browser (default true). */
  openBrowser?: boolean;
  timeoutMs?: number;
  /** Receives human-facing progress lines (stderr). */
  log?: (line: string) => void;
}

export interface InteractiveAuthResult {
  servers: ServerName[];
  expiresAt?: number;
  scope?: string;
  clientId: string;
  issuer?: string;
}

/**
 * Run the OAuth Authorization Code + PKCE flow against Swiggy and persist the token for every
 * server in `opts.servers`.
 */
export async function interactiveAuthLogin(opts: InteractiveAuthOptions): Promise<InteractiveAuthResult> {
  const log = opts.log ?? ((line: string) => process.stderr.write(`${line}\n`));
  const metadata = await discoverOAuthMetadata(opts.serverUrl);
  const port = opts.port ?? DEFAULT_PORT;
  const host = opts.redirectHost || "127.0.0.1";
  const expectedState = randomBytes(16).toString("hex");
  const { verifier, challenge } = pkce();

  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });
  const addr = server.address();
  const boundPort = typeof addr === "object" && addr ? addr.port : port;
  const redirectUri = `http://${host}:${boundPort}/callback`;

  let client: OAuthClient;
  try {
    client = await resolveClient(metadata, redirectUri, opts.clientId, opts.clientSecret);
  } catch (err) {
    server.close();
    throw err;
  }

  const codePromise = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new CliError("AUTH_FAILED", "Timed out waiting for the browser sign-in to complete.", {
        hint: "Re-run swiggy auth init and finish the phone + OTP step in the browser tab.",
      }));
    }, opts.timeoutMs ?? CALLBACK_TIMEOUT_MS);
    server.on("request", (req, res) => {
      const u = new URL(req.url || "/", `http://${host}`);
      if (u.pathname !== "/callback") {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }
      clearTimeout(timer);
      const code = u.searchParams.get("code");
      const state = u.searchParams.get("state");
      const error = u.searchParams.get("error");
      res.setHeader("content-type", "text/html; charset=utf-8");
      if (error) {
        res.end(page("Authorization failed", `${error}: ${u.searchParams.get("error_description") ?? ""}`));
        server.close();
        reject(new CliError("AUTH_FAILED", `OAuth error: ${error}`, { details: { error_description: u.searchParams.get("error_description") } }));
        return;
      }
      if (!code || state !== expectedState) {
        res.end(page("Invalid response", "State mismatch or missing code. Please retry from the terminal."));
        server.close();
        reject(new CliError("AUTH_FAILED", "Invalid OAuth callback (state mismatch or missing code)."));
        return;
      }
      res.end(page("You're signed in", "swiggy-cli is now authenticated for Food, Instamart and Dineout. You can close this tab."));
      server.close();
      resolve(code);
    });
  });

  const scopes = metadata.scopes_supported?.length ? metadata.scopes_supported : DEFAULT_SCOPES;
  const authUrl = new URL(metadata.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", client.client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", expectedState);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("scope", scopes.join(" "));
  const link = authUrl.toString();

  const opened = opts.openBrowser === false ? false : openInBrowser(link);
  log("");
  log(opened ? "Opening your browser to sign in to Swiggy (phone + OTP)." : "Sign in to Swiggy by opening this URL in a browser:");
  log(opened ? "If nothing opened, copy this URL into a browser:" : "");
  log(link);
  log("");

  const code = await codePromise;
  const tok = await exchangeCode(metadata, client, code, verifier, redirectUri);

  const auth = await loadAuth();
  const now = Date.now();
  const entry: AuthEntry = {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    tokenType: tok.token_type || "Bearer",
    scope: tok.scope,
    obtainedAt: now,
    expiresAt: tok.expires_in ? now + tok.expires_in * 1000 : undefined,
    clientId: client.client_id,
    clientSecret: client.client_secret,
    redirectUri,
    authorizationEndpoint: metadata.authorization_endpoint,
    tokenEndpoint: metadata.token_endpoint,
    issuer: metadata.issuer,
  };
  for (const s of opts.servers) auth.servers[s] = { ...entry };
  await saveAuth(auth);
  return { servers: opts.servers, expiresAt: entry.expiresAt, scope: entry.scope, clientId: client.client_id, issuer: metadata.issuer };
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

/**
 * Exchange the authorization code. Standard OAuth uses application/x-www-form-urlencoded; the
 * Swiggy docs show a JSON body. We try form encoding first and fall back to JSON if rejected.
 */
async function exchangeCode(metadata: OAuthMetadata, client: OAuthClient, code: string, verifier: string, redirectUri: string): Promise<TokenResponse> {
  const params: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: client.client_id,
    code_verifier: verifier,
  };
  if (client.client_secret) params.client_secret = client.client_secret;
  return postToken(metadata.token_endpoint, params);
}

async function postToken(tokenEndpoint: string, params: Record<string, string>): Promise<TokenResponse> {
  const attempt = async (json: boolean): Promise<Response> =>
    fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": json ? "application/json" : "application/x-www-form-urlencoded",
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
      body: json ? JSON.stringify(params) : new URLSearchParams(params),
    });
  let res: Response;
  try {
    res = await attempt(false);
    if (res.status === 400 || res.status === 415) {
      const retry = await attempt(true);
      if (retry.ok) res = retry;
    }
  } catch (err) {
    throw new NetworkError(`Token endpoint unreachable: ${(err as Error).message}`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new CliError("AUTH_FAILED", `Token exchange failed: ${res.status} ${res.statusText}`, {
      details: safeJson(text) ?? text.slice(0, 300),
      hint: "Authorization codes are single-use and expire after 120s. Run swiggy auth init again.",
    });
  }
  const tok = safeJson(text) as TokenResponse | undefined;
  if (!tok?.access_token) throw new CliError("AUTH_FAILED", "Token endpoint returned no access_token.", { details: tok });
  return tok;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function refreshAccessToken(entry: AuthEntry): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: number; tokenType?: string }> {
  if (!entry.tokenEndpoint || !entry.refreshToken || !entry.clientId) {
    throw new CliError("AUTH_FAILED", "Cannot refresh: missing token endpoint, refresh token, or client id.");
  }
  const params: Record<string, string> = { grant_type: "refresh_token", refresh_token: entry.refreshToken, client_id: entry.clientId };
  if (entry.clientSecret) params.client_secret = entry.clientSecret;
  const tok = await postToken(entry.tokenEndpoint, params);
  return {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token || entry.refreshToken,
    expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
    tokenType: tok.token_type || entry.tokenType,
  };
}

async function registerDynamicClient(registrationEndpoint: string, redirectUri: string): Promise<OAuthClient> {
  const body = {
    client_name: "swiggy-cli",
    client_uri: "https://github.com/HKTITAN/swiggy-cli",
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
  let res: Response;
  try {
    res = await fetch(registrationEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new NetworkError(`OAuth client registration failed: ${(err as Error).message}`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new CliError("AUTH_FAILED", `OAuth client registration failed: ${res.status} ${res.statusText}`, {
      details: safeJson(text) ?? text.slice(0, 300),
      hint: "Set SWIGGY_OAUTH_CLIENT_ID or pass --client-id <id> and retry.",
    });
  }
  const registered = (safeJson(text) ?? {}) as { client_id?: string; client_secret?: string };
  if (!registered.client_id) {
    throw new CliError("AUTH_FAILED", "OAuth client registration response did not include client_id.", {
      hint: "Set SWIGGY_OAUTH_CLIENT_ID or pass --client-id <id> and retry.",
    });
  }
  return { client_id: registered.client_id, client_secret: registered.client_secret };
}

function page(title: string, body: string): string {
  return (
    `<!doctype html><meta charset="utf-8"><title>swiggy-cli</title>` +
    `<body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#fff5ed;color:#222;padding:48px;max-width:560px;margin:auto">` +
    `<div style="display:flex;align-items:center;gap:12px"><span style="display:inline-block;width:36px;height:36px;border-radius:9px;background:#FF5200"></span>` +
    `<h1 style="margin:0;color:#FF5200;font-size:22px">swiggy-cli</h1></div>` +
    `<h2 style="margin-top:28px">${title}</h2><p style="line-height:1.5">${body}</p></body>`
  );
}

export interface AuthHealth {
  authenticated: boolean;
  reason: string;
  expiresAt: number | null;
  hasRefresh: boolean;
}

export function evaluateAuthHealth(entry?: AuthEntry): AuthHealth {
  if (!entry?.accessToken) {
    return { authenticated: false, reason: "missing - run swiggy auth init", expiresAt: null, hasRefresh: false };
  }
  const hasRefresh = Boolean(entry.refreshToken);
  const expiresAt = entry.expiresAt ?? null;
  const nowWithSkew = Date.now() + EXPIRY_SKEW_MS;
  if (expiresAt !== null && expiresAt < nowWithSkew && !hasRefresh) {
    return { authenticated: false, reason: "token expired - run swiggy auth init", expiresAt, hasRefresh };
  }
  if (expiresAt !== null && expiresAt < nowWithSkew && hasRefresh && !entry.tokenEndpoint) {
    return { authenticated: false, reason: "token refresh misconfigured - run swiggy auth init", expiresAt, hasRefresh };
  }
  const remainingH = expiresAt !== null ? Math.max(0, Math.round((expiresAt - Date.now()) / 3_600_000)) : null;
  return {
    authenticated: true,
    reason: remainingH !== null ? `token valid (~${remainingH}h left)` : "token available",
    expiresAt,
    hasRefresh,
  };
}

interface TokenClaims {
  sub?: string;
  iss?: string;
  iat?: number;
  exp?: number;
  [k: string]: unknown;
}

export function extractTokenClaims(accessToken?: string): TokenClaims | undefined {
  if (!accessToken) return undefined;
  const parts = accessToken.split(".");
  if (parts.length < 2) return undefined;
  try {
    const payload = parts[1]!;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as TokenClaims;
  } catch {
    return undefined;
  }
}
