# Tools catalog

Verified against <https://mcp.swiggy.com/builders/docs/reference/> on **2026-09-05** — **51 tools** across 3 servers (Food 20, Instamart 19, Dineout 12). Parameter names are verbatim from the reference (camelCase). The CLI also discovers live schemas at runtime: `swiggy schema <server> <tool> --json`.

⚠ = destructive in this CLI (gated by confirmation / `--yes`). Stage and behaviour come from Swiggy's reference.

## Food (`https://mcp.swiggy.com/food`) — 20 tools

| Tool | Stage | Behaviour | Required params | Optional params |
| --- | --- | --- | --- | --- |
| `apply_food_coupon` | Cart | mutating | `couponCode`, `addressId` | `cartId` |
| `check_payment_status` | Payment | read-only | `paasId` | `orderId`, `addressId`, `cartId`, `lat`, `lng` |
| `confirm_order` | Payment | mutating | `orderId`, `addressId` (for Food), `lat` (for Food), `lng` (for Food) | `transactionId`, `paasId`, `cartId` |
| `create_address` | Discover | mutating | `fullAddress`, `addressLine`, `addressLine2`, `city`, `postalCode`, `addressCategory`, `userName`, `userPhone` | `locality`, `latitude`, `longitude`, `addressTag`, `receiverName`, `receiverPhone` |
| `delete_address` ⚠ | Discover | mutating | `addressId` | — |
| `fetch_food_coupons` | Cart | read-only | `restaurantId`, `addressId` | `couponCode` |
| `flush_food_cart` ⚠ | Cart | mutating | — | — |
| `get_addresses` | Discover | read-only | — | `page`, `pageSize` |
| `get_food_cart` | Cart | read-only | `addressId` | `restaurantName` |
| `get_food_delivery_status` | Track | read-only | `orderId` | — |
| `get_food_order_details` | Track | read-only | `orderId` | — |
| `get_food_orders` | Track | read-only | `addressId` | `activeOnly` |
| `get_payment_options` | Payment | read-only | — | `addressId` |
| `get_restaurant_menu` | Discover | read-only | `addressId`, `restaurantId` | — |
| `place_food_order` ⚠ | Order | mutating | `addressId` | `paymentMethod`, `intentApp`, `generateUPIQR`, `noteToRestaurant` |
| `report_error` | Support | mutating | `tool`, `errorMessage` | `domain`, `flowDescription`, `toolContext`, `userNotes` |
| `search_menu` | Discover | read-only | `addressId`, `query` | `restaurantIdOfAddedItem`, `vegFilter`, `offset` |
| `search_restaurants` | Discover | read-only | `addressId`, `query` | `offset`, `collection` |
| `track_food_order` | Track | read-only | — | `orderId` |
| `update_food_cart` | Cart | mutating | `restaurantId`, `cartItems`, `addressId` | `restaurantName`, `cutleryOptIn` |

## Instamart (`https://mcp.swiggy.com/im`) — 19 tools

| Tool | Stage | Behaviour | Required params | Optional params |
| --- | --- | --- | --- | --- |
| `apply_coupon` | Cart | mutating | `couponCode` | — |
| `check_payment_status` | Payment | read-only | `paasId` | `orderId`, `addressId`, `cartId`, `lat`, `lng` |
| `checkout` ⚠ | Order | mutating | `addressId` | `paymentMethod`, `intentApp`, `generateUPIQR` |
| `clear_cart` ⚠ | Cart | mutating | — | — |
| `confirm_order` | Payment | mutating | `orderId`, `paasId` (for IM/Dineout) | `transactionId`, `addressId`, `cartId`, `lat`, `lng` |
| `create_address` | Discover | mutating | `fullAddress`, `addressLine`, `addressLine2`, `city`, `postalCode`, `addressCategory`, `userName`, `userPhone` | `locality`, `latitude`, `longitude`, `addressTag`, `receiverName`, `receiverPhone` |
| `delete_address` ⚠ | Discover | mutating | `addressId` | — |
| `get_addresses` | Discover | read-only | — | `page`, `pageSize` |
| `get_cart` | Cart | read-only | — | — |
| `get_delivery_status` | Track | read-only | `orderId`, `addressId` | — |
| `get_order_details` | Track | read-only | `orderId` | — |
| `get_orders` | Track | read-only | — | `count`, `orderType`, `activeOnly` |
| `get_payment_options` | Payment | read-only | — | `addressId` |
| `list_coupons` | Cart | read-only | `addressId` | — |
| `report_error` | Support | mutating | `tool`, `errorMessage` | `domain`, `flowDescription`, `toolContext`, `userNotes` |
| `search_products` | Discover | read-only | `addressId`, `query` | `offset` |
| `track_order` | Track | read-only | `orderId`, `lat`, `lng` | — |
| `update_cart` | Cart | mutating | `selectedAddressId`, `items` | — |
| `your_go_to_items` | Discover | read-only | `addressId` | `offset` |

## Dineout (`https://mcp.swiggy.com/dineout`) — 12 tools

| Tool | Stage | Behaviour | Required params | Optional params |
| --- | --- | --- | --- | --- |
| `book_table` ⚠ | Reserve | mutating | `restaurantId`, `slotId`, `itemId`, `reservationTime`, `guestCount`, `latitude`, `longitude` | `paymentMethod`, `cartKey`, `intentApp`, `generateUPIQR` |
| `cancel_booking` ⚠ | Manage | mutating | `orderId` | `cancellationReason` |
| `check_payment_status` | Payment | read-only | `paasId` | `orderId`, `addressId`, `cartId`, `lat`, `lng` |
| `confirm_order` | Payment | mutating | `orderId`, `paasId` (for IM/Dineout) | `transactionId`, `addressId`, `cartId`, `lat`, `lng` |
| `create_cart` | Reserve | mutating | `restaurantId`, `cartType`, `latitude`, `longitude`, `slotId` (for DEAL_TICKET_PURCHASE), `itemId` (for DEAL_TICKET_PURCHASE), `reservationTime` (for DEAL_TICKET_PURCHASE), `guestCount` (for DEAL_TICKET_PURCHASE), `billAmount` (for DINEOUT) | `source` |
| `get_available_slots` | Reserve | read-only | `restaurantId`, `date`, `latitude`, `longitude` | — |
| `get_booking_status` | Manage | read-only | `orderId` | — |
| `get_payment_options` | Payment | read-only | — | `addressId` |
| `get_restaurant_details` | Find | read-only | `restaurantId`, `latitude`, `longitude` | — |
| `get_saved_locations` | Find | read-only | — | — |
| `report_error` | Support | mutating | `tool`, `errorMessage` | `domain`, `flowDescription`, `toolContext`, `userNotes` |
| `search_restaurants_dineout` | Find | read-only | `query` | `entityType`, `addressId`, `latitude`, `longitude`, `limit`, `offset` |

## Shared Payment stage

`get_payment_options`, `check_payment_status` and `confirm_order` exist on every server with the same shape; the place-order tool differs (`place_food_order` / `checkout` / `book_table`). See [payments.md](./payments.md).
