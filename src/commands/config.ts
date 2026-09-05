import { Command } from "commander";
import { attachOutputOptions, readGlobalOpts, run } from "./common.js";
import { renderResult } from "../lib/output.js";
import { loadConfig, saveConfig, DEFAULT_ENDPOINTS, DOCS } from "../lib/config.js";
import { PATHS } from "../lib/paths.js";
import { VERSION } from "../lib/version.js";

export function buildConfigCommands(program: Command): void {
  const cfg = program.command("config").description("Manage swiggy-cli configuration");

  attachOutputOptions(
    cfg
      .command("init")
      .description("Write a default config file at ~/.swiggy/config.json")
      .action(async () => {
        const opts = readGlobalOpts(cfg);
        await run(opts, async () => {
          const c = await loadConfig();
          await saveConfig(c);
          renderResult({ path: PATHS.configFile, profile: c.currentProfile }, { ...opts, tool: "config.init" });
        });
      })
  );

  attachOutputOptions(
    cfg
      .command("show")
      .description("Print the current configuration, paths and endpoints")
      .action(async () => {
        const opts = readGlobalOpts(cfg);
        await run(opts, async () => {
          const c = await loadConfig();
          renderResult({ version: VERSION, ...c, paths: PATHS, defaultEndpoints: DEFAULT_ENDPOINTS, docs: DOCS.base }, { ...opts, tool: "config.show" });
        });
      })
  );

  attachOutputOptions(
    cfg
      .command("path")
      .description("Print the on-disk paths swiggy-cli uses")
      .action(async () => {
        const opts = readGlobalOpts(cfg);
        await run(opts, async () => {
          renderResult(PATHS, { ...opts, tool: "config.path" });
        });
      })
  );
}
