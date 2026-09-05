import type { Command } from "commander";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { EnvelopeMeta, OutputOptions, ProfileConfig, ServerName } from "../types/index.js";
import { getCurrentProfile } from "../lib/config.js";
import { McpClient, extractDeprecation, extractToolPayload, unwrapSwiggyEnvelope } from "../lib/mcp.js";
import { renderError, renderResult, startSpinner, brand, dim, note, type RenderContext } from "../lib/output.js";
import { CliError, UsageError } from "../lib/errors.js";
import { confirm } from "../lib/confirm.js";
import { DESTRUCTIVE_TOOLS } from "../lib/aliases.js";
import { isMachineMode } from "../lib/tty.js";
import { getPrompter } from "../lib/prompter.js";
import { PATHS } from "../lib/paths.js";
import { labelFor, messageLine, viewFor } from "../lib/views.js";
import { extractRecent, remember, getContext, getRecent } from "../lib/recent.js";

export function attachOutputOptions(cmd: Command): Command {
  return cmd
    .option("--json", "emit machine-readable JSON envelope on stdout")
    .option("--plain", "emit TSV-style line-oriented output")
    .option("--raw", "emit the raw MCP tools/call result as JSON (no unwrapping)")
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
    noInteractive: Boolean(o.noInteractive) || o.interactive === false,
    yes: o.yes,
    profile: o.profile,
  };
}

/**
 * Run a command body with uniform error handling: any thrown CliError (or unknown error) is
 * rendered in the caller's output mode and mapped to the process exit code.
 */
export async function run(opts: ExecOpts, body: () => Promise<void>, ctx: Partial<RenderContext> = {}): Promise<void> {
  try {
    await body();
  } catch (err) {
    process.exitCode = renderError(err, { ...opts, ...ctx });
  }
}

export interface ToolOutcome {
  /** Unwrapped Swiggy `data` (or the whole payload when the tool did not use the envelope). */
  data: unknown;
  /** Swiggy's human-readable `message`, when present. */
  message?: string;
  /** Top-level fields Swiggy returned outside `data` (e.g. Dineout latitude/longitude). */
  extra?: Record<string, unknown>;
  /** Raw MCP result (what `--raw` prints). */
  raw: unknown;
  meta: EnvelopeMeta;
  profileName: string;
  profile: ProfileConfig;
}

/**
 * Invoke one MCP tool with confirmation gating, spinner, envelope unwrapping and error mapping.
 * Throws CliError on failure; never renders. Use `callTool` when you want the result printed.
 */
export async function invokeTool(server: ServerName, tool: string, args: unknown, opts: ExecOpts, label?: string): Promise<ToolOutcome> {
  if (DESTRUCTIVE_TOOLS.has(tool)) await confirm(label ?? `Run "${tool}" on ${server}`, opts);
  const { profile, name: profileName } = await getCurrentProfile(opts.profile);
  const sp = startSpinner(`${labelFor(tool)} ${dim(`· ${server}`, opts)}`, opts);
  const client = new McpClient({ server, profile });
  let result;
  try {
    result = await client.callTool(tool, args);
  } catch (err) {
    sp.fail(`${labelFor(tool)} · ${server}`);
    throw err;
  }
  const meta: EnvelopeMeta = {};
  if (client.lastRateLimit) meta.rateLimit = client.lastRateLimit;
  const deprecation = extractDeprecation(result);
  if (deprecation) meta.deprecation = deprecation;

  if (result.isError) {
    sp.fail(`${labelFor(tool)} · ${server}`);
    const message = extractMcpToolErrorMessage(result) ?? `Tool "${tool}" returned an error`;
    throw new CliError("MCP_ERROR", message, { details: result, hint: hintForToolError(server, message) });
  }
  const payload = extractToolPayload(result);
  const unwrapped = unwrapSwiggyEnvelope(payload);
  if (unwrapped.error) {
    sp.fail(`${labelFor(tool)} · ${server}`);
    const message = unwrapped.error.message ?? "Tool reported failure.";
    const reportLink = typeof unwrapped.error.reportLink === "string" ? unwrapped.error.reportLink : undefined;
    throw new CliError("MCP_ERROR", message, {
      details: { error: unwrapped.error, data: unwrapped.data, ...(meta.rateLimit ? { rateLimit: meta.rateLimit } : {}) },
      hint: hintForToolError(server, message) ?? (reportLink ? `Diagnostics: ${reportLink}` : `Run: swiggy ${server} report-error --tool ${tool} --message "<what you saw>"`),
    });
  }
  sp.succeed(`${labelFor(tool)} ${dim(`· ${server}/${tool}`, opts)}`);
  if (unwrapped.message) meta.message = unwrapped.message;
  return { data: unwrapped.data, message: unwrapped.message, extra: unwrapped.extra, raw: result, meta, profileName, profile };
}

