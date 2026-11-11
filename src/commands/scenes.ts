import { Command } from "commander";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { UsageError } from "../lib/errors.js";
import { PATHS } from "../lib/paths.js";
import {
  attachOutputOptions,
  buildArgs,
  callTool,
  invokeTool,
  num,
  positiveInt,
  readGlobalOpts,
  rememberCoords,
  renderOutcome,
  resolveCoords,
  run,
  type Coords,
  type ExecOpts,
} from "./common.js";
import { attachPayFlags, attachPaymentCommands, placeOrderWithPayment, type PayFlags } from "./payments.js";
import { getContext, resolveRef } from "../lib/recent.js";
import { dim, note } from "../lib/output.js";

/**
 * Swiggy Scenes (mcp.swiggy.com/scenes) — events and shows, 15 tools. Parameter names verified
 * against https://mcp.swiggy.com/builders/docs/reference/scenes/ on 2026-11-11.
 *
 * The booking path is fixed by Swiggy:
 *   discover | search | collection → details (the only source of venueId) → shows (scoped to that
 *   venue) → cart (checkoutMode FREE | UPI | UNAVAILABLE) → book → status
 *
 * Location: every discovery tool takes latitude + longitude OR a saved-location addressId, and
 * echoes the coordinates it resolved. Swiggy asks clients to reuse exactly those for every
 * follow-up call, so the CLI remembers them. There is no Cash option on Scenes.
 */

interface SavedEventCart {
  cartKey: string;
  checkoutMode?: string;
  venueId?: string;
  showId?: number;
  ticketId?: string;
  showTime?: number;
  guestCount?: number;
  latitude?: number;
  longitude?: number;
  billToPay?: number;
  savedAt: number;
}

async function saveEventCart(cart: SavedEventCart): Promise<void> {
  try {
    await mkdir(dirname(PATHS.scenesCartFile), { recursive: true });
    await writeFile(PATHS.scenesCartFile, JSON.stringify(cart, null, 2), { mode: 0o600 });
  } catch {
    /* best-effort */
  }
}

async function loadEventCart(): Promise<SavedEventCart | undefined> {
  if (!existsSync(PATHS.scenesCartFile)) return undefined;
  try {
    const cart = JSON.parse(await readFile(PATHS.scenesCartFile, "utf8")) as SavedEventCart;
    // A cart is "for the immediate follow-up flow" only; one from an earlier sitting is stale.
    return cart.cartKey && Date.now() - cart.savedAt < 30 * 60_000 ? cart : undefined;
  } catch {
    return undefined;
  }
}

/** Location for a discovery call: a saved location id, or coordinates (flags → profile → last Scenes response). */
async function locationArgs(opts: ExecOpts, o: { addressId?: string; lat?: string; lng?: string }, requiredBy: string): Promise<Record<string, unknown>> {
  if (o.addressId) return { addressId: (await resolveRef("locations", o.addressId, "locations")).id };
  const c = await resolveCoords("scenes", opts, o.lat, o.lng, requiredBy).catch(() => undefined);
  if (c) return { ...c };
  throw new UsageError(
    `${requiredBy} needs a location.`,
    "Pass --address-id <id|#> (see `swiggy scenes locations`) or --lat/--lng for a city (Bangalore 12.9716,77.5946 · Mumbai 19.0760,72.8777 · Delhi 28.6139,77.2090)"
  );
}

/** Coordinates for a follow-up call. Optional upstream, so a miss is not an error. */
async function followUpCoords(opts: ExecOpts, o: { lat?: string; lng?: string }, requiredBy: string): Promise<Partial<Coords>> {
  return (await resolveCoords("scenes", opts, o.lat, o.lng, requiredBy).catch(() => undefined)) ?? {};
}

