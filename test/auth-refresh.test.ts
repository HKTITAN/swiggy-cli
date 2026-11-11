import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMockMcp } from "./helpers/mock-mcp.js";

/**
 * Token refresh, as Swiggy documents it (docs/start/authenticate): JSON body with grant_type +
 * refresh_token, a rotated refresh token in the reply, and no refreshing a token that has already
 * expired. So the CLI must refresh ahead of expiry, and again when a server answers 401.
 */

let mock: Awaited<ReturnType<typeof startMockMcp>>;
let stateless: Awaited<ReturnType<typeof startMockMcp>>;
let home: string;
let auth: typeof import("../src/lib/auth.js");
let mcp: typeof import("../src/lib/mcp.js");

const HOUR = 3_600_000;

async function writeAuth(servers: Record<string, unknown>): Promise<void> {
  await writeFile(join(home, "auth.json"), JSON.stringify({ servers }));
}
async function readAuth(): Promise<{ servers: Record<string, { accessToken: string; refreshToken?: string; expiresAt?: number }> }> {
  return JSON.parse(await readFile(join(home, "auth.json"), "utf8"));
}

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "swiggy-refresh-"));
  process.env.SWIGGY_HOME = home;
  mock = await startMockMcp();
  stateless = await startMockMcp({ stateless: true });
  auth = await import("../src/lib/auth.js");
  mcp = await import("../src/lib/mcp.js");
});

afterAll(async () => {
  await mock.close();
  await stateless.close();
});

describe("token refresh", () => {
  it("refreshes ahead of expiry and updates every server that shared the token", async () => {
    mock.state.token = "old";
    mock.state.refreshToken = "old-refresh";
    const entry = { accessToken: "old", refreshToken: "old-refresh", expiresAt: Date.now() + HOUR, tokenEndpoint: `${mock.url}/auth/token` };
    await writeAuth({ food: entry, instamart: entry, dineout: { accessToken: "someone-else", expiresAt: Date.now() + 100 * HOUR } });

    const token = await auth.getAccessToken("food");
    expect(token).toBe("refreshed-1");
    expect(mock.state.refreshCount).toBe(1);

    const stored = await readAuth();
    expect(stored.servers.food!.accessToken).toBe("refreshed-1");
    expect(stored.servers.food!.refreshToken).toBe("refreshed-1"); // rotated, not the old one
    expect(stored.servers.instamart!.accessToken).toBe("refreshed-1");
    expect(stored.servers.dineout!.accessToken).toBe("someone-else");
    expect(stored.servers.food!.expiresAt! - Date.now()).toBeGreaterThan(29 * 24 * HOUR);
  });

  it("leaves a token with plenty of life alone", async () => {
    const before = mock.state.refreshCount;
    expect(await auth.getAccessToken("food")).toBe("refreshed-1");
    expect(mock.state.refreshCount).toBe(before);
  });

  it("keeps using the current token when an early refresh fails", async () => {
    await writeAuth({ food: { accessToken: "still-good", refreshToken: "rejected", expiresAt: Date.now() + HOUR, tokenEndpoint: `${mock.url}/auth/token` } });
    expect(await auth.getAccessToken("food")).toBe("still-good");
  });

  it("refreshes once on a 401 and replays the call", async () => {
    mock.state.token = "server-side-token";
    mock.state.refreshToken = "r2";
    const before = mock.state.refreshCount;
    await writeAuth({ food: { accessToken: "revoked-early", refreshToken: "r2", expiresAt: Date.now() + 100 * HOUR, tokenEndpoint: `${mock.url}/auth/token` } });

    const c = new mcp.McpClient({ server: "food", profile: { endpoints: { food: mock.url } } });
    const r = await c.callTool("echo", { ok: 1 });
    expect(mcp.unwrapSwiggyEnvelope(mcp.extractToolPayload(r)).data).toEqual({ args: { ok: 1 } });
    expect(mock.state.refreshCount).toBe(before + 1);
    expect((await readAuth()).servers.food!.accessToken).toBe(mock.state.token);
  });

  it("gives up with AUTH_FAILED when the refresh is rejected too", async () => {
    mock.state.token = "unreachable";
    await writeAuth({ food: { accessToken: "revoked", refreshToken: "also-revoked", expiresAt: Date.now() + 100 * HOUR, tokenEndpoint: `${mock.url}/auth/token` } });
    const c = new mcp.McpClient({ server: "food", profile: { endpoints: { food: mock.url } } });
    await expect(c.callTool("echo", {})).rejects.toMatchObject({ code: "AUTH_FAILED" });
  });
});

describe("handshake on a stateless server (no Mcp-Session-Id)", () => {
  it("handshakes once and remembers it without a session id", async () => {
    await writeAuth({ instamart: { accessToken: "test-token", expiresAt: Date.now() + 100 * HOUR } });
    const profile = { endpoints: { instamart: stateless.url } };

    await new mcp.McpClient({ server: "instamart", profile }).listTools();
    expect(stateless.state.initializeCount).toBe(1);
    const cached = JSON.parse(await readFile(join(home, "cache", "sessions.json"), "utf8"));
    expect(cached.instamart.sessionId).toBeUndefined();
    expect(cached.instamart.token).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(cached)).not.toContain("test-token");

    await new mcp.McpClient({ server: "instamart", profile }).callTool("echo", { n: 1 });
    await new mcp.McpClient({ server: "instamart", profile }).callTool("echo", { n: 2 });
    expect(stateless.state.initializeCount).toBe(1);
  });
});
