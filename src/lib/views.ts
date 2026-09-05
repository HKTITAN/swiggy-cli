import type { OutputOptions, ServerName } from "../types/index.js";
import { loadTable } from "./lazy.js";
import { PALETTE, paint, renderMarkdown, link } from "./ui.js";
import { shouldUseColor } from "./tty.js";

/**
 * Native views: one renderer per Swiggy response shape, built from the output schemas at
 * https://mcp.swiggy.com/builders/docs/reference/. Each returns the text to print (or undefined to
 * fall back to the generic table). Rows are numbered so the next command can refer to them.
 */

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);
const s = (v: unknown): string => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
const money = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "";
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? `₹${n % 1 === 0 ? n : n.toFixed(2)}` : String(v);
};
const yes = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "true" || v === "VEG";

export interface ViewCtx extends OutputOptions {
  server?: string;
  tool?: string;
  message?: string;
}

/** Friendly progress labels — humans see "Searching restaurants", never "tools/call search_restaurants". */
export const TOOL_LABELS: Record<string, string> = {
  search_restaurants: "Searching restaurants",
  search_menu: "Searching dishes",
  get_restaurant_menu: "Loading the menu",
  get_addresses: "Loading your addresses",
  create_address: "Saving the address",
  delete_address: "Deleting the address",
  get_food_cart: "Loading your cart",
  update_food_cart: "Updating your cart",
  flush_food_cart: "Clearing your cart",
  fetch_food_coupons: "Finding coupons",
  apply_food_coupon: "Applying the coupon",
  place_food_order: "Placing your order",
  get_food_orders: "Loading your orders",
  get_food_order_details: "Loading the order",
  track_food_order: "Tracking your order",
  get_food_delivery_status: "Checking delivery",
  get_payment_options: "Loading payment methods",
  check_payment_status: "Checking the payment",
  confirm_order: "Confirming the order",
  report_error: "Sending the report",
  search_products: "Searching products",
  your_go_to_items: "Loading your usual items",
  get_cart: "Loading your cart",
  update_cart: "Updating your cart",
  clear_cart: "Clearing your cart",
  list_coupons: "Finding coupons",
  apply_coupon: "Applying the coupon",
  checkout: "Placing your order",
  get_orders: "Loading your orders",
  get_order_details: "Loading the order",
  track_order: "Tracking your order",
  get_delivery_status: "Checking delivery",
  get_restaurant_details: "Loading the restaurant",
  get_saved_locations: "Loading your locations",
  search_restaurants_dineout: "Searching restaurants",
  get_available_slots: "Checking availability",
  create_cart: "Preparing the booking",
  book_table: "Booking your table",
  get_booking_status: "Loading the booking",
  cancel_booking: "Cancelling the booking",
};

export function labelFor(tool: string): string {
  return TOOL_LABELS[tool] ?? tool.replace(/_/g, " ");
}

function table(head: string[], rows: string[][], ctx: ViewCtx, widths?: number[]): string {
  const Table = loadTable();
  const t = new Table({ head: head.map((h) => paint(PALETTE.orange, h, ctx)), style: { head: [], border: [] }, wordWrap: true, ...(widths ? { colWidths: widths } : {}) });
  for (const r of rows) t.push(r);
  return t.toString();
}

function title(text: string, ctx: ViewCtx, sub?: string): string {
  return `${paint(PALETTE.orange, text, ctx, true)}${sub ? ` ${paint(PALETTE.muted, sub, ctx)}` : ""}`;
}

function hint(text: string, ctx: ViewCtx): string {
  return paint(PALETTE.muted, text, ctx);
}

const dim = (t: string, ctx: ViewCtx) => paint(PALETTE.muted, t, ctx);
const trunc = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/* ---------------------------------- Food ---------------------------------- */

function foodRestaurants(data: Rec, ctx: ViewCtx): string {
  const rows = arr(data.restaurants);
  if (rows.length === 0 && arr(data.dishes).length === 0) return `${title("No restaurants found", ctx, `for "${s(data.query)}"`)}\n${hint("Try a cuisine or a restaurant name, e.g. swiggy food search -q biryani", ctx)}`;
  const out: string[] = [title("Restaurants", ctx, `${rows.length}${data.totalRestaurants ? ` of ${s(data.totalRestaurants)}` : ""} for "${s(data.query)}"`)];
  out.push(
    table(
      ["#", "restaurant", "cuisines", "rating", "for two", "delivery", "status"],
      rows.map((r, i) => [
        String(i + 1),
        `${s(r.name)}${r.veg ? dim(" · veg", ctx) : ""}${r.offer ? `\n${dim(s(r.offer), ctx)}` : ""}`,
        trunc(arr(r.cuisines).length ? "" : (Array.isArray(r.cuisines) ? (r.cuisines as string[]).join(", ") : ""), 34),
        r.avgRating !== undefined ? `${s(r.avgRating)}★${r.totalRatings ? dim(` (${s(r.totalRatings)})`, ctx) : ""}` : "",
        s(r.costForTwo),
        [s(r.deliveryTimeRange || (r.deliveryTimeMinutes ? `${s(r.deliveryTimeMinutes)} min` : "")), r.distanceKm ? `${s(r.distanceKm)} km` : ""].filter(Boolean).join(" · "),
        r.availabilityStatus === "OPEN" ? paint(PALETTE.success, "open", ctx) : r.availabilityStatus ? paint(PALETTE.warn, `${s(r.availabilityStatus).toLowerCase()}${r.nextOpenTime ? ` · ${s(r.nextOpenTime)}` : ""}`, ctx) : "",
      ]),
      ctx
    )
  );
  const dishes = arr(data.dishes);
  if (dishes.length) {
    out.push(title("Dishes", ctx, `${dishes.length}`));
    out.push(table(["dish", "price", "restaurant", "veg"], dishes.slice(0, 15).map((d) => [s(d.name), money(d.price), `${s(d.restaurantName)}${d.restaurantRating ? dim(` ${s(d.restaurantRating)}★`, ctx) : ""}`, yes(d.isVeg) ? "🟢" : ""]), ctx));
  }
  out.push(hint(`next: swiggy food menu <#>   ·   swiggy food search-menu -q "<dish>"${data.hasMore || data.nextOffset ? `   ·   more: --offset ${s(data.nextOffset)}` : ""}`, ctx));
  return out.join("\n");
}

