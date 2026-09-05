import type { CliEnvelope } from "../../types/index.js";
import { chooseColumns, pickList } from "./human.js";

/**
 * TSV-friendly plain renderer. Flattens the most useful array-of-objects in the payload to a
 * header row + value rows (same column selection as the human table). Objects become
 * `key<TAB>value` lines; scalars print as-is.
 */
export function renderPlain<T>(envelope: CliEnvelope<T>): void {
  if (!envelope.ok) {
    process.stderr.write(`error\t${envelope.error.code}\t${envelope.error.message}\n`);
    return;
  }
  const data = envelope.data as unknown;
  const list = pickList(data);
  if (list) {
    const headers = chooseColumns(list.rows);
    process.stdout.write(headers.join("\t") + "\n");
    for (const row of list.rows) process.stdout.write(headers.map((h) => stringify(row[h])).join("\t") + "\n");
    return;
  }
  if (typeof data === "object" && data !== null) {
    for (const [k, v] of Object.entries(data)) process.stdout.write(`${k}\t${stringify(v)}\n`);
    return;
  }
  process.stdout.write(stringify(data) + "\n");
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}
