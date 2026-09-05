import { Command } from "commander";
import { createInterface, type Interface } from "node:readline";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "../lib/paths.js";
import { PALETTE, paint } from "../lib/ui.js";
import { VERSION } from "../lib/version.js";
import { loadAuth, evaluateAuthHealth } from "../lib/auth.js";
import { setPrompter, type Choice } from "../lib/prompter.js";

/**
 * `swiggy shell` — a line-oriented interactive session (the full-screen app is `swiggy app`).
 *
 * Every line runs in-process, so the MCP session, auth token and Node runtime stay warm: one
 * `initialize` per server per session instead of one per command, which also keeps you inside
 * Swiggy's auth-event rate limit. Tab completes commands; ↑/↓ recalls history (~/.swiggy/history).
 *
 * The shell answers prompts (address picker, confirmations) on its own line reader. It must not
 * let a second readline take over stdin: that is what ended the session after one command in 0.2.0.
 */

const HISTORY_FILE = join(PATHS.home, "history");
const MAX_HISTORY = 500;

export function buildShellCommand(program: Command, buildProgram: () => Command): void {
  program
    .command("shell")
    .alias("repl")
    .description("Line-oriented interactive session with a warm MCP session, tab completion and history")
    .action(async () => {
      await runShell(buildProgram);
    });
}

/** Split a command line into argv, honouring single/double quotes and backslash escapes. */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | undefined;
  let has = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quote) {
      if (ch === quote) quote = undefined;
      else if (ch === "\\" && quote === '"' && i + 1 < line.length) cur += line[++i];
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (ch === "\\" && i + 1 < line.length) cur += line[++i];
    else if (/\s/.test(ch)) {
      if (cur || has) out.push(cur);
      cur = "";
      has = false;
    } else cur += ch;
  }
  if (cur || has) out.push(cur);
  return out;
}

/** Completion candidates for a partial line, from the program's command tree. */
export function completions(program: Command, line: string): [string[], string] {
  const commands = program.commands.map((c) => c.name());
  const parts = line.split(/\s+/).filter(Boolean);
  const trailingSpace = /\s$/.test(line);
  if (parts.length === 0 || (parts.length === 1 && !trailingSpace)) {
    const prefix = parts[0] ?? "";
    return [[...commands, "help", "exit", "clear"].filter((c) => c.startsWith(prefix)), prefix];
  }
  const top = program.commands.find((c) => c.name() === parts[0] || c.aliases().includes(parts[0]!));
  const subs = top ? top.commands.map((s) => s.name()) : [];
  if (parts.length === 1 || (parts.length === 2 && !trailingSpace)) {
    const prefix = parts[1] ?? "";
    return [subs.filter((s) => s.startsWith(prefix)), prefix];
  }
  return [[], ""];
}

/** Run one command line in-process against a fresh program; never throws, never exits the process. */
export async function runLine(buildProgram: () => Command, line: string): Promise<void> {
  const argv = line === "help" || line === "?" ? ["--help"] : tokenize(line.replace(/^swiggy\s+/, ""));
  const p = buildProgram();
  // exitOverride/configureOutput are copied to subcommands only at creation time, so apply them to the whole tree:
  // otherwise `food nonsense` or `food menu --help` would exit the process and end the session.
  const walk = (c: Command): void => {
    c.exitOverride();
    c.configureOutput({ writeErr: (t) => process.stderr.write(t), writeOut: (t) => process.stdout.write(t) });
    for (const sub of c.commands) walk(sub);
  };
  walk(p);
  process.exitCode = 0;
  try {
    await p.parseAsync(argv, { from: "user" });
  } catch (e) {
    const ce = e as { code?: string; message?: string };
    const code = String(ce.code ?? "");
    if (!code.startsWith("commander.") && ce.message) process.stderr.write(`${paint(PALETTE.error, "✖")} ${ce.message}\n`);
  } finally {
    process.exitCode = 0;
  }
}

function ask(rl: Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a)));
}

