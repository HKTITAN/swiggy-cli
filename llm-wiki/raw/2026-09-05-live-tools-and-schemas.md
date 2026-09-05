# Live capture: signed-in `tools/list`, tool schemas and auth state (2026-09-05, ~13:30 IST)

Captured with swiggy-cli 0.2.0 after a real `swiggy auth init` (browser, phone + OTP) on the maintainer's account. Read-only calls only (`tools/list`, `tools/list` schemas, `auth status`, `doctor`, Instamart `get_payment_options` on an empty cart).

## Auth
- One token stored for food / instamart / dineout; `expiresAt` = sign-in + 120 h (5 days), matching the docs.
- **A refresh token WAS issued** (`hasRefresh: true`) — the docs say refresh-token issuance is "not wired in v1.0". Whether the refresh grant actually succeeds at `/auth/token` is untested.
- Dynamic client registration worked with an ephemeral loopback port (`http://127.0.0.1:50445/callback`).

## tools/list per server (this account)
| Server | Count | vs reference (2026-09-05) |
| --- | --- | --- |
| Food | 20 | in sync |
| Instamart | 16 | missing `apply_coupon`, `list_coupons`, `get_order_details` |
| Dineout | 12 | missing `cancel_booking`; **extra, undocumented** `render_restaurants_dineout` |

Instamart list: get_addresses, create_address, delete_address, search_products, your_go_to_items, get_cart, update_cart, clear_cart, checkout, get_orders, track_order, get_delivery_status, report_error, get_payment_options, check_payment_status, confirm_order.
Dineout list: get_saved_locations, search_restaurants_dineout, get_restaurant_details, render_restaurants_dineout, get_available_slots, book_table, create_cart, get_booking_status, report_error, get_payment_options, check_payment_status, confirm_order.

## Live schemas vs reference
- `update_food_cart`: required `restaurantId, cartItems, addressId`; optional `restaurantName, cutleryOptIn`. `cartItems[]` = `{ menu_item_id, quantity, variants[] {variation_id|variationId, group_id|groupId, name?, price?}, variantsV2[] {group_id, variation_id}, addons[] … }`; the schema says each item uses `variations` OR `variantsV2`, never both. Matches the reference.
- `update_cart`: required `selectedAddressId, items`. Matches.
- `place_food_order`: required `addressId`; optional `paymentMethod, intentApp, generateUPIQR, noteToRestaurant`. Matches.
- `checkout`: required `addressId`; optional `paymentMethod, intentApp, generateUPIQR`. Matches.
- `book_table`: required `restaurantId, slotId, itemId, reservationTime, guestCount, latitude, longitude`; optional `paymentMethod, cartKey, intentApp, generateUPIQR` **plus undocumented `tidOverride`** ("Override transaction ID (tid) from auth context").
- `search_products`: required `addressId, query`; optional `offset`. Matches.
- `get_payment_options` (food): optional `addressId` **plus `cartAmount`** marked "Deprecated. Ignored".
- `render_restaurants_dineout` (undocumented): required `restaurantIds[]` (1–50, display order ranked by user intent) and `searches[]` (1–5 of `{query, latitude, longitude, entityType?}`); the server re-runs the searches to rebuild card data for a rich UI widget. Description: "Call this AFTER search_restaurants_dineout, once you have decided which restaurants to show and in what order … Call it once with your final curated, ordered list."

## Rate-limit headers
- No `X-RateLimit-*` headers on any successful response (`meta.rateLimit` undefined on all three servers). Consistent with the changelog's "MCP-layer rate limiting not enforced in v1.0" rather than the rate-limits page.

## Payments
- Instamart `get_payment_options` on an empty cart returned `allMethods: []`, no `platforms`, `paymentAmount: null`. Swiggy Money's representation therefore remains unobserved (needs a non-empty cart).
