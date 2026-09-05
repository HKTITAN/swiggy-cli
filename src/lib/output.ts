import type { CliEnvelope, EnvelopeMeta, OutputOptions } from "../types/index.js";
import { isMachineMode, shouldUseColor } from "./tty.js";
import { renderHuman } from "./renderers/human.js";
import { renderJson } from "./renderers/json.js";
import { renderPlain } from "./renderers/plain.js";
import { CliError, EXIT_CODE } from "./errors.js";
import { PALETTE, paint, startStatus, type Status } from "./ui.js";

/** Swiggy brand orange (mcp.swiggy.com uses #FF5200; the classic app orange is #FC8019). */
export const BRAND = {
  orange: PALETTE.orange,
  legacyOrange: "#FC8019",
};

export function brand(s: string, opts: OutputOptions): string {
  return paint(PALETTE.orange, s, opts, true);
}

export function dim(s: string, opts: OutputOptions): string {
  return paint(PALETTE.muted, s, opts);
}

export function err(s: string, opts: OutputOptions): string {
  return paint(PALETTE.error, s, opts);
}

export function ok(s: string, opts: OutputOptions): string {
  return paint(PALETTE.success, s, opts);
}

export function warn(s: string, opts: OutputOptions): string {
  return paint(PALETTE.warn, s, opts);
}

/** Write a human-facing note to stderr. Suppressed by --quiet; never pollutes stdout. */
export function note(s: string, opts: OutputOptions): void {
  if (opts.quiet) return;
  process.stderr.write(`${s}\n`);
}

/** Start a status line (spinner + elapsed time) on stderr. No-op in machine/quiet mode. */
export function startSpinner(text: string, opts: OutputOptions): Status {
  return startStatus(text, opts);
}

export function renderStartupBanner(opts: OutputOptions): void {
  if (isMachineMode(opts) || opts.quiet || !process.stdout.isTTY || process.env.SWIGGY_NO_BANNER || process.env.SWIGGY_SHELL_ACTIVE) return;
  const header = [
    "███████╗██╗    ██╗██╗ ██████╗  ██████╗ ██╗   ██╗",
    "██╔════╝██║    ██║██║██╔════╝ ██╔════╝ ╚██╗ ██╔╝",
    "███████╗██║ █╗ ██║██║██║  ███╗██║  ███╗ ╚████╔╝ ",
    "╚════██║██║███╗██║██║██║   ██║██║   ██║  ╚██╔╝  ",
    "███████║╚███╔███╔╝██║╚██████╔╝╚██████╔╝   ██║   ",
    "╚══════╝ ╚══╝╚══╝ ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   ",
  ].join("\n");
  process.stderr.write(`\n${shouldUseColor(opts) ? paint(PALETTE.orange, header, opts, true) : header}\n\n`);
}

export interface RenderContext extends OutputOptions {
  server?: string;
  tool?: string;
  meta?: EnvelopeMeta;
}

export function renderResult<T>(data: T, ctx: RenderContext, humanRenderer?: (data: T, ctx: RenderContext) => void): void {
  const meta: EnvelopeMeta = { profile: ctx.profile, ...(ctx.meta ?? {}) };
  const envelope: CliEnvelope<T> = { ok: true, server: ctx.server, tool: ctx.tool, data, meta };
  if (ctx.json || ctx.raw) return renderJson(envelope);
  if (ctx.plain) return renderPlain(envelope);
  if (meta.deprecation) note(warn(`⚠ deprecation notice from Swiggy: ${JSON.stringify(meta.deprecation)}`, ctx), ctx);
  if (humanRenderer) humanRenderer(data, ctx);
  else renderHuman(envelope, ctx);
}

export function renderError(error: unknown, ctx: RenderContext): number {
  const cli = error instanceof CliError ? error : new CliError("UNKNOWN", error instanceof Error ? error.message : String(error));
  const envelope: CliEnvelope = { ok: false, error: { code: cli.code, message: cli.message, details: cli.details, hint: cli.hint } };
  if (ctx.json || ctx.raw) {
    renderJson(envelope);
  } else if (ctx.plain) {
    process.stderr.write(`error\t${cli.code}\t${cli.message}\n`);
  } else {
    process.stderr.write(err(`✖ ${cli.message}\n`, ctx));
    if (cli.hint) process.stderr.write(dim(`  hint: ${cli.hint}\n`, ctx));
    process.stderr.write(dim(`  code: ${cli.code} (exit ${EXIT_CODE[cli.code] ?? 1})\n`, ctx));
  }
  return EXIT_CODE[cli.code] ?? 1;
}
