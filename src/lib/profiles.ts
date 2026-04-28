import { loadConfig, saveConfig } from "./config.js";
import type { ProfileConfig } from "../types/index.js";
import { CliError } from "./errors.js";

export async function listProfiles(): Promise<{ current: string; profiles: Record<string, ProfileConfig> }> {
  const cfg = await loadConfig();
  return { current: cfg.currentProfile, profiles: cfg.profiles };
}

export async function useProfile(name: string): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg.profiles[name]) {
    throw new CliError("CONFIG_ERROR", `Profile "${name}" does not exist.`, {
      hint: `Create it: swiggy profile create ${name}`,
    });
  }
  cfg.currentProfile = name;
  await saveConfig(cfg);
}

export async function createProfile(name: string, profile: ProfileConfig = {}): Promise<void> {
  const cfg = await loadConfig();
  if (cfg.profiles[name]) {
    throw new CliError("CONFIG_ERROR", `Profile "${name}" already exists.`);
  }
  cfg.profiles[name] = { output: "human", ...profile };
  await saveConfig(cfg);
}

export async function deleteProfile(name: string): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg.profiles[name]) {
    throw new CliError("CONFIG_ERROR", `Profile "${name}" does not exist.`);
  }
  if (name === "default") {
    throw new CliError("CONFIG_ERROR", `Cannot delete the "default" profile.`);
  }
  delete cfg.profiles[name];
  if (cfg.currentProfile === name) cfg.currentProfile = "default";
  await saveConfig(cfg);
}

export async function setProfileField<K extends keyof ProfileConfig>(
  name: string,
  key: K,
  value: ProfileConfig[K]
): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg.profiles[name]) throw new CliError("CONFIG_ERROR", `Profile "${name}" does not exist.`);
  cfg.profiles[name][key] = value;
  await saveConfig(cfg);
}
