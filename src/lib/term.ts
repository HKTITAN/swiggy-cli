/**
 * Terminal capability detection and escape helpers.
 *
 * Techniques borrowed from Grok Build's TUI (xai-org/grok-build): adaptive color levels with a
 * truecolor upgrade for known terminals hiding behind tmux/SSH, OSC 8 hyperlinks, OSC 9;4
 * progress indicators on terminals that support them, and synchronized output (DEC 2026) so
 * multi-line redraws never tear.
 *
 * Everything here is pure or writes only escape sequences; nothing throws.
 */

export type ColorLevel = 0 | 1 | 2 | 3; // none, basic16, ansi256, truecolor

let cachedLevel: ColorLevel | undefined;

function normalize(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/[\s\-_.]/g, "");
}

/** True for terminals known to render 24-bit color even when COLORTERM is stripped (tmux, ssh, mosh). */
export function terminalSupportsTruecolor(env: NodeJS.ProcessEnv = process.env): boolean {
  const prog = normalize(env.TERM_PROGRAM);
  if (["iterm", "iterm2", "itermapp", "ghostty", "kitty", "wezterm", "alacritty", "warp", "warpterminal", "vscode"].includes(prog)) return true;
  if (env.ITERM_SESSION_ID || env.KITTY_WINDOW_ID || env.WEZTERM_EXECUTABLE || env.GHOSTTY_RESOURCES_DIR || env.ALACRITTY_WINDOW_ID) return true;
  if (env.WT_SESSION) return true; // Windows Terminal
  return false;
}

export function detectColorLevel(env: NodeJS.ProcessEnv = process.env, isTTY = Boolean(process.stderr.isTTY)): ColorLevel {
  if (cachedLevel !== undefined && env === process.env) return cachedLevel;
  let level: ColorLevel;
  if (env.NO_COLOR !== undefined) level = 0;
  else if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "0") level = env.FORCE_COLOR === "1" ? 1 : env.FORCE_COLOR === "2" ? 2 : 3;
  else if (!isTTY) level = 0;
  else {
    const colorterm = normalize(env.COLORTERM);
    const term = (env.TERM ?? "").toLowerCase();
    if (colorterm === "truecolor" || colorterm === "24bit") level = 3;
    else if (term.includes("256color")) level = 2;
    else if (term === "dumb") level = 0;
    else if (process.platform === "win32") level = 3; // conhost/Windows Terminal both do truecolor since Win10 1909
    else if (term) level = 1;
    else level = 0;
    if (level < 3 && level > 0 && terminalSupportsTruecolor(env)) level = 3;
  }
  if (env === process.env) cachedLevel = level;
  return level;
}

export interface TerminalContext {
  brand: "ghostty" | "wezterm" | "iterm2" | "kitty" | "vscode" | "windows-terminal" | "apple-terminal" | "unknown";
  inTmux: boolean;
  termProgramVersion?: string;
}

export function terminalContext(env: NodeJS.ProcessEnv = process.env): TerminalContext {
  const prog = normalize(env.TERM_PROGRAM);
  let brand: TerminalContext["brand"] = "unknown";
  if (prog === "ghostty" || env.GHOSTTY_RESOURCES_DIR) brand = "ghostty";
  else if (prog === "wezterm" || env.WEZTERM_EXECUTABLE) brand = "wezterm";
  else if (prog.startsWith("iterm") || env.ITERM_SESSION_ID) brand = "iterm2";
  else if (prog === "kitty" || env.KITTY_WINDOW_ID) brand = "kitty";
  else if (prog === "vscode") brand = "vscode";
  else if (env.WT_SESSION) brand = "windows-terminal";
  else if (prog === "appleterminal") brand = "apple-terminal";
  return { brand, inTmux: Boolean(env.TMUX), termProgramVersion: env.TERM_PROGRAM_VERSION };
}

/** OSC 9;4 progress (indeterminate / clear). Only Ghostty, WezTerm, iTerm2 ≥ 3.6 and Windows Terminal understand it. */
export function supportsProgressBar(ctx: TerminalContext = terminalContext()): boolean {
  if (ctx.brand === "ghostty" || ctx.brand === "wezterm" || ctx.brand === "windows-terminal") return true;
  if (ctx.brand === "iterm2") {
    const [maj = 0, min = 0] = (ctx.termProgramVersion ?? "0.0").split(".").map(Number);
    return maj > 3 || (maj === 3 && min >= 6);
  }
  return false;
}

const OSC_PROGRESS_INDETERMINATE = "\u001b]9;4;3;0\u0007";
const OSC_PROGRESS_CLEAR = "\u001b]9;4;0;0\u0007";

function tmuxPassthrough(seq: string, ctx: TerminalContext): string {
  return ctx.inTmux ? `\u001bPtmux;${seq.replace(/\u001b/g, "\u001b\u001b")}\u001b\\` : seq;
}

export function progressSequence(state: "indeterminate" | "clear", ctx: TerminalContext = terminalContext()): string | undefined {
  if (!supportsProgressBar(ctx)) return undefined;
  return tmuxPassthrough(state === "indeterminate" ? OSC_PROGRESS_INDETERMINATE : OSC_PROGRESS_CLEAR, ctx);
}

/** OSC 8 hyperlink. Falls back to the plain URL when the stream is not a TTY or colors are off. */
export function hyperlink(url: string, text: string = url, enabled = detectColorLevel() > 0): string {
  if (!enabled) return text === url ? url : `${text} (${url})`;
  return `\u001b]8;;${url}\u0007${text}\u001b]8;;\u0007`;
}

/** Synchronized output (DEC private mode 2026): the terminal holds the frame until END. */
export const SYNC_BEGIN = "\u001b[?2026h";
export const SYNC_END = "\u001b[?2026l";
export const CURSOR_HIDE = "\u001b[?25l";
export const CURSOR_SHOW = "\u001b[?25h";
export const CLEAR_LINE = "\u001b[2K\r";

/** Write a frame to stderr atomically (no tearing on terminals that honour mode 2026). */
export function writeFrame(text: string, stream: NodeJS.WriteStream = process.stderr): void {
  if (!stream.isTTY) return;
  stream.write(`${SYNC_BEGIN}${text}${SYNC_END}`);
}

/** Format a duration for status lines: 830ms, 1.4s, 1m 12s. */
export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}
