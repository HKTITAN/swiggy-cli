import { Command } from "commander";
import { UsageError } from "../lib/errors.js";
import { attachOutputOptions, callTool, parseJsonInput, readGlobalOpts } from "./common.js";

export function buildDineoutCommands(program: Command): void {
  const d = program.command("dineout").description("Swiggy Dineout: discover restaurants, slots, bookings");

  attachOutputOptions(
    d
      .command("search")
      .description("Search Dineout restaurants")
      .option("-q, --query <q>", "search query")
      .option("-c, --city <city>", "city")
      .option("--cuisine <cuisine>", "cuisine filter")
      .action(async (o: { query?: string; city?: string; cuisine?: string }) => {
        await callTool("dineout", "search_restaurants_dineout", strip(o), readGlobalOpts(d));
      })
  );

  attachOutputOptions(
    d
      .command("details <id>")
      .description("Show restaurant details (menu, ratings, offers)")
      .action(async (id: string) => {
        await callTool("dineout", "get_restaurant_details", { restaurant_id: id }, readGlobalOpts(d));
      })
  );

  attachOutputOptions(
    d
      .command("locations")
      .description("List your saved Dineout locations")
      .action(async () => {
        await callTool("dineout", "get_saved_locations", {}, readGlobalOpts(d));
      })
  );

  attachOutputOptions(
    d
      .command("slots")
      .description("Get available booking slots for a restaurant")
      .option("--restaurant-id <id>", "restaurant id")
      .option("--date <yyyy-mm-dd>", "booking date")
      .option("--guests <n>", "number of guests")
      .action(async (o: { restaurantId?: string; date?: string; guests?: string }) => {
        if (!o.restaurantId) {
          throw new UsageError("Missing required option --restaurant-id.", "Run: swiggy dineout search first");
        }
        if (o.guests && Number(o.guests) <= 0) {
          throw new UsageError("Invalid --guests. It must be a positive number.");
        }
        await callTool(
          "dineout",
          "get_available_slots",
          strip({
            restaurant_id: o.restaurantId,
            date: o.date,
            guests: o.guests ? Number(o.guests) : undefined,
          }),
          readGlobalOpts(d)
        );
      })
  );

  attachOutputOptions(
    d
      .command("cart")
      .description("Create a Dineout booking cart")
      .option("--input <json>", "raw arguments JSON", "{}")
      .action(async (o: { input?: string }) => {
        await callTool("dineout", "create_cart", parseJsonInput(o.input || "{}"), readGlobalOpts(d));
      })
  );

  attachOutputOptions(
    d
      .command("book")
      .description("Book a table — destructive, requires confirmation")
      .option("--input <json>", "booking payload JSON", "{}")
      .action(async (o: { input?: string }) => {
        await callTool("dineout", "book_table", parseJsonInput(o.input || "{}"), readGlobalOpts(d));
      })
  );

  attachOutputOptions(
    d
      .command("status <bookingId>")
      .description("Get the status of a booking")
      .action(async (id: string) => {
        await callTool("dineout", "get_booking_status", { booking_id: id }, readGlobalOpts(d));
      })
  );
}

function strip<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") out[k] = v;
  return out as Partial<T>;
}
