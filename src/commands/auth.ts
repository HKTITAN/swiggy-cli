import { Command } from "commander";
import { attachOutputOptions, readGlobalOpts } from "./common.js";
import { renderError, renderResult, startSpinner } from "../lib/output.js";
import { interactiveAuthLoginV2, loadAuth, clearAuth, evaluateAuthHealth, extractTokenClaims } from "../lib/auth.js";
import { SERVER_NAMES, type ServerName } from "../types/index.js";
import { getCurrentProfile, endpointFor } from "../lib/config.js";
import { PATHS } from "../lib/paths.js";
import { UsageError } from "../lib/errors.js";

export function buildAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Manage authentication for Swiggy MCP servers");

  attachOutputOptions(
    auth
      .command("init")
      .description("Authenticate via OAuth (browser flow). Repeats per server.")
      .option("--server <name>", `server: ${SERVER_NAMES.join("|")} (default: all)`)
      .option(
        "--client-id <id>",
        "OAuth client_id (overrides SWIGGY_OAUTH_CLIENT_ID). Optional when dynamic registration is available."
      )
      .option(
        "--client-secret <secret>",
        "OAuth client_secret for confidential clients (overrides SWIGGY_OAUTH_CLIENT_SECRET). Omit for public PKCE clients."
      )
      .option(
        "--redirect-host <host>",
        "loopback host for redirect URI: 127.0.0.1 (default) or localhost — both are whitelisted by Swiggy",
        "127.0.0.1"
      )
      .option("--port <port>", "fixed port for the redirect listener (default: ephemeral)")
      .action(
        async (o: {
          server?: string;
          clientId?: string;
          clientSecret?: string;
          redirectHost?: "127.0.0.1" | "localhost";
          port?: string;
        }) => {
          const opts = readGlobalOpts(auth);
          try {
            const targets = o.server ? [assertServer(o.server)] : SERVER_NAMES;
            const { profile } = await getCurrentProfile(opts.profile);
            const parsedPort = parsePort(o.port);
            for (const s of targets) {
              const sp = startSpinner(`Starting OAuth for ${s}…`, opts);
              try {
                await interactiveAuthLoginV2({
                  server: s,
                  serverUrl: endpointFor(s, profile),
                  clientId: o.clientId,
                  clientSecret: o.clientSecret,
                  redirectHost: o.redirectHost,
                  port: parsedPort,
                });
              } finally {
                sp?.stop();
              }
            }
            renderResult({ authenticated: targets }, { ...opts, server: o.server });
          } catch (err) {
            process.exitCode = renderError(err, opts);
          }
        }
      )
  );

  attachOutputOptions(
    auth
      .command("status")
      .description("Show authentication status for all servers and token health")
      .action(async () => {
        const opts = readGlobalOpts(auth);
        try {
          const state = await loadAuth();
          const data = SERVER_NAMES.map((s) => {
            const e = state.servers[s];
            const health = evaluateAuthHealth(e);
            return {
              server: s,
              authenticated: health.authenticated,
              reason: health.reason,
              expiresAt: health.expiresAt ? new Date(health.expiresAt).toISOString() : null,
              hasRefresh: health.hasRefresh,
            };
          });
          renderResult({ authFile: PATHS.authFile, servers: data }, opts);
        } catch (err) {
          process.exitCode = renderError(err, opts);
        }
      })
  );

  attachOutputOptions(
    auth
      .command("whoami")
      .description("Show signed-in identity details inferred from stored token claims")
      .option("--server <name>", `server: ${SERVER_NAMES.join("|")} (default: all)`)
      .action(async (o: { server?: string }) => {
        const opts = readGlobalOpts(auth);
        try {
          const targets = o.server ? [assertServer(o.server)] : SERVER_NAMES;
          const state = await loadAuth();
          const data = targets.map((s) => {
            const entry = state.servers[s];
            const claims = extractTokenClaims(entry?.accessToken);
            const health = evaluateAuthHealth(entry);
            return {
              server: s,
              authenticated: health.authenticated,
              reason: health.reason,
              subject: typeof claims?.sub === "string" ? claims.sub : null,
              issuer: typeof claims?.iss === "string" ? claims.iss : null,
              issuedAt: typeof claims?.iat === "number" ? new Date(claims.iat * 1000).toISOString() : null,
              expiresAt:
                typeof claims?.exp === "number"
                  ? new Date(claims.exp * 1000).toISOString()
                  : health.expiresAt
                    ? new Date(health.expiresAt).toISOString()
                    : null,
            };
          });
          renderResult({ authFile: PATHS.authFile, servers: data }, opts);
        } catch (err) {
          process.exitCode = renderError(err, opts);
        }
      })
  );

  attachOutputOptions(
    auth
      .command("logout")
      .description("Clear stored credentials (all servers by default)")
      .option("--server <name>", "log out of one server only")
      .action(async (o: { server?: string }) => {
        const opts = readGlobalOpts(auth);
        try {
          const target = o.server ? assertServer(o.server) : undefined;
          await clearAuth(target);
          renderResult({ cleared: target ?? "all" }, opts);
        } catch (err) {
          process.exitCode = renderError(err, opts);
        }
      })
  );
}

function assertServer(s: string): ServerName {
  if (!SERVER_NAMES.includes(s as ServerName)) {
    throw new UsageError(`Unknown server "${s}". Valid: ${SERVER_NAMES.join(", ")}`);
  }
  return s as ServerName;
}

function parsePort(port?: string): number | undefined {
  if (!port) return undefined;
  const parsed = Number(port);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new UsageError(`Invalid --port "${port}". Expected an integer between 1 and 65535.`);
  }
  return parsed;
}
