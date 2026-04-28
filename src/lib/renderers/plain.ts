import type { CliEnvelope } from "../../types/index.js";

/**
 * TSV-friendly plain renderer. Best-effort flatten of common shapes
 * (arrays of objects → header row + value rows). Falls back to JSON.
 */
export function renderPlain<T>(envelope: CliEnvelope<T>): void {
  if (!envelope.ok) {
    process.stderr.write(`error\t${envelope.error.code}\t${envelope.error.message}\n`);
    return;
  }
  const data = envelope.data as unknown;
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
    const headers = Array.from(
      data.reduce<Set<string>>((set, row) => {
        Object.keys(row as object).forEach((k) => set.add(k));
        return set;
      }, new Set())
    );
    process.stdout.write(headers.join("\t") + "\n");
    for (const row of data as Record<string, unknown>[]) {
      process.stdout.write(headers.map((h) => stringify(row[h])).join("\t") + "\n");
    }
    return;
  }
  if (typeof data === "object" && data !== null) {
    for (const [k, v] of Object.entries(data)) {
      process.stdout.write(`${k}\t${stringify(v)}\n`);
    }
    return;
  }
  process.stdout.write(stringify(data) + "\n");
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.replace(/\t/g, " ").replace(/\n/g, " ");
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}
