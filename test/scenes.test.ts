import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startMockMcp } from "./helpers/mock-mcp.js";

/**
 * The Scenes booking path on the built binary, as Swiggy fixes it:
 *   discover → (details gives venueId) → shows → cart (FREE | UPI) → book → status
 * Row numbers, remembered coordinates and the remembered ticket cart carry the ids between commands.
 */

const exec = promisify(execFile);
const BIN = resolve("dist/cli.js");

let mock: Awaited<ReturnType<typeof startMockMcp>>;
let home: string;

async function cli(args: string[]): Promise<{ code: number; out: string; err: string; json?: { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string; hint?: string }; meta?: Record<string, unknown> } }> {
  const env = { ...process.env, SWIGGY_HOME: home, SWIGGY_SCENES_URL: mock.url, SWIGGY_DINEOUT_URL: mock.url, SWIGGY_NO_BANNER: "1", SWIGGY_NO_SHELL: "1", NO_COLOR: "1", CI: "" };
  const parse = (s: string) => {
    try {
      return JSON.parse(s.trim().split("\n").at(-1) ?? "");
    } catch {
      return undefined;
    }
  };
  try {
    const { stdout, stderr } = await exec("node", [BIN, ...args], { env });
    return { code: 0, out: stdout, err: stderr, json: parse(stdout) };
  } catch (e) {
    const x = e as { code?: number; stdout?: string; stderr?: string };
    return { code: x.code ?? 1, out: x.stdout ?? "", err: x.stderr ?? "", json: parse(x.stdout ?? "") };
  }
}

const lastCall = () => mock.state.calls.at(-1)!;

beforeAll(async () => {
  mock = await startMockMcp();
  home = await mkdtemp(join(tmpdir(), "swiggy-scenes-"));
  // An auth file from before Scenes existed: no "scenes" entry. The shared token must still work.
  await writeFile(join(home, "auth.json"), JSON.stringify({ servers: { food: { accessToken: "test-token", expiresAt: Date.now() + 100 * 3_600_000 } } }));
});

afterAll(async () => {
  await mock.close();
});

