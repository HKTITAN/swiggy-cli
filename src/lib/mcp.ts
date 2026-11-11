import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { CliError, McpProtocolError, NetworkError, RateLimitError, AuthRequiredError } from "./errors.js";
import { forceRefresh, getAccessToken, getAuthLookupState } from "./auth.js";
import { endpointFor } from "./config.js";
import { PATHS } from "./paths.js";
import { USER_AGENT, VERSION } from "./version.js";
import type { McpTool, McpToolResult, ProfileConfig, ServerName } from "../types/index.js";

/**
 * The Swiggy API client. Swiggy's public API is JSON-RPC 2.0 over HTTPS (the Model Context Protocol
 * "Streamable HTTP" transport): one POST per call to mcp.swiggy.com/{food,im,dineout,scenes} with a
 * Bearer token. This file speaks it directly with fetch; there is no SDK and no child process.
 *
 * - Accepts JSON or SSE responses.
 * - Handshake once, not per call. Swiggy asks clients never to `initialize` per tool invocation
 *   (each one is an auth event). A one-shot CLI process cannot hold a connection open, so the
 *   handshake is recorded per server in ~/.swiggy/cache/sessions.json (with the `Mcp-Session-Id`
 *   when the server issues one; Swiggy's transport is documented as stateless and may not) and
 *   later invocations go straight to the call. The record is tied to the token and expires after
 *   HANDSHAKE_TTL_MS. If the server rejects a call made on a remembered handshake (404, 400, or a
 *   "not initialized" JSON-RPC error) the CLI handshakes once and retries; such a rejection means
 *   the call did not run, so the retry is safe even for order placement.
 * - HTTP 401 with a token → refresh the token once and retry, then AUTH_FAILED. 419 / JSON-RPC
 *   -32001 → AUTH_REQUIRED. 429 → RATE_LIMITED with Retry-After. Swiggy sends no X-RateLimit-*
 *   headers, so there is no remaining-quota figure to report.
 */

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export const PROTOCOL_VERSION = "2025-06-18";

/** How long a remembered handshake is trusted before the CLI handshakes again. */
const HANDSHAKE_TTL_MS = 12 * 60 * 60 * 1000;

interface Handshake {
  /** Present only when the server issued an `Mcp-Session-Id`. */
  sessionId?: string;
  url: string;
  savedAt: number;
  /** Fingerprint of the token the handshake was made with (never the token itself). */
  token?: string;
}

interface SessionCache {
  [server: string]: Handshake;
}

const memorySessions = new Map<string, Handshake>();

function fingerprint(token: string | undefined): string | undefined {
  return token ? createHash("sha256").update(token).digest("hex").slice(0, 16) : undefined;
}

async function loadSessions(): Promise<SessionCache> {
  if (!existsSync(PATHS.sessionFile)) return {};
  try {
    return JSON.parse(await readFile(PATHS.sessionFile, "utf8")) as SessionCache;
  } catch {
    return {};
  }
}

async function saveSession(server: string, handshake: Handshake | undefined): Promise<void> {
  try {
    const all = await loadSessions();
    if (handshake) all[server] = handshake;
    else delete all[server];
    await mkdir(dirname(PATHS.sessionFile), { recursive: true });
    await writeFile(PATHS.sessionFile, JSON.stringify(all, null, 2), { mode: 0o600 });
  } catch {
    /* cache is best-effort */
  }
}

interface ClientOpts {
  server: ServerName;
  profile: ProfileConfig;
  /** Disable the on-disk session cache (tests). */
  noSessionCache?: boolean;
}

export class McpClient {
  readonly server: ServerName;
  readonly url: string;
  private sessionId?: string;
  private initialized = false;
  /** True while running on a handshake this process did not perform itself. */
  private remembered = false;
  private sessionLoaded = false;
  private readonly noSessionCache: boolean;

