import { Command } from "commander";
import { UsageError } from "../lib/errors.js";
import { attachOutputOptions, callTool, ensureAddressId, parseJsonInput, readGlobalOpts } from "./common.js";

export function buildInstamartCommands(program: Command): void {
  const im = program.command("instamart").description("Swiggy Instamart: groceries, cart, checkout");

  attachOutputOptions(
    im
      .command("search")
      .description("Search Instamart products")
      .option("-q, --query <q>", "search query")
      .option("--address-id <id>", "delivery address id")
      .action(async (o: { query?: string; addressId?: string }) => {
        const opts = readGlobalOpts(im);
        const addressId = await ensureAddressId("instamart", opts, o.addressId, { requiredBy: "instamart search" });
        await callTool("instamart", "search_products", strip({ query: o.query, addressId }), opts);
      })
  );

  attachOutputOptions(
    im
      .command("go-to-items")
      .description("Show your frequently-ordered Instamart items")
      .option("--address-id <id>", "delivery address id")
      .action(async (o: { addressId?: string }) => {
        const opts = readGlobalOpts(im);
        const addressId = await ensureAddressId("instamart", opts, o.addressId, { requiredBy: "instamart go-to-items" });
        await callTool("instamart", "your_go_to_items", { addressId }, opts);
      })
  );

  attachOutputOptions(
    im
      .command("addresses")
      .description("List Instamart addresses")
      .action(async () => {
        await callTool("instamart", "get_addresses", {}, readGlobalOpts(im));
      })
  );

  attachOutputOptions(
    im
      .command("create-address")
      .description("Create a delivery address")
      .option("--input <json>", "address payload JSON", "{}")
      .action(async (o: { input?: string }) => {
        await callTool("instamart", "create_address", parseJsonInput(o.input || "{}"), readGlobalOpts(im));
      })
  );

  attachOutputOptions(
    im
      .command("delete-address <id>")
      .description("Delete an Instamart address (destructive)")
      .action(async (id: string) => {
        await callTool("instamart", "delete_address", { address_id: id }, readGlobalOpts(im));
      })
  );

  attachOutputOptions(
    im
      .command("cart")
      .description("Show current Instamart cart")
      .action(async () => {
        await callTool("instamart", "get_cart", {}, readGlobalOpts(im));
      })
  );

  attachOutputOptions(
    im
      .command("add-to-cart")
      .description("Update Instamart cart")
      .option("--product-id <id>", "product id")
      .option("--quantity <n>", "quantity", "1")
      .option("--input <json>", "raw arguments JSON")
      .action(async (o: { productId?: string; quantity?: string; input?: string }) => {
        if (!o.input && !o.productId) {
          throw new UsageError("Missing required option --product-id.", "Provide --product-id or pass --input <json>");
        }
        if (!o.input && o.quantity && Number(o.quantity) <= 0) {
          throw new UsageError("Invalid --quantity. It must be a positive number.");
        }
        const args = o.input
          ? parseJsonInput(o.input)
          : strip({ product_id: o.productId, quantity: o.quantity ? Number(o.quantity) : undefined });
        await callTool("instamart", "update_cart", args, readGlobalOpts(im));
      })
  );

  attachOutputOptions(
    im
      .command("clear-cart")
      .description("Empty the Instamart cart (destructive)")
      .action(async () => {
        await callTool("instamart", "clear_cart", {}, readGlobalOpts(im));
      })
  );

  attachOutputOptions(
    im
      .command("checkout")
      .description("Place Instamart order — COD only (destructive)")
      .option("--address-id <id>", "delivery address id")
      .option("--input <json>", "raw arguments JSON")
      .action(async (o: { addressId?: string; input?: string }) => {
        const opts = readGlobalOpts(im);
        const addressId = o.input
          ? undefined
          : await ensureAddressId("instamart", opts, o.addressId, { requiredBy: "instamart checkout" });
        const args = o.input ? parseJsonInput(o.input) : strip({ addressId });
        await callTool("instamart", "checkout", args, opts);
      })
  );

  attachOutputOptions(
    im
      .command("orders")
      .description("List Instamart orders")
      .action(async () => {
        await callTool("instamart", "get_orders", {}, readGlobalOpts(im));
      })
  );

  attachOutputOptions(
    im
      .command("order <id>")
      .description("Show details of an Instamart order")
      .action(async (id: string) => {
        await callTool("instamart", "get_order_details", { order_id: id }, readGlobalOpts(im));
      })
  );

  attachOutputOptions(
    im
      .command("track <id>")
      .description("Track an Instamart order")
      .action(async (id: string) => {
        await callTool("instamart", "track_order", { order_id: id }, readGlobalOpts(im));
      })
  );
}

function strip<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") out[k] = v;
  return out as Partial<T>;
}
