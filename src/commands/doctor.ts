import { Command } from "commander";
import { attachOutputOptions, readGlobalOpts, run } from "./common.js";
import { dim, err, ok, renderResult, startSpinner } from "../lib/output.js";
import { SERVER_NAMES } from "../types/index.js";
import { DOCS, getCurrentProfile, endpointFor } from "../lib/config.js";
import { loadAuth, discoverOAuthMetadata, evaluateAuthHealth } from "../lib/auth.js";
import { McpClient } from "../lib/mcp.js";
import { TOOL_CATALOG } from "../lib/aliases.js";
import { PATHS } from "../lib/paths.js";
import { VERSION, USER_AGENT } from "../lib/version.js";
import { detectColorLevel, supportsProgressBar, terminalContext } from "../lib/term.js";
import { loadTable } from "../lib/lazy.js";

interface Check {
  check: string;
  ok: boolean;
  detail?: string;
  /** Informational only — does not fail the doctor run. */
  soft?: boolean;
}

export function buildDoctorCommand(program: Command): void {
  attachOutputOptions(
    program
      .command("doctor")
      .description("Diagnose runtime, config, auth, connectivity, tool discovery and catalog drift")
      .option("--offline", "skip network checks")
      .action(async (o: { offline?: boolean }) => {
        const opts = readGlobalOpts(program);
        await run(opts, async () => {
          const { profile, name } = await getCurrentProfile(opts.profile);
          const auth = await loadAuth();
          const checks: Check[] = [];
          const major = Number(process.versions.node.split(".")[0]);
          checks.push({ check: "cli.version", ok: true, detail: VERSION });
          checks.push({ check: "node>=20", ok: major >= 20, detail: process.version });
          checks.push({ check: "profile", ok: true, detail: `${name} (${PATHS.configFile})` });
          const ctx = terminalContext();
          checks.push({ check: "terminal", ok: true, soft: true, detail: `${ctx.brand}, color level ${detectColorLevel()}, progress bar ${supportsProgressBar(ctx) ? "yes" : "no"}` });

          const sp = startSpinner("checking Swiggy MCP", opts);
          for (const s of SERVER_NAMES) {
            const url = endpointFor(s, profile);
            checks.push({ check: `${s}.endpoint`, ok: true, detail: url });
            const health = evaluateAuthHealth(auth.servers[s]);
            checks.push({ check: `${s}.auth`, ok: health.authenticated, detail: health.reason, soft: !health.authenticated });
            if (o.offline) continue;
            sp.update(`checking ${s}`);
            try {
              const md = await discoverOAuthMetadata(url);
              checks.push({ check: `${s}.oauth-metadata`, ok: true, detail: `${md.issuer ?? "issuer?"}${md.registration_endpoint ? " · dynamic registration" : ""}` });
            } catch (e) {
              checks.push({ check: `${s}.oauth-metadata`, ok: false, detail: (e as Error).message });
            }
            if (!health.authenticated) {
              checks.push({ check: `${s}.tools/list`, ok: true, soft: true, detail: "skipped (not signed in)" });
              continue;
            }
            try {
              const c = new McpClient({ server: s, profile });
              const tools = await c.listTools();
              const live = new Set(tools.map((t) => t.name));
              const missing = TOOL_CATALOG[s].filter((n) => !live.has(n));
              const extra = tools.map((t) => t.name).filter((n) => !TOOL_CATALOG[s].includes(n));
              checks.push({ check: `${s}.tools/list`, ok: tools.length > 0, detail: `${tools.length} tools${c.lastRateLimit?.remaining !== undefined ? ` · rate limit ${c.lastRateLimit.remaining}/${c.lastRateLimit.limit}` : ""}` });
              checks.push({
                check: `${s}.catalog-drift`,
                ok: missing.length === 0 && extra.length === 0,
                soft: true,
                detail: missing.length === 0 && extra.length === 0 ? "in sync" : `${missing.length ? `not on server: ${missing.join(", ")}` : ""}${missing.length && extra.length ? "; " : ""}${extra.length ? `new upstream: ${extra.join(", ")}` : ""}`,
              });
            } catch (e) {
              checks.push({ check: `${s}.tools/list`, ok: false, detail: (e as Error).message });
            }
          }
          if (!o.offline) {
            try {
              const res = await fetch(DOCS.index, { headers: { "user-agent": USER_AGENT } });
              checks.push({ check: "docs.llms.txt", ok: res.ok, soft: true, detail: `${DOCS.index} → HTTP ${res.status}` });
            } catch (e) {
              checks.push({ check: "docs.llms.txt", ok: false, soft: true, detail: (e as Error).message });
            }
          }
          sp.stop();

          const hardFailures = checks.filter((c) => !c.ok && !c.soft);
          renderResult(checks, { ...opts, tool: "doctor", profile: opts.profile || name, meta: { healthy: hardFailures.length === 0 } }, (data, c) => renderDoctor(data as Check[], c));
          if (hardFailures.length) process.exitCode = 1;
        });
      })
  );
}

function renderDoctor(checks: Check[], ctx: ReturnType<typeof readGlobalOpts>): void {
  const Table = loadTable();
  const t = new Table({ head: ["check", "status", "detail"], style: { head: [], border: [] }, wordWrap: true, colWidths: [24, 8, 80] });
  for (const c of checks) t.push([c.check, c.ok ? ok("ok", ctx) : c.soft ? dim("info", ctx) : err("FAIL", ctx), c.detail ?? ""]);
  process.stdout.write(`${t.toString()}\n`);
  const failing = checks.filter((c) => !c.ok && !c.soft);
  process.stdout.write(failing.length ? err(`${failing.length} check(s) failing\n`, ctx) : ok("all checks passed\n", ctx));
}