  constructor(opts: ClientOpts) {
    this.server = opts.server;
    this.url = endpointFor(opts.server, opts.profile);
    this.noSessionCache = Boolean(opts.noSessionCache);
    // A handshake already in memory means this process completed it (the app and the shell).
    const live = memorySessions.get(opts.server);
    if (live && live.url === this.url) {
      this.sessionId = live.sessionId;
      this.initialized = true;
      this.remembered = true;
    }
  }

  private async restoreSession(): Promise<void> {
    if (this.sessionLoaded) return;
    this.sessionLoaded = true;
    if (this.initialized || this.noSessionCache) return;
    const cached = (await loadSessions())[this.server];
    if (!cached || cached.url !== this.url) return;
    if (Date.now() - cached.savedAt > HANDSHAKE_TTL_MS) return;
    // A handshake made with another token (re-login, another account) is not ours to reuse.
    if (cached.token && cached.token !== fingerprint(await getAccessToken(this.server))) return;
    this.sessionId = cached.sessionId;
    this.initialized = true;
    this.remembered = true;
    memorySessions.set(this.server, cached);
  }

  private async rememberHandshake(token: string | undefined): Promise<void> {
    const handshake: Handshake = { sessionId: this.sessionId, url: this.url, savedAt: Date.now(), token: fingerprint(token) };
    memorySessions.set(this.server, handshake);
    if (!this.noSessionCache) await saveSession(this.server, handshake);
  }