function foodMenu(data: Rec, ctx: ViewCtx): string {
  const rest = isRec(data.restaurant) ? data.restaurant : {};
  const items = arr(data.items);
  const meta = [Array.isArray(rest.cuisines) ? (rest.cuisines as string[]).join(", ") : "", rest.avgRatingString ? `${s(rest.avgRatingString)}★` : rest.avgRating ? `${s(rest.avgRating)}★` : "", s(rest.costForTwoMessage), s(rest.slaString), rest.isOpen === false ? "closed" : ""].filter(Boolean).join(" · ");
  const out: string[] = [title(s(rest.name) || "Menu", ctx, meta)];
  if (rest.address) out.push(dim(s(rest.address), ctx));
  if (items.length === 0) out.push(hint("No items returned.", ctx));
  else {
    let lastCat = "";
    const rows: string[][] = [];
    items.forEach((it, i) => {
      const cat = arr(it.categories).length ? "" : Array.isArray(it.categories) ? String((it.categories as string[])[0] ?? "") : "";
      const catCell = cat && cat !== lastCat ? cat : "";
      lastCat = cat || lastCat;
      rows.push([
        String(i + 1),
        `${yes(it.isVeg) ? "🟢 " : it.isVeg === false ? "🔴 " : ""}${s(it.name)}${it.isBestseller ? dim(" · bestseller", ctx) : ""}${it.hasVariants || it.hasAddons ? dim(` · ${[it.hasVariants ? "variants" : "", it.hasAddons ? "add-ons" : ""].filter(Boolean).join(", ")}`, ctx) : ""}`,
        money(it.price),
        it.rating ? `${s(it.rating)}★` : "",
        it.inStock === 0 || it.inStock === false ? paint(PALETTE.warn, "out of stock", ctx) : "",
        dim(catCell, ctx),
      ]);
    });
    out.push(table(["#", "item", "price", "rating", "", "category"], rows, ctx));
    if (data.truncated) out.push(dim(`showing ${items.length} of ${s(data.totalItems)} items (capped upstream); use swiggy food search-menu -q "<dish>" --restaurant-id ${s(rest.id)}`, ctx));
  }
  out.push(hint(`next: swiggy food add <#> --qty 1`, ctx));
  return out.join("\n");
}

function foodMenuSearch(data: Rec, ctx: ViewCtx): string {
  const items = arr(data.items);
  if (items.length === 0) return `${title("No dishes found", ctx, `for "${s(data.query)}"`)}\n${hint("Try a simpler name, e.g. -q biryani", ctx)}`;
  const out: string[] = [title("Dishes", ctx, `${items.length}${data.totalItems ? ` of ${s(data.totalItems)}` : ""} for "${s(data.query)}"`)];
  out.push(
    table(
      ["#", "dish", "price", "restaurant", "rating", ""],
      items.map((it, i) => [
        String(i + 1),
        `${yes(it.isVeg) ? "🟢 " : it.isVeg === false ? "🔴 " : ""}${s(it.name)}${it.isBestseller ? dim(" · bestseller", ctx) : ""}${it.hasVariants || it.hasAddons ? dim(" · customisable", ctx) : ""}`,
        money(it.price),
        s(it.restaurant_name),
        it.rating ? `${s(it.rating)}★${it.totalRatings ? dim(` (${s(it.totalRatings)})`, ctx) : ""}` : "",
        it.inStock === 0 ? paint(PALETTE.warn, "out of stock", ctx) : "",
      ]),
      ctx
    )
  );
  out.push(hint(`next: swiggy food add <#> --qty 1${data.hasMore ? `   ·   more: --offset ${s(data.nextOffset)}` : ""}`, ctx));
  return out.join("\n");
}

