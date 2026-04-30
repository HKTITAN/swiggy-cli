import chalk from "chalk";
import ora, { type Ora } from "ora";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { CliEnvelope, OutputOptions } from "../types/index.js";
import { isMachineMode, shouldUseColor } from "./tty.js";
import { renderHuman } from "./renderers/human.js";
import { renderJson } from "./renderers/json.js";
import { renderPlain } from "./renderers/plain.js";
import { CliError, EXIT_CODE } from "./errors.js";

/** Swiggy brand orange. Used sparingly per the brief. */
export const BRAND = {
  orange: "#FC8019",
  deepOrange: "#FE5200",
};

export function brand(s: string, opts: OutputOptions): string {
  return shouldUseColor(opts) ? chalk.hex(BRAND.orange).bold(s) : s;
}

export function dim(s: string, opts: OutputOptions): string {
  return shouldUseColor(opts) ? chalk.dim(s) : s;
}

export function err(s: string, opts: OutputOptions): string {
  return shouldUseColor(opts) ? chalk.red(s) : s;
}

export function ok(s: string, opts: OutputOptions): string {
  return shouldUseColor(opts) ? chalk.green(s) : s;
}

export function startSpinner(text: string, opts: OutputOptions): Ora | null {
  if (isMachineMode(opts) || opts.quiet) return null;
  return ora({ text, color: "yellow" }).start();
}

export function renderStartupBanner(opts: OutputOptions): void {
  if (isMachineMode(opts) || opts.quiet || !process.stdout.isTTY) return;
  if (wasBannerRenderedForSession()) return;
  markBannerRenderedForSession();

  // Set terminal title where supported.
  process.stdout.write("\u001b]0;SWIGGY\u0007");

  const title = shouldUseColor(opts) ? chalk.hex(BRAND.orange).bold("SWIGGY") : "SWIGGY";
  const sub = shouldUseColor(opts) ? chalk.dim("Food · Instamart · Dineout CLI") : "Food · Instamart · Dineout CLI";
  const commandHint = shouldUseColor(opts)
    ? `${chalk.dim("Try")} ${chalk.hex(BRAND.orange)("swiggy --help")} ${chalk.dim("or")} ${chalk.hex(BRAND.orange)(
        "swiggy doctor"
      )}`
    : "Try swiggy --help or swiggy doctor";

  process.stderr.write(`\n${title}\n${sub}\n${commandHint}\n\n`);
}

export interface RenderContext extends OutputOptions {
  server?: string;
  tool?: string;
}

export function renderResult<T>(
  data: T,
  ctx: RenderContext,
  humanRenderer?: (data: T, ctx: RenderContext) => void
): void {
  const envelope: CliEnvelope<T> = {
    ok: true,
    server: ctx.server,
    tool: ctx.tool,
    data,
    meta: { profile: ctx.profile },
  };
  if (ctx.json) return renderJson(envelope);
  if (ctx.plain) return renderPlain(envelope);
  if (ctx.raw) return renderJson(envelope);
  if (humanRenderer) humanRenderer(data, ctx);
  else renderHuman(envelope, ctx);
}

export function renderError(error: unknown, ctx: RenderContext): number {
  const cli =
    error instanceof CliError
      ? error
      : new CliError("UNKNOWN", error instanceof Error ? error.message : String(error));
  const envelope: CliEnvelope = {
    ok: false,
    error: { code: cli.code, message: cli.message, details: cli.details },
  };
  if (ctx.json || ctx.raw) {
    renderJson(envelope);
  } else if (ctx.plain) {
    process.stderr.write(`error\t${cli.code}\t${cli.message}\n`);
  } else {
    process.stderr.write(err(`✖ ${cli.message}\n`, ctx));
    if (cli.hint) process.stderr.write(dim(`  hint: ${cli.hint}\n`, ctx));
    if (cli.code) process.stderr.write(dim(`  code: ${cli.code}\n`, ctx));
  }
  return EXIT_CODE[cli.code] ?? 1;
}

function sessionMarkerPath(): string {
  const shellId = process.env.WT_SESSION || process.env.TERM_SESSION_ID || String(process.ppid);
  return join(tmpdir(), `swiggy-cli-banner-${shellId}`);
}

function wasBannerRenderedForSession(): boolean {
  return existsSync(sessionMarkerPath());
}

function markBannerRenderedForSession(): void {
  try {
    writeFileSync(sessionMarkerPath(), String(Date.now()), { encoding: "utf8" });
  } catch {
    // Non-fatal: rendering the banner more than once is acceptable fallback behavior.
  }
}
