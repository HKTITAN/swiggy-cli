import prompts from "prompts";
import { ConfirmationRequiredError } from "./errors.js";
import { isMachineMode } from "./tty.js";
import type { OutputOptions } from "../types/index.js";

export async function confirm(action: string, opts: OutputOptions): Promise<void> {
  if (opts.yes) return;
  if (isMachineMode(opts) || opts.noInteractive) {
    throw new ConfirmationRequiredError(action);
  }
  const { value } = await prompts({
    type: "confirm",
    name: "value",
    message: `${action} — proceed?`,
    initial: false,
  });
  if (!value) throw new ConfirmationRequiredError(action);
}
