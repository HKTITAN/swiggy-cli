export function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY) && process.env.CI !== "true";
}

export function isMachineMode(opts: { json?: boolean; plain?: boolean; raw?: boolean; noInteractive?: boolean }): boolean {
  return Boolean(opts.json || opts.plain || opts.raw || opts.noInteractive) || !isInteractive();
}

export function shouldUseColor(opts: { json?: boolean; plain?: boolean; quiet?: boolean; noInteractive?: boolean }): boolean {
  if (opts.json || opts.plain || opts.noInteractive) return false;
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout.isTTY);
}
