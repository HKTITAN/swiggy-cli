import Table from "cli-table3";
import chalk from "chalk";
import type { CliEnvelope } from "../../types/index.js";
import { BRAND } from "../output.js";
import { shouldUseColor } from "../tty.js";

interface HumanCtx {
  json?: boolean;
  plain?: boolean;
  quiet?: boolean;
  server?: string;
  tool?: string;
}

/** Generic fallback human renderer. Specialized renderers live in commands/. */
export function renderHuman<T>(envelope: CliEnvelope<T>, ctx: HumanCtx): void {
  if (!envelope.ok) return; // errors handled by renderError
  const data = envelope.data as unknown;
  const colored = shouldUseColor(ctx);
  const heading = colored ? chalk.hex(BRAND.orange).bold : (s: string) => s;

  if (envelope.tool && envelope.server) {
    process.stdout.write(heading(`${envelope.server} › ${envelope.tool}`) + "\n");
  }

  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
    const headers = Array.from(
      data.reduce<Set<string>>((set, row) => {
        Object.keys(row as object).forEach((k) => set.add(k));
        return set;
      }, new Set())
    ).slice(0, 8);
    const t = new Table({
      head: headers.map((h) => (colored ? chalk.hex(BRAND.orange)(h) : h)),
      style: { head: [], border: [] },
      wordWrap: true,
    });
    for (const row of data as Record<string, unknown>[]) {
      t.push(headers.map((h) => fmt(row[h])));
    }
    process.stdout.write(t.toString() + "\n");
    return;
  }

  if (typeof data === "object" && data !== null) {
    const t = new Table({ style: { head: [], border: [] }, wordWrap: true });
    for (const [k, v] of Object.entries(data)) {
      t.push([colored ? chalk.bold(k) : k, fmt(v)]);
    }
    process.stdout.write(t.toString() + "\n");
    return;
  }

  process.stdout.write(String(data) + "\n");
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
