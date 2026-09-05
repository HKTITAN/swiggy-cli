import { PATHS } from "./paths.js";

/**
 * Stable, agent-readable error codes.
 *
 * Exit code mapping (see src/cli.ts):
 *   0   success
 *   1   generic / unknown
 *   2   USAGE / invalid arguments
 *   3   AUTH_REQUIRED / AUTH_FAILED
 *   4   NOT_FOUND
 *   5   NETWORK
 *   6   MCP_ERROR (server returned an error, or the tool returned success:false)
 *   7   CONFIRMATION_REQUIRED (non-interactive without --yes)
 *   8   CONFIG_ERROR
 *   9   RATE_LIMITED (HTTP 429 from Swiggy MCP — honour Retry-After)
 *  10   PAYMENT_FAILED (UPI payment failed / cancelled / timed out during --wait)
 */

export type ErrorCode =
  | "USAGE"
  | "AUTH_REQUIRED"
  | "AUTH_FAILED"
  | "NOT_FOUND"
  | "NETWORK"
  | "MCP_ERROR"
  | "CONFIRMATION_REQUIRED"
  | "CONFIG_ERROR"
  | "RATE_LIMITED"
  | "PAYMENT_FAILED"
  | "UNKNOWN";

export const EXIT_CODE: Record<ErrorCode, number> = {
  USAGE: 2,
  AUTH_REQUIRED: 3,
  AUTH_FAILED: 3,
  NOT_FOUND: 4,
  NETWORK: 5,
  MCP_ERROR: 6,
  CONFIRMATION_REQUIRED: 7,
  CONFIG_ERROR: 8,
  RATE_LIMITED: 9,
  PAYMENT_FAILED: 10,
  UNKNOWN: 1,
};

export class CliError extends Error {
  code: ErrorCode;
  details?: unknown;
  hint?: string;

  constructor(code: ErrorCode, message: string, opts: { details?: unknown; hint?: string } = {}) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.details = opts.details;
    this.hint = opts.hint;
  }
}

export class AuthRequiredError extends CliError {
  constructor(server: string, reason?: string) {
    super("AUTH_REQUIRED", reason ?? `Authentication required for server "${server}".`, {
      hint: `Run: swiggy auth init (auth store: ${PATHS.authFile}). One Swiggy login covers food, instamart and dineout.`,
      details: { server },
    });
  }
}

export class McpProtocolError extends CliError {
  constructor(message: string, details?: unknown, hint?: string) {
    super("MCP_ERROR", message, { details, hint });
  }
}

export class NetworkError extends CliError {
  constructor(message: string, details?: unknown) {
    super("NETWORK", message, { details });
  }
}

export class UsageError extends CliError {
  constructor(message: string, hint?: string) {
    super("USAGE", message, { hint });
  }
}

export class ConfirmationRequiredError extends CliError {
  constructor(action: string) {
    super(
      "CONFIRMATION_REQUIRED",
      `"${action}" requires confirmation. Pass --yes to proceed in non-interactive mode.`,
      { hint: "Re-run the command with --yes to acknowledge." }
    );
  }
}

export class RateLimitError extends CliError {
  retryAfterSeconds?: number;
  constructor(server: string, retryAfterSeconds?: number, details?: unknown) {
    super(
      "RATE_LIMITED",
      `Swiggy MCP rate limit hit on "${server}"${retryAfterSeconds ? ` — retry after ${retryAfterSeconds}s` : ""}.`,
      {
        details: { retryAfterSeconds, ...(typeof details === "object" && details ? details : {}) },
        hint:
          "Stop retrying immediately and wait for Retry-After. Quotas: 70 req/min per user per server (30/min for write tools). See https://mcp.swiggy.com/builders/docs/operate/rate-limits/",
      }
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class PaymentFailedError extends CliError {
  constructor(message: string, details?: unknown, hint?: string) {
    super("PAYMENT_FAILED", message, { details, hint });
  }
}
