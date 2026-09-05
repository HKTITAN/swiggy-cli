import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMockMcp } from "./helpers/mock-mcp.js";
import { FakeTTY, pretendTTY, stripAnsi, until } from "./helpers/fake-tty.js";

/**
 * The line-oriented session must survive an interactive prompt: in 0.2.0 the address picker
 * (prompts library) tore stdin down and the session ended after the first command.
 */

let mock: Awaited<ReturnType<typeof startMockMcp>>;
let restore: () => void;
let shell: typeof import("../src/commands/shell.js");
let buildProgram: typeof import("../src/program.js").buildProgram;

beforeAll(async () => {
  mock = await startMockMcp();
  const home = await mkdtemp(join(tmpdir(), "swiggy-shell-"));
  await writeFile(join(home, "auth.json"), JSON.stringify({ servers: { food: { accessToken: "test-token", expiresAt: Date.now() + 86_400_000 } } }));
  await writeFile(join(home, "config.json"), JSON.stringify({ currentProfile: "default", profiles: { default: { output: "human" } } }));
  process.env.SWIGGY_HOME = home;
  process.env.SWIGGY_FOOD_URL = mock.url;
  process.env.SWIGGY_NO_BANNER = "1";
  restore = pretendTTY();
  shell = await import("../src/commands/shell.js");
  buildProgram = (await import("../src/program.js")).buildProgram;
});

afterAll(async () => {
  restore();
  await mock.close();
});

describe("swiggy shell", () => {
  it("keeps running after an address prompt, a second command and a confirmation", async () => {
    const stdin = new FakeTTY();
    const stdout = FakeTTY.output();
    const captured: string[] = [];
    const so = process.stdout.write;
    const se = process.stderr.write;
    const cap = ((chunk: unknown) => {
      captured.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stdout.write = cap;
    process.stderr.write = cap as typeof process.stderr.write;
    const out = () => stripAnsi(captured.join("") + stdout.chunks.join(""));
    try {
      const done = shell.runShell(buildProgram, { stdin: stdin as unknown as NodeJS.ReadStream, stdout: stdout as unknown as NodeJS.WriteStream });
      await until(() => out().includes("interactive session"), "shell banner", out);
      stdin.write("food search biryani\n");
      await until(() => out().includes("pick a number"), "address picker on the shell's own reader", out);
      stdin.write("2\n");
      await until(() => out().includes("Behrouz Biryani"), "search results", out);
      expect(mock.state.calls.find((c) => c.name === "search_restaurants")?.args).toMatchObject({ addressId: "addr_2" });

      // the session is still alive: a second command runs (the 0.2.0 bug ended the process here)
      stdin.write("food menu 1\n");
      await until(() => out().includes("Paneer Biryani"), "menu after the prompt", out);

      // destructive commands ask y/N on the same reader
      stdin.write("food clear\n");
      await until(() => out().includes("[y/N]"), "confirm prompt", out);
      stdin.write("y\n");
      await until(() => mock.state.calls.some((c) => c.name === "flush_food_cart"), "flush called", out);

      stdin.write("exit\n");
      await done;
      expect(out()).toContain("bye");
      expect(out()).not.toContain("███"); // no ASCII banner per command inside the session
    } finally {
      process.stdout.write = so;
      process.stderr.write = se;
    }
  }, 30_000);

  it("tokenizes quoted arguments", () => {
    expect(shell.tokenize('food search "chicken biryani" --limit 5')).toEqual(["food", "search", "chicken biryani", "--limit", "5"]);
    expect(shell.tokenize("call food echo --input '{\"a\":\"b c\"}'")).toEqual(["call", "food", "echo", "--input", '{"a":"b c"}']);
    expect(shell.tokenize("a\\ b")).toEqual(["a b"]);
    expect(shell.tokenize("")).toEqual([]);
  });
});
