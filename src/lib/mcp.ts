import { randomUUID } from "node:crypto";
import { CliError, McpProtocolError, NetworkError } from "./errors.js";
import { getAccessToken, requireAccessToken } from "./auth.js";
import { endpointFor } from "./config.js";
import type { McpTool, McpToolResult, ProfileConfig, ServerName } from "../types/index.js";

/**
 * Minimal Streamable-HTTP MCP client.
 *
 * Per the MCP spec, a Streamable-HTTP server accepts JSON-RPC POSTs at a single endpoint
 * and returns either a JSON response or an SSE stream. This client supports both shapes.
 * It reuses a session id (Mcp-Session-Id) header across requests and performs the
 * `initialize` handshake on first use.
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

const PROTOCOL_VERSION = "2025-06-18";
const sessionStore = new Map<string, string>(); // server -> session id

interface ClientOpts {
  server: ServerName;
  profile: ProfileConfig;
  raw?: boolean;
}

export class McpClient {
  readonly server: ServerName;
  readonly url: string;
  private sessionId?: string;
  private initialized = false;

  constructor(opts: ClientOpts) {
    this.server = opts.server;
    this.url = endpointFor(opts.server, opts.profile);
    this.sessionId = sessionStore.get(opts.server);
  }

  private async post<T = unknown>(method: string, params: unknown, requireAuth = true): Promise<T> {
    const id = randomUUID();
    const body: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": PROTOCOL_VERSION,
    };
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;

    if (requireAuth) {
      const token = await getAccessToken(this.server);
      if (token) headers.authorization = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await fetch(this.url, { method: "POST", headers, body: JSON.stringify(body) });
    } catch (err) {
      throw new NetworkError(`Failed to reach ${this.url}: ${(err as Error).message}`);
    }

    const respSession = res.headers.get("mcp-session-id");
    if (respSession) {
      this.sessionId = respSession;
      sessionStore.set(this.server, respSession);
    }

    if (res.status === 401 || res.status === 403) {
      // Force a re-auth for the caller
      await requireAccessToken(this.server);
      throw new CliError("AUTH_REQUIRED", `Authentication rejected by ${this.server}.`, {
        hint: `Re-run: swiggy auth init --server ${this.server}`,
      });
    }

    const ctype = res.headers.get("content-type") || "";
    let payload: JsonRpcResponse<T> | undefined;

    if (ctype.includes("text/event-stream")) {
      payload = await readSseFrame<T>(res);
    } else {
      const text = await res.text();
      if (!text) {
        if (!res.ok) throw new NetworkError(`HTTP ${res.status} from ${this.url}`);
        return undefined as T;
      }
      try {
        payload = JSON.parse(text) as JsonRpcResponse<T>;
      } catch {
        throw new McpProtocolError(`Invalid JSON-RPC response`, { text });
      }
    }

    if (!payload) throw new McpProtocolError("Empty response from server.");
    if (payload.error) {
      throw new McpProtocolError(payload.error.message, payload.error);
    }
    return payload.result as T;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.post(
      "initialize",
      {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        clientInfo: { name: "swiggy-cli", version: "0.1.0" },
      },
      false
    );
    // Some servers require initialized notification (no id, no response)
    try {
      await this.notify("notifications/initialized", {});
    } catch {
      /* non-fatal */
    }
    this.initialized = true;
  }

  private async notify(method: string, params: unknown): Promise<void> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": PROTOCOL_VERSION,
    };
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;
    const token = await getAccessToken(this.server);
    if (token) headers.authorization = `Bearer ${token}`;
    await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", method, params }),
    }).catch(() => undefined);
  }

  async listTools(): Promise<McpTool[]> {
    await this.initialize();
    const res = await this.post<{ tools: McpTool[] }>("tools/list", {});
    return res.tools || [];
  }

  async getToolSchema(name: string): Promise<McpTool | undefined> {
    const tools = await this.listTools();
    return tools.find((t) => t.name === name);
  }

  async callTool(name: string, args: unknown): Promise<McpToolResult> {
    await this.initialize();
    return this.post<McpToolResult>("tools/call", { name, arguments: args ?? {} });
  }
}

async function readSseFrame<T>(res: Response): Promise<JsonRpcResponse<T> | undefined> {
  if (!res.body) return undefined;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() ?? "";
      for (const evt of events) {
        const dataLines = evt
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart());
        if (dataLines.length === 0) continue;
        const data = dataLines.join("\n");
        try {
          const parsed = JSON.parse(data) as JsonRpcResponse<T>;
          if ("id" in parsed) return parsed;
        } catch {
          // skip
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

/**
 * Helper: extract a useful payload from an MCP tool result.
 * Servers return either `structuredContent` or a content array of text/json blocks.
 */
export function extractToolPayload(result: McpToolResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  if (Array.isArray(result.content)) {
    const texts = result.content
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string);
    if (texts.length === 1) {
      try {
        return JSON.parse(texts[0]!);
      } catch {
        return texts[0];
      }
    }
    if (texts.length > 1) return texts;
  }
  return result;
}
