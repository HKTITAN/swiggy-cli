import type { Command } from "commander";
import prompts from "prompts";
import type { OutputOptions, ServerName } from "../types/index.js";
import { getCurrentProfile } from "../lib/config.js";
import { McpClient, extractToolPayload } from "../lib/mcp.js";
import { renderError, renderResult, startSpinner, brand } from "../lib/output.js";
import { CliError } from "../lib/errors.js";
import { UsageError } from "../lib/errors.js";
import { confirm } from "../lib/confirm.js";
import { DESTRUCTIVE_TOOLS } from "../lib/aliases.js";
import { isMachineMode } from "../lib/tty.js";

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
      const message = extractMcpToolErrorMessage(result) ?? `Tool "${tool}" returned an error`;
      throw new CliError("MCP_ERROR", message, { details: result, hint: hintForToolError(server, message) });
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

interface PromptAddressOptions {
  requiredBy: string;
}

export async function ensureAddressId(
  server: Extract<ServerName, "food" | "instamart">,
  opts: ExecOpts,
  currentAddressId: string | undefined,
  promptOpts: PromptAddressOptions
): Promise<string> {
  if (currentAddressId) return currentAddressId;
  if (isMachineMode(opts)) {
    throw new UsageError(
      `Missing address id for ${promptOpts.requiredBy}. Run: swiggy ${server} addresses, then retry with --address-id <id>.`,
      `Run: swiggy ${server} addresses, then pass --address-id <id>`
    );
  }
  const { profile } = await getCurrentProfile(opts.profile);
  const client = new McpClient({ server, profile });
  const result = await client.callTool("get_addresses", {});
  const payload = extractToolPayload(result);
  const addresses = extractAddresses(payload);
  if (addresses.length === 0) {
    throw new UsageError(
      `No saved addresses found for ${server}.`,
      "Add an address first (Swiggy app) or run with explicit --address-id"
    );
  }
  if (addresses.length === 1) return addresses[0]!.id;
  const response = await prompts({
    type: "select",
    name: "addressId",
    message: `Select delivery address for ${promptOpts.requiredBy}:`,
    choices: addresses.map((a) => ({ title: a.label, value: a.id })),
  });
  if (!response.addressId) {
    throw new UsageError("Address selection cancelled.", `Re-run and pass --address-id <id> if you prefer non-interactive`);
  }
  return response.addressId as string;
}

function extractAddresses(payload: unknown): Array<{ id: string; label: string }> {
  if (!Array.isArray(payload)) return [];
  const addresses: Array<{ id: string; label: string }> = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = firstString(record, ["address_id", "addressId", "id"]);
    if (!id) continue;
    const label =
      firstString(record, ["display_address", "address", "name", "label", "title"]) ??
      firstString(record, ["area", "city"]) ??
      id;
    addresses.push({ id, label });
  }
  return addresses;
}

function firstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}

function extractMcpToolErrorMessage(result: { content?: Array<{ type?: string; text?: string }> }): string | undefined {
  const texts = (result.content ?? [])
    .filter((chunk) => chunk?.type === "text" && typeof chunk.text === "string")
    .map((chunk) => (chunk.text as string).trim())
    .filter((text) => text.length > 0);
  if (texts.length === 0) return undefined;
  return texts[0];
}

function hintForToolError(server: ServerName, message: string): string | undefined {
  if (/address[_ ]?id is required/i.test(message)) {
    return `Run: swiggy ${server} addresses, then retry with --address-id <id>`;
  }
  if (/required/i.test(message)) {
    return `Run: swiggy schema ${server} <tool> --json to inspect required arguments`;
  }
  return undefined;
}