export function buildScenesCommands(program: Command): void {
  const sc = program.command("scenes").alias("events").description("Swiggy Scenes: discover events and shows, pick a show, book tickets (free or UPI)");

  attachOutputOptions(
    sc
      .command("locations")
      .description("Your saved locations for 'near me' discovery (use # or id as --address-id)")
      .action(async () => {
        const opts = readGlobalOpts(sc);
        await run(opts, async () => {
          await callTool("scenes", "get_saved_locations", {}, opts);
        });
      })
  );

  attachOutputOptions(
    sc
      .command("discover")
      .alias("browse")
      .description("Events near a location: what's on, plus the genre chips you can open with `scenes collection`")
      .option("--address-id <id|#>", "saved location (id or # from `scenes locations`)")
      .option("--lat <lat>", "latitude (with --lng)")
      .option("--lng <lng>", "longitude")
      .option("--input <json>", "raw arguments JSON (merged over flags)")
      .action(async (o: { addressId?: string; lat?: string; lng?: string; input?: string }) => {
        const opts = readGlobalOpts(sc);
        await run(opts, async () => {
          const args = await buildArgs(o.input ? {} : await locationArgs(opts, o, "scenes discover"), o.input);
          const out = await invokeTool("scenes", "discover_events", args, opts);
          await rememberCoords("scenes", out.data, out.extra, "discover");
          await renderOutcome("scenes", "discover_events", out, opts);
        });
      })
  );

  attachOutputOptions(
    sc
      .command("search <name>")
      .description("Look up ONE named artist or show title (auto-suggest, at most 4 results). For a genre or 'what's on', use discover")
      .option("--address-id <id|#>", "saved location (id or # from `scenes locations`)")
      .option("--lat <lat>", "latitude (with --lng)")
      .option("--lng <lng>", "longitude")
      .action(async (name: string, o: { addressId?: string; lat?: string; lng?: string }) => {
        const opts = readGlobalOpts(sc);
        await run(opts, async () => {
          const where = o.addressId ? { addressId: (await resolveRef("locations", o.addressId, "locations")).id } : await followUpCoords(opts, o, "scenes search");
          const out = await invokeTool("scenes", "search_events", { query: name, ...where }, opts);
          await rememberCoords("scenes", out.data, out.extra, "search");
          await renderOutcome("scenes", "search_events", out, opts);
        });
      })
  );

  attachOutputOptions(
    sc
      .command("collection <chip>")
      .alias("genre")
      .description("Events in one genre: the chip # from the last `discover`, or its collectionIdentifier")
      .option("--address-id <id|#>", "saved location (id or # from `scenes locations`)")
      .option("--lat <lat>", "latitude (defaults to the last discover)")
      .option("--lng <lng>", "longitude")
      .action(async (chip: string, o: { addressId?: string; lat?: string; lng?: string }) => {
        const opts = readGlobalOpts(sc);
        await run(opts, async () => {
          const { id: collectionIdentifier } = await resolveRef("collections", chip, "genre chips");
          const where = o.addressId ? { addressId: (await resolveRef("locations", o.addressId, "locations")).id } : await followUpCoords(opts, o, "scenes collection");
          const out = await invokeTool("scenes", "get_events_collection", { collectionIdentifier, ...where }, opts);
          await rememberCoords("scenes", out.data, out.extra, "collection");
          await renderOutcome("scenes", "get_events_collection", out, opts);
        });
      })
  );

  attachOutputOptions(
    sc
      .command("details <event>")
      .alias("info")
      .description("One event: venue, address, next date, starting price. The only source of the venueId a booking needs (event id or #)")
      .option("--lat <lat>", "latitude (defaults to the last discover)")
      .option("--lng <lng>", "longitude")
      .action(async (event: string, o: { lat?: string; lng?: string }) => {
        const opts = readGlobalOpts(sc);
        await run(opts, async () => {
          const { id: eventId } = await resolveRef("events", event, "events");
          await callTool("scenes", "get_event_details", { eventId, ...(await followUpCoords(opts, o, "scenes details")) }, opts);
        });
      })
  );

  attachOutputOptions(
    sc
      .command("venue <event>")
      .description("Venue and event facts (genre, language, duration). Not part of booking; use `shows` for that")
      .option("--venue-id <id>", "limit to one venue")
      .option("--lat <lat>", "latitude")
      .option("--lng <lng>", "longitude")
      .option("--input <json>", "raw arguments JSON, e.g. the date-window fields (merged over flags)")
      .action(async (event: string, o: { venueId?: string; lat?: string; lng?: string; input?: string }) => {
        const opts = readGlobalOpts(sc);
        await run(opts, async () => {
          const { id: eventId } = await resolveRef("events", event, "events");
          const args = await buildArgs({ eventId, venueId: o.venueId, ...(await followUpCoords(opts, o, "scenes venue")) }, o.input);
          await callTool("scenes", "get_event_venue_info", args, opts);
        });
      })
  );

  attachOutputOptions(
    sc
      .command("shows [event]")
      .alias("schedule")
      .description("Show times, seats left and ticket types for an event at ONE venue (event id or #; defaults to the last `details`)")
      .option("--venue-id <id>", "venue to book at (defaults to the venue from the last `details`; fetched for you when missing)")
      .option("--all-venues", "list shows across every venue (browse only; not safe to book from)")
      .option("--from <iso>", "start of the show window, ISO-8601 (default now; window ≤ 5 days)")
      .option("--to <iso>", "end of the show window, ISO-8601")
      .option("--lat <lat>", "latitude (defaults to the last discover)")
      .option("--lng <lng>", "longitude")
      .option("--input <json>", "raw list_event_shows arguments (merged over flags)")
      .action(async (eventArg: string | undefined, o: { venueId?: string; allVenues?: boolean; from?: string; to?: string; lat?: string; lng?: string; input?: string }) => {
        const opts = readGlobalOpts(sc);
        await run(opts, async () => {
          const ctx = await getContext();
          const ref = eventArg ?? ctx.eventId;
          if (!ref && !o.input) throw new UsageError("Which event?", "Run: swiggy scenes discover, then swiggy scenes shows <#>");
          const eventId = ref ? (await resolveRef("events", ref, "events")).id : undefined;
          const coords = await followUpCoords(opts, o, "scenes shows");
          let venueId = o.venueId ?? (eventId && ctx.eventId === eventId ? ctx.venueId : undefined);
          if (!venueId && !o.allVenues && !o.input && eventId) {
            // venueId only comes from get_event_details, and a listing without it spans venues and cannot be booked from.
            note(dim("looking up the venue first", opts), opts);
            const details = await invokeTool("scenes", "get_event_details", { eventId, ...coords }, { ...opts, quiet: true });
            venueId = (details.data as { venueId?: string } | undefined)?.venueId;
            if (!venueId) throw new UsageError("Swiggy returned no venue for this event.", "Try: swiggy scenes details <event>, or browse with --all-venues");
          }
          const args = await buildArgs({ eventId, venueId: o.allVenues ? undefined : venueId, ...coords, showStartTime: o.from, showEndTime: o.to }, o.input);
          await callTool("scenes", "list_event_shows", args, opts);
        });
      })
  );

  attachOutputOptions(
    sc
      .command("cart")
      .description("Create the ticket cart for one show: --show <#> from the last `shows` listing plus --guests. Says whether it is FREE, UPI or UNAVAILABLE")
      .option("--show <#>", "ticket row from the last `shows` listing")
      .option("--guests <n>", "number of tickets, 1-20")
      .option("--venue-id <id>", "venueId from `details` (instead of --show)")
      .option("--show-id <n>", "showId from `shows`")
      .option("--ticket-id <id>", "ticketId from `shows`")
      .option("--show-time <unix>", "show_time_unix from `shows`, exactly as returned")
      .option("--lat <lat>", "latitude (defaults to the last discover)")
      .option("--lng <lng>", "longitude")
      .option("--input <json>", "raw create_event_cart arguments (merged over flags)")
      .action(async (o: { show?: string; guests?: string; venueId?: string; showId?: string; ticketId?: string; showTime?: string; lat?: string; lng?: string; input?: string }) => {
        const opts = readGlobalOpts(sc);
        await run(opts, async () => {
          const row = o.show ? (await resolveRef("shows", o.show, "shows")).entry?.extra ?? {} : {};
          const guestCount = positiveInt(o.guests, "--guests");
          if (guestCount !== undefined && guestCount > 20) throw new UsageError("--guests must be between 1 and 20.");
          const coords = o.input ? await followUpCoords(opts, o, "scenes cart") : await resolveCoords("scenes", opts, o.lat, o.lng, "scenes cart");
          const args = await buildArgs(
            {
              venueId: o.venueId ?? (row.venueId as string | undefined) ?? (await getContext()).venueId,
              showId: num(o.showId, "--show-id") ?? (row.showId as number | undefined),
              ticketId: o.ticketId ?? (row.ticketId as string | undefined),
              showTime: num(o.showTime, "--show-time") ?? (row.showTime as number | undefined),
              guestCount,
              ...coords,
            },
            o.input
          );
          if (!o.input) {
            for (const [k, f] of [["venueId", "--venue-id"], ["showId", "--show-id"], ["ticketId", "--ticket-id"], ["showTime", "--show-time"], ["guestCount", "--guests"]] as const) {
              if (args[k] === undefined) throw new UsageError(`Missing ${f}.`, "Pick a ticket: swiggy scenes shows <event>, then swiggy scenes cart --show <#> --guests 2");
            }
          }
          const out = await invokeTool("scenes", "create_event_cart", args, opts);
          const d = (out.data ?? {}) as { cartKey?: string; checkoutMode?: string; cart?: { cartKey?: string; bill?: { billToPay?: number } } };
          const cartKey = d.cartKey ?? d.cart?.cartKey;
          if (cartKey) {
            await saveEventCart({
              cartKey,
              checkoutMode: d.checkoutMode,
              venueId: args.venueId as string | undefined,
              showId: args.showId as number | undefined,
              ticketId: args.ticketId as string | undefined,
              showTime: args.showTime as number | undefined,
              guestCount: args.guestCount as number | undefined,
              latitude: args.latitude as number | undefined,
              longitude: args.longitude as number | undefined,
              billToPay: d.cart?.bill?.billToPay,
              savedAt: Date.now(),
            });
          }
          await renderOutcome("scenes", "create_event_cart", out, opts);
        });
      })
  );

  attachOutputOptions(
    sc
      .command("show-cart")
      .description("Look up an existing ticket cart (not needed in the normal flow: `cart` already returns it)")
      .option("--cart-key <key>", "cartKey from `scenes cart` (defaults to the last one)")
      .option("--lat <lat>", "latitude")
      .option("--lng <lng>", "longitude")
      .action(async (o: { cartKey?: string; lat?: string; lng?: string }) => {
        const opts = readGlobalOpts(sc);
        await run(opts, async () => {
          const saved = await loadEventCart();
          const cartKey = o.cartKey ?? saved?.cartKey;
          if (!cartKey) throw new UsageError("No ticket cart.", "Create one: swiggy scenes cart --show <#> --guests 2");
          const c = await resolveCoords("scenes", opts, o.lat, o.lng, "scenes show-cart");
          await callTool("scenes", "get_event_cart", { cartKey, ...c }, opts);
        });
      })
  );

  attachOutputOptions(
    attachPayFlags(
      sc
        .command("book")
        .alias("checkout")
        .description("Book the tickets in your cart (destructive). Free tickets book directly; paid tickets take UPI: --pay upi --wait. No Cash on Scenes")
        .option("--cart-key <key>", "cartKey from `scenes cart` (defaults to the last one)")
        .option("--input <json>", "raw place_event_order arguments (merged over flags)")
    ).action(async (o: { cartKey?: string; input?: string } & PayFlags) => {
      const opts = readGlobalOpts(sc);
      await run(opts, async () => {
        const saved = await loadEventCart();
        const cartKey = o.cartKey ?? saved?.cartKey;
        if (!cartKey && !o.input) throw new UsageError("No ticket cart to book.", "Create one first: swiggy scenes cart --show <#> --guests 2  (carts are kept for 30 minutes)");
        const mode = saved && saved.cartKey === cartKey ? saved.checkoutMode : undefined;
        if (o.pay && /^(cash|cod)$/i.test(o.pay.trim())) throw new UsageError("Scenes has no Cash option.", "Paid tickets take UPI: --pay upi --wait");
        if (mode === "UNAVAILABLE") throw new UsageError("This selection cannot be booked.", "Pick another show: swiggy scenes shows <event>");
        if (o.input) {
          await placeOrderWithPayment("scenes", await buildArgs({ cartKey }, o.input), o, opts);
          return;
        }
        if (mode === "FREE") {
          if (o.pay) throw new UsageError("This ticket is free; drop --pay.");
          // A free cart is recreated and repriced server-side, so Swiggy needs the selection echoed back.
          const { venueId, showId, ticketId, showTime, guestCount, latitude, longitude } = saved!;
          await placeOrderWithPayment("scenes", { cartKey, paymentMethod: "FREE", venueId, showId, ticketId, showTime, guestCount, latitude, longitude }, {}, opts);
          return;
        }
        if (!o.pay || !/^(upi|qr)/i.test(o.pay.trim())) {
          throw new UsageError(mode === "UPI" ? "These tickets are paid." : "How do you want to pay?", "Add --pay upi --wait (a scan-or-tap link), or --pay upi:<app id from `swiggy scenes payment-options`>");
        }
        await placeOrderWithPayment("scenes", { cartKey }, o, opts);
      });
    })
  );

  attachOutputOptions(
    sc
      .command("status <order>")
      .description("Ticket booking status and details (orderId from `book`)")
      .action(async (order: string) => {
        const opts = readGlobalOpts(sc);
        await run(opts, async () => {
          await callTool("scenes", "get_event_booking_status", { orderId: order }, opts);
        });
      })
  );

  attachPaymentCommands("scenes", sc, async () => (await loadEventCart())?.cartKey);
}
