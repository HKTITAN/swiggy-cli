import { Command } from "commander";
import { createInterface } from "node:readline";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "../lib/paths.js";
import { PALETTE, paint } from "../lib/ui.js";
import { VERSION } from "../lib/version.js";
import { loadAuth, evaluateAuthHealth } from "../lib/auth.js";

/**
 * `swiggy shell` — an interactive session (the closest a per-command CLI gets to Grok Build's TUI).
 *
 * Why it feels faster: every line runs in-process, so the MCP session, auth token and Node runtime
 * are all warm. One `initialize` handshake per server per session instead of one per command, which
 * also keeps you well inside Swiggy's auth-event rate limit.
 *
 * Tab completes commands and subcommands; ↑/↓ recalls history (persisted to ~/.swiggy/history).
 */

const HISTORY_FILE = join(PATHS.home, "history");
const MAX_HISTORY = 500;

export function buildShellCommand(program: Command, buildProgram: () => Command): void {
  program
    .command("shell")
    .alias("repl")
    .description("Interactive session: run swiggy commands with a warm MCP session, tab completion and history")
    .action(async () => {
      await runShell(buildProgram);
    });
}

export async function runShell(buildProgram: () => Command): Promise<void> {
  const template = buildProgram();
  const commands = template.commands.map((c) => c.name());
  const subcommands = new Map<string, string[]>(template.commands.map((c) => [c.name(), c.commands.map((s) => s.name())]));
  const history = await loadHistory();
  const auth = await loadAuth();
  const signedIn = Object.values(auth.servers).some((e) => evaluateAuthHealth(e).authenticated);

  process.stderr.write(
    `${paint(PALETTE.orange, "swiggy", undefined, true)} ${paint(PALETTE.muted, `v${VERSION} · interactive session`)}\n` +
      `${paint(PALETTE.muted, signedIn ? "signed in · type a command (e.g. food search -q biryani), 'help', or 'exit'" : "not signed in · run 'auth init' first")}\n\n`
  );

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    history,
    historySize: MAX_HISTORY,
    removeHistoryDuplicates: true,
    prompt: `${paint(PALETTE.orange, "swiggy", undefined, true)} ${paint(PALETTE.muted, "›")} `,
    completer: (line: string) => {
      const parts = line.split(/\s+/).filter(Boolean);
      const trailingSpace = /\s$/.test(line);
      if (parts.length === 0 || (parts.length === 1 && !trailingSpace)) {
        const prefix = parts[0] ?? "";
        const hits = [...commands, "help", "exit", "clear"].filter((c) => c.startsWith(prefix));
        return [hits, prefix];
      }
      const subs = subcommands.get(parts[0]!) ?? [];
      if (parts.length === 1 || (parts.length === 2 && !trailingSpace)) {
        const prefix = parts[1] ?? "";
        return [subs.filter((s) => s.startsWith(prefix)), prefix];
      }
      return [[], ""];
    },
  });

  const lines: string[] = [];
  let running = false;
  rl.prompt();
  rl.on("line", async (raw) => {
    const line = raw.trim();
    if (!line) return rl.prompt();
    if (line === "exit" || line === "quit" || line === ".exit") return rl.close();
    if (line === "clear") {
      process.stdout.write("\u001b[2J\u001b[H");
      return rl.prompt();
    }
    lines.push(line);
    if (running) return;
    running = true;
    rl.pause();
    try {
      const argv = line === "help" || line === "?" ? ["--help"] : tokenize(line.replace(/^swiggy\s+/, ""));
      const p = buildProgram();
      p.exitOverride();
      p.configureOutput({ writeErr: (s) => process.stderr.write(s), writeOut: (s) => process.stdout.write(s) });
      process.exitCode = 0;
      await p.parseAsync(argv, { from: "user" });
    } catch (e) {
      const ce = e as { code?: string; message?: string; exitCode?: number };
      if (ce.code !== "commander.helpDisplayed" && ce.code !== "commander.version" && ce.code !== "commander.help") {
        if (ce.message && !String(ce.code ?? "").startsWith("commander.")) process.stderr.write(`${paint(PALETTE.error, "✖")} ${ce.message}\n`);
      }
    } finally {
      process.exitCode = 0;
      running = false;
      rl.resume();
      rl.prompt();
    }
  });
  await new Promise<void>((resolve) => rl.on("close", () => resolve()));
  await saveHistory([...history.slice().reverse(), ...lines].slice(-MAX_HISTORY));
  process.stderr.write(`${paint(PALETTE.muted, "bye")}\n`);
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

async function loadHistory(): Promise<string[]> {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    return (await readFile(HISTORY_FILE, "utf8")).split("\n").filter(Boolean).slice(-MAX_HISTORY).reverse();
  } catch {
    return [];
  }
}

async function saveHistory(lines: string[]): Promise<void> {
  try {
    await mkdir(PATHS.home, { recursive: true });
    await writeFile(HISTORY_FILE, lines.join("\n") + "\n", { mode: 0o600 });
  } catch {
    /* best-effort */
  }
}
