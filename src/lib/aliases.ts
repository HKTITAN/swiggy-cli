/**
 * Verified tool catalog for the official Swiggy MCP servers.
 *
 * Sourced from https://mcp.swiggy.com/builders/docs/reference/ (llms-full.txt) on 2026-09-05:
 * 51 tools — Food 20, Instamart 19, Dineout 12. Tool names and parameter names are verbatim
 * from the reference (parameters are camelCase: `addressId`, `restaurantId`, `orderId`, ...).
 *
 * The CLI still discovers live schemas at runtime via MCP `tools/list`; this catalog is used
 * for ergonomic command → tool mapping, drift detection in `swiggy doctor`, and tests.
 * If a tool is renamed or removed upstream, the generic `swiggy call <server> <tool>` pathway
 * keeps working — only the convenience aliases need patching here.
 */

import type { ServerName } from "../types/index.js";

export const TOOL_CATALOG: Record<ServerName, readonly string[]> = {
  food: [
    // Discover
    "create_address",
    "delete_address",
    "get_addresses",
    "get_restaurant_menu",
    "search_menu",
    "search_restaurants",
    // Cart
    "apply_food_coupon",
    "fetch_food_coupons",
    "flush_food_cart",
    "get_food_cart",
    "update_food_cart",
    // Payment
    "check_payment_status",
    "confirm_order",
    "get_payment_options",
    // Order
    "place_food_order",
    // Track
    "get_food_delivery_status",
    "get_food_order_details",
    "get_food_orders",
    "track_food_order",
    // Support
    "report_error",
  ],
  instamart: [
    // Discover
    "create_address",
    "delete_address",
    "get_addresses",
    "search_products",
    "your_go_to_items",
    // Cart
    "apply_coupon",
    "clear_cart",
    "get_cart",
    "list_coupons",
    "update_cart",
    // Payment
    "check_payment_status",
    "confirm_order",
    "get_payment_options",
    // Order
    "checkout",
    // Track
    "get_delivery_status",
    "get_order_details",
    "get_orders",
    "track_order",
    // Support
    "report_error",
  ],
  dineout: [
    // Find
    "get_restaurant_details",
    "get_saved_locations",
    "search_restaurants_dineout",
    // Reserve
    "book_table",
    "create_cart",
    "get_available_slots",
    // Payment
    "check_payment_status",
    "confirm_order",
    "get_payment_options",
    // Manage
    "cancel_booking",
    "get_booking_status",
    // Support
    "report_error",
  ],
} as const;

export const TOOL_COUNTS: Record<ServerName, number> = {
  food: TOOL_CATALOG.food.length,
  instamart: TOOL_CATALOG.instamart.length,
  dineout: TOOL_CATALOG.dineout.length,
};

/**
 * Map ergonomic CLI verbs → real MCP tool names.
 * Keep this list in sync with src/commands/{food,instamart,dineout,payments,address}.ts.
 */
export const ERGONOMIC_ALIASES: Record<ServerName, Record<string, string>> = {
  food: {
    "search-restaurants": "search_restaurants",
    "search-menu": "search_menu",
    menu: "get_restaurant_menu",
    addresses: "get_addresses",
    "create-address": "create_address",
    "delete-address": "delete_address",
    cart: "get_food_cart",
    "add-to-cart": "update_food_cart",
    "clear-cart": "flush_food_cart",
    "apply-coupon": "apply_food_coupon",
    "list-coupons": "fetch_food_coupons",
    checkout: "place_food_order",
    orders: "get_food_orders",
    order: "get_food_order_details",
    track: "track_food_order",
    "delivery-status": "get_food_delivery_status",
    "payment-options": "get_payment_options",
    "payment-status": "check_payment_status",
    "confirm-order": "confirm_order",
    "report-error": "report_error",
  },
  instamart: {
    search: "search_products",
    "go-to-items": "your_go_to_items",
    addresses: "get_addresses",
    "create-address": "create_address",
    "delete-address": "delete_address",
    cart: "get_cart",
    "set-cart": "update_cart",
    "add-to-cart": "update_cart",
    "clear-cart": "clear_cart",
    "list-coupons": "list_coupons",
    "apply-coupon": "apply_coupon",
    checkout: "checkout",
    orders: "get_orders",
    order: "get_order_details",
    track: "track_order",
    "delivery-status": "get_delivery_status",
    "payment-options": "get_payment_options",
    "payment-status": "check_payment_status",
    "confirm-order": "confirm_order",
    "report-error": "report_error",
  },
  dineout: {
    search: "search_restaurants_dineout",
    details: "get_restaurant_details",
    locations: "get_saved_locations",
    slots: "get_available_slots",
    cart: "create_cart",
    book: "book_table",
    status: "get_booking_status",
    cancel: "cancel_booking",
    "payment-options": "get_payment_options",
    "payment-status": "check_payment_status",
    "confirm-order": "confirm_order",
    "report-error": "report_error",
  },
};

/** Tools that place orders, spend money, or destroy state. Require --yes in non-interactive mode. */
export const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set([
  "place_food_order",
  "checkout",
  "book_table",
  "cancel_booking",
  "flush_food_cart",
  "clear_cart",
  "delete_address",
]);

/**
 * Tools that mutate server-side state. Swiggy applies a separate 30 req/min quota to these
 * (vs 70 req/min for reads). Used by `swiggy doctor` output and documentation only.
 */
export const WRITE_TOOLS: ReadonlySet<string> = new Set([
  ...DESTRUCTIVE_TOOLS,
  "create_address",
  "update_food_cart",
  "update_cart",
  "apply_food_coupon",
  "apply_coupon",
  "confirm_order",
  "create_cart",
  "report_error",
]);

/** The shared Payment stage — same three tools on every server. */
export const PAYMENT_TOOLS: readonly string[] = ["get_payment_options", "check_payment_status", "confirm_order"];

/** Per-server place-order tool (the one that returns PENDING_PAYMENT for UPI). */
export const PLACE_ORDER_TOOL: Record<ServerName, string> = {
  food: "place_food_order",
  instamart: "checkout",
  dineout: "book_table",
};
