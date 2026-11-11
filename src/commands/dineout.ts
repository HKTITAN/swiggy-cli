import { Command } from "commander";
import { UsageError } from "../lib/errors.js";
import {
  attachOutputOptions,
  buildArgs,
  callTool,
  invokeTool,
  num,
  oneOf,
  positiveInt,
  readGlobalOpts,
  rememberDineoutCoords,
  renderOutcome,
  requireFlag,
  resolveDineoutCoords,
  run,
} from "./common.js";
import { attachPayFlags, attachPaymentCommands, placeOrderWithPayment, type PayFlags } from "./payments.js";
import { getContext, resolveRef } from "../lib/recent.js";
import { note, dim } from "../lib/output.js";

const ENTITY_TYPES = ["locality", "CUISINE", "RESTAURANT_CATEGORY", "ambience_tags"] as const;
const CART_TYPES = ["DEAL_TICKET_PURCHASE", "DINEOUT"] as const;

/**
 * Swiggy Dineout (mcp.swiggy.com/dineout) — 11 tools. Parameter names verified against
 * https://mcp.swiggy.com/builders/docs/reference/dineout/ on 2026-11-11.
 *
 * Dineout takes the `latitude`/`longitude` of a city or area. Search no longer accepts a saved
 * address id (the November 2026 reference requires coordinates and drops `get_saved_locations`),
 * so set them once in the profile or pass --lat/--lng; the CLI then reuses the last ones it saw.
 * Positional arguments accept a row number from the last listing or a raw id.
 */
