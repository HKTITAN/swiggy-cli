import { createRequire } from "node:module";
import type Table from "cli-table3";
import type prompts from "prompts";

/**
 * Lazy loaders for the two UI-only dependencies. Machine-mode invocations (`--json`, agents in a
 * loop) never touch them, which keeps startup close to the bare Node floor. Both packages are CJS,
 * so a synchronous `require` through createRequire is safe and works from `dist/` and `src/`.
 */
const req = createRequire(import.meta.url);

let tableCtor: typeof Table | undefined;
export function loadTable(): typeof Table {
  if (!tableCtor) tableCtor = req("cli-table3") as typeof Table;
  return tableCtor;
}

let promptsFn: typeof prompts | undefined;
export function loadPrompts(): typeof prompts {
  if (!promptsFn) promptsFn = req("prompts") as typeof prompts;
  return promptsFn;
}
