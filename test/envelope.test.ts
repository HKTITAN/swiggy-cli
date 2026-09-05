import { describe, it, expect } from "vitest";
import { extractToolPayload, unwrapSwiggyEnvelope, isSwiggyEnvelope, parseSseEvent, extractDeprecation } from "../src/lib/mcp.js";
import { pickList, chooseColumns } from "../src/lib/renderers/human.js";
import { extractAddresses, compact, hintForToolError } from "../src/commands/common.js";
import { tokenize } from "../src/commands/shell.js";
import { detectColorLevel, hyperlink, fmtDuration, supportsProgressBar } from "../src/lib/term.js";
import { renderMarkdown } from "../src/lib/ui.js";

describe("extractToolPayload", () => {
  it("prefers structuredContent", () => {
    expect(extractToolPayload({ structuredContent: { a: 1 }, content: [{ type: "text", text: "{}" }] })).toEqual({ a: 1 });
  });
  it("parses a single JSON text block", () => {
    expect(extractToolPayload({ content: [{ type: "text", text: '{"success":true,"data":{"x":1}}' }] })).toEqual({ success: true, data: { x: 1 } });
  });
  it("returns the raw string when the text is not JSON", () => {
    expect(extractToolPayload({ content: [{ type: "text", text: "hello" }] })).toBe("hello");
  });
  it("picks the envelope when a JSON block is followed by prose", () => {
    const r = extractToolPayload({ content: [{ type: "text", text: '{"success":true,"data":{"x":1}}' }, { type: "text", text: "Here is your cart" }] });
    expect(r).toEqual({ success: true, data: { x: 1 } });
  });
});

describe("unwrapSwiggyEnvelope", () => {
  it("unwraps success envelopes and keeps message + extra fields", () => {
    const u = unwrapSwiggyEnvelope({ success: true, data: { items: [] }, message: "hi", latitude: 12.9, longitude: 77.6 });
    expect(u.data).toEqual({ items: [] });
    expect(u.message).toBe("hi");
    expect(u.extra).toEqual({ latitude: 12.9, longitude: 77.6 });
    expect(u.error).toBeUndefined();
  });
  it("surfaces failure envelopes", () => {
    const u = unwrapSwiggyEnvelope({ success: false, error: { message: "nope", reportLink: "https://r" } });
    expect(u.error?.message).toBe("nope");
    expect(u.error?.reportLink).toBe("https://r");
  });
  it("passes non-envelope payloads through", () => {
    expect(unwrapSwiggyEnvelope([1, 2]).data).toEqual([1, 2]);
    expect(unwrapSwiggyEnvelope("txt").data).toBe("txt");
    expect(isSwiggyEnvelope({ success: "yes" })).toBe(false);
  });
});

describe("SSE + meta", () => {
  it("parses a data frame with an id", () => {
    const evt = 'event: message\ndata: {"jsonrpc":"2.0","id":"1","result":{"ok":1}}';
    expect(parseSseEvent(evt)?.id).toBe("1");
    expect(parseSseEvent("data: not json")).toBeUndefined();
    expect(parseSseEvent(": keepalive")).toBeUndefined();
  });
  it("reads swiggy deprecation metadata in both shapes", () => {
    expect(extractDeprecation({ _meta: { "swiggy.deprecation": { tool: "x" } } })).toEqual({ tool: "x" });
    expect(extractDeprecation({ _meta: { swiggy: { deprecation: { tool: "y" } } } })).toEqual({ tool: "y" });
    expect(extractDeprecation({})).toBeUndefined();
  });
});

describe("human renderer helpers", () => {
  it("finds the most useful list and prioritises id/name columns", () => {
    const data = { restaurants: [{ rating: 4, id: "r1", name: "A", extra: { deep: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] } }], nextOffset: 10 };
    const l = pickList(data)!;
    expect(l.key).toBe("restaurants");
    expect(chooseColumns(l.rows).slice(0, 2)).toEqual(["id", "name"]);
    expect(chooseColumns(l.rows)).not.toContain("extra");
  });
  it("digs into nested data", () => {
    expect(pickList({ data: { data: { items: [{ id: 1 }] } } })?.key).toBe("data.data.items");
    expect(pickList({ a: 1 })).toBeUndefined();
    expect(pickList([1, 2])).toBeUndefined();
  });
});