export async function callTool(
  server: ServerName,
  tool: string,
  args: unknown,
  opts: ExecOpts,
  humanRenderer?: (data: unknown, ctx: RenderContext) => void,
  label?: string
): Promise<ToolOutcome | undefined> {
  try {
    const out = await invokeTool(server, tool, args, opts, label);
    await renderOutcome(server, tool, out, opts, humanRenderer);
    return out;
  } catch (err) {
    process.exitCode = renderError(err, { ...opts, server, tool });
    return undefined;
  }
}

export async function renderOutcome(
  server: ServerName,
  tool: string,
  out: ToolOutcome,
  opts: ExecOpts,
  humanRenderer?: (data: unknown, ctx: RenderContext) => void,
  extraMeta: EnvelopeMeta = {}
): Promise<void> {
  const ctx: RenderContext = { ...opts, server, tool, profile: opts.profile || out.profileName, meta: { ...out.meta, ...extraMeta } };
  const data = opts.raw ? out.raw : out.extra ? { ...out.extra, ...(isRecord(out.data) ? out.data : { data: out.data }) } : out.data;
  // Remember numbered rows + follow-up context so the next command can say "#2". Awaited (a few ms): inside
  // a warm session the next command may run immediately and must see the rows.
  const recent = extractRecent(server, tool, out.data, out.extra);
  if (recent) await remember(recent.kind, server, recent.entries, recent.context);
  const native = !opts.json && !opts.plain && !opts.raw && !humanRenderer ? viewFor(server, tool) : undefined;
  if (native) {
    const text = native(out.data, { ...ctx, message: out.message });
    if (text !== undefined) {
      const msg = messageLine(out.message, ctx);
      process.stdout.write(text + "\n");
      if (msg && !looksRedundant(msg, text)) process.stdout.write(msg + "\n");
      if (ctx.meta?.deprecation) note(`⚠ deprecation notice from Swiggy: ${JSON.stringify(ctx.meta.deprecation)}`, opts);
      return;
    }
  }
  renderResult(data, ctx, humanRenderer as never);
}

