import type { Command } from "commander";
import { emitKeypressEvents } from "node:readline";
import { PALETTE, paint, setStatusSink } from "../lib/ui.js";
import { setPrompter, type Choice } from "../lib/prompter.js";
import { getLastList, type RecentEntry, type RecentKind } from "../lib/recent.js";
import { getCurrentProfile } from "../lib/config.js";
import { loadAuth, evaluateAuthHealth } from "../lib/auth.js";
import { VERSION } from "../lib/version.js";
import { fmtDuration } from "../lib/term.js";
import { completions, loadHistory, runLine, saveHistory } from "../commands/shell.js";
import { setProfileField } from "../lib/profiles.js";

/**
 * `swiggy app` — the full-screen session.
 *
 * Layout (top → bottom): header · scrollable output pane · status line · command line · key hints.
 * The output pane shows exactly what the commands print (native views, errors), numbered rows are
 * selectable with ↑/↓, and Enter on a row does the obvious next thing (restaurant → menu, dish →
 * add, product → add, dineout restaurant → slots, slot → book, order → details, address → make
 * default). Typing runs any swiggy command; Tab completes; Esc clears; q quits when the line is empty.
 *
 * Techniques (from Grok Build): alternate screen so your scrollback survives, synchronized output so
 * frames never tear, one long-lived process so every command reuses the warm MCP session.
 */

const ESC = "\u001b";
const ALT_ON = `${ESC}[?1049h`;
const ALT_OFF = `${ESC}[?1049l`;
const CUR_HIDE = `${ESC}[?25l`;
const CUR_SHOW = `${ESC}[?25h`;
const SYNC_ON = `${ESC}[?2026h`;
const SYNC_OFF = `${ESC}[?2026l`;
const HOME = `${ESC}[H`;
const CLR_EOL = `${ESC}[K`;
const INVERT = `${ESC}[7m`;
const RESET = `${ESC}[0m`;

type Kind = RecentKind;

/** A numbered table row as the native views print it: a border, the row number, a border. */
const ROW_RE = /^[\u2502|]\s*(\d{1,3})\s*[\u2502|]/;

interface Pending {
  kind: "confirm" | "select";
  message: string;
  choices?: Choice[];
  resolve: (v: string | boolean | undefined) => void;
}

interface State {
  lines: string[]; // rendered output history
  scroll: number; // first visible line
  followNew: boolean;
  entries: RecentEntry[];
  kind?: Kind;
  server?: string;
  selected: number;
  rowLine: Map<number, number>; // entry index → line index
  cmdStart: number; // first output line of the current command / prompt block
  input: string;
  caret: number;
  history: string[];
  histIdx: number;
  status: string;
  statusKind: "info" | "ok" | "fail" | "busy";
  busy: boolean;
  queued?: string; // a line entered while a command was running; runs next
  spinnerFrame: number;
  pending?: Pending;
  address?: string;
  profileName: string;
  signedIn: boolean;
}

/** Visible width of a string with ANSI escapes removed (approximation: 1 column per code point, 2 for wide CJK/emoji). */
export function visibleWidth(s: string): number {
  let w = 0;
  for (const ch of stripAnsi(s)) w += wide(ch) ? 2 : 1;
  return w;
}

export function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;?]*[A-Za-z]|\u001b\][^\u0007]*\u0007/g, "");
}

function wide(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0x1f300 && c <= 0x1faff);
}

/** Cut a string to `cols` visible columns, keeping escape sequences intact and resetting attributes. */
export function sliceAnsi(s: string, cols: number): string {
  let out = "";
  let w = 0;
  let i = 0;
  while (i < s.length) {
    if (s[i] === ESC) {
      const m = /^\u001b(\[[0-9;?]*[A-Za-z]|\][^\u0007]*\u0007)/.exec(s.slice(i));
      if (m) {
        out += m[0];
        i += m[0].length;
        continue;
      }
    }
    const cp = s.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    const cw = wide(ch) ? 2 : 1;
    if (w + cw > cols) break;
    out += ch;
    w += cw;
    i += ch.length;
  }
  return out + RESET;
}

function pad(s: string, cols: number): string {
  const w = visibleWidth(s);
  return w >= cols ? sliceAnsi(s, cols) : s + " ".repeat(cols - w);
}

