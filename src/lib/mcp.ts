import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { CliError, McpProtocolError, NetworkError, RateLimitError, AuthRequiredError } from "./errors.js";
import { getAccessToken, getAuthLookupState } from "./auth.js";
import { endpointFor } from "./config.js";
import { PATHS } from "./paths.js";
import { USER_AGENT, VERSION } from "./version.js";
import type { McpTool, McpToolResult, ProfileConfig, ServerName } from "../types/index.js";

/**
 * Minimal Streamable-HTTP MCP client for the Swiggy servers.
 *
 * - JSON-RPC 2.0 over POST; accepts JSON or SSE responses.
 * - Performs the `initialize` handshake once and persists the `Mcp-Session-Id` per server in
 *   ~/.swiggy/cache/sessions.json so consecutive CLI invocations reuse one session. Swiggy counts
 *   every initialize as an auth event against the rate limit, so this matters for agents that
 *   call the CLI in a loop. An expired session (HTTP 404) is re-initialized once, transparently.
 * - Maps HTTP 401/419 → AUTH_REQUIRED, 429 → RATE_LIMITED (with Retry-After), JSON-RPC -32001 →
 *   AUTH_REQUIRED, and surfaces `X-RateLimit-*` headers on `lastRateLimit`.
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

export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: number;
}

interface SessionCache {
  [server: string]: { sessionId: string; url: string; savedAt: number };
}

const memorySessions = new Map<string, string>();

async function loadSessions(): Promise<SessionCache> {
  if (!existsSync(PATHS.sessionFile)) return {};
  try {
    return JSON.parse(await readFile(PATHS.sessionFile, "utf8")) as SessionCache;
  } catch {
    return {};
  }
}

async function saveSession(server: string, url: string, sessionId: string | undefined): Promise<void> {
  try {
    const all = await loadSessions();
    if (sessionId) all[server] = { sessionId, url, savedAt: Date.now() };
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
  lastRateLimit?: RateLimitInfo;
  private sessionId?: string;
  private initialized = false;
  private sessionLoaded = false;
  private readonly noSessionCache: boolean;

  constructor(opts: ClientOpts) {
    this.server = opts.server;
    this.url = endpointFor(opts.server, opts.profile);
    this.noSessionCache = Boolean(opts.noSessionCache);
    this.sessionId = memorySessions.get(opts.server);
    // A session id already in memory means this process completed the handshake.
    if (this.sessionId) this.initialized = true;
  }

  private async restoreSession(): Promise<void> {
    if (this.sessionLoaded) return;
    this.sessionLoaded = true;
    if (this.sessionId || this.noSessionCache) return;
    const cached = (await loadSessions())[this.server];
    if (cached && cached.url === this.url) {
      this.sessionId = cached.sessionId;
      this.initialized = true; // a cached session already completed the handshake
      memorySessions.set(this.server, cached.sessionId);
    }
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

  private captureRateLimit(res: Response): void {
    const limit = res.headers.get("x-ratelimit-limit");
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    if (limit || remaining || reset) {
      this.lastRateLimit = {
        limit: limit ? Number(limit) : undefined,
        remaining: remaining ? Number(remaining) : undefined,
        reset: reset ? Number(reset) : undefined,
      };
    }
  }

  private async post<T = unknown>(method: string, params: unknown, retryOnSessionLoss = true): Promise<T> {
    const id = randomUUID();
    const body: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
    const headers = await this.headers();

    let res: Response;
    try {
      res = await fetch(this.url, { method: "POST", headers, body: JSON.stringify(body) });
    } catch (err) {
      throw new NetworkError(`Failed to reach ${this.url}: ${(err as Error).message}`);
    }
    this.captureRateLimit(res);

    const respSession = res.headers.get("mcp-session-id");
    if (respSession && respSession !== this.sessionId) {
      this.sessionId = respSession;
      memorySessions.set(this.server, respSession);
      if (!this.noSessionCache) await saveSession(this.server, this.url, respSession);
    }

    if (res.status === 401 || res.status === 403 || res.status === 419) {
      const hadToken = Boolean(headers.authorization);
      await this.dropSession();
      if (res.status === 419) throw new AuthRequiredError(this.server, `Swiggy session was revoked (HTTP 419) for "${this.server}".`);
      if (!hadToken) {
        const authState = await getAuthLookupState(this.server);
        throw new CliError("AUTH_REQUIRED", `Authentication required for server "${this.server}".`, {
          details: authState,
          hint: `Run: swiggy auth init  (auth store: ${authState.authFile}). One login covers all three servers.`,
        });
      }
      throw new CliError("AUTH_FAILED", `Stored credentials were rejected by ${this.server} (HTTP ${res.status}).`, {
        hint: "Run: swiggy auth init  (tokens last 5 days and may be revoked earlier)",
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

    // Per MCP Streamable HTTP: 404 with a session id means the session expired → re-initialize once.
    if (res.status === 404 && headers["mcp-session-id"] && retryOnSessionLoss) {
      await this.dropSession();
      this.initialized = false;
      await this.initialize();
      return this.post<T>(method, params, false);
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
      throw new McpProtocolError(payload.error.message, payload.error);
    }
    return payload.result as T;
  }

  private async dropSession(): Promise<void> {
    this.sessionId = undefined;
    this.initialized = false;
    memorySessions.delete(this.server);
    if (!this.noSessionCache) await saveSession(this.server, this.url, undefined);
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
 * Extract a useful payload from an MCP tool result.
 * Servers return either `structuredContent` or a content array of text/json blocks.
 */
export function extractToolPayload(result: McpToolResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
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
  return result;
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

/** `_meta.swiggy.deprecation` (planned upstream in v1.1). Returns undefined when absent. */
export function extractDeprecation(result: McpToolResult): unknown {
  const meta = result._meta;
  if (!meta || typeof meta !== "object") return undefined;
  const direct = (meta as Record<string, unknown>)["swiggy.deprecation"];
  if (direct) return direct;
  const nested = (meta as Record<string, unknown>).swiggy as Record<string, unknown> | undefined;
  return nested?.deprecation;
}
