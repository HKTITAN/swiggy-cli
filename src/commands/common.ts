import type { Command } from "commander";
import type { OutputOptions, ServerName } from "../types/index.js";
import { getCurrentProfile } from "../lib/config.js";
import { McpClient, extractToolPayload } from "../lib/mcp.js";
import { renderError, renderResult, startSpinner, brand } from "../lib/output.js";
import { CliError } from "../lib/errors.js";
import { UsageError } from "../lib/errors.js";
import { confirm } from "../lib/confirm.js";
import { DESTRUCTIVE_TOOLS } from "../lib/aliases.js";

export function attachOutputOptions(cmd: Command): Command {
  return cmd
    .option("--json", "emit machine-readable JSON envelope on stdout")
    .option("--plain", "emit TSV-style line-oriented output")
    .option("--raw", "emit raw MCP response payload as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-interactive", "disable prompts and spinners (machine mode)")
    .option("-y, --yes", "auto-confirm destructive actions")
    .option("--profile <name>", "use a named profile");
}

export interface ExecOpts extends OutputOptions {}

export function readGlobalOpts(cmd: Command): ExecOpts {
  const o = cmd.optsWithGlobals<ExecOpts>();
  return {
    json: o.json,
    plain: o.plain,
    raw: o.raw,
    quiet: o.quiet,
    noInteractive: o.noInteractive,
    yes: o.yes,
    profile: o.profile,
  };
}

export async function callTool(
  server: ServerName,
  tool: string,
  args: unknown,
  opts: ExecOpts,
  humanRenderer?: (data: unknown, ctx: ExecOpts & { server?: string; tool?: string }) => void
): Promise<void> {
  try {
    if (DESTRUCTIVE_TOOLS.has(tool)) {
      await confirm(`Run destructive tool "${tool}" on ${server}`, opts);
    }
    const { profile, name: profileName } = await getCurrentProfile(opts.profile);
    const ctx = { ...opts, server, tool, profile: opts.profile || profileName };
    const sp = startSpinner(`${brand("swiggy", opts)} · calling ${server}/${tool}…`, opts);
    const client = new McpClient({ server, profile });
    let result;
    try {
      result = await client.callTool(tool, args);
    } finally {
      sp?.stop();
    }
    if (result.isError) {
      throw new CliError("MCP_ERROR", `Tool "${tool}" returned an error`, { details: result });
    }
    const payload = opts.raw ? result : extractToolPayload(result);
    renderResult(payload, ctx, humanRenderer as never);
  } catch (err) {
    const code = renderError(err, { ...opts, server, tool });
    process.exitCode = code;
  }
}

export function parseJsonInput(input: string, flagName = "--input"): unknown {
  try {
    return JSON.parse(input);
  } catch (err) {
    throw new UsageError(`${flagName} is not valid JSON: ${(err as Error).message}`);
  }
}