/** What Enter does on a selected row of the last listing. Returns a command line (or a prefill needing more input). */
export function actionFor(kind: Kind | undefined, server: string | undefined, n: number, entry?: RecentEntry): { run?: string; prefill?: string; special?: "default-address" } {
  switch (kind) {
    case "restaurants":
      return { run: `food menu ${n}` };
    case "menuItems":
      return { run: `food add ${n} --qty 1` };
    case "products":
      return { run: `instamart add ${n} --qty 1` };
    case "dineout":
      return { run: `dineout slots ${n}` };
    case "slots":
      return { prefill: `dineout book ${n} --guests 2${entry?.extra?.isFree === false ? " --pay upi --wait" : ""}` };
    case "orders":
      return { run: `${server === "instamart" ? "instamart" : server === "dineout" ? "dineout status" : "food"}${server === "dineout" ? "" : " order"} ${n}`.replace("dineout status  ", "dineout status ") };
    case "addresses":
      return { special: "default-address" };
    case "locations":
      return { prefill: `dineout search  --address-id ${n}` };
    default:
      return {};
  }
}

export function commonPrefix(words: string[]): string {
  if (!words.length) return "";
  let p = words[0]!;
  for (const w of words.slice(1)) {
    let i = 0;
    while (i < p.length && i < w.length && p[i] === w[i]) i++;
    p = p.slice(0, i);
  }
  return p;
}

const HINT_FOR: Partial<Record<Kind, string>> = {
  restaurants: "Enter: open menu",
  menuItems: "Enter: add 1 to cart",
  products: "Enter: add 1 to cart",
  dineout: "Enter: see slots",
  slots: "Enter: prepare booking",
  orders: "Enter: order details",
  addresses: "Enter: make default address",
  locations: "Enter: search near it",
  coupons: "",
};

/** Terminal streams the app drives; injectable so the whole app can be exercised in tests with fake TTYs. */
export interface AppIO {
  stdin: NodeJS.ReadStream & { setRawMode?: (mode: boolean) => unknown };
  stdout: NodeJS.WriteStream;
}