  private async headers(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": PROTOCOL_VERSION,
      "user-agent": USER_AGENT,
    };
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;
    const token = await getAccessToken(this.server);
    if (token) headers.authorization = `Bearer ${token}`;
    return headers;
  }

  /** Handshake again after the server rejected a remembered one, then replay the call once. */
  private async rehandshake<T>(method: string, params: unknown): Promise<T> {
    await this.dropSession();
    await this.initialize();
    return this.post<T>(method, params, false);
  }

  private async post<T = unknown>(method: string, params: unknown, retryOnSessionLoss = true, retryOnAuth = true): Promise<T> {
    const id = randomUUID();
    const body: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
    const headers = await this.headers();

    let res: Response;
    try {
      res = await fetch(this.url, { method: "POST", headers, body: JSON.stringify(body) });
    } catch (err) {
      throw new NetworkError(`Failed to reach ${this.url}: ${(err as Error).message}`);
    }
    const respSession = res.headers.get("mcp-session-id");
    if (respSession && respSession !== this.sessionId) this.sessionId = respSession;

    if (res.status === 401 || res.status === 403 || res.status === 419) {
      const hadToken = Boolean(headers.authorization);
      // A 401 means the call did not run. Swiggy's guidance: refresh first, re-authorize only if that fails.
      if (res.status === 401 && hadToken && retryOnAuth && (await forceRefresh(this.server))) {
        await res.body?.cancel().catch(() => undefined);
        await this.dropSession();
        if (method !== "initialize") await this.initialize();
        return this.post<T>(method, params, false, false);
      }
      await this.dropSession();
      if (res.status === 419) throw new AuthRequiredError(this.server, `Swiggy session was revoked (HTTP 419) for "${this.server}".`);
      if (!hadToken) {
        const authState = await getAuthLookupState(this.server);
        throw new CliError("AUTH_REQUIRED", `Authentication required for server "${this.server}".`, {
          details: authState,
          hint: `Run: swiggy auth init  (auth store: ${authState.authFile}). One login covers all four servers.`,
        });
      }
      throw new CliError("AUTH_FAILED", `Stored credentials were rejected by ${this.server} (HTTP ${res.status}).`, {
        hint: res.status === 403 ? "The token lacks a scope this call needs. Run: swiggy auth init" : "Run: swiggy auth init  (the token could not be refreshed; sessions can be revoked before they expire)",
      });
    }

    if (res.status === 429) {
      const ra = res.headers.get("retry-after");
      const seconds = ra ? Number(ra) : undefined;
      let details: unknown;
      try {
        details = JSON.parse(await res.text());
      } catch {
        /* ignore */
      }
      throw new RateLimitError(this.server, Number.isFinite(seconds) ? seconds : undefined, details);
    }

    // 404 with a session id: the session expired. 400/404 on a handshake this process only
    // remembered: the server wants a fresh one. Either way the call did not run.
    const sessionGone = res.status === 404 && Boolean(headers["mcp-session-id"]);
    const handshakeRejected = (res.status === 400 || res.status === 404) && this.remembered;
    if ((sessionGone || handshakeRejected) && retryOnSessionLoss && method !== "initialize") {
      await res.body?.cancel().catch(() => undefined);
      return this.rehandshake<T>(method, params);
    }

    const ctype = res.headers.get("content-type") || "";
    let payload: JsonRpcResponse<T> | undefined;

    if (ctype.includes("text/event-stream")) {
      payload = await readSseFrame<T>(res, id);
    } else {
      const text = await res.text();
      if (!text) {
        if (!res.ok) throw new NetworkError(`HTTP ${res.status} from ${this.url}`);
        return undefined as T;
      }
      try {
        payload = JSON.parse(text) as JsonRpcResponse<T>;
      } catch {
        if (!res.ok) throw new NetworkError(`HTTP ${res.status} from ${this.url}`, { text: text.slice(0, 500) });
        throw new McpProtocolError(`Invalid JSON-RPC response`, { text: text.slice(0, 500) });
      }
    }

    if (!payload) {
      if (!res.ok) throw new NetworkError(`HTTP ${res.status} from ${this.url}`);
      throw new McpProtocolError("Empty response from server.");
    }
    if (payload.error) {
      if (payload.error.code === -32001) {
        await this.dropSession();
        throw new AuthRequiredError(this.server, `Swiggy rejected the session (${payload.error.message}).`);
      }
      if (this.remembered && retryOnSessionLoss && method !== "initialize" && /not (been )?initiali[sz]ed|initiali[sz]e first|session (not found|expired|invalid)/i.test(payload.error.message ?? "")) {
        return this.rehandshake<T>(method, params);
      }
      throw new McpProtocolError(payload.error.message, payload.error);
    }
    return payload.result as T;
  }

  private async dropSession(): Promise<void> {
    this.sessionId = undefined;
    this.initialized = false;
    this.remembered = false;
    memorySessions.delete(this.server);
    if (!this.noSessionCache) await saveSession(this.server, undefined);
  }

  async initialize(): Promise<void> {
    await this.restoreSession();
    if (this.initialized) return;
    await this.post(
      "initialize",
      {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        clientInfo: { name: "swiggy-cli", version: VERSION },
      },
      false
    );
    await this.notify("notifications/initialized", {});
    this.initialized = true;
    this.remembered = false;
    await this.rememberHandshake(await getAccessToken(this.server));
  }

  private async notify(method: string, params: unknown): Promise<void> {
    const headers = await this.headers();
    await fetch(this.url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", method, params }) })
      .then((r) => r.body?.cancel())
      .catch(() => undefined);
  }

  async listTools(): Promise<McpTool[]> {
    await this.initialize();
    const res = await this.post<{ tools: McpTool[] }>("tools/list", {});
    return res?.tools || [];
  }

  async getToolSchema(name: string): Promise<McpTool | undefined> {
    const tools = await this.listTools();
    return tools.find((t) => t.name === name);
  }

  async callTool(name: string, args: unknown): Promise<McpToolResult> {
    await this.initialize();
    const result = await this.post<McpToolResult>("tools/call", { name, arguments: args ?? {} });
    if (!result || typeof result !== "object") throw new McpProtocolError("Tool call returned no result.", { name });
    return result;
  }
}