export function buildDineoutCommands(program: Command): void {
  const d = program.command("dineout").description("Swiggy Dineout: discover restaurants, slots, table bookings, paid deals via UPI");

  attachOutputOptions(
    d
      .command("search")
      .argument("[term]", "ONE term: name, cuisine, area, 'rooftop', 'pub', 'buffet'")
      .description("Find restaurants to book around a city or area (coordinates)")
      .option("-q, --query <term>", "same as the positional term")
      .option("--address-id <id|#>", "no longer accepted by Swiggy for Dineout search; use --lat/--lng")
      .option("--lat <lat>", "latitude (with --lng) of the city or area; defaults to your profile or the last search")
      .option("--lng <lng>", "longitude")
      .option("--sort <key>", "sortKey, as documented for search_restaurants_dineout")
      .option("--entity-type <t>", `force interpretation: ${ENTITY_TYPES.join("|")} (rarely needed)`)
      .option("--limit <n>", "max results (default 10, max 30)")
      .option("--offset <n>", "offset from the previous response for more results")
      .option("--input <json>", "raw arguments JSON (merged over flags)")
      .action(async (termArg: string | undefined, o: { query?: string; addressId?: string; lat?: string; lng?: string; sort?: string; entityType?: string; limit?: string; offset?: string; input?: string }) => {
        const opts = readGlobalOpts(d);
        await run(opts, async () => {
          const query = o.query ?? termArg;
          if (!query && !o.input) throw new UsageError("What kind of place?", "Example: swiggy dineout search italian --lat 12.9716 --lng 77.5946");
          if (o.addressId) throw new UsageError("Dineout search takes coordinates, not a saved address id.", "Pass --lat/--lng for the city or area (Bangalore 12.9716,77.5946 · Mumbai 19.0760,72.8777 · Delhi 28.6139,77.2090), or set defaults: swiggy profile set default defaultLat <lat>");
          let latitude = num(o.lat, "--lat");
          let longitude = num(o.lng, "--lng");
          if (!o.input && (latitude === undefined || longitude === undefined)) {
            const c = await resolveDineoutCoords(opts, o.lat, o.lng, "dineout search").catch(() => undefined);
            if (c) ({ latitude, longitude } = c);
            else throw new UsageError("dineout search needs a location.", "Pass --lat/--lng for a city or area (Bangalore 12.9716,77.5946 · Mumbai 19.0760,72.8777 · Delhi 28.6139,77.2090)");
          }
          const args = await buildArgs(
            { query, latitude, longitude, sortKey: o.sort, entityType: oneOf(o.entityType, "--entity-type", ENTITY_TYPES), limit: positiveInt(o.limit, "--limit"), offset: num(o.offset, "--offset") },
            o.input
          );
          const out = await invokeTool("dineout", "search_restaurants_dineout", args, opts);
          await rememberDineoutCoords(out.data, out.extra, "search");
          await renderOutcome("dineout", "search_restaurants_dineout", out, opts);
        });
      })
  );

  attachOutputOptions(
    d
      .command("details <restaurant>")
      .alias("info")
      .description("Restaurant details: deals, menu images, amenities, timings (id or # from the last search)")
      .option("--lat <lat>", "latitude (defaults to the last search)")
      .option("--lng <lng>", "longitude")
      .action(async (restaurant: string, o: { lat?: string; lng?: string }) => {
        const opts = readGlobalOpts(d);
        await run(opts, async () => {
          const { id: restaurantId } = await resolveRef("dineout", restaurant, "restaurants");
          const c = await resolveDineoutCoords(opts, o.lat, o.lng, "dineout details");
          const out = await invokeTool("dineout", "get_restaurant_details", { restaurantId, ...c }, opts);
          await rememberDineoutCoords(out.data, out.extra, "details");
          await renderOutcome("dineout", "get_restaurant_details", out, opts);
        });
      })
  );

  attachOutputOptions(
    d
      .command("locations")
      .alias("addresses")
      .description("Your saved locations")
      .action(async () => {
        const opts = readGlobalOpts(d);
        await run(opts, async () => {
          await callTool("dineout", "get_saved_locations", {}, opts);
        });
      })
  );

  attachOutputOptions(
    d
      .command("slots [restaurant]")
      .alias("availability")
      .description("Available booking slots for up to 7 days from a date (restaurant id or #; defaults to the last one)")
      .option("--restaurant-id <id|#>", "restaurant (alternative to the positional)")
      .option("--date <yyyy-mm-dd>", "start date (default: today)")
      .option("--lat <lat>", "latitude (defaults to the last search)")
      .option("--lng <lng>", "longitude")
      .action(async (restaurantArg: string | undefined, o: { restaurantId?: string; date?: string; lat?: string; lng?: string }) => {
        const opts = readGlobalOpts(d);
        await run(opts, async () => {
          const ref = o.restaurantId ?? restaurantArg ?? (await getContext()).restaurantId;
          if (!ref) throw new UsageError("Which restaurant?", "Run: swiggy dineout search <term>, then swiggy dineout slots <#> --date YYYY-MM-DD");
          const { id: restaurantId } = await resolveRef("dineout", ref, "restaurants");
          const date = o.date ?? new Date().toISOString().slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$|^\d{9,13}$/.test(date)) throw new UsageError("--date must be YYYY-MM-DD (or epoch seconds).");
          const c = await resolveDineoutCoords(opts, o.lat, o.lng, "dineout slots");
          await callTool("dineout", "get_available_slots", { restaurantId, date, ...c }, opts);
        });
      })
  );

  attachOutputOptions(
    d
      .command("cart")
      .description("Create a booking cart: DEAL_TICKET_PURCHASE for a paid prebook deal (returns cartKey), DINEOUT for bill payment")
      .option("--slot <#|slotId:itemId>", "slot/deal from the last `slots` listing")
      .option("--restaurant-id <id|#>", "restaurant id (defaults to the slot's restaurant)")
      .option("--type <cartType>", `${CART_TYPES.join("|")}`, "DEAL_TICKET_PURCHASE")
      .option("--slot-id <n>", "slot.deals[].slotId (booking cart)")
      .option("--item-id <id>", "slot.deals[].itemId, format restaurantId-ticketId (booking cart)")
      .option("--reservation-time <epoch>", "slot.reservationTime (booking cart)")
      .option("--guests <n>", "guest count 1-20 (booking cart)")
      .option("--bill-amount <rupees>", "bill amount (DINEOUT bill-payment cart)")
      .option("--source <s>", "bill-payment source (default direct-payment-cart)")
      .option("--lat <lat>", "latitude (defaults to the last search)")
      .option("--lng <lng>", "longitude")
      .option("--input <json>", "raw create_cart arguments (merged over flags)")
      .action(async (o: { slot?: string; restaurantId?: string; type?: string; slotId?: string; itemId?: string; reservationTime?: string; guests?: string; billAmount?: string; source?: string; lat?: string; lng?: string; input?: string }) => {
        const opts = readGlobalOpts(d);
        await run(opts, async () => {
          const slot = o.slot ? (await resolveRef("slots", o.slot, "slots")).entry?.extra ?? {} : {};
          const restaurantRef = o.restaurantId ?? (slot.restaurantId as string | undefined) ?? (await getContext()).restaurantId;
          if (!restaurantRef && !o.input) throw new UsageError("Missing --restaurant-id.", "Run: swiggy dineout slots <#> first");
          const restaurantId = restaurantRef ? (await resolveRef("dineout", restaurantRef, "restaurants")).id : undefined;
          const c = await resolveDineoutCoords(opts, o.lat, o.lng, "dineout cart");
          const cartType = oneOf(o.type, "--type", CART_TYPES) ?? "DEAL_TICKET_PURCHASE";
          const args = await buildArgs(
            {
              restaurantId,
              cartType,
              ...c,
              slotId: num(o.slotId, "--slot-id") ?? (slot.slotId as number | undefined),
              itemId: o.itemId ?? (slot.itemId as string | undefined),
              reservationTime: num(o.reservationTime, "--reservation-time") ?? (slot.reservationTime as number | undefined),
              guestCount: positiveInt(o.guests, "--guests"),
              billAmount: num(o.billAmount, "--bill-amount"),
              source: o.source,
            },
            o.input
          );
          if (!o.input && cartType === "DEAL_TICKET_PURCHASE") {
            for (const [k, f] of [["slotId", "--slot-id"], ["itemId", "--item-id"], ["reservationTime", "--reservation-time"], ["guestCount", "--guests"]] as const) {
              if (args[k] === undefined) throw new UsageError(`Missing required option ${f} for a DEAL_TICKET_PURCHASE cart.`, "Use --slot <#> from `swiggy dineout slots` plus --guests <n>");
            }
          }
          if (!o.input && cartType === "DINEOUT" && args.billAmount === undefined) throw new UsageError("Missing required option --bill-amount for a DINEOUT cart.");
          await callTool("dineout", "create_cart", args, opts);
        });
      })
  );

  attachOutputOptions(
    attachPayFlags(
      d
        .command("book [slot]")
        .alias("reserve")
        .description("Book a table (destructive): slot # from `slots` + --guests. Free deals book directly; paid deals take UPI via --pay upi --wait")
        .option("--guests <n>", "guest count 1-20")
        .option("--restaurant-id <id|#>", "restaurant id (defaults to the slot's restaurant)")
        .option("--slot-id <n>", "slot.deals[].slotId (instead of the positional)")
        .option("--item-id <id>", "slot.deals[].itemId (restaurantId-ticketId)")
        .option("--reservation-time <epoch>", "slot.reservationTime")
        .option("--cart-key <key>", "cartKey from `dineout cart` (paid deal; created automatically when omitted)")
        .option("--lat <lat>", "latitude (defaults to the last search)")
        .option("--lng <lng>", "longitude")
        .option("--input <json>", "raw book_table arguments (merged over flags)")
    ).action(async (slotArg: string | undefined, o: { guests?: string; restaurantId?: string; slotId?: string; itemId?: string; reservationTime?: string; cartKey?: string; lat?: string; lng?: string; input?: string } & PayFlags) => {
      const opts = readGlobalOpts(d);
      await run(opts, async () => {
        const slot = slotArg ? (await resolveRef("slots", slotArg, "slots")).entry?.extra ?? {} : {};
        const restaurantRef = o.restaurantId ?? (slot.restaurantId as string | undefined) ?? (await getContext()).restaurantId;
        if (!restaurantRef && !o.input) throw new UsageError("Missing restaurant.", "Run: swiggy dineout slots <#>, then swiggy dineout book <#> --guests 2");
        const restaurantId = restaurantRef ? (await resolveRef("dineout", restaurantRef, "restaurants")).id : undefined;
        const c = await resolveDineoutCoords(opts, o.lat, o.lng, "dineout book");
        const guestCount = o.input ? positiveInt(o.guests, "--guests") : requireFlag(positiveInt(o.guests, "--guests"), "--guests", "How many guests? e.g. --guests 2");
        if (guestCount !== undefined && guestCount > 20) throw new UsageError("--guests must be between 1 and 20.");
        const slotId = num(o.slotId, "--slot-id") ?? (slot.slotId as number | undefined);
        const itemId = o.itemId ?? (slot.itemId as string | undefined);
        const reservationTime = num(o.reservationTime, "--reservation-time") ?? (slot.reservationTime as number | undefined);
        if (!o.input && (slotId === undefined || !itemId || reservationTime === undefined)) throw new UsageError("Missing slot details.", "Pick a slot: swiggy dineout slots <restaurant> --date YYYY-MM-DD, then swiggy dineout book <#> --guests 2");
        let cartKey = o.cartKey;
        const paid = slot.isFree === false;
        const wantsUpi = Boolean(o.pay && /^upi/i.test(o.pay));
        if (paid && !wantsUpi && !o.input) {
          throw new UsageError("This is a paid deal.", "Add --pay upi --wait (the CLI creates the booking cart and takes UPI), or pick a free slot.");
        }
        if (wantsUpi && !cartKey && !o.input) {
          note(dim("paid deal: creating the booking cart first", opts), opts);
          const cart = await invokeTool("dineout", "create_cart", { restaurantId, cartType: "DEAL_TICKET_PURCHASE", ...c, slotId, itemId, reservationTime, guestCount }, opts);
          const cd = cart.data as { cartKey?: string; cart?: { cartKey?: string } } | undefined;
          cartKey = cd?.cartKey ?? cd?.cart?.cartKey;
          if (!cartKey) throw new UsageError("create_cart did not return a cartKey.", "Run: swiggy dineout cart --slot <#> --guests <n> and pass --cart-key");
        }
        const args = await buildArgs({ restaurantId, slotId, itemId, reservationTime, guestCount, ...c, cartKey }, o.input);
        await placeOrderWithPayment("dineout", args, o, opts);
      });
    })
  );

  attachOutputOptions(
    d
      .command("status <booking>")
      .description("Booking status and details (orderId from book, or # from the last listing)")
      .action(async (booking: string) => {
        const opts = readGlobalOpts(d);
        await run(opts, async () => {
          const { id: orderId } = await resolveRef("orders", booking, "bookings");
          await callTool("dineout", "get_booking_status", { orderId }, opts);
        });
      })
  );

  attachOutputOptions(
    d
      .command("cancel <booking>")
      .description("Cancel a reservation (destructive)")
      .option("--reason <text>", "short reason (not shown to the user)")
      .action(async (booking: string, o: { reason?: string }) => {
        const opts = readGlobalOpts(d);
        await run(opts, async () => {
          const { id: orderId } = await resolveRef("orders", booking, "bookings");
          await callTool("dineout", "cancel_booking", await buildArgs({ orderId, cancellationReason: o.reason }), opts, undefined, `Cancel booking ${orderId}`);
        });
      })
  );

  attachPaymentCommands("dineout", d);
}
