import { Command } from "commander";
import { attachOutputOptions, readGlobalOpts } from "./common.js";
import { renderError, renderResult } from "../lib/output.js";
import { SERVER_NAMES } from "../types/index.js";
import { getCurrentProfile, endpointFor } from "../lib/config.js";
import { loadAuth, discoverOAuthMetadata, evaluateAuthHealth } from "../lib/auth.js";
import { McpClient } from "../lib/mcp.js";

export function buildDoctorCommand(program: Command): void {
  attachOutputOptions(
    program
      .command("doctor")
      .description("Diagnose config, auth, connectivity, and tool discovery")
      .action(async () => {
        const opts = readGlobalOpts(program);
        try {
          const { profile, name } = await getCurrentProfile(opts.profile);
          const auth = await loadAuth();
          const checks: Array<{ check: string; ok: boolean; detail?: string }> = [];
          checks.push({ check: `node>=20`, ok: Number(process.versions.node.split(".")[0]) >= 20, detail: process.version });
          checks.push({ check: `profile`, ok: true, detail: name });

          for (const s of SERVER_NAMES) {
            const url = endpointFor(s, profile);
            checks.push({ check: `${s}.endpoint`, ok: true, detail: url });
            const authHealth = evaluateAuthHealth(auth.servers[s]);
            checks.push({
              check: `${s}.auth`,
              ok: authHealth.authenticated,
              detail: authHealth.reason,
            });
            try {
              await discoverOAuthMetadata(url);
              checks.push({ check: `${s}.oauth-metadata`, ok: true });
            } catch (e) {
              checks.push({ check: `${s}.oauth-metadata`, ok: false, detail: (e as Error).message });
            }
            try {
              const c = new McpClient({ server: s, profile });
              const tools = await c.listTools();
              checks.push({ check: `${s}.tools/list`, ok: tools.length > 0, detail: `${tools.length} tools` });
            } catch (e) {
              checks.push({ check: `${s}.tools/list`, ok: false, detail: (e as Error).message });
            }
          }

          renderResult(checks, { ...opts, profile: opts.profile || name });
          if (checks.some((c) => !c.ok)) process.exitCode = 1;
        } catch (err) {
          process.exitCode = renderError(err, opts);
        }
      })
  );
}