function foodCart(data: Rec, ctx: ViewCtx): string {
  const inner = isRec(data.data) ? data.data : data;
  const rest = isRec(inner.restaurant) ? inner.restaurant : {};
  const items = arr(inner.items);
  const pricing = isRec(inner.pricing) ? inner.pricing : {};
  const offers = isRec(inner.offers) ? inner.offers : {};
  const out: string[] = [title("Your cart", ctx, rest.name ? `${s(rest.name)}${rest.area ? ` · ${s(rest.area)}` : ""}` : "")];
  if (items.length === 0) {
    out.push(hint("Cart is empty. Add something: swiggy food search-menu -q \"<dish>\" then swiggy food add <#>", ctx));
    return out.join("\n");
  }
  out.push(
    table(
      ["#", "item", "qty", "each", "total", ""],
      items.map((it, i) => [
        String(i + 1),
        `${yes(it.is_veg) ? "🟢 " : ""}${s(it.name)}${arr(it.variants).length ? dim(`\n  ${arr(it.variants).map((v) => s(v.name)).filter(Boolean).join(", ")}`, ctx) : ""}${arr(it.addons).length ? dim(`\n  + ${arr(it.addons).map((a) => s(a.name)).filter(Boolean).join(", ")}`, ctx) : ""}`,
        s(it.quantity),
        money(it.final_price ?? it.subtotal),
        money(it.total),
        it.in_stock === false ? paint(PALETTE.warn, "out of stock", ctx) : "",
      ]),
      ctx
    )
  );
  const bill: string[][] = [];
  if (pricing.item_total !== undefined) bill.push(["Items", money(pricing.item_total)]);
  if (pricing.delivery_charge !== undefined) bill.push(["Delivery", `${money(pricing.delivery_charge)}${pricing.delivery_charge_strikeoff ? dim(` (was ${money(pricing.delivery_charge_strikeoff)})`, ctx) : ""}`]);
  if (pricing.taxes_and_charges !== undefined) bill.push(["Taxes & charges", money(pricing.taxes_and_charges)]);
  const discount = Number(offers.coupon_discount ?? 0);
  if (offers.coupon_applied && discount > 0) bill.push([`Coupon ${s(offers.coupon_applied)}`, `-${money(discount)}`]);
  else if (offers.coupon_applied) bill.push([`Coupon ${s(offers.coupon_applied)}`, dim("suggested · not applied", ctx)]);
  if (offers.free_delivery_applied) bill.push(["Free delivery", "applied"]);
  if (pricing.to_pay !== undefined) bill.push([paint(PALETTE.orange, "To pay", ctx, true), paint(PALETTE.orange, money(pricing.to_pay), ctx, true)]);
  if (bill.length) out.push(table(["", ""], bill, ctx, [30, 34]));
  const methods = Array.isArray(data.availablePaymentMethods) ? (data.availablePaymentMethods as unknown[]).map(s) : [];
  if (methods.length) out.push(dim(`payment: ${methods.join(", ")}`, ctx));
  out.push(hint(`next: swiggy food checkout --pay cash | --pay upi --wait   ·   coupons: swiggy food list-coupons --restaurant-id ${s(rest.id)}`, ctx));
  return out.join("\n");
}

function foodCoupons(data: Rec, ctx: ViewCtx): string {
  const sections = arr(data.coupon_sections);
  const summary = isRec(data.summary) ? data.summary : {};
  const out: string[] = [title("Coupons", ctx, `${s(summary.applicable_coupons ?? "")}${summary.total_coupons !== undefined ? ` applicable of ${s(summary.total_coupons)}` : ""}`)];
  const rows: string[][] = [];
  for (const sec of sections) for (const c of arr(sec.coupons)) {
    const status = c.applicabilityStatus === "APPLIED" ? paint(PALETTE.success, "applied", ctx) : c.applicable || c.applicabilityStatus === "APPLICABLE" ? paint(PALETTE.success, "applicable", ctx) : dim("n/a", ctx);
    rows.push([s(c.title), s(c.subtitle || c.description), status, dim(s(sec.title), ctx)]);
  }
  if (rows.length === 0) out.push(hint(s(data.status_message) || "No coupons for this cart.", ctx));
  else out.push(table(["code", "offer", "", "section"], rows, ctx));
  out.push(hint("apply: swiggy food apply-coupon <CODE>", ctx));
  return out.join("\n");
}

function foodOrders(data: Rec, ctx: ViewCtx): string {
  const orders = arr(data.orders);
  if (orders.length === 0) return `${title("Orders", ctx)}\n${hint(s(data.statusMessage) || "No orders yet.", ctx)}`;
  const out: string[] = [title("Your food orders", ctx, `${orders.length}`)];
  out.push(
    table(
      ["#", "restaurant", "items", "total", "status", "when"],
      orders.map((o, i) => [
        String(i + 1),
        `${s(o.restaurantName)}${o.restaurantAreaName ? dim(` · ${s(o.restaurantAreaName)}`, ctx) : ""}`,
        trunc(s(o.orderedItems), 40),
        money(o.orderTotal),
        o.isActiveOrder ? paint(PALETTE.success, s(o.orderDeliveryStatus || o.orderStatus), ctx) : s(o.orderStatus),
        s(o.orderedTime),
      ]),
      ctx
    )
  );
  out.push(hint("next: swiggy food order <#>   ·   swiggy food track <#>", ctx));
  return out.join("\n");
}

function foodOrderDetail(data: Rec, ctx: ViewCtx): string {
  const o = isRec(data.order) ? data.order : data;
  const addr = isRec(o.delivery_address) ? o.delivery_address : {};
  const out: string[] = [title(`Order ${s(o.order_id)}`, ctx, `${s(o.restaurant_name)} · ${s(o.order_status)}`)];
  const items = arr(o.order_items);
  if (items.length) out.push(table(["item", "qty", "total"], items.map((it) => [`${yes(it.is_veg) ? "🟢 " : ""}${s(it.name)}${arr(it.variants).length ? dim(` (${arr(it.variants).map((v) => s(v.name)).join(", ")})`, ctx) : ""}`, s(it.quantity), money(it.total)]), ctx));
  const bill: string[][] = [["Items", money(o.item_total)]];
  if (o.order_delivery_charge !== undefined) bill.push(["Delivery", money(o.order_delivery_charge)]);
  if (o.order_tax !== undefined) bill.push(["Taxes", money(o.order_tax)]);
  if (Number(o.coupon_discount ?? 0) > 0) bill.push([`Coupon ${s(o.coupon_applied)}`, `-${money(o.coupon_discount)}`]);
  bill.push([paint(PALETTE.orange, "Total", ctx, true), paint(PALETTE.orange, money(o.order_total), ctx, true)]);
  bill.push(["Paid by", s(o.payment_method)]);
  bill.push(["Ordered", s(o.order_time)]);
  bill.push(["Deliver to", `${s(addr.name)} · ${s(addr.address)}`]);
  out.push(table(["", ""], bill, ctx, [16, 80]));
  if (o.is_cancellable === false) out.push(dim("Cancellation is not available through the API. Swiggy customer care: 080-67466729", ctx));
  return out.join("\n");
}

