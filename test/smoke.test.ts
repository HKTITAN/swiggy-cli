import { describe, it, expect } from "vitest";
import { TOOL_CATALOG, ERGONOMIC_ALIASES, DESTRUCTIVE_TOOLS } from "../src/lib/aliases.js";
import { EXIT_CODE, CliError } from "../src/lib/errors.js";
import { renderJson } from "../src/lib/renderers/json.js";

describe("aliases", () => {
  it("every alias points to a real tool in the catalog", () => {
    for (const [server, map] of Object.entries(ERGONOMIC_ALIASES)) {
      const valid = new Set(TOOL_CATALOG[server as keyof typeof TOOL_CATALOG]);
      for (const [verb, tool] of Object.entries(map)) {
        expect(valid.has(tool), `${server}.${verb} → ${tool}`).toBe(true);
      }
    }
  });

  it("destructive tools all exist in some catalog", () => {
    const all = new Set(Object.values(TOOL_CATALOG).flat());
    for (const t of DESTRUCTIVE_TOOLS) expect(all.has(t)).toBe(true);
  });

  it("expected counts match upstream reference (food=14, instamart=13, dineout=8)", () => {
    expect(TOOL_CATALOG.food.length).toBe(14);
    expect(TOOL_CATALOG.instamart.length).toBe(13);
    expect(TOOL_CATALOG.dineout.length).toBe(8);
  });
});

describe("error contract", () => {
  it("every code has an exit mapping", () => {
    for (const code of Object.keys(EXIT_CODE)) {
      expect(typeof EXIT_CODE[code as keyof typeof EXIT_CODE]).toBe("number");
    }
  });

  it("CliError preserves code and details", () => {
    const e = new CliError("AUTH_REQUIRED", "x", { details: { a: 1 }, hint: "y" });
    expect(e.code).toBe("AUTH_REQUIRED");
    expect(e.details).toEqual({ a: 1 });
    expect(e.hint).toBe("y");
  });
});

describe("renderers", () => {
  it("renderJson writes a single line of valid JSON", () => {
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout.write as unknown) = (s: string) => {
      chunks.push(s);
      return true;
    };
    try {
      renderJson({ ok: true, data: { hello: "world" } });
    } finally {
      (process.stdout.write as unknown) = orig;
    }
    expect(chunks.length).toBe(1);
    const line = chunks[0]!.trimEnd();
    expect(() => JSON.parse(line)).not.toThrow();
    const parsed = JSON.parse(line);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.hello).toBe("world");
  });
});
