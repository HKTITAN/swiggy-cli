import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startMockMcp } from "./helpers/mock-mcp.js";

/**
 * Human-mode output of the built binary: native views, numbered rows, positional references
 * resolving against the last listing, merge semantics for `instamart add`, and no MCP jargon.
 */

const exec = promisify(execFile);
const BIN = resolve("dist/cli.js");

let mock: Awaited<ReturnType<typeof startMockMcp>>;
let home: string;

async function cli(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const env = { ...process.env, SWIGGY_HOME: home, SWIGGY_FOOD_URL: mock.url, SWIGGY_INSTAMART_URL: mock.url, SWIGGY_DINEOUT_URL: mock.url, SWIGGY_NO_BANNER: "1", SWIGGY_NO_SHELL: "1", NO_COLOR: "1", CI: "" };
  try {
    const { stdout, stderr } = await exec("node", [BIN, ...args], { env });
    return { code: 0, out: stdout, err: stderr };
  } catch (e) {
    const x = e as { code?: number; stdout?: string; stderr?: string };
    return { code: x.code ?? 1, out: x.stdout ?? "", err: x.stderr ?? "" };
  }
}

beforeAll(async () => {
  mock = await startMockMcp();
  home = await mkdtemp(join(tmpdir(), "swiggy-human-"));
  const token = { accessToken: "test-token", expiresAt: Date.now() + 86_400_000 };
  await writeFile(join(home, "auth.json"), JSON.stringify({ servers: { food: token, instamart: token, dineout: token } }));
  await writeFile(join(home, "config.json"), JSON.stringify({ currentProfile: "default", profiles: { default: { defaultAddressId: "addr_1" } } }));
});

afterAll(async () => {
  await mock.close();
});

