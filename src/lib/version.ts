import { createRequire } from "node:module";

/**
 * Single source of truth for the CLI version: package.json.
 * Works both from the bundled `dist/cli.js` (../package.json) and from
 * `tsx src/cli.ts` during development (../../package.json).
 */
const require = createRequire(import.meta.url);

function readVersion(): string {
  for (const candidate of ["../package.json", "../../package.json"]) {
    try {
      const pkg = require(candidate) as { name?: string; version?: string };
      if (pkg?.name === "swiggy-cli" && typeof pkg.version === "string") return pkg.version;
    } catch {
      /* try next */
    }
  }
  return "0.0.0";
}

export const VERSION: string = readVersion();
export const USER_AGENT = `swiggy-cli/${VERSION} (+https://github.com/HKTITAN/swiggy-cli)`;
