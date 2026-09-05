import { PassThrough } from "node:stream";

/**
 * Fake terminal streams for driving the interactive sessions in-process: a readable "stdin" that
 * accepts key sequences and a writable "stdout" that records frames. Both claim to be TTYs so the
 * CLI's interactive paths (address picker, confirmations, colour) are exercised exactly as for a user.
 */
export class FakeTTY extends PassThrough {
  isTTY = true;
  columns = 120;
  rows = 32;
  isRaw = false;
  chunks: string[] = [];
  setRawMode(mode: boolean): this {
    this.isRaw = mode;
    return this;
  }
  /** Record what was written, and also pass it through so a reader (keypress decoder, readline) receives it. */
  override _write(chunk: Buffer | string, _enc: BufferEncoding, cb: (e?: Error | null) => void): void {
    this.chunks.push(chunk.toString());
    this.push(chunk);
    cb();
  }
  /** For a stream used as stdout: nobody reads it, so drain the readable side to avoid buffering. */
  static output(): FakeTTY {
    const s = new FakeTTY();
    s.resume();
    return s;
  }
  /** Everything written so far, ANSI stripped. */
  text(): string {
    return stripAnsi(this.chunks.join(""));
  }
  /** The most recent full-screen frame (after the last cursor-home), ANSI stripped, as lines. */
  screen(): string[] {
    const all = this.chunks.join("");
    const frames = all.split("\u001b[H");
    return stripAnsi(frames[frames.length - 1] ?? "")
      .split("\n")
      .map((l) => l.replace(/\s+$/, ""));
  }
}

export const KEY = {
  up: "\u001b[A",
  down: "\u001b[B",
  left: "\u001b[D",
  right: "\u001b[C",
  enter: "\r",
  pageDown: "\u001b[6~",
  pageUp: "\u001b[5~",
  tab: "\t",
  backspace: "\u007f",
  ctrlU: "\u0015",
  ctrlC: "\u0003",
};

export function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;?]*[A-Za-z]|\u001b\][^\u0007]*\u0007/g, "");
}

/** Poll until `pred` is true (default 8 s), otherwise throw with the latest output for diagnosis. */
export async function until(pred: () => boolean, what: string, diag: () => string, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(`timed out waiting for ${what}\n--- last output ---\n${diag()}`);
}

/** Temporarily make the worker's process streams look like a terminal (the CLI checks process.stdout/stdin). */
export function pretendTTY(): () => void {
  const saved = {
    out: Object.getOwnPropertyDescriptor(process.stdout, "isTTY"),
    in: Object.getOwnPropertyDescriptor(process.stdin, "isTTY"),
    ci: process.env.CI,
  };
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
  process.env.CI = "";
  return () => {
    if (saved.out) Object.defineProperty(process.stdout, "isTTY", saved.out);
    else delete (process.stdout as { isTTY?: boolean }).isTTY;
    if (saved.in) Object.defineProperty(process.stdin, "isTTY", saved.in);
    else delete (process.stdin as { isTTY?: boolean }).isTTY;
    if (saved.ci === undefined) delete process.env.CI;
    else process.env.CI = saved.ci;
  };
}
