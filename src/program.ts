import { Command } from "commander";
import { buildGenericCommands } from "./commands/generic.js";
import { buildFoodCommands } from "./commands/food.js";
import { buildInstamartCommands } from "./commands/instamart.js";
import { buildDineoutCommands } from "./commands/dineout.js";
import { buildAuthCommands, runWhoami } from "./commands/auth.js";
import { buildConfigCommands } from "./commands/config.js";
import { buildProfileCommands } from "./commands/profile.js";
import { buildDoctorCommand } from "./commands/doctor.js";
import { buildShellCommand } from "./commands/shell.js";
import { attachOutputOptions, readGlobalOpts } from "./commands/common.js";
import { renderError, renderStartupBanner } from "./lib/output.js";
import { UsageError } from "./lib/errors.js";
import { PALETTE, paint } from "./lib/ui.js";
import { VERSION } from "./lib/version.js";
import { DOCS } from "./lib/config.js";

/** Build a fresh commander program. A factory so the interactive shell can parse one line at a time. */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("swiggy")
    .description(
      `${paint(PALETTE.orange, "swiggy", undefined, true)} — human- and agent-friendly CLI for the official Swiggy MCP servers.\n` +
        `Food, Instamart and Dineout: 51 tools, UPI / Swiggy Money payments, stable JSON output, one shared login.\n\n` +
        `Powered by Swiggy (${DOCS.base}/). Independent, community-built CLI — not an official Swiggy product.`
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
    .showSuggestionAfterError(true)
    .addHelpText(
      "after",
      `\nExamples:\n` +
        `  $ swiggy auth init                                   # one browser login for all three servers\n` +
        `  $ swiggy food addresses                              # pick an addressId once, then:\n` +
        `  $ swiggy profile set default defaultAddressId <id>\n` +
        `  $ swiggy food search -q biryani\n` +
        `  $ swiggy food search-menu -q "paneer tikka" --veg --json\n` +
        `  $ swiggy instamart search -q milk\n` +
        `  $ swiggy instamart set-cart --spin-id <spinId> --sku-id <skuId> --quantity 2\n` +
        `  $ swiggy instamart checkout --pay upi --wait          # scan-or-tap link, polls, confirms\n` +
        `  $ swiggy dineout search -q italian --address-id <id>\n` +
        `  $ swiggy call food search_restaurants --input '{"addressId":"<id>","query":"pizza"}' --json\n` +
        `  $ swiggy docs reference/food/search_menu             # official docs as Markdown\n` +
        `  $ swiggy shell                                       # interactive session\n\n` +
        `Docs: ${DOCS.base}/docs/  ·  README.md  ·  ./wiki/  ·  AGENTS.md`
    );

  buildGenericCommands(program);
  buildFoodCommands(program);
  buildInstamartCommands(program);
  buildDineoutCommands(program);
  buildAuthCommands(program);
  buildConfigCommands(program);
  buildProfileCommands(program);
  buildDoctorCommand(program);
  buildShellCommand(program, buildProgram);

  attachOutputOptions(
    program
      .command("whoami")
      .description("Show signed-in identity (alias for auth whoami)")
      .option("--server <name>", "server: food|instamart|dineout (default: all)")
      .action(async (o: { server?: string }) => {
        await runWhoami(readGlobalOpts(program), o.server);
      })
  );

  program.on("command:*", (operands) => {
    const attempted = operands?.[0] ?? "";
    const aliases: Record<string, string> = {
      me: "swiggy whoami",
      login: "swiggy auth init",
      signin: "swiggy auth init",
      logout: "swiggy auth logout",
      im: "swiggy instamart",
      pay: "swiggy <food|instamart> checkout --pay upi --wait",
    };
    const hint = aliases[attempted] !== undefined ? `Did you mean: ${aliases[attempted]}` : "Run: swiggy --help to see available commands";
    process.exitCode = renderError(new UsageError(`Unknown command "${attempted}". ${hint}`, hint), readGlobalOpts(program));
  });

  program.hook("preAction", (_thisCommand, actionCommand) => {
    if (process.env.SWIGGY_SHELL_ACTIVE) return;
    renderStartupBanner(actionCommand.optsWithGlobals());
  });

  return program;
}
