/**
 * The tool catalog Swiggy publishes for its four servers.
 *
 * Sourced from https://mcp.swiggy.com/builders/docs/reference/ (llms-full.txt) on 2026-11-11:
 * 62 tools — Food 20, Instamart 16, Dineout 11, Scenes 15. Tool names and parameter names are
 * verbatim from the reference (parameters are camelCase: `addressId`, `restaurantId`, `orderId`, ...).
 *
 * The CLI still discovers live schemas at runtime via `tools/list`; this catalog is used for
 * command → tool mapping, drift detection in `swiggy doctor`, and tests. If a tool is renamed or
 * removed upstream, `swiggy call <server> <tool>` keeps working — only the named commands need
 * patching here.
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
    "clear_cart",
    "get_cart",
    "update_cart",
    // Payment
    "check_payment_status",
    "confirm_order",
    "get_payment_options",
    // Order
    "checkout",
    // Track
    "get_delivery_status",
    "get_orders",
    "track_order",
    // Support
    "report_error",
  ],
  dineout: [
    // Find
    "get_restaurant_details",
    "render_restaurants_dineout",
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
    "get_booking_status",
    // Support
    "report_error",
  ],
  scenes: [
    // Discover
    "discover_events",
    "get_event_details",
    "get_event_venue_info",
    "get_events_collection",
    "get_saved_locations",
    "list_event_shows",
    "search_events",
    // Cart
    "create_event_cart",
    "get_event_cart",
    // Payment
    "check_payment_status",
    "confirm_order",
    "get_payment_options",
    // Order
    "place_event_order",
    // Manage
    "get_event_booking_status",
    // Support
    "report_error",
  ],
} as const;

export const TOOL_COUNTS: Record<ServerName, number> = {
  food: TOOL_CATALOG.food.length,
  instamart: TOOL_CATALOG.instamart.length,
  dineout: TOOL_CATALOG.dineout.length,
  scenes: TOOL_CATALOG.scenes.length,
};

/**
 * Tools the CLI still has a named command for, but which Swiggy's published reference no longer
 * lists (they were in the September 2026 reference and are gone from the November 2026 one).
 * Swiggy enables tools per account, so a signed-in `swiggy doctor` is the only way to know whether
 * your account still has them. They are kept so existing scripts keep working, never counted in
 * the catalog, and never reported as drift.
 */
export const LEGACY_TOOLS: Record<ServerName, readonly string[]> = {
  food: [],
  instamart: ["apply_coupon", "list_coupons", "get_order_details"],
  dineout: ["cancel_booking", "get_saved_locations"],
  scenes: [],
};

/**
 * Catalog tools with no named command of their own. `render_restaurants_dineout` exists to drive a
 * chat client's restaurant cards; `swiggy dineout search` calls it behind the scenes, because it is
 * the only place Swiggy returns the structured restaurants for a Dineout search.
 */
export const WIDGET_ONLY_TOOLS: ReadonlySet<string> = new Set(["render_restaurants_dineout"]);

export const LEGACY_NOTE = "not in Swiggy's published reference since Nov 2026; works only if your account still has it";

/**
 * Map ergonomic CLI verbs → real tool names.
 * Keep this list in sync with src/commands/{food,instamart,dineout,scenes,payments,address}.ts.
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
  scenes: {
    discover: "discover_events",
    search: "search_events",
    collection: "get_events_collection",
    details: "get_event_details",
    venue: "get_event_venue_info",
    shows: "list_event_shows",
    locations: "get_saved_locations",
    cart: "create_event_cart",
    "show-cart": "get_event_cart",
    book: "place_event_order",
    status: "get_event_booking_status",
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
  "place_event_order",
  "cancel_booking",
  "flush_food_cart",
  "clear_cart",
  "delete_address",
]);

/** Tools that change server-side state. Used by `swiggy tools` output and documentation only. */
export const WRITE_TOOLS: ReadonlySet<string> = new Set([
  ...DESTRUCTIVE_TOOLS,
  "create_address",
  "update_food_cart",
  "update_cart",
  "apply_food_coupon",
  "apply_coupon",
  "confirm_order",
  "create_cart",
  "create_event_cart",
  "report_error",
]);

/**
 * Order-placing tools. Swiggy does not de-duplicate them and they take no idempotency key, so a
 * retry after a timeout or a lost response can place a second order. The CLI never retries these;
 * on a network failure it tells the caller to check the order list first.
 */
export const NON_IDEMPOTENT_TOOLS: ReadonlySet<string> = new Set(["place_food_order", "checkout", "book_table", "place_event_order"]);

/** The shared Payment stage — same three tools on every server. */
export const PAYMENT_TOOLS: readonly string[] = ["get_payment_options", "check_payment_status", "confirm_order"];

/** Per-server place-order tool (the one that returns PENDING_PAYMENT for UPI). */
export const PLACE_ORDER_TOOL: Record<ServerName, string> = {
  food: "place_food_order",
  instamart: "checkout",
  dineout: "book_table",
  scenes: "place_event_order",
};
