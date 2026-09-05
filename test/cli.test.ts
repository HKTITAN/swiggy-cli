import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startMockMcp } from "./helpers/mock-mcp.js";

/**
 * Black-box tests of the built binary (dist/cli.js) — the exact artifact npm publishes.
 * `npm test` runs `pretest` (build) first.
 */

const exec = promisify(execFile);
const BIN = resolve("dist/cli.js");

interface Result {
  code: number;
  stdout: string;
  stderr: string;
  json?: { ok: boolean; data?: unknown; error?: { code: string; message: string; hint?: string }; meta?: Record<string, unknown> };
}

let mock: Awaited<ReturnType<typeof startMockMcp>>;
let home: string;
let emptyHome: string;

async function cli(args: string[], env: Record<string, string> = {}, opts: { home?: string } = {}): Promise<Result> {
  const e = { ...process.env, CI: "true", SWIGGY_NO_BANNER: "1", SWIGGY_HOME: opts.home ?? home, SWIGGY_FOOD_URL: mock.url, ...env };
  try {
    const { stdout, stderr } = await exec("node", [BIN, ...args], { env: e });
    return { code: 0, stdout, stderr, json: tryJson(stdout) };
  } catch (err) {
    const x = err as { code?: number; stdout?: string; stderr?: string };
    return { code: x.code ?? 1, stdout: x.stdout ?? "", stderr: x.stderr ?? "", json: tryJson(x.stdout ?? "") };
  }
}

