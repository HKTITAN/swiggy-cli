import { ConfirmationRequiredError } from "./errors.js";
import { isMachineMode } from "./tty.js";
import { loadPrompts } from "./lazy.js";
import type { OutputOptions } from "../types/index.js";

export async function confirm(action: string, opts: OutputOptions): Promise<void> {
  if (opts.yes) return;
  if (isMachineMode(opts)) throw new ConfirmationRequiredError(action);
  const prompts = loadPrompts();
  const { value } = await prompts({
    type: "confirm",
    name: "value",
    message: `${action} — proceed?`,
    initial: false,
  });
  if (!value) throw new ConfirmationRequiredError(action);
}
