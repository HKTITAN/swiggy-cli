import { homedir } from "node:os";
import { join } from "node:path";

const home = process.env.SWIGGY_HOME || join(homedir(), ".swiggy");

export const PATHS = {
  home,
  configFile: join(home, "config.json"),
  authFile: join(home, "auth.json"),
  cacheDir: join(home, "cache"),
  /** Per-server handshake record (and `Mcp-Session-Id` when the server issues one), so consecutive CLI invocations skip `initialize`. */
  sessionFile: join(home, "cache", "sessions.json"),
  /** Last known Dineout coordinates (from a search/details response) reused by slots/book. */
  dineoutCoordsFile: join(home, "cache", "dineout-coords.json"),
  /** Last coordinates a Scenes discovery/search response resolved, reused by every follow-up Scenes call. */
  scenesCoordsFile: join(home, "cache", "scenes-coords.json"),
  /** The last event cart created with `scenes cart` (selection + cartKey + checkoutMode), reused by `scenes book`. */
  scenesCartFile: join(home, "cache", "scenes-cart.json"),
};
