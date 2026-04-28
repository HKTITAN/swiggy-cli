export type ServerName = "food" | "instamart" | "dineout";

export const SERVER_NAMES: ServerName[] = ["food", "instamart", "dineout"];

export interface ServerEndpoint {
  name: ServerName;
  url: string;
}

export interface JsonEnvelope<T = unknown> {
  ok: true;
  server?: string;
  tool?: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface JsonErrorEnvelope {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type CliEnvelope<T = unknown> = JsonEnvelope<T> | JsonErrorEnvelope;

export interface OutputOptions {
  json?: boolean;
  plain?: boolean;
  raw?: boolean;
  quiet?: boolean;
  noInteractive?: boolean;
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
  [k: string]: unknown;
}

export interface AuthState {
  servers: Record<
    string,
    {
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: number;
      tokenType?: string;
      scope?: string;
      clientId?: string;
      clientSecret?: string;
      redirectUri?: string;
      authorizationEndpoint?: string;
      tokenEndpoint?: string;
    }
  >;
}

export interface ProfileConfig {
  defaultServer?: ServerName;
  defaultCity?: string;
  output?: "human" | "json" | "plain";
  endpoints?: Partial<Record<ServerName, string>>;
}

export interface RootConfig {
  currentProfile: string;
  profiles: Record<string, ProfileConfig>;
}
