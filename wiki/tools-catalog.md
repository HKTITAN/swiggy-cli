# Tools catalog

Verified against [https://mcp.swiggy.com/builders/docs/reference/](https://mcp.swiggy.com/builders/docs/reference/) on **2026-04-28** (35 tools across 3 servers).

> Tool names are verbatim. Parameter shapes are not yet pinned in the public reference; this CLI fetches them at runtime via `tools/list`. If you need them right now, run `swiggy schema <server> <tool> --json`.

## Food (`https://mcp.swiggy.com/food`) — 14 tools

### Discover

- `search_restaurants` — search by query / cuisine / dish / location
- `search_menu` — search dishes across restaurants
- `get_restaurant_menu` — full menu for a restaurant id
- `get_addresses` — saved delivery addresses

### Cart

- `get_food_cart` — current cart contents
- `update_food_cart` — add / change / remove items
- `flush_food_cart` ⚠ — empty the cart
- `apply_food_coupon` — apply a coupon code
- `fetch_food_coupons` — list applicable coupons

### Order

- `place_food_order` ⚠ — place a COD order

### Track

- `get_food_orders` — history of food orders
- `get_food_order_details` — single order detail
- `track_food_order` — live tracking

### Support

- `report_error` — file an error report

## Instamart (`https://mcp.swiggy.com/im`) — 13 tools

### Discover

- `search_products` — query products by name/category/brand
- `your_go_to_items` — frequently-ordered items

### Address

- `get_addresses`
- `create_address`
- `delete_address` ⚠

### Cart

- `get_cart`
- `update_cart`
- `clear_cart` ⚠

### Order / Track

- `checkout` ⚠ — place COD order
- `get_orders`
- `get_order_details`
- `track_order`

### Support

- `report_error`

## Dineout (`https://mcp.swiggy.com/dineout`) — 8 tools

### Find

- `search_restaurants_dineout`
- `get_restaurant_details` — menu, ratings, offers
- `get_saved_locations`

### Reserve

- `create_cart`
- `get_available_slots`
- `book_table` ⚠ — free bookings only

### Manage / Support

- `get_booking_status`
- `report_error`

⚠ = destructive. Gated by confirmation in this CLI; see `src/lib/aliases.ts` (`DESTRUCTIVE_TOOLS`).