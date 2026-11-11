import { describe, it, expect } from "vitest";
import { TOOL_CATALOG, TOOL_COUNTS, ERGONOMIC_ALIASES, DESTRUCTIVE_TOOLS, WRITE_TOOLS, PAYMENT_TOOLS, PLACE_ORDER_TOOL, LEGACY_TOOLS, WIDGET_ONLY_TOOLS, NON_IDEMPOTENT_TOOLS } from "../src/lib/aliases.js";
import { EXIT_CODE, CliError, RateLimitError } from "../src/lib/errors.js";
import { renderJson } from "../src/lib/renderers/json.js";
import { VERSION } from "../src/lib/version.js";
import { createRequire } from "node:module";

const pkg = createRequire(import.meta.url)("../package.json") as { version: string };

describe("catalog (verified against mcp.swiggy.com/builders/docs/reference on 2026-11-11)", () => {
  it("has 62 tools: food=20, instamart=16, dineout=11, scenes=15", () => {
    expect(TOOL_COUNTS).toEqual({ food: 20, instamart: 16, dineout: 11, scenes: 15 });
    expect(Object.values(TOOL_CATALOG).flat().length).toBe(62);
  });

  it("legacy tools are kept out of the catalog", () => {
    for (const [server, tools] of Object.entries(LEGACY_TOOLS)) {
      for (const t of tools) expect(TOOL_CATALOG[server as keyof typeof TOOL_CATALOG], `${server}.${t}`).not.toContain(t);
    }
  });

  it("every alias points to a published tool, or to one marked legacy", () => {
    for (const [server, map] of Object.entries(ERGONOMIC_ALIASES)) {
      const valid = new Set([...TOOL_CATALOG[server as keyof typeof TOOL_CATALOG], ...LEGACY_TOOLS[server as keyof typeof LEGACY_TOOLS]]);
      for (const [verb, tool] of Object.entries(map)) expect(valid.has(tool), `${server}.${verb} → ${tool}`).toBe(true);
    }
  });

  it("every catalog tool has a named command, except the widget-only ones", () => {
    for (const [server, tools] of Object.entries(TOOL_CATALOG)) {
      const aliased = new Set(Object.values(ERGONOMIC_ALIASES[server as keyof typeof ERGONOMIC_ALIASES]));
      for (const t of tools) expect(aliased.has(t) || WIDGET_ONLY_TOOLS.has(t), `${server}.${t} has no alias`).toBe(true);
    }
  });

  it("the shared Payment stage exists on every server", () => {
    for (const tools of Object.values(TOOL_CATALOG)) for (const p of PAYMENT_TOOLS) expect(tools).toContain(p);
    expect(PLACE_ORDER_TOOL).toEqual({ food: "place_food_order", instamart: "checkout", dineout: "book_table", scenes: "place_event_order" });
    // Every place-order tool is one Swiggy does not de-duplicate, and every one of those needs --yes.
    expect([...NON_IDEMPOTENT_TOOLS].sort()).toEqual(Object.values(PLACE_ORDER_TOOL).sort());
    for (const t of NON_IDEMPOTENT_TOOLS) expect(DESTRUCTIVE_TOOLS.has(t), t).toBe(true);
  });

  it("destructive tools all exist and are a subset of write tools", () => {
    const all = new Set([...Object.values(TOOL_CATALOG).flat(), ...Object.values(LEGACY_TOOLS).flat()]);
    for (const t of DESTRUCTIVE_TOOLS) {
      expect(all.has(t), t).toBe(true);
      expect(WRITE_TOOLS.has(t), t).toBe(true);
    }
    expect(DESTRUCTIVE_TOOLS.has("cancel_booking")).toBe(true);
    expect(DESTRUCTIVE_TOOLS.has("confirm_order")).toBe(false); // idempotent, never places an unpaid order
  });

  it("no tool names contain uppercase or spaces", () => {
    for (const t of Object.values(TOOL_CATALOG).flat()) expect(t).toMatch(/^[a-z_]+$/);
  });
});

describe("error contract", () => {
  it("every code has a unique-enough exit mapping in 1..10", () => {
    for (const [code, exit] of Object.entries(EXIT_CODE)) {
      expect(typeof exit, code).toBe("number");
      expect(exit).toBeGreaterThanOrEqual(1);
      expect(exit).toBeLessThanOrEqual(10);
    }
    expect(EXIT_CODE.RATE_LIMITED).toBe(9);
    expect(EXIT_CODE.PAYMENT_FAILED).toBe(10);
  });

  it("CliError preserves code, details and hint", () => {
    const e = new CliError("AUTH_REQUIRED", "x", { details: { a: 1 }, hint: "y" });
    expect(e.code).toBe("AUTH_REQUIRED");
    expect(e.details).toEqual({ a: 1 });
    expect(e.hint).toBe("y");
  });

  it("RateLimitError carries Retry-After", () => {
    const e = new RateLimitError("food", 23);
    expect(e.code).toBe("RATE_LIMITED");
    expect(e.retryAfterSeconds).toBe(23);
    expect(e.message).toContain("23s");
  });
});

describe("version", () => {
  it("is read from package.json (single source of truth)", () => {
    expect(VERSION).toBe(pkg.version);
    expect(VERSION).not.toBe("0.0.0");
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
    const parsed = JSON.parse(chunks[0]!.trimEnd());
    expect(parsed.ok).toBe(true);
    expect(parsed.data.hello).toBe("world");
  });
});
