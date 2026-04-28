import type { CliEnvelope } from "../../types/index.js";

/** Strict JSON renderer. Writes ONE JSON object to stdout, no prose, no color. */
export function renderJson<T>(envelope: CliEnvelope<T>): void {
  process.stdout.write(JSON.stringify(envelope) + "\n");
}