function foodTrack(data: Rec, ctx: ViewCtx): string {
  const orders = arr(data.orders);
  if (orders.length === 0) return `${title("Tracking", ctx)}\n${hint(s(data.statusMessage) || "No active orders.", ctx)}`;
  const out: string[] = [title("Active orders", ctx, `${orders.length}`)];
  out.push(table(["#", "order", "status", "eta", "progress"], orders.map((o, i) => [String(i + 1), `${s(o.title)}${o.subtitle ? dim(`\n${s(o.subtitle)}`, ctx) : ""}`, paint(PALETTE.success, s(o.orderStatus), ctx), s(o.etaText), o.progressPercentage ? bar(Number(o.progressPercentage), ctx) : ""]), ctx));
  out.push(hint("refresh: swiggy food track <#>   (no faster than every 10 s)", ctx));
  return out.join("\n");
}

function deliveryStatus(data: Rec, ctx: ViewCtx): string {
  const state = data.delivered ? paint(PALETTE.success, "delivered", ctx) : data.cancelled ? paint(PALETTE.error, "cancelled", ctx) : paint(PALETTE.warn, "on the way", ctx);
  const eta = data.etaText ? s(data.etaText) : data.deliveryBy && data.serverNow ? `${Math.max(0, Math.round((Number(data.deliveryBy) - Number(data.serverNow)) / 60000))} min` : "";
  return [title(`Order ${s(data.orderId)}`, ctx, state), data.statusText ? s(data.statusText) : "", eta ? `ETA ${eta}` : "", hint(`poll every ${s(data.pollIntervalSec)} s`, ctx)].filter(Boolean).join("\n");
}

function bar(pct: number, ctx: ViewCtx): string {
  const n = Math.max(0, Math.min(10, Math.round(pct / 10)));
  return `${paint(PALETTE.orange, "█".repeat(n), ctx)}${dim("░".repeat(10 - n), ctx)} ${pct}%`;
}

/* -------------------------------- Instamart -------------------------------- */

function products(data: Rec, ctx: ViewCtx, heading = "Products"): string {
  const list = arr(data.products).length ? arr(data.products) : arr(data.items);
  if (list.length === 0) return `${title(`No ${heading.toLowerCase()} found`, ctx)}\n${hint("Try a brand or category name.", ctx)}`;
  const rows: string[][] = [];
  let n = 0;
  for (const p of list) {
    const variations = arr(p.variations);
    if (variations.length === 0) {
      n += 1;
      rows.push([String(n), `${s(p.displayName ?? p.itemName ?? p.name)}${p.brand ? dim(` · ${s(p.brand)}`, ctx) : ""}`, s(p.itemVariant ?? p.quantityDescription), money(p.discountedFinalPrice ?? p.price), p.isInStockAndAvailable === false || p.inStock === false ? paint(PALETTE.warn, "out of stock", ctx) : ""]);
      continue;
    }
    variations.forEach((v, vi) => {
      n += 1;
      const price = isRec(v.price) ? v.price : {};
      const mrp = Number(price.mrp), offer = Number(price.offerPrice);
      rows.push([
        String(n),
        vi === 0 ? `${s(p.displayName)}${p.brand ? dim(` · ${s(p.brand)}`, ctx) : ""}` : dim("〃", ctx),
        s(v.quantityDescription),
        `${money(offer || mrp)}${offer && mrp && offer < mrp ? dim(` (mrp ${money(mrp)})`, ctx) : ""}`,
        v.isInStockAndAvailable === false ? paint(PALETTE.warn, "out of stock", ctx) : isRec(v.sla) ? dim(`${s(v.sla.value)} ${s(v.sla.unit)}`, ctx) : "",
      ]);
    });
  }
  const out = [title(heading, ctx, `${n}${data.query ? ` for "${s(data.query)}"` : ""}`), table(["#", "product", "pack", "price", ""], rows, ctx)];
  const similar = arr(data.similarProducts);
  if (similar.length) out.push(dim(`+ ${similar.length} similar items (see --json)`, ctx));
  out.push(hint(`next: swiggy instamart add <#> --qty 1${data.nextOffset ? `   ·   more: --offset ${s(data.nextOffset)}` : ""}`, ctx));
  return out.join("\n");
}

function imCart(data: Rec, ctx: ViewCtx): string {
  const items = arr(data.items);
  const addr = isRec(data.selectedAddressDetails) ? data.selectedAddressDetails : {};
  const out: string[] = [title("Your Instamart cart", ctx, addr.address ? `deliver to ${s(addr.name || addr.annotation)} · ${s(addr.address)}` : "")];
  if (data.cartAbsent || items.length === 0) {
    out.push(hint(s(data.cartAbsentReason) || "Cart is empty. Add something: swiggy instamart search -q milk then swiggy instamart add <#>", ctx));
    return out.join("\n");
  }
  out.push(table(["#", "item", "qty", "each", "total", ""], items.map((it, i) => [String(i + 1), `${s(it.itemName)}${it.itemVariant ? dim(` · ${s(it.itemVariant)}`, ctx) : ""}`, s(it.quantity), money(it.discountedFinalPrice), money(Number(it.discountedFinalPrice ?? 0) * Number(it.quantity ?? 1)), it.isInStockAndAvailable === false ? paint(PALETTE.warn, "out of stock", ctx) : it.maxQuantityMessage ? dim(s(it.maxQuantityMessage), ctx) : ""]), ctx));
  const bill = isRec(data.billBreakdown) ? data.billBreakdown : {};
  const rows = arr(bill.lineItems).map((l) => [s(l.label), s(l.value)]);
  if (isRec(bill.toPay)) rows.push([paint(PALETTE.orange, s(bill.toPay.label) || "To pay", ctx, true), paint(PALETTE.orange, s(bill.toPay.value), ctx, true)]);
  else if (data.cartTotalAmount) rows.push([paint(PALETTE.orange, "To pay", ctx, true), paint(PALETTE.orange, s(data.cartTotalAmount), ctx, true)]);
  if (rows.length) out.push(table(["", ""], rows, ctx, [30, 34]));
  const unserviceable = arr(data.unserviceableItems);
  if (unserviceable.length) out.push(paint(PALETTE.warn, `unserviceable: ${unserviceable.map((u) => s(u.itemName)).join(", ")}`, ctx));
  if (isRec(data.cartWarning)) out.push(paint(PALETTE.warn, s(data.cartWarning.message), ctx));
  if (data.addressWarning) out.push(paint(PALETTE.warn, s(data.addressWarning), ctx));
  const methods = Array.isArray(data.availablePaymentMethods) ? (data.availablePaymentMethods as unknown[]).map(s) : [];
  if (methods.length) out.push(dim(`payment: ${methods.join(", ")}`, ctx));
  out.push(hint("next: swiggy instamart checkout --pay cash | --pay upi --wait", ctx));
  return out.join("\n");
}