export async function runApp(buildProgram: () => Command, io: AppIO = { stdin: process.stdin, stdout: process.stdout }): Promise<void> {
  if (!io.stdin.isTTY || !io.stdout.isTTY) {
    process.stderr.write("swiggy app needs an interactive terminal. Use `swiggy shell` or plain commands with --json.\n");
    process.exitCode = 2;
    return;
  }
  process.env.SWIGGY_SHELL_ACTIVE = "1";
  const template = buildProgram();
  const auth = await loadAuth();
  const { name: profileName, profile } = await getCurrentProfile();
  const st: State = {
    lines: [],
    scroll: 0,
    followNew: true,
    entries: [],
    selected: 0,
    rowLine: new Map(),
    cmdStart: 0,
    input: "",
    caret: 0,
    history: (await loadHistory()).reverse(),
    histIdx: -1,
    status: "",
    statusKind: "info",
    busy: false,
    spinnerFrame: 0,
    address: profile.defaultAddressId,
    profileName,
    signedIn: Object.values(auth.servers).some((e) => evaluateAuthHealth(e).authenticated),
  };
  const newLines: string[] = [];

  const out = io.stdout;
  const cols = () => out.columns || 100;
  const rows = () => out.rows || 30;
  const write = (s: string) => origStdoutWrite(s);
  const origStdoutWrite = out.write.bind(out);
  const origStderrWrite = process.stderr.write.bind(process.stderr);

  // ---- rendering -----------------------------------------------------------------------------
  const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const paneRows = () => Math.max(3, rows() - 4);

  function render(): void {
    const C = cols();
    const R = rows();
    const pane = paneRows();
    if (st.followNew) st.scroll = Math.max(0, st.lines.length - pane);
    st.scroll = Math.max(0, Math.min(st.scroll, Math.max(0, st.lines.length - pane)));
    const frame: string[] = [];
    // header
    const left = `${paint(PALETTE.orange, " swiggy", undefined, true)} ${paint(PALETTE.muted, `v${VERSION}`)}  ${st.signedIn ? paint(PALETTE.success, "● signed in") : paint(PALETTE.error, "● not signed in — run: auth init")}${st.address ? paint(PALETTE.muted, `  · address ${st.address.slice(0, 18)}…`) : paint(PALETTE.warn, "  · no default address")}`;
    const right = paint(PALETTE.muted, "Powered by Swiggy  ? help  q quit ");
    frame.push(pad(left, Math.max(0, C - visibleWidth(right))) + right);
    // pane
    for (let i = 0; i < pane; i++) {
      const idx = st.scroll + i;
      let line = st.lines[idx] ?? "";
      const selIdx = st.rowLine.get(st.selected);
      if (selIdx === idx && st.entries.length) line = `${INVERT}${pad(stripAnsi(line), C)}${RESET}`;
      frame.push(pad(line, C));
    }
    // status
    const spin = st.busy ? `${paint(PALETTE.orange, FRAMES[st.spinnerFrame % FRAMES.length]!)} ` : "";
    const stColor = st.statusKind === "fail" ? PALETTE.error : st.statusKind === "ok" ? PALETTE.success : st.statusKind === "busy" ? PALETTE.accent : PALETTE.muted;
    let statusText = st.pending
      ? st.pending.kind === "confirm"
        ? `${paint(PALETTE.warn, st.pending.message, undefined, true)} ${paint(PALETTE.muted, "[y/n]")}`
        : `${paint(PALETTE.warn, st.pending.message, undefined, true)} ${paint(PALETTE.muted, `↑↓ then Enter · Esc cancels · #${st.selected + 1} ${stripAnsi(st.entries[st.selected]?.label ?? "").slice(0, 48)}`)}`
      : `${spin}${paint(stColor, st.status)}`;
    if (st.queued) statusText += paint(PALETTE.muted, `   next: ${st.queued}`);
    if (!st.pending && st.entries.length && st.kind && !st.busy) statusText += paint(PALETTE.muted, `   ${st.entries.length} rows · ${HINT_FOR[st.kind] ?? ""} · #${st.selected + 1} ${stripAnsi(st.entries[st.selected]?.label ?? "").slice(0, 40)}`);
    frame.push(pad(` ${statusText}`, C));
    // input
    const promptStr = `${paint(PALETTE.orange, " swiggy", undefined, true)} ${paint(PALETTE.muted, "›")} `;
    const before = st.input.slice(0, st.caret);
    const after = st.input.slice(st.caret);
    frame.push(pad(`${promptStr}${before}${INVERT}${after[0] ?? " "}${RESET}${after.slice(1)}`, C));
    // hints
    frame.push(pad(paint(PALETTE.muted, " ↑↓ select · Enter open/run · type a command · Tab complete · PgUp/PgDn scroll · c cart · o orders · Esc clear · q quit"), C));
    write(`${SYNC_ON}${HOME}${frame.map((l) => l + CLR_EOL).join("\n")}${SYNC_OFF}`);
  }

  // ---- output capture ------------------------------------------------------------------------
  function append(text: string): void {
    const parts = text.replace(/\r/g, "").split("\n");
    if (parts[parts.length - 1] === "") parts.pop();
    for (const p of parts) newLines.push(p);
  }
  function flushNew(jumpTo?: number): void {
    if (newLines.length) {
      st.lines.push(...newLines);
      newLines.length = 0;
    }
    if (st.lines.length > 5000) {
      const drop = st.lines.length - 5000;
      st.lines.splice(0, drop);
      st.cmdStart = Math.max(0, st.cmdStart - drop);
    }
    st.rowLine.clear();
    for (let i = st.cmdStart; i < st.lines.length; i++) {
      const m = ROW_RE.exec(stripAnsi(st.lines[i]!));
      if (m && !st.rowLine.has(Number(m[1]) - 1)) st.rowLine.set(Number(m[1]) - 1, i);
    }
    if (jumpTo !== undefined) {
      // show the start of the new output (so the list is visible), not just its tail
      st.followNew = false;
      st.scroll = Math.max(0, jumpTo);
    }
  }

  // ---- prompts inside the app ---------------------------------------------------------------
  setPrompter({
    confirm: (message) =>
      new Promise<boolean>((resolve) => {
        st.pending = { kind: "confirm", message, resolve: (v) => resolve(v === true) };
        render();
      }),
    select: (message, choices) =>
      new Promise<string | undefined>((resolve) => {
        flushNew();
        const at = st.lines.length;
        append("");
        append(paint(PALETTE.orange, message, undefined, true));
        choices.forEach((c, i) => append(`| ${String(i + 1).padStart(2)} | ${c.title}`));
        st.cmdStart = at;
        flushNew(at);
        st.entries = choices.map((c) => ({ id: c.value, label: c.title }));
        st.kind = undefined;
        st.selected = 0;
        st.pending = { kind: "select", message, choices, resolve: (v) => resolve(typeof v === "string" ? v : undefined) };
        render();
      }),
  });
  setStatusSink({
    start: (t) => {
      st.busy = true;
      st.statusKind = "busy";
      st.status = t;
      render();
    },
    update: (t) => {
      st.status = t;
      render();
    },
    done: (kind, t, ms) => {
      st.busy = false;
      st.statusKind = kind === "ok" ? "ok" : kind === "fail" ? "fail" : "info";
      st.status = t ? `${t} ${paint(PALETTE.muted, fmtDuration(ms))}` : "";
      render();
    },
  });

  // ---- running commands ----------------------------------------------------------------------
  async function run(line: string): Promise<void> {
    if (st.busy) {
      // Typed ahead: keep it and run it as soon as the current command finishes (never drop input).
      st.queued = line;
      st.input = "";
      st.caret = 0;
      render();
      return;
    }
    const startedAt = Date.now();
    st.history.push(line);
    st.histIdx = -1;
    st.input = "";
    st.caret = 0;
    st.busy = true;
    st.statusKind = "busy";
    st.status = "running";
    flushNew();
    append("");
    const echoAt = st.lines.length + 1;
    append(`${paint(PALETTE.orange, "swiggy", undefined, true)} ${paint(PALETTE.muted, "›")} ${line}`);
    st.cmdStart = st.lines.length + 2;
    flushNew(echoAt);
    render();
    // Output arrives live; keep the viewport anchored on the command's first line so the start of a
    // listing is what the user sees (the tail is one PgDn away).
    const capture = ((chunk: unknown) => {
      append(typeof chunk === "string" ? chunk : String(chunk));
      flushNew(echoAt);
      render();
      return true;
    }) as typeof process.stdout.write;
    process.stdout.write = capture;
    process.stderr.write = capture as typeof process.stderr.write;
    try {
      if (line === "help" || line === "?") append(helpText());
      else await runLine(buildProgram, line);
    } finally {
      process.stdout.write = origStdoutWrite;
      process.stderr.write = origStderrWrite;
      st.busy = false;
      if (st.statusKind === "busy") {
        st.statusKind = "info";
        st.status = "";
      }
      flushNew(echoAt);
      await refreshEntries(startedAt);
      const { name: pn, profile: p } = await getCurrentProfile();
      st.profileName = pn;
      st.address = p.defaultAddressId;
      const a = await loadAuth();
      st.signedIn = Object.values(a.servers).some((e) => evaluateAuthHealth(e).authenticated);
      render();
      const next = st.queued;
      st.queued = undefined;
      if (next) await run(next);
    }
  }

  /** Adopt the listing a command just saved — only if it was saved by this command and matches the numbered rows on screen. */
  async function refreshEntries(since: number): Promise<void> {
    const last = await getLastList();
    if (last && st.rowLine.size && last.savedAt >= since - 5 && last.entries.length >= st.rowLine.size) {
      st.entries = last.entries;
      st.kind = last.kind;
      st.server = last.server;
      st.selected = 0;
    } else {
      st.entries = [];
      st.kind = undefined;
      st.rowLine.clear();
    }
  }

  function helpText(): string {
    return [
      paint(PALETTE.orange, "swiggy app", undefined, true),
      "  Type any swiggy command (without 'swiggy'), e.g.  food search biryani  ·  instamart search milk  ·  dineout search italian --address-id 1",
      "  ↑ ↓         move the selection over the numbered rows of the last listing",
      "  Enter       run the typed command, or act on the selected row (menu / add to cart / slots / booking / order details)",
      "  Tab         complete the command; ← → move the caret; Esc clears the line; ↑ ↓ recall history when there is no listing",
      "  c / o / a   cart · orders · addresses for the current service (food unless the last listing was instamart/dineout)",
      "  PgUp/PgDn   scroll the output; Home/End jump; q quits when the line is empty; Ctrl+C always quits",
      "  Orders, bookings, cart clearing and address deletion ask for confirmation here (y/n).",
      paint(PALETTE.muted, "  Powered by Swiggy · independent, community-built CLI · not an official Swiggy product"),
    ].join("\n");
  }

  // ---- keyboard ------------------------------------------------------------------------------
  const stdin = io.stdin;
  emitKeypressEvents(stdin);
  stdin.setRawMode?.(true);
  stdin.resume();
  write(`${ALT_ON}${CUR_HIDE}`);
  const spinTimer = setInterval(() => {
    if (st.busy) {
      st.spinnerFrame++;
      render();
    }
  }, 80);
  out.on("resize", render);

  let quit!: () => void;
  const done = new Promise<void>((resolve) => (quit = resolve));

  async function onEnter(): Promise<void> {
    const line = st.input.trim();
    if (st.pending?.kind === "select") {
      const p = st.pending;
      st.pending = undefined;
      const choice = p.choices?.[st.selected];
      st.entries = [];
      st.cmdStart = st.lines.length;
      st.rowLine.clear();
      p.resolve(choice?.value);
      render();
      return;
    }
    if (line) {
      if (line === "exit" || line === "quit") return quit();
      if (line === "clear") {
        st.lines = [];
        st.rowLine.clear();
        st.entries = [];
        st.input = "";
        st.caret = 0;
        render();
        return;
      }
      await run(line);
      return;
    }
    if (st.entries.length) {
      const n = st.selected + 1;
      const act = actionFor(st.kind, st.server, n, st.entries[st.selected]);
      if (act.special === "default-address") {
        const id = st.entries[st.selected]!.id;
        await setProfileField(st.profileName, "defaultAddressId", id);
        st.address = id;
        st.statusKind = "ok";
        st.status = `default address set to ${id}`;
        render();
        return;
      }
      if (act.run) return run(act.run);
      if (act.prefill) {
        st.input = act.prefill;
        st.caret = act.prefill.includes("search  --") ? act.prefill.indexOf("search ") + 7 : act.prefill.length;
        render();
      }
    }
  }

  const onKey = (str: string | undefined, key: { name?: string; ctrl?: boolean; meta?: boolean; shift?: boolean; sequence?: string }) => {
    const name = key?.name ?? "";
    if (key?.ctrl && name === "c") return quit();
    if (st.pending?.kind === "confirm") {
      const p = st.pending;
      if (name === "y") {
        st.pending = undefined;
        p.resolve(true);
      } else if (name === "n" || name === "escape") {
        st.pending = undefined;
        p.resolve(false);
      }
      render();
      return;
    }
    if (st.pending?.kind === "select" && name === "escape") {
      const p = st.pending;
      st.pending = undefined;
      st.entries = [];
      st.cmdStart = st.lines.length;
      st.rowLine.clear();
      p.resolve(undefined);
      render();
      return;
    }
    const pane = paneRows();
    switch (name) {
      case "return":
      case "enter":
        void onEnter();
        return;
      case "up":
        if (st.entries.length) {
          st.selected = Math.max(0, st.selected - 1);
          ensureSelectedVisible();
        } else if (st.history.length) {
          st.histIdx = st.histIdx < 0 ? st.history.length - 1 : Math.max(0, st.histIdx - 1);
          st.input = st.history[st.histIdx] ?? "";
          st.caret = st.input.length;
        }
        break;
      case "down":
        if (st.entries.length) {
          st.selected = Math.min(st.entries.length - 1, st.selected + 1);
          ensureSelectedVisible();
        } else if (st.histIdx >= 0) {
          st.histIdx = st.histIdx + 1 >= st.history.length ? -1 : st.histIdx + 1;
          st.input = st.histIdx < 0 ? "" : (st.history[st.histIdx] ?? "");
          st.caret = st.input.length;
        }
        break;
      case "left":
        st.caret = Math.max(0, st.caret - 1);
        break;
      case "right":
        st.caret = Math.min(st.input.length, st.caret + 1);
        break;
      case "home":
        if (st.input) st.caret = 0;
        else {
          st.followNew = false;
          st.scroll = 0;
        }
        break;
      case "end":
        if (st.input) st.caret = st.input.length;
        else st.followNew = true;
        break;
      case "pageup":
        st.followNew = false;
        st.scroll = Math.max(0, st.scroll - pane);
        break;
      case "pagedown":
        st.scroll = Math.min(Math.max(0, st.lines.length - pane), st.scroll + pane);
        st.followNew = st.scroll >= st.lines.length - pane;
        break;
      case "backspace":
        if (st.caret > 0) {
          st.input = st.input.slice(0, st.caret - 1) + st.input.slice(st.caret);
          st.caret--;
        }
        break;
      case "delete":
        st.input = st.input.slice(0, st.caret) + st.input.slice(st.caret + 1);
        break;
      case "escape":
        st.input = "";
        st.caret = 0;
        st.histIdx = -1;
        break;
      case "tab": {
        const [hits, prefix] = completions(template, st.input.slice(0, st.caret));
        // one hit: complete it and add a space; several: fill the shared prefix and list them
        const fill = hits.length === 1 ? hits[0] + " " : commonPrefix(hits);
        if (fill.length > prefix.length) {
          st.input = st.input.slice(0, st.caret - prefix.length) + fill + st.input.slice(st.caret);
          st.caret = st.caret - prefix.length + fill.length;
        }
        if (hits.length > 1) {
          st.statusKind = "info";
          st.status = hits.join("  ");
        }
        break;
      }
      default: {
        if (key?.ctrl && name === "u") {
          st.input = "";
          st.caret = 0;
          break;
        }
        if (key?.ctrl && name === "l") {
          st.lines = [];
          st.rowLine.clear();
          st.entries = [];
          break;
        }
        if (!st.input && !st.busy && str && !key?.ctrl && !key?.meta) {
          const svc = st.server === "instamart" ? "instamart" : st.server === "dineout" ? "dineout" : "food";
          if (str === "q") return quit();
          if (str === "?") return void run("help");
          if (str === "c" && svc !== "dineout") return void run(`${svc} cart`);
          if (str === "o") return void run(svc === "dineout" ? "dineout locations" : `${svc} orders`);
          if (str === "a") return void run(svc === "dineout" ? "dineout locations" : `${svc} addresses`);
        }
        if (str && !key?.ctrl && !key?.meta && str >= " ") {
          st.input = st.input.slice(0, st.caret) + str + st.input.slice(st.caret);
          st.caret += str.length;
        }
      }
    }
    render();
  };
  stdin.on("keypress", onKey);

  function ensureSelectedVisible(): void {
    const li = st.rowLine.get(st.selected);
    if (li === undefined) return;
    const pane = paneRows();
    st.followNew = false;
    if (li < st.scroll) st.scroll = li;
    else if (li >= st.scroll + pane) st.scroll = li - pane + 1;
  }

  // ---- first paint ---------------------------------------------------------------------------
  append(helpText());
  flushNew();
  st.followNew = true;
  if (!st.signedIn) {
    st.statusKind = "fail";
    st.status = "not signed in — type: auth init";
  } else if (!st.address) {
    st.statusKind = "info";
    st.status = "pick a default address first: press a, then Enter on the one you want";
  } else {
    st.statusKind = "info";
    st.status = "ready — try: food search biryani";
  }
  render();

  await done;

  clearInterval(spinTimer);
  out.off("resize", render);
  setStatusSink(undefined);
  setPrompter(undefined);
  stdin.removeListener("keypress", onKey);
  stdin.setRawMode?.(false);
  stdin.pause();
  write(`${CUR_SHOW}${ALT_OFF}`);
  const existing = (await loadHistory()).reverse();
  await saveHistory([...existing, ...st.history.filter((h) => !existing.includes(h))].slice(-500));
  if (st.busy) {
    // A command is still running (e.g. `auth init` waiting for the browser). Its sockets would keep the
    // process alive with no UI attached, so end it here; the terminal is already restored.
    process.stderr.write("swiggy: left while a command was still running; stopped it.\n");
    process.exit(process.exitCode ?? 0);
  }
}
