import { ConfirmationRequiredError } from "./errors.js";
import { isMachineMode } from "./tty.js";
import { getPrompter } from "./prompter.js";
import type { OutputOptions } from "../types/index.js";

export async function confirm(action: string, opts: OutputOptions): Promise<void> {
  if (opts.yes) return;
  if (isMachineMode(opts)) throw new ConfirmationRequiredError(action);
  const ok = await getPrompter().confirm(`${action} — proceed?`);
  if (!ok) throw new ConfirmationRequiredError(action);
}
