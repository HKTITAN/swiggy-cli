import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { PATHS } from "./paths.js";
import type { RootConfig, ProfileConfig, ServerName } from "../types/index.js";
import { CliError } from "./errors.js";

const DEFAULT_CONFIG: RootConfig = {
  currentProfile: "default",
  profiles: {
    default: {
      output: "human",
      defaultCity: undefined,
    },
  },
};

export const DEFAULT_ENDPOINTS: Record<ServerName, string> = {
  food: "https://mcp.swiggy.com/food",
  instamart: "https://mcp.swiggy.com/im",
  dineout: "https://mcp.swiggy.com/dineout",
};

/** Swiggy Builders Club docs — every page is also served as Markdown by appending `.md`. */
export const DOCS = {
  base: "https://mcp.swiggy.com/builders",
  index: "https://mcp.swiggy.com/builders/llms.txt",
  full: "https://mcp.swiggy.com/builders/llms-full.txt",
  reference: "https://mcp.swiggy.com/builders/docs/reference/",
  authenticate: "https://mcp.swiggy.com/builders/docs/start/authenticate/",
  payments: "https://mcp.swiggy.com/builders/docs/build/recipes/pay-with-upi/",
  rateLimits: "https://mcp.swiggy.com/builders/docs/operate/rate-limits/",
  errors: "https://mcp.swiggy.com/builders/docs/reference/errors/",
};

/** Human-readable labels for servers (Swiggy's own naming). */
export const SERVER_LABEL: Record<ServerName, string> = {
  food: "Swiggy Food",
  instamart: "Swiggy Instamart",
  dineout: "Swiggy Dineout",
};

/** The `domain` value Swiggy's `report_error` tool expects for each server. */
export const SERVER_DOMAIN: Record<ServerName, string> = {
  food: "food",
  instamart: "im",
  dineout: "dineout",
};

async function ensureDir(file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
}

export async function loadConfig(): Promise<RootConfig> {
  if (!existsSync(PATHS.configFile)) return structuredClone(DEFAULT_CONFIG);
  try {
    const raw = await readFile(PATHS.configFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<RootConfig>;
    return {
      currentProfile: parsed.currentProfile || "default",
      profiles: parsed.profiles && Object.keys(parsed.profiles).length > 0 ? parsed.profiles : DEFAULT_CONFIG.profiles,
    };
  } catch (err) {
    throw new CliError("CONFIG_ERROR", `Failed to read config at ${PATHS.configFile}: ${(err as Error).message}`);
  }
}

export async function saveConfig(cfg: RootConfig): Promise<void> {
  await ensureDir(PATHS.configFile);
  await writeFile(PATHS.configFile, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

export async function getCurrentProfile(selectedProfile?: string): Promise<{ name: string; profile: ProfileConfig }> {
  const cfg = await loadConfig();
  const envProfile = process.env.SWIGGY_PROFILE;
  const name = selectedProfile || envProfile || cfg.currentProfile || "default";
  const profile = cfg.profiles[name] || {};
  return { name, profile };
}

export function endpointFor(server: ServerName, profile: ProfileConfig): string {
  return profile.endpoints?.[server] || process.env[`SWIGGY_${server.toUpperCase()}_URL`] || DEFAULT_ENDPOINTS[server];
}