describe("scenes", () => {
  it("is listed with its 15 tools", async () => {
    const r = await cli(["tools", "scenes", "--offline", "--json"]);
    expect(r.code).toBe(0);
    expect((r.json?.data as unknown as unknown[]).length).toBe(15);
  });

  it("discover needs a location and says how to give one", async () => {
    const r = await cli(["scenes", "discover", "--json"]);
    expect(r.code).toBe(2);
    expect(r.json?.error?.hint).toMatch(/--lat\/--lng/);
  });

  it("discover lists numbered events and genre chips, and works with a pre-Scenes login", async () => {
    const r = await cli(["scenes", "discover", "--lat", "12.9", "--lng", "77.5"]);
    expect(r.code).toBe(0);
    expect(lastCall()).toMatchObject({ name: "discover_events", args: { latitude: 12.9, longitude: 77.5 } });
    expect(r.out).toContain("Late Night Laughs");
    expect(r.out).toContain("The Courtyard");
    expect(r.out).toMatch(/1 Comedy/);
    expect(r.out).not.toContain("discover_events");
    expect(r.out).toContain("swiggy scenes shows <#>");
  });

  it("shows <#> looks up the venue first, then reuses the coordinates Swiggy resolved", async () => {
    const r = await cli(["scenes", "shows", "1"]);
    expect(r.code).toBe(0);
    const calls = mock.state.calls.slice(-2);
    expect(calls[0]).toMatchObject({ name: "get_event_details", args: { eventId: "ev_a", latitude: 12.9716, longitude: 77.5946 } });
    expect(calls[1]).toMatchObject({ name: "list_event_shows", args: { eventId: "ev_a", venueId: "ven_9", latitude: 12.9716, longitude: 77.5946 } });
    expect(r.out).toContain("Sat 14 Nov, 8:00 PM");
    expect(r.out).toContain("Late Night Laughs");
    expect(r.out).toContain("at The Courtyard");
    expect(r.out).toContain("General");
    expect(r.out).toContain("₹499");
    expect(r.out).toContain("free");
  });

  it("shows --all-venues lists without row numbers, because a multi-venue listing cannot be booked from", async () => {
    const r = await cli(["scenes", "shows", "ev_a", "--all-venues"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("browse only");
    const back = await cli(["scenes", "shows", "ev_a"]); // restore the bookable listing for the next tests
    expect(back.code).toBe(0);
  });

  it("cart --show <#> sends the exact show and ticket ids, with show_time_unix untouched", async () => {
    const r = await cli(["scenes", "cart", "--show", "1", "--guests", "2", "--json"]);
    expect(r.code).toBe(0);
    expect(lastCall()).toEqual({ name: "create_event_cart", sessionId: lastCall().sessionId, args: { venueId: "ven_9", showId: 71, ticketId: "tk_paid", showTime: 1794670200, guestCount: 2, latitude: 12.9716, longitude: 77.5946 } });
    expect(r.json?.data).toMatchObject({ cartKey: "eck_1", checkoutMode: "UPI" });
  });

  it("book refuses a paid cart without a payment choice, and refuses Cash", async () => {
    const noPay = await cli(["scenes", "book", "--yes", "--json"]);
    expect(noPay.code).toBe(2);
    expect(noPay.json?.error?.hint).toMatch(/--pay upi --wait/);
    const cash = await cli(["scenes", "book", "--pay", "cash", "--yes", "--json"]);
    expect(cash.code).toBe(2);
    expect(cash.json?.error?.message).toMatch(/no Cash/);
  });

  it("book needs --yes in machine mode", async () => {
    const r = await cli(["scenes", "book", "--pay", "upi", "--json", "--no-interactive"]);
    expect(r.code).toBe(7);
    expect(r.json?.error?.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("book --pay upi --wait shares the link, polls, and confirms with orderId + paasId", async () => {
    const r = await cli(["scenes", "book", "--pay", "upi", "--wait", "--interval-ms", "50", "--max-wait-ms", "3000", "--yes", "--json"]);
    expect(r.code).toBe(0);
    const names = mock.state.calls.map((c) => c.name);
    expect(names).toContain("place_event_order");
    const place = mock.state.calls.find((c) => c.name === "place_event_order")!;
    expect(place.args).toEqual({ cartKey: "eck_1", paymentMethod: "UPI", generateUPIQR: true });
    expect(lastCall()).toMatchObject({ name: "confirm_order", args: { orderId: "ev_1", paasId: "paas_e", transactionId: "txn_e" } });
    expect(r.err).toContain("https://pay.example/bridge/e");
    expect(r.json?.meta?.payment).toMatchObject({ outcome: "confirmed" });
  });

  it("a free ticket books directly and echoes the selection back", async () => {
    await cli(["scenes", "cart", "--show", "2", "--guests", "1", "--json"]);
    const r = await cli(["scenes", "book", "--yes", "--json"]);
    expect(r.code).toBe(0);
    expect(lastCall()).toMatchObject({ name: "place_event_order", args: { cartKey: "eck_1", paymentMethod: "FREE", venueId: "ven_9", showId: 71, ticketId: "tk_free", showTime: 1794670200, guestCount: 1, latitude: 12.9716, longitude: 77.5946 } });
    expect(r.json?.data).toMatchObject({ orderId: "ev_free", status: "CONFIRMED" });
  });

  it("status reads the booking Swiggy returns under `booking`, not `data`", async () => {
    const r = await cli(["scenes", "status", "ev_free"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("The Courtyard");
    expect(r.out).toContain("CONFIRMED");
  });

  it("payment-options sends the ticket cart's key", async () => {
    await cli(["scenes", "payment-options", "--json"]);
    expect(lastCall()).toMatchObject({ name: "get_payment_options", args: { cartKey: "eck_1" } });
  });
});

describe("dineout against the live response shapes", () => {
  it("search turns Swiggy's prose-only answer into rows by asking for the restaurant cards", async () => {
    const r = await cli(["dineout", "search", "brewery", "--lat", "12.9784", "--lng", "77.6408", "--json"]);
    expect(r.code).toBe(0);
    const calls = mock.state.calls.slice(-2);
    expect(calls[0]!.name).toBe("search_restaurants_dineout");
    expect(calls[1]).toMatchObject({ name: "render_restaurants_dineout", args: { restaurantIds: ["dr1"], searches: [{ query: "brewery", latitude: 12.9784, longitude: 77.6408 }] } });
    const data = r.json?.data as { restaurants: Array<{ id: string; name: string }>; total: number };
    expect(data.restaurants.map((x) => x.name)).toEqual(["Toit"]);
    expect(data.total).toBe(1);
  });

  it("slots come from the widget metadata, and book sends reservationTime as a number", async () => {
    const sl = await cli(["dineout", "slots", "1", "--date", "2026-09-06"]);
    expect(sl.code).toBe(0);
    expect(sl.out).toContain("7:00 PM");
    expect(sl.out).toContain("Flat 20% off");
    const b = await cli(["dineout", "book", "1", "--guests", "2", "--yes", "--json"]);
    expect(b.code).toBe(0);
    expect(lastCall()).toMatchObject({ name: "book_table", args: { restaurantId: "dr1", slotId: 101, itemId: "dr1-t1", reservationTime: 1757178000, guestCount: 2 } });
  });
});

describe("dineout search (coordinates only since Nov 2026)", () => {
  it("rejects a saved address id and points at --lat/--lng", async () => {
    const r = await cli(["dineout", "search", "italian", "--address-id", "1", "--json"]);
    expect(r.code).toBe(2);
    expect(r.json?.error?.hint).toMatch(/--lat\/--lng/);
  });
});
