import { homedir } from "node:os";
import { join } from "node:path";

const home = process.env.SWIGGY_HOME || join(homedir(), ".swiggy");

export const PATHS = {
  home,
  configFile: join(home, "config.json"),
  authFile: join(home, "auth.json"),
  cacheDir: join(home, "cache"),
  /** Persisted `Mcp-Session-Id` per server, so consecutive CLI invocations reuse one MCP session. */
  sessionFile: join(home, "cache", "sessions.json"),
  /** Last known Dineout coordinates (from a search/details response) reused by slots/book. */
  dineoutCoordsFile: join(home, "cache", "dineout-coords.json"),
};
