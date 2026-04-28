/**
 * Verified tool catalog for the official Swiggy MCP servers.
 *
 * Sourced from https://mcp.swiggy.com/builders/docs/reference/ on 2026-04-28.
 * Tool names are verbatim. Parameter shapes are NOT yet pinned in the public reference;
 * the CLI discovers parameter schemas at runtime via MCP `tools/list`. This catalog is
 * used only for ergonomic command → tool mapping. Update if Swiggy publishes more.
 *
 * If a tool is renamed or removed upstream, the generic `swiggy call <server> <tool>`
 * pathway keeps working — only the convenience aliases need patching here.
 */

import type { ServerName } from "../types/index.js";

export const TOOL_CATALOG: Record<ServerName, readonly string[]> = {
  food: [
    "get_addresses",
    "get_restaurant_menu",
    "search_menu",
    "search_restaurants",
    "apply_food_coupon",
    "fetch_food_coupons",
    "flush_food_cart",
    "get_food_cart",
    "update_food_cart",
    "place_food_order",
    "get_food_order_details",
    "get_food_orders",
    "track_food_order",
    "report_error",
  ],
  instamart: [
    "create_address",
    "delete_address",
    "get_addresses",
    "search_products",
    "your_go_to_items",
    "clear_cart",
    "get_cart",
    "update_cart",
    "checkout",
    "get_order_details",
    "get_orders",
    "track_order",
    "report_error",
  ],
  dineout: [
    "get_restaurant_details",
    "get_saved_locations",
    "search_restaurants_dineout",
    "book_table",
    "create_cart",
    "get_available_slots",
    "get_booking_status",
    "report_error",
  ],
} as const;

/**
 * Map ergonomic CLI verbs → real MCP tool names.
 * Keep this list in sync with src/commands/{food,instamart,dineout}.ts.
 */
export const ERGONOMIC_ALIASES: Record<ServerName, Record<string, string>> = {
  food: {
    "search-restaurants": "search_restaurants",
    "search-menu": "search_menu",
    menu: "get_restaurant_menu",
    addresses: "get_addresses",
    cart: "get_food_cart",
    "add-to-cart": "update_food_cart",
    "clear-cart": "flush_food_cart",
    "apply-coupon": "apply_food_coupon",
    "list-coupons": "fetch_food_coupons",
    checkout: "place_food_order",
    orders: "get_food_orders",
    order: "get_food_order_details",
    track: "track_food_order",
    "report-error": "report_error",
  },
  instamart: {
    search: "search_products",
    "go-to-items": "your_go_to_items",
    addresses: "get_addresses",
    "create-address": "create_address",
    "delete-address": "delete_address",
    cart: "get_cart",
    "add-to-cart": "update_cart",
    "clear-cart": "clear_cart",
    checkout: "checkout",
    orders: "get_orders",
    order: "get_order_details",
    track: "track_order",
    "report-error": "report_error",
  },
  dineout: {
    search: "search_restaurants_dineout",
    details: "get_restaurant_details",
    locations: "get_saved_locations",
    cart: "create_cart",
    slots: "get_available_slots",
    book: "book_table",
    status: "get_booking_status",
    "report-error": "report_error",
  },
};

/** Risky tools that should require --yes in non-interactive mode. */
export const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set([
  "place_food_order",
  "checkout",
  "book_table",
  "flush_food_cart",
  "clear_cart",
  "delete_address",
]);
