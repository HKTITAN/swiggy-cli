import { Command } from "commander";
import { attachOutputOptions, callTool, parseJsonInput, readGlobalOpts } from "./common.js";

export function buildFoodCommands(program: Command): void {
  const food = program.command("food").description("Swiggy Food: search, menus, cart, orders");

  attachOutputOptions(
    food
      .command("search-restaurants")
      .description("Search restaurants by query, cuisine, or dish")
      .option("-q, --query <q>", "search query (e.g. 'biryani')")
      .option("-c, --city <city>", "city name")
      .option("--lat <lat>", "latitude")
      .option("--lng <lng>", "longitude")
      .action(async (o: { query?: string; city?: string; lat?: string; lng?: string }) => {
        await callTool("food", "search_restaurants", stripUndefined(o), readGlobalOpts(food));
      })
  );

  attachOutputOptions(
    food
      .command("search-menu")
      .description("Search menu items across restaurants")
      .option("-q, --query <q>", "search query")
      .action(async (o: { query?: string }) => {
        await callTool("food", "search_menu", stripUndefined(o), readGlobalOpts(food));
      })
  );

  attachOutputOptions(
    food
      .command("menu")
      .description("Get a restaurant's menu")
      .option("--restaurant-id <id>", "restaurant id")
      .action(async (o: { restaurantId?: string }) => {
        await callTool("food", "get_restaurant_menu", { restaurant_id: o.restaurantId }, readGlobalOpts(food));
      })
  );

  attachOutputOptions(
    food
      .command("addresses")
      .description("List your saved delivery addresses")
      .action(async () => {
        await callTool("food", "get_addresses", {}, readGlobalOpts(food));
      })
  );

  attachOutputOptions(
    food
      .command("cart")
      .description("Show your current food cart")
      .action(async () => {
        await callTool("food", "get_food_cart", {}, readGlobalOpts(food));
      })
  );

  attachOutputOptions(
    food
      .command("add-to-cart")
      .description("Add or update items in the food cart")
      .option("--restaurant-id <id>", "restaurant id")
      .option("--item-id <id>", "menu item id")
      .option("--quantity <n>", "quantity", "1")
      .option("--input <json>", "raw arguments JSON (overrides flags)")
      .action(async (o: { restaurantId?: string; itemId?: string; quantity?: string; input?: string }) => {
        const args = o.input
          ? parseJsonInput(o.input)
          : stripUndefined({
              restaurant_id: o.restaurantId,
              item_id: o.itemId,
              quantity: o.quantity ? Number(o.quantity) : undefined,
            });
        await callTool("food", "update_food_cart", args, readGlobalOpts(food));
      })
  );

  attachOutputOptions(
    food
      .command("clear-cart")
      .description("Empty the food cart")
      .action(async () => {
        await callTool("food", "flush_food_cart", {}, readGlobalOpts(food));
      })
  );

  attachOutputOptions(
    food
      .command("list-coupons")
      .description("List available food coupons")
      .action(async () => {
        await callTool("food", "fetch_food_coupons", {}, readGlobalOpts(food));
      })
  );

  attachOutputOptions(
    food
      .command("apply-coupon <code>")
      .description("Apply a coupon code to the food cart")
      .action(async (code: string) => {
        await callTool("food", "apply_food_coupon", { code }, readGlobalOpts(food));
      })
  );

  attachOutputOptions(
    food
      .command("checkout")
      .description("Place the current food order (COD only — destructive, requires confirmation)")
      .option("--address-id <id>", "delivery address id")
      .option("--input <json>", "raw arguments JSON")
      .action(async (o: { addressId?: string; input?: string }) => {
        const args = o.input ? parseJsonInput(o.input) : stripUndefined({ address_id: o.addressId });
        await callTool("food", "place_food_order", args, readGlobalOpts(food));
      })
  );

  attachOutputOptions(
    food
      .command("orders")
      .description("List your recent food orders")
      .action(async () => {
        await callTool("food", "get_food_orders", {}, readGlobalOpts(food));
      })
  );

  attachOutputOptions(
    food
      .command("order <id>")
      .description("Show details of a specific food order")
      .action(async (id: string) => {
        await callTool("food", "get_food_order_details", { order_id: id }, readGlobalOpts(food));
      })
  );

  attachOutputOptions(
    food
      .command("track <id>")
      .description("Track a food order")
      .action(async (id: string) => {
        await callTool("food", "track_food_order", { order_id: id }, readGlobalOpts(food));
      })
  );
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== "") out[k] = v;
  return out as Partial<T>;
}
