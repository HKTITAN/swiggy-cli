import { buildProgram } from "./program.js";
import { renderError } from "./lib/output.js";
import { CliError } from "./lib/errors.js";
import { isInteractive } from "./lib/tty.js";

const program = buildProgram();

// `swiggy` with no arguments in a terminal opens the full-screen app; piped/CI usage prints help.
const argv = process.argv.length <= 2 && isInteractive() && !process.env.SWIGGY_NO_SHELL ? [...process.argv, "app"] : process.argv;

program.parseAsync(argv).catch((err: unknown) => {
  const opts = program.opts();
  process.exitCode = renderError(err instanceof CliError ? err : new CliError("UNKNOWN", err instanceof Error ? err.message : String(err)), opts);
});
