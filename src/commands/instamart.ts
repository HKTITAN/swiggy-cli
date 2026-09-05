import { Command } from "commander";
import { UsageError } from "../lib/errors.js";
import { attachOutputOptions, buildArgs, callTool, ensureAddressId, invokeTool, num, positiveInt, readGlobalOpts, renderOutcome, run } from "./common.js";
import { attachAddressCommands } from "./address.js";
import { attachPayFlags, attachPaymentCommands, placeOrderWithPayment, type PayFlags } from "./payments.js";
import { resolveRef } from "../lib/recent.js";

/**
 * Swiggy Instamart (mcp.swiggy.com/im) — 19 tools. Parameter names verified against
 * https://mcp.swiggy.com/builders/docs/reference/instamart/ on 2026-09-05.
 *
 * Upstream `update_cart` REPLACES the cart. `swiggy instamart add` therefore reads the current cart
 * and merges, so it behaves the way a person expects; `set-cart` exposes the raw replace semantics.
 */
export function buildInstamartCommands(program: Command): void {
  const im = program.command("instamart").alias("im").description("Swiggy Instamart: groceries, cart, coupons, checkout, UPI payment");

  attachOutputOptions(
    im
      .command("search")
      .argument("[query]", "product, category or brand, e.g. milk")
      .description("Search products available at your address (each product has variations with spinId/skuId)")
      .option("-q, --query <q>", "same as the positional query")
      .option("--address-id <id>", "delivery address id")
      .option("--offset <n>", "pagination offset (nextOffset from the previous response)")
      .option("--input <json>", "raw arguments JSON (merged over flags)")
      .action(async (queryArg: string | undefined, o: { query?: string; addressId?: string; offset?: string; input?: string }) => {
        const opts = readGlobalOpts(im);
        await run(opts, async () => {
          const query = o.query ?? queryArg;
          if (!query && !o.input) throw new UsageError("What should I search for?", "Example: swiggy instamart search milk");
          const addressId = await ensureAddressId("instamart", opts, o.addressId, "instamart search");
          await callTool("instamart", "search_products", await buildArgs({ addressId, query, offset: num(o.offset, "--offset") }, o.input), opts);
        });
      })
  );

  attachOutputOptions(
    im
      .command("go-to-items")
      .alias("usual")
      .alias("reorder")
      .description("Your frequently / recently ordered items (one call replaces 3-5 searches for a reorder)")
      .option("--address-id <id>", "delivery address id")
      .option("--offset <n>", "pagination offset")
      .action(async (o: { addressId?: string; offset?: string }) => {
        const opts = readGlobalOpts(im);
        await run(opts, async () => {
          const addressId = await ensureAddressId("instamart", opts, o.addressId, "instamart go-to-items");
          await callTool("instamart", "your_go_to_items", await buildArgs({ addressId, offset: num(o.offset, "--offset") }), opts);
        });
      })
  );

  attachAddressCommands("instamart", im);

  attachOutputOptions(
    im
      .command("cart")
      .description("Show the Instamart cart with bill breakdown and available payment methods")
      .action(async () => {
        const opts = readGlobalOpts(im);
        await run(opts, async () => {
          await callTool("instamart", "get_cart", {}, opts);
        });
      })
  );

  attachOutputOptions(
    im
      .command("add")
      .alias("add-to-cart")
      .argument("[product]", "product: # from the last search, or a spinId")
      .description("Add a product to the cart (merges with what is already there)")
      .option("--qty, --quantity <n>", "quantity", "1")
      .option("--spin-id <id>", "variation spinId (alternative to the positional)")
      .option("--sku-id <id>", "variation skuId (auto-filled from the last search when using #)")
      .option("--address-id <id>", "selected delivery address id")
      .option("--replace", "do not merge: send only this item (upstream update_cart semantics)")
      .action(async (productArg: string | undefined, o: { quantity?: string; spinId?: string; skuId?: string; addressId?: string; replace?: boolean }) => {
        const opts = readGlobalOpts(im);
        await run(opts, async () => {
          const ref = o.spinId ?? productArg;
          if (!ref) throw new UsageError("Which product?", "Run: swiggy instamart search <item>, then swiggy instamart add <#> --qty 1");
          const { id: spinId, entry } = await resolveRef("products", ref, "products");
          const skuId = o.skuId ?? (entry?.extra?.skuId as string | undefined);
          const qty = positiveInt(o.quantity, "--qty") ?? 1;
          const selectedAddressId = await ensureAddressId("instamart", opts, o.addressId, "instamart add");
          let items: Array<Record<string, unknown>> = [];
          if (!o.replace) {
            const current = await invokeTool("instamart", "get_cart", {}, { ...opts, quiet: true });
            const existing = current.data && typeof current.data === "object" && Array.isArray((current.data as { items?: unknown }).items) ? ((current.data as { items: Array<Record<string, unknown>> }).items ?? []) : [];
            items = existing
              .filter((it) => typeof it.spinId === "string" && it.spinId !== spinId)
              .map((it) => ({ spinId: it.spinId, skuId: it.skuId, quantity: it.quantity }));
            const same = existing.find((it) => it.spinId === spinId);
            if (same) items.push({ spinId, skuId: skuId ?? same.skuId, quantity: Number(same.quantity ?? 0) + qty });
            else items.push({ spinId, skuId, quantity: qty });
          } else {
            items = [{ spinId, skuId, quantity: qty }];
          }
          const cleaned = items.map((it) => Object.fromEntries(Object.entries(it).filter(([, v]) => v !== undefined)));
          const out = await invokeTool("instamart", "update_cart", { selectedAddressId, items: cleaned }, opts);
          renderOutcome("instamart", "update_cart", out, opts);
        });
      })
  );

  attachOutputOptions(
    im
      .command("set-cart")
      .description("Replace the whole Instamart cart with the items you pass (raw update_cart semantics)")
      .option("--spin-id <id>", "variation spinId from search (SKU-level id)")
      .option("--sku-id <id>", "variation skuId from search")
      .option("--qty, --quantity <n>", "quantity", "1")
      .option("--items <json>", "full items array JSON: [{\"spinId\":\"...\",\"skuId\":\"...\",\"quantity\":1}, ...]")
      .option("--address-id <id>", "selected delivery address id")
      .option("--input <json>", "raw update_cart arguments (merged over flags)")
      .action(async (o: { spinId?: string; skuId?: string; quantity?: string; items?: string; addressId?: string; input?: string }) => {
        const opts = readGlobalOpts(im);
        await run(opts, async () => {
          if (!o.input && !o.spinId && !o.items) throw new UsageError("Provide --spin-id (with --sku-id) or --items <json>.", "Get spinId/skuId from `swiggy instamart search <term>` → products[].variations[]");
          const qty = positiveInt(o.quantity, "--qty") ?? 1;
          let items: unknown;
          if (o.items) {
            items = JSON.parse(o.items);
            if (!Array.isArray(items)) throw new UsageError("--items must be a JSON array.");
          } else if (o.spinId) {
            items = [o.skuId ? { spinId: o.spinId, skuId: o.skuId, quantity: qty } : { spinId: o.spinId, quantity: qty }];
          }
          const selectedAddressId = o.input ? o.addressId : await ensureAddressId("instamart", opts, o.addressId, "instamart set-cart");
          await callTool("instamart", "update_cart", await buildArgs({ selectedAddressId, items }, o.input), opts);
        });
      })
  );

  attachOutputOptions(
    im
      .command("clear-cart")
      .alias("clear")
      .description("Empty the Instamart cart (destructive)")
      .action(async () => {
        const opts = readGlobalOpts(im);
        await run(opts, async () => {
          await callTool("instamart", "clear_cart", {}, opts, undefined, "Empty the Instamart cart");
        });
      })
  );

  attachOutputOptions(
    im
      .command("list-coupons")
      .alias("coupons")
      .description("Coupons applicable to the current cart at an address")
      .option("--address-id <id>", "delivery address id")
      .action(async (o: { addressId?: string }) => {
        const opts = readGlobalOpts(im);
        await run(opts, async () => {
          const addressId = await ensureAddressId("instamart", opts, o.addressId, "instamart list-coupons");
          await callTool("instamart", "list_coupons", { addressId }, opts);
        });
      })
  );

  attachOutputOptions(
    im
      .command("apply-coupon <couponCode>")
      .alias("coupon")
      .description("Apply a coupon code to the Instamart cart (case-insensitive)")
      .action(async (couponCode: string) => {
        const opts = readGlobalOpts(im);
        await run(opts, async () => {
          await callTool("instamart", "apply_coupon", { couponCode }, opts);
        });
      })
  );

  attachOutputOptions(
    attachPayFlags(
      im
        .command("checkout")
        .alias("place-order")
        .alias("order-now")
        .description("Place the Instamart order (destructive). --pay cash|upi|upi:<app>|swiggypay; add --wait to complete UPI in one go")
        .option("--address-id <id>", "delivery address id")
        .option("--input <json>", "raw checkout arguments (merged over flags)")
    ).action(async (o: { addressId?: string; input?: string } & PayFlags) => {
      const opts = readGlobalOpts(im);
      await run(opts, async () => {
        const addressId = o.input ? o.addressId : await ensureAddressId("instamart", opts, o.addressId, "instamart checkout");
        await placeOrderWithPayment("instamart", await buildArgs({ addressId }, o.input), o, opts, { addressId });
      });
    })
  );

  attachOutputOptions(
    im
      .command("orders")
      .description("Instamart order history")
      .option("--count <n>", "number of orders (default 10, max 20)")
      .option("--type <orderType>", "order type filter, e.g. DASH or INSTAMART")
      .option("--active", "only active / ongoing orders")
      .action(async (o: { count?: string; type?: string; active?: boolean }) => {
        const opts = readGlobalOpts(im);
        await run(opts, async () => {
          await callTool("instamart", "get_orders", await buildArgs({ count: positiveInt(o.count, "--count"), orderType: o.type, activeOnly: o.active ? true : undefined }), opts);
        });
      })
  );

  attachOutputOptions(
    im
      .command("order <order>")
      .description("Details of one Instamart order (id or # from the last orders listing)")
      .action(async (order: string) => {
        const opts = readGlobalOpts(im);
        await run(opts, async () => {
          const { id: orderId } = await resolveRef("orders", order, "orders");
          await callTool("instamart", "get_order_details", { orderId }, opts);
        });
      })
  );

  attachOutputOptions(
    im
      .command("track <order>")
      .description("Track an Instamart order in real time (needs the delivery address coordinates)")
      .requiredOption("--lat <lat>", "delivery address latitude")
      .requiredOption("--lng <lng>", "delivery address longitude")
      .action(async (order: string, o: { lat: string; lng: string }) => {
        const opts = readGlobalOpts(im);
        await run(opts, async () => {
          const { id: orderId } = await resolveRef("orders", order, "orders");
          await callTool("instamart", "track_order", { orderId, lat: num(o.lat, "--lat"), lng: num(o.lng, "--lng") }, opts);
        });
      })
  );

  attachOutputOptions(
    im
      .command("delivery-status <order>")
      .alias("eta")
      .description("Latest delivery ETA and status for an Instamart order")
      .option("--address-id <id>", "delivery address id for the order")
      .action(async (order: string, o: { addressId?: string }) => {
        const opts = readGlobalOpts(im);
        await run(opts, async () => {
          const { id: orderId } = await resolveRef("orders", order, "orders");
          const addressId = await ensureAddressId("instamart", opts, o.addressId, "instamart delivery-status");
          await callTool("instamart", "get_delivery_status", { orderId, addressId }, opts);
        });
      })
  );

  attachPaymentCommands("instamart", im);
}
