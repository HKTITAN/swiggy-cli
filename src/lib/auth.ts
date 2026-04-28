import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { PATHS } from "./paths.js";
import { CliError, AuthRequiredError } from "./errors.js";
import type { AuthState, ServerName } from "../types/index.js";

/**
 * The Swiggy MCP servers use HTTP transport with OAuth.
 * Per the manifest, the canonical flow is:
 *   1. Discover OAuth metadata at <server>/.well-known/oauth-authorization-server
 *      (per RFC 8414 / MCP authorization spec).
 *   2. Dynamic client registration if supported, or use a pre-issued client.
 *   3. Authorization Code + PKCE → access token.
 *
 * The official CLI flow opens a local loopback redirect URI and waits.
 * Whitelisted redirect URIs in the manifest include vscode/claude/chatgpt;
 * `http://127.0.0.1:<port>/callback` is the conventional CLI choice and
 * is typically accepted by MCP servers that support dynamic registration.
 *
 * If the deployed server requires a pre-registered client, set
 * SWIGGY_OAUTH_CLIENT_ID / SWIGGY_OAUTH_CLIENT_SECRET in the environment.
 */

const DEFAULT_PORT = 0; // ephemeral

async function ensureDir(file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
}

export async function loadAuth(): Promise<AuthState> {
  if (!existsSync(PATHS.authFile)) return { servers: {} };
  try {
    return JSON.parse(await readFile(PATHS.authFile, "utf8")) as AuthState;
  } catch {
    return { servers: {} };
  }
}

export async function saveAuth(state: AuthState): Promise<void> {
  await ensureDir(PATHS.authFile);
  await writeFile(PATHS.authFile, JSON.stringify(state, null, 2), { mode: 0o600 });
}