function tryJson(s: string): Result["json"] {
  const line = s.trim().split("\n").at(-1) ?? "";
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

beforeAll(async () => {
  mock = await startMockMcp();
  home = await mkdtemp(join(tmpdir(), "swiggy-cli-"));
  emptyHome = await mkdtemp(join(tmpdir(), "swiggy-cli-empty-"));
  await writeFile(join(home, "auth.json"), JSON.stringify({ servers: { food: { accessToken: "test-token", expiresAt: Date.now() + 86_400_000 } } }));
  await writeFile(join(home, "config.json"), JSON.stringify({ currentProfile: "default", profiles: { default: { output: "human", defaultAddressId: "addr_1" } } }));
});

afterAll(async () => {
  await mock.close();
});

describe("swiggy (built binary)", () => {
  it("--version matches package.json", async () => {
    const pkg = JSON.parse(await (await import("node:fs/promises")).readFile("package.json", "utf8"));
    const r = await cli(["--version"]);
    expect(r.stdout.trim()).toBe(pkg.version);
  });

  it("servers --json returns the three servers with tool counts", async () => {
    const r = await cli(["servers", "--json"]);
    expect(r.code).toBe(0);
    expect(r.json?.ok).toBe(true);
    const data = r.json?.data as Array<{ name: string; toolCount: number }>;
    expect(data.map((d) => [d.name, d.toolCount])).toEqual([["food", 20], ["instamart", 19], ["dineout", 12]]);
  });

  it("call unwraps the Swiggy envelope, keeps message in meta, and exposes rate-limit headers", async () => {
    const r = await cli(["call", "food", "echo", "--input", '{"q":"biryani"}', "--json"]);
    expect(r.code).toBe(0);
    expect(r.json).toMatchObject({ ok: true, server: "food", tool: "echo", data: { args: { q: "biryani" } } });
    expect(r.json?.meta).toMatchObject({ message: "echoed **ok**", rateLimit: { limit: 70, remaining: 69 } });
  });

  it("--raw returns the untouched MCP result", async () => {
    const r = await cli(["call", "food", "echo", "--raw"]);
    expect((r.json?.data as { content: unknown[] }).content).toBeDefined();
  });

  it("food search uses the documented camelCase params and the profile default address", async () => {
    const r = await cli(["food", "search", "-q", "biryani", "--json"]);
    expect(r.code).toBe(0);
    const last = mock.state.calls.at(-1)!;
    expect(last.name).toBe("search_restaurants");
    expect(last.args).toEqual({ addressId: "addr_1", query: "biryani" });
    expect((r.json?.data as { restaurants: unknown[] }).restaurants.length).toBe(2);
  });

  it("--input JSON overrides flag-derived args", async () => {
    await cli(["food", "search", "-q", "x", "--input", '{"query":"pizza","collection":"BOLT"}', "--json"]);
    expect(mock.state.calls.at(-1)?.args).toEqual({ addressId: "addr_1", query: "pizza", collection: "BOLT" });
  });

  it("tool success:false → MCP_ERROR (exit 6) with hint", async () => {
    const r = await cli(["call", "food", "fail", "--json"]);
    expect(r.code).toBe(6);
    expect(r.json?.error?.code).toBe("MCP_ERROR");
    expect(r.json?.error?.message).toBe("Invalid addressId: required");
    expect(r.json?.error?.hint).toMatch(/addresses/);
  });

  it("isError results → MCP_ERROR", async () => {
    const r = await cli(["call", "food", "iserror", "--json"]);
    expect(r.code).toBe(6);
    expect(r.json?.error?.message).toBe("boom");
  });

  it("HTTP 429 → RATE_LIMITED (exit 9)", async () => {
    const r = await cli(["call", "food", "rate", "--json"]);
    expect(r.code).toBe(9);
    expect(r.json?.error?.code).toBe("RATE_LIMITED");
  });

  it("no token → AUTH_REQUIRED (exit 3) without calling the server", async () => {
    const before = mock.state.calls.length;
    const r = await cli(["call", "food", "echo", "--json"], {}, { home: emptyHome });
    expect(r.code).toBe(3);
    expect(r.json?.error?.code).toBe("AUTH_REQUIRED");
    expect(mock.state.calls.length).toBe(before);
  });

  it("destructive tool without --yes in machine mode → CONFIRMATION_REQUIRED (exit 7), no call made", async () => {
    const before = mock.state.calls.length;
    const r = await cli(["food", "clear-cart", "--json"]);
    expect(r.code).toBe(7);
    expect(r.json?.error?.code).toBe("CONFIRMATION_REQUIRED");
    expect(mock.state.calls.length).toBe(before);
  });

  it("destructive tool with --yes runs", async () => {
    const r = await cli(["food", "clear-cart", "--yes", "--json"]);
    expect(r.code).toBe(0);
    expect(mock.state.calls.at(-1)?.name).toBe("flush_food_cart");
  });

  it("usage errors inside subcommands are rendered as JSON (exit 2)", async () => {
    const r = await cli(["food", "add-to-cart", "--json"]);
    expect(r.code).toBe(2);
    expect(r.json?.error?.code).toBe("USAGE");
    const r2 = await cli(["food", "search", "--json"]);
    expect(r2.code).not.toBe(0); // commander: missing required -q
  });

  it("machine mode without --address-id and no profile default → USAGE with guidance", async () => {
    const r = await cli(["food", "search", "-q", "x", "--json"], {}, { home: emptyHome });
    // emptyHome has no token either, but address resolution happens first
    expect(r.code).toBe(2);
    expect(r.json?.error?.message).toMatch(/address/i);
  });

  it("checkout --pay cash places a COD order (no payment leg)", async () => {
    const r = await cli(["food", "checkout", "--pay", "cash", "--yes", "--json"]);
    expect(r.code).toBe(0);
    expect(mock.state.calls.at(-1)?.args).toEqual({ addressId: "addr_1", paymentMethod: "Cash" });
    expect(r.json?.meta).toMatchObject({ payment: { pending: false } });
  });

  it("checkout --pay upi returns the pending order with bridgeUrl and a next-step command", async () => {
    const r = await cli(["food", "checkout", "--pay", "upi", "--yes", "--json"]);
    expect(r.code).toBe(0);
    expect(mock.state.calls.at(-1)?.args).toEqual({ addressId: "addr_1", paymentMethod: "UPI", generateUPIQR: true });
    const payment = r.json?.meta?.payment as { pending: boolean; bridgeUrl: string; next: string };
    expect(payment.pending).toBe(true);
    expect(payment.bridgeUrl).toBe("https://pay.example/bridge/1");
    expect(payment.next).toMatch(/payment-status --paas-id paas_1 --order-id ord_1 --address-id addr_1 --lat 12.9 --lng 77.6 --wait/);
    expect(r.stderr).toContain("https://pay.example/bridge/1");
  });

  it("checkout --pay upi --wait polls, confirms with the Food contract, and reports PLACED", async () => {
    const r = await cli(["food", "checkout", "--pay", "upi", "--wait", "--interval-ms", "50", "--max-wait-ms", "5000", "--yes", "--json"]);
    expect(r.code).toBe(0);
    const names = mock.state.calls.slice(-5).map((c) => c.name);
    expect(names).toContain("check_payment_status");
    expect(names.at(-1)).toBe("confirm_order");
    const confirm = mock.state.calls.at(-1)!.args as Record<string, unknown>;
    expect(confirm).toEqual({ orderId: "ord_1", addressId: "addr_1", cartId: "cart_1", lat: 12.9, lng: 77.6 });
    expect(confirm).not.toHaveProperty("paasId");
    expect(r.json?.data).toMatchObject({ status: "PLACED", confirmed: true });
    expect((r.json?.meta?.payment as { outcome: string }).outcome).toBe("confirmed");
  });

  it("plain mode prints a TSV table", async () => {
    const r = await cli(["food", "addresses", "--plain"]);
    expect(r.code).toBe(0);
    const [header, first] = r.stdout.trim().split("\n");
    expect(header?.split("\t")).toContain("id");
    expect(first).toContain("addr_1");
  });

  it("mcp-config emits valid client config", async () => {
    const r = await cli(["mcp-config", "--client", "plugin", "--json"]);
    expect(r.json?.data).toMatchObject({ $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json" });
    const servers = (r.json?.data as { mcpServers: Record<string, { type: string; url: string }> }).mcpServers;
    expect(servers["swiggy-instamart"]).toEqual({ type: "streamable-http", url: "https://mcp.swiggy.com/im" });
  });

  it("unknown command → USAGE with a suggestion", async () => {
    const r = await cli(["login", "--json"]);
    expect(r.code).toBe(2);
    expect(r.json?.error?.message).toMatch(/auth init/);
  });

  it("machine-mode output never contains ANSI escapes", async () => {
    const r = await cli(["food", "addresses", "--json"], { FORCE_COLOR: "3" });
    expect(r.stdout).not.toMatch(/\[/);
  });
});
