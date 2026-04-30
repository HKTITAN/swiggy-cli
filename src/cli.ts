import { Command } from "commander";
import chalk from "chalk";
import { buildGenericCommands } from "./commands/generic.js";
import { buildFoodCommands } from "./commands/food.js";
import { buildInstamartCommands } from "./commands/instamart.js";
import { buildDineoutCommands } from "./commands/dineout.js";
import { buildAuthCommands } from "./commands/auth.js";
import { buildConfigCommands } from "./commands/config.js";
import { buildProfileCommands } from "./commands/profile.js";
import { buildDoctorCommand } from "./commands/doctor.js";
import { renderError, renderStartupBanner } from "./lib/output.js";
import { CliError } from "./lib/errors.js";
import { BRAND } from "./lib/output.js";

const VERSION = "0.1.2";

const program = new Command();

program
  .name("swiggy")
  .description(
    `${chalk.hex(BRAND.orange).bold("swiggy")} — human- and agent-friendly CLI for the Swiggy MCP servers.\n` +
      `Wraps Food, Instamart, and Dineout MCP endpoints with stable JSON output, profiles, and OAuth.\n\n` +
      `Powered by Swiggy MCP (https://mcp.swiggy.com/builders/).\n` +
      `This is an unofficial community CLI; it is not the official Swiggy CLI and is not affiliated with\n` +
      `or endorsed by Bundl Technologies / Swiggy.`
  )
  .version(VERSION, "-v, --version")
  .option("--json", "emit JSON envelope on stdout")
  .option("--plain", "emit TSV-style line-oriented output")
  .option("--raw", "emit raw MCP response payload")
  .option("--quiet", "suppress non-essential output")
  .option("--no-interactive", "disable prompts and spinners (machine mode)")
  .option("-y, --yes", "auto-confirm destructive actions")
  .option("--profile <name>", "use a named profile")
  .showHelpAfterError("(run swiggy --help for usage)")
  .addHelpText(
    "after",
    `\nExamples:\n` +
      `  $ swiggy food search-restaurants --query "biryani" --city Delhi\n` +
      `  $ swiggy instamart search --query "milk bread eggs" --json\n` +
      `  $ swiggy dineout search --query "italian" --city Delhi\n` +
      `  $ swiggy servers --json\n` +
      `  $ swiggy tools food | head\n` +
      `  $ swiggy schema food search_restaurants\n` +
      `  $ swiggy call food search_restaurants --input '{"query":"pizza"}'\n` +
      `  $ swiggy auth init --server food\n` +
      `  $ swiggy doctor\n\n` +
      `Docs: see README.md and ./wiki/`
  );

buildGenericCommands(program);
buildFoodCommands(program);
buildInstamartCommands(program);
buildDineoutCommands(program);
buildAuthCommands(program);
buildConfigCommands(program);
buildProfileCommands(program);
buildDoctorCommand(program);

program.hook("preAction", (_thisCommand, actionCommand) => {
  const opts = actionCommand.optsWithGlobals();
  renderStartupBanner(opts);
});

program.parseAsync(process.argv).catch((err: unknown) => {
  const opts = program.opts();
  process.exitCode = renderError(
    err instanceof CliError ? err : new CliError("UNKNOWN", err instanceof Error ? err.message : String(err)),
    opts
  );
});