describe("addresses", () => {
  it("handles get_addresses and get_saved_locations shapes", () => {
    expect(extractAddresses({ addresses: [{ id: "a1", addressLine: "12B", addressTag: "Home" }] })).toEqual([{ id: "a1", label: "Home · 12B" }]);
    expect(extractAddresses({ locations: [{ index: 1, id: "l1", addressLine: "Office" }] })).toEqual([{ id: "l1", label: "Office" }]);
    expect(extractAddresses({ data: { addresses: [{ address_id: "old", display_address: "X" }] } })).toEqual([{ id: "old", label: "X" }]);
    expect(extractAddresses(null)).toEqual([]);
  });
  it("compact drops undefined and empty strings", () => {
    expect(compact({ a: 1, b: undefined, c: "", d: 0, e: false })).toEqual({ a: 1, d: 0, e: false });
  });
  it("hints on common upstream errors", () => {
    expect(hintForToolError("food", "Invalid addressId: required")).toMatch(/addresses/);
    expect(hintForToolError("dineout", "latitude is required")).toMatch(/--lat/);
    expect(hintForToolError("instamart", "Minimum order value not met")).toMatch(/99/);
  });
});

describe("shell tokenizer", () => {
  it("honours quotes and escapes", () => {
    expect(tokenize(`food search -q "paneer tikka" --json`)).toEqual(["food", "search", "-q", "paneer tikka", "--json"]);
    expect(tokenize(`call food echo --input '{"a":"b c"}'`)).toEqual(["call", "food", "echo", "--input", '{"a":"b c"}']);
    expect(tokenize(`a\\ b ""`)).toEqual(["a b", ""]);
  });
});

describe("terminal helpers", () => {
  it("detects color level from env", () => {
    expect(detectColorLevel({ NO_COLOR: "1" }, true)).toBe(0);
    expect(detectColorLevel({ COLORTERM: "truecolor", TERM: "xterm" }, true)).toBe(3);
    expect(detectColorLevel({ TERM: "xterm-256color" }, true)).toBe(2);
    expect(detectColorLevel({ TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app" }, true)).toBe(3);
    expect(detectColorLevel({ TERM: "xterm", TMUX: "1", ITERM_SESSION_ID: "x" }, true)).toBe(3);
    expect(detectColorLevel({ TERM: "xterm-256color" }, false)).toBe(0);
    expect(detectColorLevel({ FORCE_COLOR: "1" }, false)).toBe(1);
  });
  it("OSC 8 hyperlinks degrade to plain text", () => {
    expect(hyperlink("https://x", "X", false)).toBe("X (https://x)");
    expect(hyperlink("https://x", "https://x", false)).toBe("https://x");
    expect(hyperlink("https://x", "X", true)).toBe("]8;;https://xX]8;;");
  });
  it("progress bar support is brand-gated", () => {
    expect(supportsProgressBar({ brand: "ghostty", inTmux: false })).toBe(true);
    expect(supportsProgressBar({ brand: "iterm2", inTmux: false, termProgramVersion: "3.5.0" })).toBe(false);
    expect(supportsProgressBar({ brand: "iterm2", inTmux: false, termProgramVersion: "3.6.1" })).toBe(true);
    expect(supportsProgressBar({ brand: "kitty", inTmux: false })).toBe(false);
  });
  it("formats durations", () => {
    expect(fmtDuration(830)).toBe("830ms");
    expect(fmtDuration(1400)).toBe("1.4s");
    expect(fmtDuration(72_000)).toBe("1m 12s");
  });
  it("renders markdown without color as readable text", () => {
    expect(renderMarkdown("**Bold** and [link](https://x)", { json: true })).toBe("**Bold** and link (https://x)");
  });
});