function imOrders(data: Rec, ctx: ViewCtx): string {
  const orders = arr(data.orders);
  if (orders.length === 0) return `${title("Orders", ctx)}\n${hint("No orders yet.", ctx)}`;
  const out = [title("Your Instamart orders", ctx, `${orders.length}`)];
  out.push(table(["#", "store", "items", "total", "status", "when"], orders.map((o, i) => [String(i + 1), s(o.storeName), `${s(o.itemCount)} · ${trunc(arr(o.items).map((it) => s(it.name)).join(", "), 36)}`, money(o.totalAmount), o.isActive ? paint(PALETTE.success, s(o.statusMessage || o.currentStatus), ctx) : s(o.status), s(o.createdAt)]), ctx));
  out.push(hint("next: swiggy instamart order <#>   ·   swiggy instamart track <#> --lat <lat> --lng <lng>", ctx));
  return out.join("\n");
}

function imOrderDetail(data: Rec, ctx: ViewCtx): string {
  const out = [title(`Order ${s(data.orderId)}`, ctx, s(data.status))];
  const items = arr(data.items);
  if (items.length) out.push(table(["item", "qty", "price", ""], items.map((it) => [s(it.name), s(it.quantity), money(it.finalPrice), it.removed ? paint(PALETTE.warn, "removed", ctx) : ""]), ctx));
  const bill = isRec(data.bill) ? data.bill : {};
  const rows = arr(bill.lineItems).map((l) => [s(l.name), s(l.amount)]);
  rows.push([paint(PALETTE.orange, "Total", ctx, true), paint(PALETTE.orange, s(bill.grandTotal || money(data.totalBill)), ctx, true)]);
  out.push(table(["", ""], rows, ctx, [28, 24]));
  if (data.hasRefunds) out.push(dim("This order has refunds.", ctx));
  return out.join("\n");
}

function imTrack(data: Rec, ctx: ViewCtx): string {
  const status = isRec(data.status) ? data.status : {};
  const store = isRec(data.storeInfo) ? data.storeInfo : {};
  const delivery = isRec(data.deliveryInfo) ? data.deliveryInfo : {};
  const out = [title(s(data.orderTitle) || `Order ${s(data.orderId)}`, ctx, s(data.orderSubtitle))];
  out.push(`${paint(PALETTE.success, s(status.statusMessage), ctx, true)}${status.subStatusMessage ? ` ${dim(s(status.subStatusMessage), ctx)}` : ""}${status.etaText || status.etaMinutes ? `  ·  ETA ${s(status.etaText || `${s(status.etaMinutes)} min`)}` : ""}`);
  if (store.name) out.push(dim(`from ${s(store.name)}`, ctx));
  if (delivery.fullAddress) out.push(dim(`to ${s(delivery.addressLabel ? `${s(delivery.addressLabel)} · ` : "")}${s(delivery.fullAddress)}`, ctx));
  const items = arr(data.items);
  if (items.length) out.push(table(["item", "qty", "price"], items.map((it) => [s(it.name), s(it.quantity), s(it.price)]), ctx));
  if (isRec(data.paymentInfo)) out.push(dim(s(data.paymentInfo.message), ctx));
  out.push(hint(`refresh in ${s(data.pollingIntervalSeconds) || "10"} s: swiggy instamart track ${s(data.orderId)}`, ctx));
  return out.join("\n");
}

/* --------------------------------- Dineout --------------------------------- */

function dineoutRestaurants(data: Rec, ctx: ViewCtx): string {
  const rows = arr(data.restaurants);
  if (rows.length === 0) return `${title("No restaurants matched", ctx)}\n${hint("Try one term: a cuisine, an area, 'rooftop', 'pub'…", ctx)}`;
  const out = [title("Restaurants to book", ctx, `${rows.length}${data.total ? ` of ${s(data.total)}` : ""}`)];
  out.push(
    table(
      ["#", "restaurant", "cuisine", "rating", "for two", "distance", "deals"],
      rows.map((r, i) => {
        const rating = isRec(r.rating) ? r.rating : {};
        const deals = arr(r.availableDeals).map((d) => s(d.dealTitle)).filter(Boolean);
        const offers = arr(r.offers).map((o) => s(o.offerTitle)).filter(Boolean);
        return [String(i + 1), `${s(r.name)}${r.locality || r.area ? dim(`\n${s(r.locality || r.area)}`, ctx) : ""}`, trunc(Array.isArray(r.cuisine) ? (r.cuisine as string[]).join(", ") : s(r.cuisine), 30), rating.value ? `${s(rating.value)}★${rating.count ? dim(` (${s(rating.count)})`, ctx) : ""}` : "", s(r.costForTwo), s(r.distance), trunc([...deals, ...offers].join(" · "), 40)];
      }),
      ctx
    )
  );
  out.push(hint(`next: swiggy dineout slots <#> --date YYYY-MM-DD   ·   swiggy dineout details <#>${data.nextOffset ? `   ·   more: --offset ${s(data.nextOffset)}` : ""}`, ctx));
  return out.join("\n");
}

