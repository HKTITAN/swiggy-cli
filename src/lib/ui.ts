import type { OutputOptions } from "../types/index.js";
import { isMachineMode, shouldUseColor } from "./tty.js";
import {
  CLEAR_LINE,
  CURSOR_HIDE,
  CURSOR_SHOW,
  detectColorLevel,
  fmtDuration,
  hyperlink,
  progressSequence,
  writeFrame,
} from "./term.js";

/**
 * Small, dependency-free status line for long-running work (tool calls, OAuth, payment polling).
 *
 * - Renders to stderr only; stdout stays reserved for data.
 * - Uses synchronized output so a redraw never tears, hides the cursor while active, and always
 *   restores it (including on SIGINT).
 * - Ticks at 12.5 fps (80ms) — enough for a fluid spinner without burning CPU.
 * - Mirrors state to the terminal's native progress indicator (OSC 9;4) where supported.
 * - Silent in machine mode (--json/--plain/--raw/--no-interactive/non-TTY) and with --quiet.
 */

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const TICK_MS = 80;

export const PALETTE = {
  orange: "#FF5200",
  muted: "#8A8F98",
  success: "#2FBF71",
  warn: "#E8A317",
  error: "#E5484D",
  accent: "#FFB187",
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbTo256(r: number, g: number, b: number): number {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  return 16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5);
}

function rgbTo16(r: number, g: number, b: number): number {
  const bright = Math.max(r, g, b) > 170 ? 60 : 0;
  const code = (r > 127 ? 1 : 0) | (g > 127 ? 2 : 0) | (b > 127 ? 4 : 0);
  return 30 + code + bright;
}

/** Colorize with the best sequence the terminal supports (truecolor → 256 → 16 → none). */
export function paint(hex: string, s: string, opts?: OutputOptions, bold = false): string {
  if (opts && !shouldUseColor(opts)) return s;
  const level = detectColorLevel();
  if (level === 0) return s;
  const [r, g, b] = hexToRgb(hex);
  const open = level === 3 ? `\u001b[38;2;${r};${g};${b}m` : level === 2 ? `\u001b[38;5;${rgbTo256(r, g, b)}m` : `\u001b[${rgbTo16(r, g, b)}m`;
  return `${bold ? "\u001b[1m" : ""}${open}${s}\u001b[0m`;
}

export function link(url: string, text?: string, opts?: OutputOptions): string {
  const enabled = opts ? shouldUseColor(opts) : detectColorLevel() > 0;
  return hyperlink(url, text ? paint(PALETTE.accent, text, opts) : paint(PALETTE.accent, url, opts), enabled);
}

export interface Status {
  update(text: string): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  stop(): void;
  readonly elapsedMs: number;
}

const noop: Status = {
  update() {},
  succeed() {},
  fail() {},
  stop() {},
  get elapsedMs() {
    return 0;
  },
};

let activeCount = 0;
let sigintInstalled = false;

function installSigint(): void {
  if (sigintInstalled) return;
  sigintInstalled = true;
  process.once("SIGINT", () => {
    process.stderr.write(`${CLEAR_LINE}${CURSOR_SHOW}${progressSequence("clear") ?? ""}`);
    process.stderr.write(`${paint(PALETTE.muted, "cancelled")}\n`);
    process.exit(130);
  });
}

/** Start a status line. Returns a no-op in machine/quiet mode so call sites never branch. */
export function startStatus(text: string, opts: OutputOptions): Status {
  if (isMachineMode(opts) || opts.quiet || !process.stderr.isTTY) return noop;
  installSigint();
  const start = Date.now();
  let current = text;
  let frame = 0;
  let stopped = false;
  activeCount += 1;
  const prog = progressSequence("indeterminate");
  if (prog) process.stderr.write(prog);
  process.stderr.write(CURSOR_HIDE);

  const draw = (): void => {
    const spinner = paint(PALETTE.orange, FRAMES[frame % FRAMES.length]!);
    const elapsed = paint(PALETTE.muted, fmtDuration(Date.now() - start));
    writeFrame(`${CLEAR_LINE}${spinner} ${current} ${elapsed}`);
    frame += 1;
  };
  draw();
  const timer = setInterval(draw, TICK_MS);
  timer.unref();

  const finish = (line?: string): void => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    activeCount -= 1;
    const clear = activeCount === 0 ? (progressSequence("clear") ?? "") : "";
    writeFrame(`${CLEAR_LINE}${line ? `${line}\n` : ""}${CURSOR_SHOW}${clear}`);
  };

  return {
    update(t: string) {
      current = t;
      draw();
    },
    succeed(t?: string) {
      finish(`${paint(PALETTE.success, "✓")} ${t ?? current} ${paint(PALETTE.muted, fmtDuration(Date.now() - start))}`);
    },
    fail(t?: string) {
      finish(`${paint(PALETTE.error, "✖")} ${t ?? current} ${paint(PALETTE.muted, fmtDuration(Date.now() - start))}`);
    },
    stop() {
      finish();
    },
    get elapsedMs() {
      return Date.now() - start;
    },
  };
}

/**
 * Minimal Markdown → ANSI for the `message` strings Swiggy tools return (headings, bold, inline
 * code, bullets, links). Deliberately tiny: it must never mangle text it doesn't understand.
 */
export function renderMarkdown(md: string, opts?: OutputOptions): string {
  const color = opts ? shouldUseColor(opts) : detectColorLevel() > 0;
  if (!color) return md.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)");
  return md
    .split(/\r?\n/)
    .map((line) => {
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) return paint(PALETTE.orange, h[2]!, opts, true);
      let out = line.replace(/^(\s*)[-*]\s+/, "$1• ");
      out = out.replace(/\*\*([^*]+)\*\*/g, (_m, t: string) => `\u001b[1m${t}\u001b[22m`);
      out = out.replace(/`([^`]+)`/g, (_m, t: string) => paint(PALETTE.accent, t, opts));
      out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_m, t: string, u: string) => hyperlink(u, paint(PALETTE.accent, t, opts), true));
      return out;
    })
    .join("\n");
}