describe("native human output", () => {
  it("food search renders a numbered restaurant table without tool names", async () => {
    const r = await cli(["food", "search", "biryani"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("Restaurants");
    expect(r.out).toContain("Paradise Biryani");
    expect(r.out).toMatch(/\n[│|]\s*1\s*[│|]/); // numbered first row
    expect(r.out).toContain("open");
    expect(r.out).toContain("closed · 11:00 AM");
    expect(r.out).not.toContain("search_restaurants");
    expect(r.out).not.toContain("tools/call");
    expect(r.out).toContain("swiggy food menu <#>");
  });

  it("food menu 1 resolves the row number from the last search and remembers the restaurant", async () => {
    const r = await cli(["food", "menu", "1"]);
    expect(r.code).toBe(0);
    expect(mock.state.calls.at(-1)?.args).toEqual({ addressId: "addr_1", restaurantId: "r1" });
    expect(r.out).toContain("Paradise Biryani");
    expect(r.out).toContain("Gulab Jamun");
    expect(r.out).toContain("out of stock");
    const recent = JSON.parse(await readFile(join(home, "cache", "recent.json"), "utf8"));
    expect(recent.context.restaurantId).toBe("r1");
    expect(recent.lists.menuItems.entries[1].id).toBe("m2");
  });

  it("food add 2 --qty 3 uses the remembered restaurant and menu_item_id", async () => {
    const r = await cli(["food", "add", "2", "--qty", "3"]);
    expect(r.code).toBe(0);
    expect(mock.state.calls.at(-1)?.args).toEqual({ restaurantId: "r1", cartItems: [{ menu_item_id: "m2", quantity: 3 }], addressId: "addr_1", restaurantName: "Paradise Biryani" });
    expect(r.out).toContain("Your cart");
    expect(r.out).toContain("To pay");
    expect(r.out).toContain("₹750");
    expect(r.out).toContain("not applied"); // coupon_discount 0 → suggestion, not a saving
  });

  it("food add with no listing and no context fails with guidance, not a stack trace", async () => {
    const r = await cli(["food", "add", "999"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("out of range");
  });

  it("instamart search + add merges into the existing cart (update_cart replaces upstream)", async () => {
    mock.state.imCart = [{ spinId: "spin_9", skuId: "sku_9", quantity: 1 }];
    const s = await cli(["instamart", "search", "milk"]);
    expect(s.code).toBe(0);
    expect(s.out).toContain("Amul Taaza");
    expect(s.out).toContain("500 ml");
    expect(s.out).toContain("mrp ₹28");
    const a = await cli(["instamart", "add", "1", "--qty", "2"]);
    expect(a.code).toBe(0);
    const call = mock.state.calls.at(-1)!;
    expect(call.name).toBe("update_cart");
    expect(call.args).toEqual({ selectedAddressId: "addr_1", items: [{ spinId: "spin_9", skuId: "sku_9", quantity: 1 }, { spinId: "spin_1", skuId: "sku_1", quantity: 2 }] });
    expect(a.out).toContain("Your Instamart cart");
    expect(a.out).toContain("SwiggyPay");
    const again = await cli(["instamart", "add", "1"]);
    expect(again.code).toBe(0);
    expect((mock.state.calls.at(-1)!.args as { items: Array<{ spinId: string; quantity: number }> }).items.find((i) => i.spinId === "spin_1")?.quantity).toBe(3);
  });

  it("dineout search → slots 1 → book 1 --guests 2 chains through remembered coordinates and slot fields", async () => {
    const s = await cli(["dineout", "search", "brewery", "--lat", "12.9784", "--lng", "77.6408"]);
    expect(s.code).toBe(0);
    expect(s.out).toContain("Toit");
    expect(s.out).toContain("Restaurants to book");
    const sl = await cli(["dineout", "slots", "1", "--date", "2026-09-06"]);
    expect(sl.code).toBe(0);
    expect(mock.state.calls.at(-1)?.args).toEqual({ restaurantId: "dr1", date: "2026-09-06", latitude: 12.9784, longitude: 77.6408 });
    expect(sl.out).toContain("7:00 PM");
    expect(sl.out).toContain("free");
    expect(sl.out).toContain("₹500");
    const b = await cli(["dineout", "book", "1", "--guests", "2", "--yes"]);
    expect(b.code).toBe(0);
    expect(mock.state.calls.at(-1)?.args).toEqual({ restaurantId: "dr1", slotId: 101, itemId: "dr1-t1", reservationTime: 1757178000, guestCount: 2, latitude: 12.9784, longitude: 77.6408 });
    expect(b.out).toContain("Your booking");
    expect(b.out).toContain("CONFIRMED");
    expect(b.out).toContain("bk_1");
  });

  it("booking a paid slot without --pay upi explains what to do", async () => {
    const b = await cli(["dineout", "book", "2", "--guests", "2", "--yes"]);
    expect(b.code).toBe(2);
    expect(b.err).toContain("paid deal");
  });

  it("booking a paid slot with --pay upi creates the cart first and passes cartKey", async () => {
    const b = await cli(["dineout", "book", "2", "--guests", "2", "--pay", "upi", "--yes"]);
    expect(b.code).toBe(0);
    const names = mock.state.calls.slice(-2).map((c) => c.name);
    expect(names).toEqual(["create_cart", "book_table"]);
    expect(mock.state.calls.at(-1)?.args).toMatchObject({ cartKey: "ck_1", paymentMethod: "UPI", generateUPIQR: true, slotId: 102 });
    expect(b.out).toContain("not placed yet");
    expect(b.out).toContain("https://pay.example/bridge/b");
  });

  it("payment options list each method with the matching --pay flag", async () => {
    const r = await cli(["food", "payment-options"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("Google Pay");
    expect(r.out).toContain("--pay upi:gpay://upi/");
    expect(r.out).toContain("--pay cash");
  });

  it("cash checkout renders an 'Order placed' card with the tracking hint", async () => {
    const r = await cli(["food", "checkout", "--pay", "cash", "--yes"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("Order placed");
    expect(r.out).toContain("ord_cod");
    expect(r.out).toContain("swiggy food track ord_cod");
  });

  it("errors are plain language with a hint, and progress uses friendly labels on stderr", async () => {
    const r = await cli(["call", "food", "fail"]);
    expect(r.code).toBe(6);
    expect(r.err).toContain("Invalid addressId: required");
    expect(r.err).toContain("hint:");
    const ok = await cli(["food", "addresses"]);
    expect(ok.out).toContain("Saved addresses");
    expect(ok.out).toContain("Home");
  });
});