function dineoutDetails(data: Rec, ctx: ViewCtx): string {
  const inner = isRec(data.data) ? data.data : data;
  const r = isRec(inner.restaurant) ? inner.restaurant : {};
  const out = [title(s(r.name) || "Restaurant", ctx, [Array.isArray(r.cuisines) ? (r.cuisines as string[]).join(", ") : "", r.avgRating ? `${s(r.avgRating)}★${r.totalRatings ? ` (${s(r.totalRatings)})` : ""}` : "", s(r.costForTwo), s(r.distance)].filter(Boolean).join(" · "))];
  if (r.address) out.push(dim(s(r.address), ctx));
  if (r.timings) out.push(dim(`hours: ${s(r.timings)}`, ctx));
  if (r.description) out.push(s(r.description));
  const deals = arr(r.deals);
  if (deals.length) {
    out.push(title("Deals", ctx));
    out.push(table(["deal", "discount", "cover", "when", ""], deals.map((d) => [`${s(d.title)}${d.description ? dim(`\n${trunc(s(d.description), 60)}`, ctx) : ""}`, d.discountPercentage ? `${s(d.discountPercentage)}%` : "", d.coverCharge ? money(d.coverCharge) : "free", s(d.slotGroupName), dim(s(d.offerCategory), ctx)]), ctx));
  }
  const amenities = Array.isArray(inner.amenities) ? (inner.amenities as unknown[]).map(s) : [];
  if (amenities.length) out.push(dim(`amenities: ${amenities.join(", ")}`, ctx));
  if (inner.locationMapUrl) out.push(dim(`map: ${link(s(inner.locationMapUrl), undefined, ctx)}`, ctx));
  out.push(hint(`next: swiggy dineout slots ${s(r.restaurantId || r.id)} --date YYYY-MM-DD`, ctx));
  return out.join("\n");
}

function dineoutSlots(data: Rec, ctx: ViewCtx): string {
  const slots = arr(data.slots);
  const out = [title(s(data.restaurantName) || "Available slots", ctx, `from ${s(data.date)}${data.guestCount ? ` · ${s(data.guestCount)} guests` : ""}`)];
  if (slots.length === 0) {
    out.push(hint("No slots in this window. Try another date.", ctx));
    return out.join("\n");
  }
  const rows: string[][] = [];
  let n = 0;
  let lastDate = "";
  for (const sl of slots) {
    const deals = arr(sl.deals);
    const date = s(sl.dateStr);
    const dateCell = date !== lastDate ? date : "";
    lastDate = date;
    if (deals.length === 0) {
      n += 1;
      rows.push([String(n), dateCell, s(sl.displayTime), s(sl.slotGroupName), sl.isFree === false ? money(sl.price) : "free", s(sl.availableInventory)]);
      continue;
    }
    deals.forEach((d, di) => {
      n += 1;
      rows.push([String(n), di === 0 ? dateCell : "", di === 0 ? s(sl.displayTime) : dim("〃", ctx), `${s(sl.slotGroupName)}${d.title ? dim(` · ${s(d.title)}`, ctx) : ""}`, d.isFree === false ? `${money(d.bookingPrice ?? d.coverCharge)}${d.discountPercentage ? dim(` · ${s(d.discountPercentage)}% off`, ctx) : ""}` : paint(PALETTE.success, "free", ctx), s(d.availableInventory ?? sl.availableInventory)]);
    });
  }
  out.push(table(["#", "date", "time", "slot · deal", "price", "left"], rows, ctx));
  out.push(hint("next: swiggy dineout book <#> --guests 2   (paid deals: the CLI creates the cart and takes UPI with --pay upi --wait)", ctx));
  return out.join("\n");
}

function booking(data: Rec, ctx: ViewCtx): string {
  const rows: string[][] = [];
  if (data.restaurantName) rows.push(["Restaurant", `${s(data.restaurantName)}${data.restaurantLocation ? dim(` · ${s(data.restaurantLocation)}`, ctx) : ""}`]);
  if (data.reservationDate || data.reservationTime) rows.push(["When", `${s(data.reservationDate)} ${s(data.reservationTime)}`.trim()]);
  if (data.guestCount) rows.push(["Guests", s(data.guestCount)]);
  if (data.dealTitle) rows.push(["Deal", s(data.dealTitle)]);
  rows.push(["Status", data.status === "PENDING_PAYMENT" ? paint(PALETTE.warn, "payment pending", ctx) : paint(PALETTE.success, s(data.status), ctx)]);
  rows.push(["Booking id", s(data.orderId)]);
  if (data.canCancel !== undefined) rows.push(["Cancellable", data.canCancel ? "yes — swiggy dineout cancel " + s(data.orderId) : "no"]);
  return [title(data.status === "CANCELLED" ? "Booking cancelled" : "Your booking", ctx), table(["", ""], rows, ctx, [14, 70])].join("\n");
}

/* --------------------------------- shared ---------------------------------- */