/** Prompts answered on the shell's own readline (numbered list + y/n), so stdin never changes hands. */
function shellPrompter(rl: Interface) {
  return {
    async select(message: string, choices: Choice[]): Promise<string | undefined> {
      process.stderr.write(`${paint(PALETTE.orange, message, undefined, true)}\n`);
      choices.forEach((c, i) => process.stderr.write(`  ${paint(PALETTE.muted, String(i + 1).padStart(2))}  ${c.title}\n`));
      const a = (await ask(rl, `${paint(PALETTE.muted, "pick a number (Enter to cancel)")} › `)).trim();
      const n = Number(a);
      if (!a || !Number.isInteger(n) || n < 1 || n > choices.length) return undefined;
      return choices[n - 1]!.value;
    },
    async confirm(message: string): Promise<boolean> {
      const a = (await ask(rl, `${paint(PALETTE.warn, message)} ${paint(PALETTE.muted, "[y/N]")} › `)).trim().toLowerCase();
      return a === "y" || a === "yes";
    },
  };
}

export interface ShellIO {
  stdin: NodeJS.ReadStream & { setRawMode?: (mode: boolean) => unknown; isRaw?: boolean };
  stdout: NodeJS.WriteStream;
}

export async function runShell(buildProgram: () => Command, io: ShellIO = { stdin: process.stdin, stdout: process.stdout }): Promise<void> {
  process.env.SWIGGY_SHELL_ACTIVE = "1";
  const template = buildProgram();
  const history = await loadHistory();
  const auth = await loadAuth();
  const signedIn = Object.values(auth.servers).some((e) => evaluateAuthHealth(e).authenticated);

  process.stderr.write(
    `${paint(PALETTE.orange, "swiggy", undefined, true)} ${paint(PALETTE.muted, `v${VERSION} · interactive session · try \`swiggy app\` for the full-screen UI`)}\n` +
      `${paint(PALETTE.muted, signedIn ? "signed in · type a command (e.g. food search biryani), 'help', or 'exit'" : "not signed in · run 'auth init' first")}\n\n`
  );

  const rl = createInterface({
    input: io.stdin,
    output: io.stdout,
    terminal: true,
    history,
    historySize: MAX_HISTORY,
    removeHistoryDuplicates: true,
    prompt: `${paint(PALETTE.orange, "swiggy", undefined, true)} ${paint(PALETTE.muted, "›")} `,
    completer: (line: string) => completions(template, line),
  });
  setPrompter(shellPrompter(rl));
  // Belt and braces: nothing a command does to stdin may end the session; only 'exit'/Ctrl+D do.
  const keepAlive = setInterval(() => undefined, 1 << 30);

  const lines: string[] = [];
  let running = false;
  rl.prompt();
  rl.on("line", async (raw) => {
    const line = raw.trim();
    if (running) return;
    if (!line) return rl.prompt();
    if (line === "exit" || line === "quit" || line === ".exit") return rl.close();
    if (line === "clear") {
      io.stdout.write("\u001b[2J\u001b[H");
      return rl.prompt();
    }
    lines.push(line);
    running = true;
    try {
      await runLine(buildProgram, line);
    } finally {
      running = false;
      if (io.stdin.isTTY && !io.stdin.isRaw && typeof io.stdin.setRawMode === "function") io.stdin.setRawMode(true);
      rl.resume();
      rl.prompt();
    }
  });
  await new Promise<void>((resolve) => rl.on("close", () => resolve()));
  clearInterval(keepAlive);
  setPrompter(undefined);
  await saveHistory([...history.slice().reverse(), ...lines].slice(-MAX_HISTORY));
  process.stderr.write(`${paint(PALETTE.muted, "bye")}\n`);
}

export async function loadHistory(): Promise<string[]> {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    return (await readFile(HISTORY_FILE, "utf8")).split("\n").filter(Boolean).slice(-MAX_HISTORY).reverse();
  } catch {
    return [];
  }
}

export async function saveHistory(lines: string[]): Promise<void> {
  try {
    await mkdir(PATHS.home, { recursive: true });
    await writeFile(HISTORY_FILE, lines.join("\n") + "\n", { mode: 0o600 });
  } catch {
    /* best-effort */
  }
}