/** Swiggy's message often restates the table (e.g. "Found 10 restaurants"); skip it when it adds nothing. */
function looksRedundant(message: string, rendered: string): boolean {
  const m = message.replace(/\u001b\[[0-9;]*m/g, "").toLowerCase();
  if (m.length < 12) return true;
  if (/^(found|showing|here (are|is)|listing)\b/.test(m) && rendered.length > 200) return true;
  return false;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function parseJsonInput(input: string, flagName = "--input"): unknown {
  try {
    return JSON.parse(input);
  } catch (err) {
    throw new UsageError(`${flagName} is not valid JSON: ${(err as Error).message}`);
  }
}

/** Drop undefined / empty-string values so we never send `"city": ""` upstream. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== "" && !(typeof v === "number" && Number.isNaN(v))) out[k] = v;
  return out as Partial<T>;
}

/** Merge `--input` JSON over flag-derived args (JSON wins) so power users can add any documented parameter. */
export async function buildArgs(flags: Record<string, unknown>, input?: string, inputFile?: string): Promise<Record<string, unknown>> {
  let override: unknown = {};
  if (inputFile) override = parseJsonInput(await readFile(inputFile, "utf8"), "--input-file");
  else if (input) override = parseJsonInput(input);
  if (override && typeof override !== "object") throw new UsageError("--input must be a JSON object.");
  return { ...compact(flags), ...(override as Record<string, unknown>) };
}

export function num(v: string | undefined, flag: string): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new UsageError(`${flag} must be a number (got "${v}").`);
  return n;
}

export function positiveInt(v: string | undefined, flag: string): number | undefined {
  const n = num(v, flag);
  if (n !== undefined && (!Number.isInteger(n) || n <= 0)) throw new UsageError(`${flag} must be a positive integer (got "${v}").`);
  return n;
}

export function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

export function oneOf<T extends string>(v: string | undefined, flag: string, allowed: readonly T[]): T | undefined {
  if (v === undefined || v === "") return undefined;
  const hit = allowed.find((a) => a.toLowerCase() === v.toLowerCase());
  if (!hit) throw new UsageError(`${flag} must be one of: ${allowed.join(", ")} (got "${v}").`);
  return hit;
}

export function requireFlag<T>(v: T | undefined, flag: string, hint?: string): T {
  if (v === undefined || v === "") throw new UsageError(`Missing required option ${flag}.`, hint);
  return v;
}

/** Address list shape from get_addresses / get_saved_locations, tolerant of older field names. */
export function extractAddresses(payload: unknown): Array<{ id: string; label: string }> {
  const list = resolveAddressList(payload);
  if (!Array.isArray(list)) return [];
  const addresses: Array<{ id: string; label: string }> = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = firstString(record, ["id", "address_id", "addressId"]);
    if (!id) continue;
    const tag = firstString(record, ["addressTag", "addressCategory", "annotation"]);
    const line = firstString(record, ["addressLine", "display_address", "address", "name", "label", "title"]) ?? firstString(record, ["area", "city"]);
    const label = [tag, line].filter(Boolean).join(" · ") || id;
    addresses.push({ id, label });
  }
  return addresses;
}

function resolveAddressList(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  for (const key of ["addresses", "locations"]) if (Array.isArray(record[key])) return record[key] as unknown[];
  if (record.data && typeof record.data === "object") return resolveAddressList(record.data);
  return undefined;
}

function firstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

/**
 * Resolve the `addressId` a Food/Instamart tool needs: explicit flag → profile default → (interactive)
 * pick from saved addresses. In machine mode the caller must pass --address-id; we never guess.
 */
export async function ensureAddressId(
  server: Extract<ServerName, "food" | "instamart">,
  opts: ExecOpts,
  current: string | undefined,
  requiredBy: string
): Promise<string> {
  if (current) return current;
  const { profile } = await getCurrentProfile(opts.profile);
  if (profile.defaultAddressId) return profile.defaultAddressId;
  // An address picked (or used) earlier carries over, so a session without a default asks once, not per command.
  const carried = (await getContext()).addressId;
  if (carried) {
    const label = (await getRecent("addresses")).find((a) => a.id === carried)?.label;
    note(dim(`address: ${label ? `${label} (${carried})` : carried} · from your last command; change with --address-id or  swiggy profile set default defaultAddressId <id>`, opts), opts);
    return carried;
  }
  if (isMachineMode(opts)) {
    throw new UsageError(
      `Missing address id for ${requiredBy}. Run: swiggy ${server} addresses --json, then retry with --address-id <id>.`,
      `Or set a default once: swiggy profile set default defaultAddressId <id>`
    );
  }
  const out = await invokeTool(server, "get_addresses", {}, opts);
  const addresses = extractAddresses(out.data);
  if (addresses.length === 0) {
    throw new UsageError(`No saved addresses found for ${server}.`, `Create one: swiggy ${server} create-address --help`);
  }
  if (addresses.length === 1) return addresses[0]!.id;
  const picked = await getPrompter().select(`Delivery address for ${requiredBy}:`, addresses.map((a) => ({ title: a.label, value: a.id })));
  if (!picked) throw new UsageError("Address selection cancelled.", "Re-run with --address-id <id> for non-interactive use.");
  await remember("addresses", server, [], { addressId: picked });
  note(dim(`tip: make this the default with  swiggy profile set default defaultAddressId ${picked}`, opts), opts);
  return picked;
}

export interface Coords {
  latitude: number;
  longitude: number;
}

interface CoordsCache {
  latitude: number;
  longitude: number;
  source: string;
  savedAt: number;
}

