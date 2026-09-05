import { Command } from "commander";
import { UsageError } from "../lib/errors.js";
import { attachOutputOptions, buildArgs, callTool, ensureAddressId, invokeTool, num, oneOf, positiveInt, readGlobalOpts, run } from "./common.js";
import { attachAddressCommands } from "./address.js";
import { attachPayFlags, attachPaymentCommands, placeOrderWithPayment, type PayFlags } from "./payments.js";
import { getContext, resolveRef } from "../lib/recent.js";

const COLLECTIONS = ["EATRIGHT", "BOLT", "STORE_99"] as const;

/**
 * Swiggy Food (mcp.swiggy.com/food) — 20 tools. Parameter names verified against
 * https://mcp.swiggy.com/builders/docs/reference/food/ on 2026-09-05.
 *
 * Positional arguments accept a row number from the last listing (`swiggy food menu 2`,
 * `swiggy food add 3 --qty 2`) or a raw id.
 */
export function buildFoodCommands(program: Command): void {
  const food = program.command("food").description("Swiggy Food: restaurants, menus, cart, coupons, orders, UPI payment");

  attachOutputOptions(
    food
      .command("search")
      .alias("search-restaurants")
      .argument("[query]", "restaurant name or cuisine, e.g. biryani")
      .description("Search restaurants by name or cuisine near your address")
      .option("-q, --query <q>", "same as the positional query")
      .option("--address-id <id>", "delivery address id (from `food addresses`)")
      .option("--collection <c>", `storefront: ${COLLECTIONS.join("|")} (EATRIGHT=healthy, BOLT=~10-min delivery, STORE_99=budget)`)
      .option("--offset <n>", "pagination offset (use nextOffset from the previous response)")
      .option("--input <json>", "raw arguments JSON (merged over flags)")
      .action(async (queryArg: string | undefined, o: { query?: string; addressId?: string; collection?: string; offset?: string; input?: string }) => {
        const opts = readGlobalOpts(food);
        await run(opts, async () => {
          const query = o.query ?? queryArg;
          if (!query && !o.input) throw new UsageError("What should I search for?", 'Example: swiggy food search biryani  (or -q "north indian")');
          const addressId = await ensureAddressId("food", opts, o.addressId, "food search");
          const args = await buildArgs({ addressId, query, collection: oneOf(o.collection, "--collection", COLLECTIONS), offset: num(o.offset, "--offset") }, o.input);
          await callTool("food", "search_restaurants", args, opts);
        });
      })
  );

  attachOutputOptions(
    food
      .command("search-menu")
      .alias("dishes")
      .argument("[dish]", "dish name, e.g. \"paneer tikka\"")
      .description("Search dishes across restaurants (or within one with --restaurant-id)")
      .option("-q, --query <q>", "same as the positional dish")
      .option("--address-id <id>", "delivery address id")
      .option("--restaurant-id <id|#>", "scope the search to one restaurant (id or # from the last search)")
      .option("--veg", "veg-only items (there is no non-veg-only filter upstream)")
      .option("--offset <n>", "pagination offset")
      .option("--input <json>", "raw arguments JSON (merged over flags)")
      .action(async (dishArg: string | undefined, o: { query?: string; addressId?: string; restaurantId?: string; veg?: boolean; offset?: string; input?: string }) => {
        const opts = readGlobalOpts(food);
        await run(opts, async () => {
          const query = o.query ?? dishArg;
          if (!query && !o.input) throw new UsageError("Which dish should I look for?", "Example: swiggy food search-menu \"paneer tikka\" --veg");
          const addressId = await ensureAddressId("food", opts, o.addressId, "food search-menu");
          const restaurantId = o.restaurantId ? (await resolveRef("restaurants", o.restaurantId, "restaurants")).id : undefined;
          const args = await buildArgs({ addressId, query, restaurantIdOfAddedItem: restaurantId, vegFilter: o.veg ? 1 : undefined, offset: num(o.offset, "--offset") }, o.input);
          await callTool("food", "search_menu", args, opts);
        });
      })
  );

  attachOutputOptions(
    food
      .command("menu")
      .argument("[restaurant]", "restaurant id, or # from the last search")
      .description("A restaurant's full menu (flat, deduplicated, capped at 150 items)")
      .option("--restaurant-id <id>", "restaurant id (alternative to the positional)")
      .option("--address-id <id>", "delivery address id")
      .action(async (restaurantArg: string | undefined, o: { restaurantId?: string; addressId?: string }) => {
        const opts = readGlobalOpts(food);
        await run(opts, async () => {
          const ref = o.restaurantId ?? restaurantArg ?? (await getContext()).restaurantId;
          if (!ref) throw new UsageError("Which restaurant?", "Run: swiggy food search <cuisine>, then swiggy food menu <#>");
          const { id: restaurantId } = await resolveRef("restaurants", ref, "restaurants");
          const addressId = await ensureAddressId("food", opts, o.addressId, "food menu");
          await callTool("food", "get_restaurant_menu", { addressId, restaurantId }, opts);
        });
      })
  );

  attachAddressCommands("food", food);

  attachOutputOptions(
    food
      .command("cart")
      .description("Show the current food cart with bill breakdown and available payment methods")
      .option("--address-id <id>", "delivery address id (for accurate delivery charges)")
      .option("--restaurant-name <name>", "restaurant name to display (the cart API does not always return it)")
      .action(async (o: { addressId?: string; restaurantName?: string }) => {
        const opts = readGlobalOpts(food);
        await run(opts, async () => {
          const addressId = await ensureAddressId("food", opts, o.addressId, "food cart");
          const restaurantName = o.restaurantName ?? (await getContext()).restaurantName;
          await callTool("food", "get_food_cart", await buildArgs({ addressId, restaurantName }), opts);
        });
      })
  );

  attachOutputOptions(
    food
      .command("add")
      .alias("add-to-cart")
      .alias("update-cart")
      .argument("[item]", "menu item: # from the last menu/dish listing, or a menu_item_id")
      .description("Add or update an item in the food cart (one restaurant per cart; switching restaurants flushes it)")
      .option("--qty, --quantity <n>", "quantity", "1")
      .option("--item-id <menu_item_id>", "menu_item_id (alternative to the positional)")
      .option("--restaurant-id <id|#>", "restaurant id (defaults to the item's restaurant / last menu)")
      .option("--items <json>", "full cartItems array JSON (for variants/addons: menu_item_id, quantity, variants[], addons[])")
      .option("--address-id <id>", "delivery address id")
      .option("--restaurant-name <name>", "restaurant name to display")
      .option("--cutlery", "request cutlery")
      .option("--no-cutlery", "skip cutlery")
      .option("--input <json>", "raw update_food_cart arguments (merged over flags)")
      .action(async (itemArg: string | undefined, o: { quantity?: string; itemId?: string; restaurantId?: string; items?: string; addressId?: string; restaurantName?: string; cutlery?: boolean; input?: string }) => {
        const opts = readGlobalOpts(food);
        await run(opts, async () => {
          const ctxRecent = await getContext();
          const qty = positiveInt(o.quantity, "--qty") ?? 1;
          let cartItems: unknown;
          let restaurantId: string | undefined;
          let restaurantName = o.restaurantName;
          if (o.items) {
            cartItems = JSON.parse(o.items);
            if (!Array.isArray(cartItems)) throw new UsageError("--items must be a JSON array.");
          } else {
            const ref = o.itemId ?? itemArg;
            if (!ref && !o.input) throw new UsageError("Which item?", "Run: swiggy food search-menu <dish> (or food menu <#>), then swiggy food add <#> --qty 1");
            if (ref) {
              const { id, entry } = await resolveRef("menuItems", ref, "menu items");
              cartItems = [{ menu_item_id: id, quantity: qty }];
              restaurantId = (entry?.extra?.restaurantId as string | undefined) ?? undefined;
              restaurantName = restaurantName ?? (entry?.extra?.restaurantName as string | undefined);
            }
          }
          if (o.restaurantId) restaurantId = (await resolveRef("restaurants", o.restaurantId, "restaurants")).id;
          restaurantId = restaurantId ?? ctxRecent.restaurantId;
          restaurantName = restaurantName ?? ctxRecent.restaurantName;
          if (!o.input && !restaurantId) throw new UsageError("Missing restaurant.", "Pass --restaurant-id <id|#>, or list the menu first so the CLI knows which restaurant the item belongs to.");
          const addressId = o.input ? o.addressId : await ensureAddressId("food", opts, o.addressId, "food add");
          const cutleryGiven = process.argv.some((a) => a === "--cutlery" || a === "--no-cutlery");
          const args = await buildArgs({ restaurantId, cartItems, addressId, restaurantName, cutleryOptIn: cutleryGiven ? o.cutlery : undefined }, o.input);
          await callTool("food", "update_food_cart", args, opts);
        });
      })
  );

  attachOutputOptions(
    food
      .command("clear-cart")
      .alias("clear")
      .description("Empty the food cart (destructive)")
      .action(async () => {
        const opts = readGlobalOpts(food);
        await run(opts, async () => {
          await callTool("food", "flush_food_cart", {}, opts, undefined, "Empty the food cart");
        });
      })
  );

  attachOutputOptions(
    food
      .command("list-coupons")
      .alias("coupons")
      .description("Coupons applicable to the cart at a restaurant")
      .option("--restaurant-id <id|#>", "restaurant id (defaults to the cart's / last menu's restaurant)")
      .option("--address-id <id>", "delivery address id")
      .option("--code <couponCode>", "check one specific coupon")
      .action(async (o: { restaurantId?: string; addressId?: string; code?: string }) => {
        const opts = readGlobalOpts(food);
        await run(opts, async () => {
          const ref = o.restaurantId ?? (await getContext()).restaurantId;
          if (!ref) throw new UsageError("Missing --restaurant-id.", "Run: swiggy food cart first (it records the cart's restaurant)");
          const { id: restaurantId } = await resolveRef("restaurants", ref, "restaurants");
          const addressId = await ensureAddressId("food", opts, o.addressId, "food list-coupons");
          await callTool("food", "fetch_food_coupons", await buildArgs({ restaurantId, addressId, couponCode: o.code }), opts);
        });
      })
  );

  attachOutputOptions(
    food
      .command("apply-coupon <couponCode>")
      .alias("coupon")
      .description("Apply a coupon code to the food cart")
      .option("--address-id <id>", "delivery address id")
      .option("--cart-id <id>", "cart id (optional)")
      .action(async (couponCode: string, o: { addressId?: string; cartId?: string }) => {
        const opts = readGlobalOpts(food);
        await run(opts, async () => {
          const addressId = await ensureAddressId("food", opts, o.addressId, "food apply-coupon");
          await callTool("food", "apply_food_coupon", await buildArgs({ couponCode, addressId, cartId: o.cartId }), opts);
        });
      })
  );

  attachOutputOptions(
    attachPayFlags(
      food
        .command("checkout")
        .alias("place-order")
        .alias("order-now")
        .description("Place the food order (destructive). --pay cash|upi|upi:<app>|swiggypay; add --wait to complete UPI in one go")
        .option("--address-id <id>", "delivery address id")
        .option("--note <text>", "note to the restaurant, e.g. 'less spicy'")
        .option("--input <json>", "raw place_food_order arguments (merged over flags)")
    ).action(async (o: { addressId?: string; note?: string; input?: string } & PayFlags) => {
      const opts = readGlobalOpts(food);
      await run(opts, async () => {
        const addressId = o.input ? o.addressId : await ensureAddressId("food", opts, o.addressId, "food checkout");
        const args = await buildArgs({ addressId, noteToRestaurant: o.note }, o.input);
        await placeOrderWithPayment("food", args, o, opts, { addressId });
      });
    })
  );

  attachOutputOptions(
    food
      .command("orders")
      .description("Food order history")
      .option("--address-id <id>", "delivery address id")
      .option("--active", "only active / in-progress orders")
      .action(async (o: { addressId?: string; active?: boolean }) => {
        const opts = readGlobalOpts(food);
        await run(opts, async () => {
          const addressId = await ensureAddressId("food", opts, o.addressId, "food orders");
          await callTool("food", "get_food_orders", await buildArgs({ addressId, activeOnly: o.active ? true : undefined }), opts);
        });
      })
  );

  attachOutputOptions(
    food
      .command("order <order>")
      .description("Details of one food order (id or # from the last orders listing)")
      .action(async (order: string) => {
        const opts = readGlobalOpts(food);
        await run(opts, async () => {
          const { id: orderId } = await resolveRef("orders", order, "orders");
          await callTool("food", "get_food_order_details", { orderId }, opts);
        });
      })
  );

  attachOutputOptions(
    food
      .command("track [order]")
      .description("Track a food order (id or #; omit to see all active orders)")
      .action(async (order?: string) => {
        const opts = readGlobalOpts(food);
        await run(opts, async () => {
          const orderId = order ? (await resolveRef("orders", order, "orders")).id : undefined;
          await callTool("food", "track_food_order", await buildArgs({ orderId }), opts);
        });
      })
  );

  attachOutputOptions(
    food
      .command("delivery-status <order>")
      .alias("eta")
      .description("Structured delivery ETA + terminal state for polling (no faster than every 10s)")
      .action(async (order: string) => {
        const opts = readGlobalOpts(food);
        await run(opts, async () => {
          const { id: orderId } = await resolveRef("orders", order, "orders");
          await callTool("food", "get_food_delivery_status", { orderId }, opts);
        });
      })
  );

  attachPaymentCommands("food", food);
  void invokeTool;
}
