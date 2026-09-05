import { Command } from "commander";
import { runApp } from "../tui/app.js";

export function buildAppCommand(program: Command, buildProgram: () => Command): void {
  program
    .command("app")
    .alias("ui")
    .description("Full-screen interactive session: arrow keys over results, Enter to drill in, one warm MCP session (default when swiggy runs with no arguments)")
    .action(async () => {
      await runApp(buildProgram);
    });
}
