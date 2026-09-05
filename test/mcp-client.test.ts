import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMockMcp } from "./helpers/mock-mcp.js";

/**
 * End-to-end tests of McpClient against a mock Streamable-HTTP server: handshake, session
 * persistence across client instances, session-expiry recovery, SSE, auth and rate-limit mapping.
 * SWIGGY_HOME is pointed at a temp dir before the modules are imported.
 */

let mock: Awaited<ReturnType<typeof startMockMcp>>;
let home: string;
let mcp: typeof import("../src/lib/mcp.js");
let profile: { endpoints: { food: string } };

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "swiggy-test-"));
  process.env.SWIGGY_HOME = home;
  mock = await startMockMcp();
  await writeFile(join(home, "auth.json"), JSON.stringify({ servers: { food: { accessToken: "test-token", expiresAt: Date.now() + 86_400_000 } } }));
  mcp = await import("../src/lib/mcp.js");
  profile = { endpoints: { food: mock.url } };
});

afterAll(async () => {
  await mock.close();
});

describe("McpClient", () => {
  it("initializes once and lists tools", async () => {
    const c = new mcp.McpClient({ server: "food", profile });
    const tools = await c.listTools();
    expect(tools.map((t) => t.name)).toContain("search_restaurants");
    expect(mock.state.initializeCount).toBe(1);
    expect(c.lastRateLimit).toEqual({ limit: 70, remaining: 69, reset: 1720000060 });
  });

  it("reuses the persisted session from a fresh client instance (no second initialize)", async () => {
    const cached = JSON.parse(await readFile(join(home, "cache", "sessions.json"), "utf8"));
    expect(cached.food.sessionId).toBe("sess-1");
    const c = new mcp.McpClient({ server: "food", profile });
    const r = await c.callTool("echo", { a: 1 });
    expect(mock.state.initializeCount).toBe(1);
    const payload = mcp.unwrapSwiggyEnvelope(mcp.extractToolPayload(r));
    expect(payload.data).toEqual({ args: { a: 1 } });
    expect(payload.message).toBe("echoed **ok**");
  });

  it("re-initializes transparently when the server expires the session (404)", async () => {
    mock.state.expireSessionOnce = true;
    const c = new mcp.McpClient({ server: "food", profile });
    const r = await c.callTool("echo", { b: 2 });
    expect(mock.state.initializeCount).toBe(2);
    expect(mcp.unwrapSwiggyEnvelope(mcp.extractToolPayload(r)).data).toEqual({ args: { b: 2 } });
    expect(mock.state.calls.at(-1)?.sessionId).toBe("sess-2");
  });

  it("reads SSE responses and matches the request id", async () => {
    const c = new mcp.McpClient({ server: "food", profile });
    const r = await c.callTool("sse", {});
    expect(mcp.unwrapSwiggyEnvelope(mcp.extractToolPayload(r)).data).toEqual({ via: "sse" });
  });

  it("maps 429 to RATE_LIMITED with Retry-After", async () => {
    const c = new mcp.McpClient({ server: "food", profile });
    await expect(c.callTool("rate", {})).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 7 });
  });

  it("maps JSON-RPC -32001 to AUTH_REQUIRED and drops the session", async () => {
    const c = new mcp.McpClient({ server: "food", profile });
    await expect(c.callTool("auth", {})).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    const cached = JSON.parse(await readFile(join(home, "cache", "sessions.json"), "utf8"));
    expect(cached.food).toBeUndefined();
  });

  it("surfaces success:false as a failure envelope", async () => {
    const c = new mcp.McpClient({ server: "food", profile });
    const r = await c.callTool("fail", {});
    const u = mcp.unwrapSwiggyEnvelope(mcp.extractToolPayload(r));
    expect(u.error?.message).toBe("Invalid addressId: required");
  });

  it("maps HTTP 401 to AUTH_FAILED when a token was sent", async () => {
    mock.state.token = "rotated";
    try {
      const c = new mcp.McpClient({ server: "food", profile });
      await expect(c.callTool("echo", {})).rejects.toMatchObject({ code: "AUTH_FAILED" });
    } finally {
      mock.state.token = "test-token";
    }
  });
});
