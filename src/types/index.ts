export type ServerName = "food" | "instamart" | "dineout";

export const SERVER_NAMES: ServerName[] = ["food", "instamart", "dineout"];

export interface ServerEndpoint {
  name: ServerName;
  url: string;
}

/** Extra, optional metadata the CLI attaches to a success envelope. */
export interface EnvelopeMeta {
  profile?: string;
  /** Human-readable message the Swiggy tool returned alongside `data`. */
  message?: string;
  /** Parsed `X-RateLimit-*` headers from the last MCP response, when present. */
  rateLimit?: { limit?: number; remaining?: number; reset?: number };
  /** `_meta.swiggy.deprecation` from the tool result, when emitted upstream. */
  deprecation?: unknown;
  /** Payment orchestration summary (only for `--pay` / `--wait` flows). */
  payment?: unknown;
  [k: string]: unknown;
}

export interface JsonEnvelope<T = unknown> {
  ok: true;
  server?: string;
  tool?: string;
  data: T;
  meta?: EnvelopeMeta;
}

export interface JsonErrorEnvelope {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    hint?: string;
  };
}

export type CliEnvelope<T = unknown> = JsonEnvelope<T> | JsonErrorEnvelope;

export interface OutputOptions {
  json?: boolean;
  plain?: boolean;
  raw?: boolean;
  quiet?: boolean;
  noInteractive?: boolean;
  /** commander stores `--no-interactive` as `interactive: false`; both are honoured. */
  interactive?: boolean;
  yes?: boolean;
  profile?: string;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpToolResult {
  content?: Array<{ type: string; text?: string; [k: string]: unknown }>;
  structuredContent?: unknown;
  isError?: boolean;
  _meta?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface AuthEntry {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  obtainedAt?: number;
  tokenType?: string;
  scope?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  issuer?: string;
}

export interface AuthState {
  servers: Record<string, AuthEntry>;
}

export interface ProfileConfig {
  defaultServer?: ServerName;
  defaultCity?: string;
  /** Saved Swiggy address id used when a command needs `addressId` and none is passed. */
  defaultAddressId?: string;
  /** Default coordinates for Dineout commands (`latitude` / `longitude`). */
  defaultLat?: number;
  defaultLng?: number;
  output?: "human" | "json" | "plain";
  endpoints?: Partial<Record<ServerName, string>>;
}

export interface RootConfig {
  currentProfile: string;
  profiles: Record<string, ProfileConfig>;
}