export async function getAccessToken(server: ServerName): Promise<string | undefined> {
  const auth = await loadAuth();
  const entry = auth.servers[server];
  if (!entry?.accessToken) return undefined;
  if (entry.expiresAt && entry.expiresAt < Date.now() + 30_000) {
    if (entry.refreshToken && entry.tokenEndpoint) {
      try {
        const refreshed = await refreshAccessToken(entry);
        auth.servers[server] = { ...entry, ...refreshed };
        await saveAuth(auth);
        return refreshed.accessToken;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
  return entry.accessToken;
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

interface OAuthMetadata {
  issuer?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
}

export async function discoverOAuthMetadata(serverUrl: string): Promise<OAuthMetadata> {
  const candidates = [
    `${serverUrl.replace(/\/$/, "")}/.well-known/oauth-authorization-server`,
    new URL("/.well-known/oauth-authorization-server", serverUrl).toString(),
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (res.ok) return (await res.json()) as OAuthMetadata;
    } catch {
      // try next
    }
  }
  throw new CliError("AUTH_FAILED", `Could not discover OAuth metadata for ${serverUrl}`, {
    hint: "Check connectivity and that the MCP endpoint is reachable.",
  });
}

interface OAuthClient {
  client_id: string;
  client_secret?: string;
}

/**
 * Resolve a client_id. Swiggy MCP does NOT advertise RFC 7591 dynamic client registration —
 * the manifest at https://github.com/Swiggy/swiggy-mcp-server-manifest pre-whitelists
 * specific OAuth clients (Claude, ChatGPT, VS Code, plus loopback for CLI use).
 *
 * Resolution order:
 *   1. explicit `clientId` argument (e.g. `--client-id` flag)
 *   2. SWIGGY_OAUTH_CLIENT_ID env var
 *   3. error with actionable hint
 */
function resolveClient(explicitClientId?: string, explicitClientSecret?: string): OAuthClient {
  const id = explicitClientId || process.env.SWIGGY_OAUTH_CLIENT_ID;
  if (!id) {
    throw new CliError(
      "AUTH_FAILED",
      "No OAuth client_id available. Swiggy MCP requires a pre-registered client.",
      {
        hint:
          "Pass `--client-id <id>` to `swiggy auth init`, or set SWIGGY_OAUTH_CLIENT_ID. " +
          "See https://github.com/Swiggy/swiggy-mcp-server-manifest for the whitelisted clients.",
      }
    );
  }
  return { client_id: id, client_secret: explicitClientSecret || process.env.SWIGGY_OAUTH_CLIENT_SECRET };
}

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

interface InteractiveAuthOptions {
  server: ServerName;
  serverUrl: string;
  port?: number;
  /** "127.0.0.1" (default, RFC 8252 recommended) or "localhost". Both are whitelisted by Swiggy. */
  redirectHost?: "127.0.0.1" | "localhost";
  /** Override SWIGGY_OAUTH_CLIENT_ID. */
  clientId?: string;
  /** Override SWIGGY_OAUTH_CLIENT_SECRET (omit for public clients with PKCE). */
  clientSecret?: string;
  open?: (url: string) => Promise<void> | void;
}

/**
 * Run the OAuth Authorization Code + PKCE flow against the configured Swiggy MCP server.
 * Public alias for interactiveAuthLoginV2 — keeps the call site stable.
 */
export const interactiveAuthLogin = (opts: InteractiveAuthOptions) => interactiveAuthLoginV2(opts);

/**
 * Production OAuth flow — Authorization Code + PKCE against a loopback redirect.
 */
export async function interactiveAuthLoginV2(opts: InteractiveAuthOptions): Promise<void> {
  const metadata = await discoverOAuthMetadata(opts.serverUrl);
  const port = opts.port ?? DEFAULT_PORT;
  const host = opts.redirectHost || "127.0.0.1";
  const expectedState = randomBytes(16).toString("hex");
  const { verifier, challenge } = pkce();

  // Resolve the OAuth client BEFORE binding a port — fail fast on misconfiguration.
  const client = resolveClient(opts.clientId, opts.clientSecret);

  // Bind a loopback port for the redirect URI. Swiggy whitelists http://127.0.0.1
  // and http://localhost (with or without /callback) — RFC 8252 §7.3 mandates that
  // any port on the loopback host matches the registered URI.
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });
  const addr = server.address();
  const boundPort = typeof addr === "object" && addr ? addr.port : port;
  const redirectUri = `http://${host}:${boundPort}/callback`;

  const codePromise = new Promise<string>((resolve, reject) => {
    server.on("request", (req, res) => {
      const u = new URL(req.url || "/", `http://127.0.0.1`);
      if (u.pathname !== "/callback") {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }
      const code = u.searchParams.get("code");
      const state = u.searchParams.get("state");
      const error = u.searchParams.get("error");
      res.setHeader("content-type", "text/html");
      if (error) {
        res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
        server.close();
        reject(new CliError("AUTH_FAILED", `OAuth error: ${error}`));
        return;
      }
      if (!code || state !== expectedState) {
        res.end(`<h1>Invalid response</h1>`);
        server.close();
        reject(new CliError("AUTH_FAILED", "Invalid OAuth callback."));
        return;
      }
      res.end(
        `<!doctype html><meta charset="utf-8"><title>swiggy-cli</title>` +
          `<body style="font-family:system-ui;background:#fff5ed;color:#222;padding:40px">` +
          `<h1 style="color:#FC8019">swiggy-cli</h1><p>Authentication complete. You can close this tab.</p></body>`
      );
      server.close();
      resolve(code);
    });
  });

  const authUrl = new URL(metadata.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", client.client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", expectedState);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("scope", (metadata.scopes_supported || ["mcp"]).join(" "));
  const link = authUrl.toString();
  // eslint-disable-next-line no-console
  console.error(`\nOpen this URL in your browser to sign in to Swiggy (${opts.server}):\n  ${link}\n`);
  if (opts.open) {
    try {
      await opts.open(link);
    } catch {
      // ignore
    }
  }

  const code = await codePromise;

  // Exchange code for tokens
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: client.client_id,
    code_verifier: verifier,
  });
  if (client.client_secret) body.set("client_secret", client.client_secret);

  const tokRes = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  if (!tokRes.ok) {
    throw new CliError("AUTH_FAILED", `Token exchange failed: ${tokRes.status} ${tokRes.statusText}`);
  }
  const tok = (await tokRes.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
  };

  const auth = await loadAuth();
  auth.servers[opts.server] = {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    tokenType: tok.token_type || "Bearer",
    scope: tok.scope,
    expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
    clientId: client.client_id,
    clientSecret: client.client_secret,
    redirectUri,
    authorizationEndpoint: metadata.authorization_endpoint,
    tokenEndpoint: metadata.token_endpoint,
  };
  await saveAuth(auth);
}

async function refreshAccessToken(entry: AuthState["servers"][string]): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
}> {
  if (!entry.tokenEndpoint || !entry.refreshToken || !entry.clientId) {
    throw new CliError("AUTH_FAILED", "Cannot refresh: missing token endpoint, refresh token, or client id.");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: entry.refreshToken,
    client_id: entry.clientId,
  });
  if (entry.clientSecret) body.set("client_secret", entry.clientSecret);
  const res = await fetch(entry.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  if (!res.ok) throw new CliError("AUTH_FAILED", `Refresh failed: ${res.status}`);
  const tok = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  return {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token || entry.refreshToken,
    expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
    tokenType: tok.token_type || entry.tokenType,
  };
}
