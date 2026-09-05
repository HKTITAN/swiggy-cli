import { Command } from "commander";
import { attachOutputOptions, readGlobalOpts, run } from "./common.js";
import { renderResult } from "../lib/output.js";
import { listProfiles, useProfile, createProfile, deleteProfile, setProfileField } from "../lib/profiles.js";
import { UsageError } from "../lib/errors.js";
import type { ProfileConfig } from "../types/index.js";

const NUMERIC_KEYS = new Set<keyof ProfileConfig>(["defaultLat", "defaultLng"]);
const KNOWN_KEYS: Array<keyof ProfileConfig> = ["defaultCity", "defaultServer", "defaultAddressId", "defaultLat", "defaultLng", "output"];

export function buildProfileCommands(program: Command): void {
  const p = program.command("profile").description("Profiles: default address, coordinates, output mode, endpoint overrides");

  attachOutputOptions(
    p.command("list").description("List profiles").action(async () => {
      const opts = readGlobalOpts(p);
      await run(opts, async () => {
        const data = await listProfiles();
        const flat = Object.entries(data.profiles).map(([name, prof]) => ({
          name,
          current: name === data.current,
          defaultAddressId: prof.defaultAddressId ?? "",
          defaultLat: prof.defaultLat ?? "",
          defaultLng: prof.defaultLng ?? "",
          defaultCity: prof.defaultCity ?? "",
          output: prof.output ?? "human",
        }));
        renderResult(flat, { ...opts, tool: "profile.list" });
      });
    })
  );

  attachOutputOptions(
    p.command("use <name>").description("Switch the active profile").action(async (name: string) => {
      const opts = readGlobalOpts(p);
      await run(opts, async () => {
        await useProfile(name);
        renderResult({ active: name }, { ...opts, tool: "profile.use" });
      });
    })
  );

  attachOutputOptions(
    p
      .command("create <name>")
      .description("Create a profile")
      .option("--city <city>", "default city (informational)")
      .option("--address-id <id>", "default Swiggy addressId for food/instamart commands")
      .option("--output <mode>", "default output mode (human|json|plain)", "human")
      .action(async (name: string, o: { city?: string; addressId?: string; output?: "human" | "json" | "plain" }) => {
        const opts = readGlobalOpts(p);
        await run(opts, async () => {
          await createProfile(name, { defaultCity: o.city, defaultAddressId: o.addressId, output: o.output });
          renderResult({ created: name }, { ...opts, tool: "profile.create" });
        });
      })
  );

  attachOutputOptions(
    p.command("delete <name>").description("Delete a profile").action(async (name: string) => {
      const opts = readGlobalOpts(p);
      await run(opts, async () => {
        await deleteProfile(name);
        renderResult({ deleted: name }, { ...opts, tool: "profile.delete" });
      });
    })
  );

  attachOutputOptions(
    p
      .command("set <name> <key> <value>")
      .description(`Set a profile field: ${KNOWN_KEYS.join(", ")}`)
      .action(async (name: string, key: string, value: string) => {
        const opts = readGlobalOpts(p);
        await run(opts, async () => {
          if (!KNOWN_KEYS.includes(key as keyof ProfileConfig)) throw new UsageError(`Unknown profile key "${key}".`, `Valid keys: ${KNOWN_KEYS.join(", ")}`);
          let v: unknown = value;
          if (NUMERIC_KEYS.has(key as keyof ProfileConfig)) {
            v = Number(value);
            if (!Number.isFinite(v)) throw new UsageError(`${key} must be a number.`);
          }
          if (key === "output" && !["human", "json", "plain"].includes(value)) throw new UsageError("output must be human, json or plain.");
          if (key === "defaultServer" && !["food", "instamart", "dineout"].includes(value)) throw new UsageError("defaultServer must be food, instamart or dineout.");
          await setProfileField(name, key as keyof ProfileConfig, v as never);
          renderResult({ updated: { name, key, value: v } }, { ...opts, tool: "profile.set" });
        });
      })
  );
}
