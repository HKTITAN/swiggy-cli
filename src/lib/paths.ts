import { homedir } from "node:os";
import { join } from "node:path";

const home = process.env.SWIGGY_HOME || join(homedir(), ".swiggy");

export const PATHS = {
  home,
  configFile: join(home, "config.json"),
  authFile: join(home, "auth.json"),
  cacheDir: join(home, "cache"),
};
