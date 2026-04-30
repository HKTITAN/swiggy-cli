import { Command } from "commander";
import { attachOutputOptions, readGlobalOpts } from "./common.js";
import { renderError, renderResult, startSpinner } from "../lib/output.js";
import { interactiveAuthLoginV2, loadAuth, clearAuth, evaluateAuthHealth } from "../lib/auth.js";
import { SERVER_NAMES, type ServerName } from "../types/index.js";
import { getCurrentProfile, endpointFor } from "../lib/config.js";
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
        "OAuth client_id (overrides SWIGGY_OAUTH_CLIENT_ID). Required: Swiggy does not support dynamic client registration."
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
      .description("Show authentication status for all servers")
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
          renderResult(data, opts);
        } catch (err) {
          process.exitCode = renderError(err, opts);
        }
      })
  );

  attachOutputOptions(
    auth
      .command("logout")
      .description("Clear stored credentials")
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
