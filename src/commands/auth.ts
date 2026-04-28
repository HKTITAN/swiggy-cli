import { Command } from "commander";
import { attachOutputOptions, readGlobalOpts } from "./common.js";
import { renderError, renderResult, startSpinner } from "../lib/output.js";
import { interactiveAuthLoginV2, loadAuth, clearAuth } from "../lib/auth.js";
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
            const { profile } = await getCurrentProfile();
            for (const s of targets) {
              const sp = startSpinner(`Starting OAuth for ${s}…`, opts);
              try {
                await interactiveAuthLoginV2({
                  server: s,
                  serverUrl: endpointFor(s, profile),
                  clientId: o.clientId,
                  clientSecret: o.clientSecret,
                  redirectHost: o.redirectHost,
                  port: o.port ? Number(o.port) : undefined,
                  open: tryOpen,
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
            return {
              server: s,
              authenticated: Boolean(e?.accessToken),
              expiresAt: e?.expiresAt ? new Date(e.expiresAt).toISOString() : null,
              hasRefresh: Boolean(e?.refreshToken),
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

async function tryOpen(url: string): Promise<void> {
  // Best-effort: do not fail if `open` is not available (no extra dep).
  const platform = process.platform;
  const { spawn } = await import("node:child_process");
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

function assertServer(s: string): ServerName {
  if (!SERVER_NAMES.includes(s as ServerName)) {
    throw new UsageError(`Unknown server "${s}". Valid: ${SERVER_NAMES.join(", ")}`);
  }
  return s as ServerName;
}