function addresses(data: Rec, ctx: ViewCtx, kind: "addresses" | "locations"): string {
  const rows = arr(data[kind]);
  if (rows.length === 0) return `${title(kind === "addresses" ? "Saved addresses" : "Saved locations", ctx)}\n${hint(kind === "addresses" ? "No saved addresses. Create one: swiggy food create-address --help" : "No saved locations.", ctx)}`;
  const out = [title(kind === "addresses" ? "Saved addresses" : "Saved locations", ctx, `${rows.length}`)];
  out.push(table(["#", "label", "address", "phone", "id"], rows.map((a, i) => [String(i + 1), `${s(a.addressTag || a.addressCategory)}`, s(a.addressLine), s(a.phoneNumber), dim(s(a.id), ctx)]), ctx));
  const pg = isRec(data.pagination) ? data.pagination : {};
  if (pg.hasMore) out.push(dim(`more: --page ${Number(pg.page ?? 1) + 1}`, ctx));
  out.push(hint(kind === "addresses" ? "set a default: swiggy profile set default defaultAddressId <id>" : "search near one: swiggy dineout search -q <term> --address-id <id>", ctx));
  return out.join("\n");
}

function placedOrder(data: Rec, ctx: ViewCtx, server: ServerName): string {
  if (data.status === "PENDING_PAYMENT") {
    const rows: string[][] = [["Status", paint(PALETTE.warn, "waiting for payment", ctx, true)], ["Order id", s(data.orderId)], ["Payment id", s(data.paasId)]];
    if (data.totalAmount ?? data.cartTotal) rows.push(["Amount", money(data.totalAmount ?? data.cartTotal)]);
    if (data.bridgeUrl) rows.push(["Pay here", link(s(data.bridgeUrl), undefined, ctx)]);
    return [title("Order created — not placed yet", ctx), table(["", ""], rows, ctx, [12, 90])].join("\n");
  }
  if (Array.isArray(data.orders)) {
    const rows = arr(data.orders).map((o) => [s(o.orderId), o.error ? paint(PALETTE.error, s(o.error), ctx) : paint(PALETTE.success, s(o.status), ctx)]);
    return [title(data.allSucceeded ? "Orders placed" : "Orders partially placed", ctx, `${s(data.successCount)}/${s(data.orderCount)} · ${s(data.paymentMethod)}`), table(["order", "status"], rows, ctx)].join("\n");
  }
  const rows: string[][] = [["Status", paint(PALETTE.success, s(data.status), ctx, true)], ["Order id", s(data.orderId)]];
  const total = data.totalAmount ?? data.cartTotal;
  if (total !== undefined && total !== null) rows.push(["Total", money(total)]);
  if (data.paymentMethod) rows.push(["Paid by", s(data.paymentMethod)]);
  if (data.restaurantName) rows.push(["From", `${s(data.restaurantName)}${data.restaurantAddress ? dim(` · ${s(data.restaurantAddress)}`, ctx) : ""}`]);
  if (data.deliveryAddress) rows.push(["Deliver to", `${data.deliveryLabel ? `${s(data.deliveryLabel)} · ` : ""}${s(data.deliveryAddress)}`]);
  if (data.estimatedDelivery) rows.push(["ETA", s(data.estimatedDelivery)]);
  const items = arr(data.items);
  const trackCmd = server === "food" ? `swiggy food track ${s(data.orderId)}` : server === "instamart" ? `swiggy instamart track ${s(data.orderId)} --lat <lat> --lng <lng>` : `swiggy dineout status ${s(data.orderId)}`;
  return [title("Order placed", ctx), table(["", ""], rows, ctx, [12, 90]), items.length ? table(["item", "qty", "total"], items.map((it) => [s(it.name), s(it.quantity), money(it.total ?? it.final_price)]), ctx) : "", hint(`track: ${trackCmd}`, ctx)].filter(Boolean).join("\n");
}

function paymentOptions(data: Rec, ctx: ViewCtx, server: ServerName): string {
  const all = arr(data.allMethods);
  const placeCmd = server === "food" ? "food checkout" : server === "instamart" ? "instamart checkout" : "dineout book …";
  const out = [title("Payment methods", ctx, data.paymentAmount ? `for ${s(data.paymentAmount)}` : "")];
  const rows: string[][] = all.map((m) => {
    const id = s(m.id);
    const kind = m.kind === "qr" ? "scan QR" : m.kind === "intent" ? "UPI app" : s(m.groupName);
    const flag = m.kind === "qr" ? "--pay upi" : m.kind === "intent" ? `--pay upi:${id}` : /cash|cod/i.test(id) ? "--pay cash" : `--pay ${s(m.groupName || id)}`;
    return [s(m.displayName || m.groupName || id), dim(kind, ctx), m.enabled === false ? dim("disabled", ctx) : "", dim(`swiggy ${placeCmd} ${flag}`, ctx)];
  });
  const cod = isRec(data.cod) ? data.cod : undefined;
  if (cod?.available && !all.some((m) => /cash|cod/i.test(s(m.id)))) rows.push([s(cod.displayName) || "Cash on delivery", "", "", dim(`swiggy ${placeCmd} --pay cash`, ctx)]);
  if (rows.length === 0) out.push(hint("No payment methods returned for this cart.", ctx));
  else out.push(table(["method", "type", "", "use"], rows, ctx));
  return out.join("\n");
}

function paymentStatus(data: Rec, ctx: ViewCtx): string {
  const cls = data.isTerminalSuccess ? paint(PALETTE.success, "paid", ctx, true) : data.isTerminalFailure ? paint(PALETTE.error, s(data.status), ctx, true) : paint(PALETTE.warn, s(data.status) || "pending", ctx, true);
  const rows: string[][] = [["Payment", cls], ["Transaction", s(data.paasId)]];
  if (data.orderId) rows.push(["Order", s(data.orderId)]);
  if (data.confirmed !== undefined) rows.push(["Order confirmed", data.confirmed ? "yes" : "not yet"]);
  if (data.cartTotal !== undefined) rows.push(["Amount", money(data.cartTotal)]);
  return [title("Payment status", ctx), table(["", ""], rows, ctx, [18, 60])].join("\n");
}

