import { loadPrompts } from "./lazy.js";

/**
 * Interactive prompts behind one small interface so different hosts can supply their own:
 *   - plain CLI runs: the `prompts` library (default)
 *   - `swiggy shell`:  readline-based questions on the shell's own line reader
 *   - `swiggy app`:    the full-screen UI answers them in its status line / list pane
 *
 * Why: the `prompts` library creates a second readline on stdin and tears the terminal down when it
 * finishes, which broke the interactive session after its first question. Hosts that own the
 * terminal must own the prompts too.
 */
export interface Choice {
  title: string;
  value: string;
  description?: string;
}

export interface Prompter {
  select(message: string, choices: Choice[]): Promise<string | undefined>;
  confirm(message: string): Promise<boolean>;
}

const defaultPrompter: Prompter = {
  async select(message, choices) {
    const prompts = loadPrompts();
    const res = await prompts({ type: "select", name: "value", message, choices: choices.map((c) => ({ title: c.title, value: c.value, description: c.description })) });
    return typeof res.value === "string" ? res.value : undefined;
  },
  async confirm(message) {
    const prompts = loadPrompts();
    const res = await prompts({ type: "confirm", name: "value", message, initial: false });
    return res.value === true;
  },
};

let current: Prompter = defaultPrompter;

export function setPrompter(p: Prompter | undefined): void {
  current = p ?? defaultPrompter;
}

export function getPrompter(): Prompter {
  return current;
}
