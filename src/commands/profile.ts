import { Command } from "commander";
import { attachOutputOptions, readGlobalOpts } from "./common.js";
import { renderError, renderResult } from "../lib/output.js";
import { listProfiles, useProfile, createProfile, deleteProfile, setProfileField } from "../lib/profiles.js";

export function buildProfileCommands(program: Command): void {
  const p = program.command("profile").description("Manage profiles (city, defaults, output mode)");

  attachOutputOptions(
    p.command("list").description("List profiles").action(async () => {
      const opts = readGlobalOpts(p);
      try {
        const data = await listProfiles();
        const flat = Object.entries(data.profiles).map(([name, prof]) => ({
          name,
          current: name === data.current,
          defaultCity: prof.defaultCity ?? "",
          defaultServer: prof.defaultServer ?? "",
          output: prof.output ?? "human",
        }));
        renderResult(flat, opts);
      } catch (err) {
        process.exitCode = renderError(err, opts);
      }
    })
  );

  attachOutputOptions(
    p.command("use <name>").description("Switch active profile").action(async (name: string) => {
      const opts = readGlobalOpts(p);
      try {
        await useProfile(name);
        renderResult({ active: name }, opts);
      } catch (err) {
        process.exitCode = renderError(err, opts);
      }
    })
  );

  attachOutputOptions(
    p
      .command("create <name>")
      .description("Create a profile")
      .option("--city <city>", "default city")
      .option("--output <mode>", "default output mode (human|json|plain)", "human")
      .action(async (name: string, o: { city?: string; output?: "human" | "json" | "plain" }) => {
        const opts = readGlobalOpts(p);
        try {
          await createProfile(name, { defaultCity: o.city, output: o.output });
          renderResult({ created: name }, opts);
        } catch (err) {
          process.exitCode = renderError(err, opts);
        }
      })
  );

  attachOutputOptions(
    p.command("delete <name>").description("Delete a profile").action(async (name: string) => {
      const opts = readGlobalOpts(p);
      try {
        await deleteProfile(name);
        renderResult({ deleted: name }, opts);
      } catch (err) {
        process.exitCode = renderError(err, opts);
      }
    })
  );

  attachOutputOptions(
    p
      .command("set <name> <key> <value>")
      .description("Set a field on a profile (e.g. defaultCity, output, defaultServer)")
      .action(async (name: string, key: string, value: string) => {
        const opts = readGlobalOpts(p);
        try {
          await setProfileField(name, key as never, value as never);
          renderResult({ updated: { name, key, value } }, opts);
        } catch (err) {
          process.exitCode = renderError(err, opts);
        }
      })
  );
}