function reportError(data: Rec, ctx: ViewCtx): string {
  const summary = isRec(data.summary) ? data.summary : {};
  return [title("Error report ready", ctx), s(summary.subject), data.mailto ? `send: ${link(s(data.mailto), "open mail draft", ctx)}` : "", dim(trunc(s(summary.body), 400), ctx)].filter(Boolean).join("\n");
}

function simpleStatus(data: Rec, ctx: ViewCtx, okText: string): string {
  const msg = s(data.statusMessage || data.message);
  const ok = data.success !== false && data.verified !== false;
  return `${ok ? paint(PALETTE.success, "✓", ctx) : paint(PALETTE.error, "✖", ctx)} ${okText}${msg ? dim(` · ${msg}`, ctx) : ""}`;
}

/** Pick the native view for a (server, tool). Returns undefined when no specialised view exists. */
export function viewFor(server: ServerName, tool: string): ((data: unknown, ctx: ViewCtx) => string | undefined) | undefined {
  const wrap = (fn: (d: Rec, c: ViewCtx) => string) => (data: unknown, ctx: ViewCtx) => (isRec(data) ? fn(data, ctx) : undefined);
  switch (tool) {
    case "search_restaurants":
      return wrap(foodRestaurants);
    case "get_restaurant_menu":
      return wrap(foodMenu);
    case "search_menu":
      return wrap(foodMenuSearch);
    case "get_food_cart":
    case "update_food_cart":
      return wrap(foodCart);
    case "apply_food_coupon":
      return wrap((d, c) => (isRec(d.data) ? foodCart(d, c) : simpleStatus(d, c, "Coupon request sent")));
    case "fetch_food_coupons":
      return wrap(foodCoupons);
    case "get_food_orders":
      return wrap(foodOrders);
    case "get_food_order_details":
      return wrap(foodOrderDetail);
    case "track_food_order":
      return wrap(foodTrack);
    case "get_food_delivery_status":
    case "get_delivery_status":
      return wrap(deliveryStatus);
    case "search_products":
      return wrap((d, c) => products(d, c, "Products"));
    case "your_go_to_items":
      return wrap((d, c) => products(d, c, "Your usual items"));
    case "get_cart":
    case "update_cart":
    case "apply_coupon":
      return wrap(imCart);
    case "get_orders":
      return wrap(imOrders);
    case "get_order_details":
      return wrap(imOrderDetail);
    case "track_order":
      return wrap(imTrack);
    case "search_restaurants_dineout":
      return wrap(dineoutRestaurants);
    case "get_restaurant_details":
      return wrap(dineoutDetails);
    case "get_available_slots":
      return wrap(dineoutSlots);
    case "book_table":
      return wrap((d, c) => (d.status === "PENDING_PAYMENT" ? placedOrder(d, c, "dineout") : booking(d, c)));
    case "get_booking_status":
    case "cancel_booking":
      return wrap(booking);
    case "get_addresses":
      return wrap((d, c) => addresses(d, c, "addresses"));
    case "get_saved_locations":
      return wrap((d, c) => addresses(d, c, "locations"));
    case "place_food_order":
    case "checkout":
      return wrap((d, c) => placedOrder(d, c, server));
    case "get_payment_options":
      return wrap((d, c) => paymentOptions(d, c, server));
    case "check_payment_status":
      return wrap(paymentStatus);
    case "confirm_order":
      return wrap((d, c) => `${d.result === "success" ? paint(PALETTE.success, "✓", c) : paint(PALETTE.warn, "•", c)} Order ${s(d.orderId)} ${s(d.orderStatus || d.result)}`);
    case "report_error":
      return wrap(reportError);
    case "create_address":
      return wrap((d, c) => `${paint(PALETTE.success, "✓", c)} Address saved · id ${s(d.addressId)}${dim("   (set as default: swiggy profile set default defaultAddressId " + s(d.addressId) + ")", c)}`);
    case "delete_address":
      return wrap((d, c) => simpleStatus(d, c, "Address deleted"));
    case "flush_food_cart":
    case "clear_cart":
      return wrap((d, c) => simpleStatus(d, c, "Cart cleared"));
    case "list_coupons":
      return wrap((d, c) => {
        const list = arr(d.coupons).length ? arr(d.coupons) : arr(d.data);
        if (!list.length) return undefined as unknown as string;
        return [title("Coupons", c, `${list.length}`), table(["code", "offer", ""], list.map((x) => [s(x.code || x.couponCode || x.title), s(x.description || x.subtitle || x.title), x.applicable === false ? dim("n/a", c) : ""]), c), hint("apply: swiggy instamart apply-coupon <CODE>", c)].join("\n");
      });
    case "create_cart":
      return wrap((d, c) => {
        const cart = isRec(d.cart) ? d.cart : {};
        const bill = isRec(cart.bill) ? cart.bill : {};
        const rows: string[][] = [["Cart key", s(d.cartKey || cart.cartKey)], ["Type", s(cart.cartType)]];
        if (bill.billToPay !== undefined) rows.push(["To pay", money(bill.billToPay)]);
        const methods = Array.isArray(d.availablePaymentMethods) ? (d.availablePaymentMethods as unknown[]).map(s) : [];
        if (methods.length) rows.push(["Payment", methods.join(", ")]);
        return [title("Booking cart ready", c), table(["", ""], rows, c, [12, 80]), hint("next: swiggy dineout book … --cart-key <key> --pay upi --wait", c)].join("\n");
      });
    default:
      return undefined;
  }
}

/** Render Swiggy's `message` (often Markdown) under a native view, when it adds information. */
export function messageLine(message: string | undefined, ctx: ViewCtx): string {
  if (!message) return "";
  const m = message.trim();
  if (!m || m.length > 600) return "";
  return renderMarkdown(m, ctx);
}

export function colored(ctx: ViewCtx): boolean {
  return shouldUseColor(ctx);
}
