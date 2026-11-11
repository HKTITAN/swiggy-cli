import { Command } from "commander";
import { buildGenericCommands } from "./commands/generic.js";
import { buildFoodCommands } from "./commands/food.js";
import { buildInstamartCommands } from "./commands/instamart.js";
import { buildDineoutCommands } from "./commands/dineout.js";
import { buildScenesCommands } from "./commands/scenes.js";
import { buildAuthCommands, runWhoami } from "./commands/auth.js";
import { buildConfigCommands } from "./commands/config.js";
import { buildProfileCommands } from "./commands/profile.js";
import { buildDoctorCommand } from "./commands/doctor.js";
import { buildShellCommand } from "./commands/shell.js";
import { buildAppCommand } from "./commands/tui.js";
import { attachOutputOptions, readGlobalOpts } from "./commands/common.js";
import { renderError, renderStartupBanner } from "./lib/output.js";
import { UsageError } from "./lib/errors.js";
import { PALETTE, paint } from "./lib/ui.js";
import { VERSION } from "./lib/version.js";
import { DOCS } from "./lib/config.js";
import { ERGONOMIC_ALIASES, LEGACY_NOTE, LEGACY_TOOLS } from "./lib/aliases.js";
import { SERVER_NAMES } from "./types/index.js";

/** Build a fresh commander program. A factory so the interactive shell can parse one line at a time. */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("swiggy")
    .description(
      `${paint(PALETTE.orange, "swiggy", undefined, true)} — Swiggy from your terminal, for people and for agents.\n` +
        `Food, Instamart, Dineout and Scenes: search, order, book, pay by UPI and track, with one login and stable JSON output.\n\n` +
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
        `  $ swiggy auth init                                   # one browser login for all four services\n` +
        `  $ swiggy food addresses                              # pick an addressId once, then:\n` +
        `  $ swiggy profile set default defaultAddressId <id>\n` +
        `  $ swiggy food search -q biryani\n` +
        `  $ swiggy food search-menu -q "paneer tikka" --veg --json\n` +
        `  $ swiggy instamart search -q milk\n` +
        `  $ swiggy instamart set-cart --spin-id <spinId> --sku-id <skuId> --quantity 2\n` +
        `  $ swiggy instamart checkout --pay upi --wait          # scan-or-tap link, polls, confirms\n` +
        `  $ swiggy dineout search italian --lat 12.9716 --lng 77.5946\n` +
        `  $ swiggy scenes discover --lat 12.9716 --lng 77.5946  # events; then: scenes shows <#>, scenes cart --show <#> --guests 2\n` +
        `  $ swiggy call food search_restaurants --input '{"addressId":"<id>","query":"pizza"}' --json\n` +
        `  $ swiggy docs reference/food/search_menu             # official docs as Markdown\n` +
        `  $ swiggy app                                         # full-screen session (also: just plain ` + `swiggy` + `)\n` +
        `  $ swiggy shell                                       # line-oriented session\n\n` +
        `Docs: ${DOCS.base}/docs/  ·  README.md  ·  ./wiki/  ·  AGENTS.md`
    );

  buildGenericCommands(program);
  buildFoodCommands(program);
  buildInstamartCommands(program);
  buildDineoutCommands(program);
  buildScenesCommands(program);
  markLegacyCommands(program);
  buildAuthCommands(program);
  buildConfigCommands(program);
  buildProfileCommands(program);
  buildDoctorCommand(program);
  buildShellCommand(program, buildProgram);
  buildAppCommand(program, buildProgram);

  attachOutputOptions(
    program
      .command("whoami")
      .description("Show signed-in identity (alias for auth whoami)")
      .option("--server <name>", "server: food|instamart|dineout|scenes (default: all)")
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
      event: "swiggy scenes",
      tickets: "swiggy scenes",
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

/** Say so in `--help` when a named command calls a tool Swiggy no longer publishes. */
function markLegacyCommands(program: Command): void {
  for (const server of SERVER_NAMES) {
    const group = program.commands.find((c) => c.name() === server);
    if (!group) continue;
    for (const cmd of group.commands) {
      const tool = ERGONOMIC_ALIASES[server][cmd.name()];
      if (tool && LEGACY_TOOLS[server].includes(tool)) cmd.description(`${cmd.description()} [legacy: ${LEGACY_NOTE}]`);
    }
  }
}
