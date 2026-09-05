interface ModeOpts {
  json?: boolean;
  plain?: boolean;
  raw?: boolean;
  quiet?: boolean;
  noInteractive?: boolean;
  interactive?: boolean;
}

export function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY) && process.env.CI !== "true";
}

/** True when the caller asked for machine mode explicitly (`--no-interactive`). */
export function noInteractiveRequested(opts: ModeOpts): boolean {
  return Boolean(opts.noInteractive) || opts.interactive === false;
}

export function isMachineMode(opts: ModeOpts): boolean {
  return Boolean(opts.json || opts.plain || opts.raw) || noInteractiveRequested(opts) || !isInteractive();
}

export function shouldUseColor(opts: ModeOpts): boolean {
  if (opts.json || opts.plain || noInteractiveRequested(opts)) return false;
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout.isTTY);
}