async function readSseFrame<T>(res: Response, wantId?: string): Promise<JsonRpcResponse<T> | undefined> {
  if (!res.body) return undefined;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split(/\r?\n\r?\n/);
      buf = events.pop() ?? "";
      for (const evt of events) {
        const parsed = parseSseEvent<T>(evt);
        if (parsed && (wantId === undefined || parsed.id === wantId)) return parsed;
      }
    }
    const tail = parseSseEvent<T>(buf);
    if (tail && (wantId === undefined || tail.id === wantId)) return tail;
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

export function parseSseEvent<T>(evt: string): JsonRpcResponse<T> | undefined {
  const dataLines = evt
    .split(/\r?\n/)
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trimStart());
  if (dataLines.length === 0) return undefined;
  try {
    const parsed = JSON.parse(dataLines.join("\n")) as JsonRpcResponse<T>;
    return parsed && typeof parsed === "object" && "id" in parsed ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract the machine-readable payload from a tool result, the way Swiggy documents it
 * (https://mcp.swiggy.com/builders/docs/build/read-tool-results/):
 *
 *   1. `structuredContent` when it is present AND non-empty (always on Food and Instamart).
 *   2. Otherwise the JSON envelope in the `content` text blocks. Dineout and Scenes can omit
 *      `structuredContent` or send it empty, and their `content` then carries `{ success, data, … }`.
 *   3. Prose in `content` is a summary for a model to relay; it is returned as-is only when there
 *      is nothing machine-readable at all.
 */
export function extractToolPayload(result: McpToolResult): unknown {
  const structured = result.structuredContent;
  if (!isEmptyPayload(structured)) return structured;
  const fromContent = payloadFromContent(result);
  if (fromContent !== undefined) return fromContent;
  return structured !== undefined && structured !== null ? structured : result;
}

function isEmptyPayload(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  return typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0;
}

function payloadFromContent(result: McpToolResult): unknown {
  if (Array.isArray(result.content)) {
    const texts = result.content.filter((c) => c.type === "text" && typeof c.text === "string").map((c) => c.text as string);
    if (texts.length === 1) {
      try {
        return JSON.parse(texts[0]!);
      } catch {
        return texts[0];
      }
    }
    if (texts.length > 1) {
      const parsed = texts.map((t) => {
        try {
          return JSON.parse(t) as unknown;
        } catch {
          return t;
        }
      });
      // Swiggy sometimes returns a JSON envelope plus a trailing prose/markdown block.
      const envelopes = parsed.filter((p) => isSwiggyEnvelope(p));
      if (envelopes.length === 1) return envelopes[0];
      return parsed;
    }
  }
  return undefined;
}

/**
 * Location context a tool echoes NEXT TO `data`. Scenes (and some Dineout) responses carry the
 * resolved `latitude` / `longitude` only in the `content` blocks: as siblings of `data` in the JSON
 * envelope, or as a "Location context: latitude=…, longitude=…" line. They are not in
 * `structuredContent`, and Swiggy asks clients to reuse them for every follow-up call.
 */
export function extractLocationContext(result: McpToolResult): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const block of result.content ?? []) {
    if (block?.type !== "text" || typeof block.text !== "string") continue;
    try {
      const env = JSON.parse(block.text) as Record<string, unknown>;
      if (env && typeof env === "object" && !Array.isArray(env)) {
        for (const k of ["latitude", "longitude", "eventId", "venueId"]) if (env[k] !== undefined && env[k] !== null && out[k] === undefined) out[k] = env[k];
      }
    } catch {
      const m = /latitude\s*[=:]\s*(-?\d+(?:\.\d+)?)[,\s]+longitude\s*[=:]\s*(-?\d+(?:\.\d+)?)/i.exec(block.text);
      if (m && out.latitude === undefined) {
        out.latitude = Number(m[1]);
        out.longitude = Number(m[2]);
      }
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Data a tool returns only for its chat widget. Observed live on 2026-11-11: Dineout's
 * `get_available_slots` puts just `{ restaurantId, date, message, latitude, longitude }` in
 * `structuredContent` and the actual `slots` / `deals` arrays in the result's `_meta`, with a prose
 * copy in `content`. A terminal has no widget, so the arrays are folded into the payload: any
 * array-valued `_meta` key the payload does not already have.
 */
export function mergeWidgetData(payload: unknown, result: McpToolResult): unknown {
  const meta = result._meta;
  if (!meta || typeof meta !== "object" || !payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const data = payload as Record<string, unknown>;
  let merged: Record<string, unknown> | undefined;
  for (const [k, v] of Object.entries(meta)) {
    if (!Array.isArray(v) || data[k] !== undefined || k.includes("/") || k.includes(".")) continue;
    merged = merged ?? { ...data };
    merged[k] = v;
  }
  return merged ?? payload;
}

/** Every text block of a result, joined: the prose a model would read. */
export function resultText(result: McpToolResult): string {
  return (result.content ?? []).flatMap((b) => (b?.type === "text" && typeof b.text === "string" ? [b.text] : [])).join("\n");
}

/** The server's own error message for a failed call, wherever this server put it. */
export function extractToolErrorMessage(result: McpToolResult): string | undefined {
  const pick = (p: unknown): string | undefined => {
    if (!p || typeof p !== "object") return undefined;
    const r = p as { error?: unknown; message?: unknown };
    if (typeof r.error === "string" && r.error.trim()) return r.error;
    const nested = (r.error as { message?: unknown } | undefined)?.message;
    if (typeof nested === "string" && nested.trim()) return nested;
    return typeof r.message === "string" && r.message.trim() ? r.message : undefined;
  };
  const fromStructured = pick(result.structuredContent);
  if (fromStructured) return fromStructured;
  for (const block of result.content ?? []) {
    if (block?.type !== "text" || typeof block.text !== "string" || !block.text.trim()) continue;
    try {
      const fromJson = pick(JSON.parse(block.text));
      if (fromJson) return fromJson;
    } catch {
      /* a plain message */
    }
    return block.text.trim();
  }
  return undefined;
}

export interface SwiggyEnvelope {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: { message?: string; reportLink?: string; reportHint?: string; [k: string]: unknown };
  [k: string]: unknown;
}

/** True when `v` looks like the uniform `{ success, data | error, message? }` Swiggy tool envelope. */
export function isSwiggyEnvelope(v: unknown): v is SwiggyEnvelope {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v) && typeof (v as SwiggyEnvelope).success === "boolean";
}

export interface UnwrappedPayload {
  data: unknown;
  message?: string;
  /** Present when the tool reported `success: false`. */
  error?: SwiggyEnvelope["error"];
  /** Extra top-level fields Swiggy sometimes adds outside `data` (e.g. Dineout `latitude`/`longitude`). */
  extra?: Record<string, unknown>;
}

/**
 * Unwrap the Swiggy `{ success, data, message }` envelope so `data` in the CLI envelope is the
 * tool's actual payload. Non-envelope payloads pass through unchanged.
 */
export function unwrapSwiggyEnvelope(payload: unknown): UnwrappedPayload {
  if (!isSwiggyEnvelope(payload)) return { data: payload };
  const { success, data, message, error, ...rest } = payload;
  const extra = Object.keys(rest).length ? rest : undefined;
  if (!success) return { data, message, error: error ?? { message: message ?? "Tool reported failure." }, extra };
  return { data: data !== undefined ? data : rest, message, extra: data !== undefined ? extra : undefined };
}

/** `_meta.swiggy.deprecation`. Swiggy does not emit this today (deprecations go out by email and changelog); returns undefined when absent. */
export function extractDeprecation(result: McpToolResult): unknown {
  const meta = result._meta;
  if (!meta || typeof meta !== "object") return undefined;
  const direct = (meta as Record<string, unknown>)["swiggy.deprecation"];
  if (direct) return direct;
  const nested = (meta as Record<string, unknown>).swiggy as Record<string, unknown> | undefined;
  return nested?.deprecation;
}
