import { Command } from "commander";
import { attachOutputOptions, readGlobalOpts } from "./common.js";
import { renderError, renderResult } from "../lib/output.js";
import { loadConfig, saveConfig, DEFAULT_ENDPOINTS } from "../lib/config.js";
import { PATHS } from "../lib/paths.js";

export function buildConfigCommands(program: Command): void {
  const cfg = program.command("config").description("Manage swiggy-cli configuration");

  attachOutputOptions(
    cfg
      .command("init")
      .description("Initialize a default config file at ~/.swiggy/config.json")
      .action(async () => {
        const opts = readGlobalOpts(cfg);
        try {
          const c = await loadConfig();
          await saveConfig(c);
          renderResult({ path: PATHS.configFile, profile: c.currentProfile }, opts);
        } catch (err) {
          process.exitCode = renderError(err, opts);
        }
      })
  );

  attachOutputOptions(
    cfg
      .command("show")
      .description("Print the current configuration")
      .action(async () => {
        const opts = readGlobalOpts(cfg);
        try {
          const c = await loadConfig();
          renderResult({ ...c, paths: PATHS, defaultEndpoints: DEFAULT_ENDPOINTS }, opts);
        } catch (err) {
          process.exitCode = renderError(err, opts);
        }
      })
  );

  attachOutputOptions(
    cfg
      .command("path")
      .description("Print the on-disk paths swiggy-cli uses")
      .action(async () => {
        renderResult(PATHS, readGlobalOpts(cfg));
      })
  );
}
