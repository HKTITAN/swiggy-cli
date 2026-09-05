import { Command } from "commander";
import { attachOutputOptions, type ExecOpts, readGlobalOpts, run } from "./common.js";
import { dim, note, ok, renderResult } from "../lib/output.js";
import { interactiveAuthLogin, loadAuth, clearAuth, evaluateAuthHealth, extractTokenClaims } from "../lib/auth.js";
import { SERVER_NAMES, type ServerName } from "../types/index.js";
import { getCurrentProfile, endpointFor } from "../lib/config.js";
import { PATHS } from "../lib/paths.js";
import { UsageError } from "../lib/errors.js";
import { loadTable } from "../lib/lazy.js";
import { normalizeServer } from "./generic.js";

export function buildAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Sign in to Swiggy (OAuth 2.1 + PKCE). One login covers all three servers.");

  attachOutputOptions(
    auth
      .command("init")
      .alias("login")
      .description("Sign in via the browser (phone + OTP). Stores one token for food, instamart and dineout.")
      .option("--server <name>", `store the token for one server only: ${SERVER_NAMES.join("|")}`)
      .option("--client-id <id>", "OAuth client_id (overrides SWIGGY_OAUTH_CLIENT_ID). Not needed: Swiggy supports dynamic registration.")
      .option("--client-secret <secret>", "OAuth client_secret for confidential clients (overrides SWIGGY_OAUTH_CLIENT_SECRET)")
      .option("--redirect-host <host>", "loopback host for the redirect URI: 127.0.0.1 (default) or localhost", "127.0.0.1")
      .option("--port <port>", "fixed port for the redirect listener (default: ephemeral)")
      .option("--no-browser", "print the sign-in URL instead of opening a browser")
      .option("--timeout <seconds>", "how long to wait for the browser callback", "300")
      .action(
        async (o: { server?: string; clientId?: string; clientSecret?: string; redirectHost?: "127.0.0.1" | "localhost"; port?: string; browser?: boolean; timeout?: string }) => {
          const opts = readGlobalOpts(auth);
          await run(opts, async () => {
            const targets = o.server ? [assertServer(normalizeServer(o.server))] : SERVER_NAMES;
            const { profile } = await getCurrentProfile(opts.profile);
            if (o.redirectHost && o.redirectHost !== "127.0.0.1" && o.redirectHost !== "localhost") throw new UsageError("--redirect-host must be 127.0.0.1 or localhost.");
            const result = await interactiveAuthLogin({
              servers: targets,
              serverUrl: endpointFor(targets[0]!, profile),
              clientId: o.clientId,
              clientSecret: o.clientSecret,
              redirectHost: o.redirectHost,
              port: parsePort(o.port),
              openBrowser: o.browser !== false,
              timeoutMs: Math.max(10, Number(o.timeout) || 300) * 1000,
              log: (line) => note(line, opts),
            });
            note(ok(`✓ signed in — token stored for ${targets.join(", ")} at ${PATHS.authFile}`, opts), opts);
            renderResult(
              { authenticated: targets, expiresAt: result.expiresAt ? new Date(result.expiresAt).toISOString() : null, scope: result.scope ?? null, issuer: result.issuer ?? null },
              { ...opts, tool: "auth.init" },
              () => undefined
            );
          });
        }
      )
  );

  attachOutputOptions(
    auth
      .command("status")
      .description("Token presence and expiry per server")
      .action(async () => {
        const opts = readGlobalOpts(auth);
        await run(opts, async () => {
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
          renderResult({ authFile: PATHS.authFile, servers: data }, { ...opts, tool: "auth.status" }, renderAuthSummary as never);
        });
      })
  );

  attachOutputOptions(
    auth
      .command("whoami")
      .description("Identity details inferred from the stored token claims")
      .option("--server <name>", `server: ${SERVER_NAMES.join("|")} (default: all)`)
      .action(async (o: { server?: string }) => {
        await runWhoami(readGlobalOpts(auth), o.server);
      })
  );

  attachOutputOptions(
    auth
      .command("logout")
      .description("Clear stored credentials (all servers by default)")
      .option("--server <name>", "log out of one server only")
      .action(async (o: { server?: string }) => {
        const opts = readGlobalOpts(auth);
        await run(opts, async () => {
          const target = o.server ? assertServer(normalizeServer(o.server)) : undefined;
          await clearAuth(target);
          renderResult({ cleared: target ?? "all" }, { ...opts, tool: "auth.logout" });
        });
      })
  );
}

function assertServer(s: string): ServerName {
  if (!SERVER_NAMES.includes(s as ServerName)) {
    throw new UsageError(`Unknown server "${s}". Valid: ${SERVER_NAMES.join(", ")}`, "Run: swiggy servers");
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

export async function runWhoami(opts: ExecOpts, server?: string): Promise<void> {
  await run(opts, async () => {
    const targets = server ? [assertServer(normalizeServer(server))] : SERVER_NAMES;
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
        issuer: typeof claims?.iss === "string" ? claims.iss : (entry?.issuer ?? null),
        issuedAt: typeof claims?.iat === "number" ? new Date(claims.iat * 1000).toISOString() : entry?.obtainedAt ? new Date(entry.obtainedAt).toISOString() : null,
        expiresAt:
          typeof claims?.exp === "number" ? new Date(claims.exp * 1000).toISOString() : health.expiresAt ? new Date(health.expiresAt).toISOString() : null,
      };
    });
    renderResult({ authFile: PATHS.authFile, servers: data }, { ...opts, tool: "auth.whoami" }, renderAuthSummary as never);
  });
}

function renderAuthSummary(
  data: {
    authFile: string;
    servers: Array<{ server: string; authenticated: boolean; reason: string; subject?: string | null; issuer?: string | null; expiresAt?: string | null }>;
  },
  ctx: ExecOpts
): void {
  const Table = loadTable();
  process.stdout.write(`${dim(`auth store: ${data.authFile}`, ctx)}\n`);
  const table = new Table({ head: ["server", "signed in", "status", "expires"], style: { head: [], border: [] }, wordWrap: true });
  for (const row of data.servers) table.push([row.server, row.authenticated ? ok("yes", ctx) : "no", row.reason ?? "—", row.expiresAt ?? "—"]);
  process.stdout.write(`${table.toString()}\n`);
  if (!data.servers.some((r) => r.authenticated)) process.stdout.write(`${dim("run: swiggy auth init", ctx)}\n`);
}