/** Remember coordinates Swiggy returned (Dineout search/details) so slots/book can reuse them. */
export async function rememberDineoutCoords(data: unknown, extra?: Record<string, unknown>, source = "dineout"): Promise<void> {
  const pick = (o: unknown): Coords | undefined => {
    if (!o || typeof o !== "object") return undefined;
    const r = o as Record<string, unknown>;
    const lat = Number(r.latitude ?? r.lat);
    const lng = Number(r.longitude ?? r.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 ? { latitude: lat, longitude: lng } : undefined;
  };
  const c = pick(extra) ?? pick(data);
  if (!c) return;
  try {
    await mkdir(dirname(PATHS.dineoutCoordsFile), { recursive: true });
    const cache: CoordsCache = { ...c, source, savedAt: Date.now() };
    await writeFile(PATHS.dineoutCoordsFile, JSON.stringify(cache, null, 2));
  } catch {
    /* best-effort */
  }
}

/**
 * Resolve Dineout coordinates: --lat/--lng → profile defaults → last coordinates Swiggy returned
 * from a search/details call. Dineout details/slots/book require them; saved locations do not
 * expose coordinates, so a search with --address-id is the canonical way to obtain them.
 */
export async function resolveDineoutCoords(opts: ExecOpts, lat: string | undefined, lng: string | undefined, requiredBy: string): Promise<Coords> {
  const la = num(lat, "--lat");
  const ln = num(lng, "--lng");
  if (la !== undefined && ln !== undefined) return { latitude: la, longitude: ln };
  if ((la === undefined) !== (ln === undefined)) throw new UsageError("--lat and --lng must be passed together.");
  const { profile } = await getCurrentProfile(opts.profile);
  if (typeof profile.defaultLat === "number" && typeof profile.defaultLng === "number") return { latitude: profile.defaultLat, longitude: profile.defaultLng };
  if (existsSync(PATHS.dineoutCoordsFile)) {
    try {
      const cached = JSON.parse(await readFile(PATHS.dineoutCoordsFile, "utf8")) as CoordsCache;
      if (Number.isFinite(cached.latitude) && Number.isFinite(cached.longitude)) {
        note(dim(`using coordinates from your last dineout ${cached.source} (${cached.latitude}, ${cached.longitude})`, opts), opts);
        return { latitude: cached.latitude, longitude: cached.longitude };
      }
    } catch {
      /* ignore */
    }
  }
  throw new UsageError(
    `Missing coordinates for ${requiredBy}.`,
    "Pass --lat/--lng, or run `swiggy dineout search -q <term> --address-id <id>` first (its response carries latitude/longitude), or set defaults: swiggy profile set default defaultLat <lat> && swiggy profile set default defaultLng <lng>"
  );
}

function extractMcpToolErrorMessage(result: { content?: Array<{ type?: string; text?: string }> }): string | undefined {
  const texts = (result.content ?? [])
    .filter((chunk) => chunk?.type === "text" && typeof chunk.text === "string")
    .map((chunk) => (chunk.text as string).trim())
    .filter((text) => text.length > 0);
  if (texts.length === 0) return undefined;
  const first = texts[0]!;
  try {
    const parsed = JSON.parse(first) as { error?: { message?: string }; message?: string };
    if (typeof parsed?.error?.message === "string") return parsed.error.message;
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    /* keep raw text */
  }
  return first;
}

export function hintForToolError(server: ServerName, message: string): string | undefined {
  if (/address[_ ]?id/i.test(message) && /required|missing|invalid/i.test(message)) {
    return `Run: swiggy ${server} addresses, then retry with --address-id <id> (or set defaultAddressId in your profile)`;
  }
  if (/latitude|longitude|location/i.test(message) && server === "dineout") {
    return "Run: swiggy dineout search -q <term> --address-id <id> first, or pass --lat/--lng";
  }
  if (/not whitelisted/i.test(message)) return "This account is not enabled for the tool yet (Swiggy rolls tools out gradually).";
  if (/out of stock|unserviceable|not serviceable/i.test(message)) return "Search again for alternatives or try another address.";
  if (/minimum order/i.test(message)) return "Add more items — Instamart needs ₹99 minimum; Food carts are capped at ₹1000 for Builders Club orders.";
  if (/required/i.test(message)) return `Run: swiggy schema ${server} <tool> --json to inspect required arguments`;
  return undefined;
}
