---
title: Food server
type: entity
updated: 2026-09-05
sources: [sources/swiggy-builders-docs, sources/create-address-ga-blog, sources/upi-payments-blog]
tags: [food, server]
---
`POST https://mcp.swiggy.com/food` — restaurant discovery, menus, a single-restaurant cart, coupons, order placement (Cash or UPI), tracking. 20 tools as of 2026-09-05.

## Details
| Stage | Tools |
| --- | --- |
| Discover | `get_addresses`, `create_address`, `delete_address`, `search_restaurants`, `search_menu`, `get_restaurant_menu` |
| Cart | `get_food_cart`, `update_food_cart`, `flush_food_cart`, `fetch_food_coupons`, `apply_food_coupon` |
| Payment | `get_payment_options`, `check_payment_status`, `confirm_order` |
| Order | `place_food_order` |
| Track | `track_food_order`, `get_food_delivery_status`, `get_food_orders`, `get_food_order_details` |
| Support | `report_error` |

## Facts
- Every discovery/cart/order call takes `addressId` from `get_addresses` (reference, 2026-09-05). `get_addresses` is paginated (`page`, `pageSize` ≤ 10) and returns addresses without coordinates (create-address blog, 2026-08-24).
- `search_restaurants { addressId, query, offset?, collection? }`; `collection` ∈ `EATRIGHT | BOLT | STORE_99`; response has `restaurants[]` **and** `dishes[]`, `nextOffset`, `hasMore`; recommend only `availabilityStatus: "OPEN"` (reference + order-food recipe).
- `search_menu { addressId, query, restaurantIdOfAddedItem?, vegFilter? (0|1), offset? }`; no non-veg-only filter exists (reference).
- `get_restaurant_menu { addressId, restaurantId }` → flat, deduplicated list capped at 150 items with `categories[]`, `truncated` (reference).
- `update_food_cart { restaurantId, addressId, cartItems: [{ menu_item_id, quantity, variants?, addons? }], restaurantName?, cutleryOptIn? }`; an item uses `variations` **or** `variantsV2`, never both; addon validity depends on the chosen variant (`valid_addons`); the tool renders no UI — call `get_food_cart` after (reference).
- `get_food_cart { addressId, restaurantName? }` → `data.data.{cart_id, restaurant, items[], pricing{item_total, delivery_charge, taxes_and_charges, to_pay}, offers{coupon_applied, coupon_discount}}` plus `availablePaymentMethods`, `paymentOptions`; a coupon counts only when `coupon_discount > 0` (reference).
- Coupons: `fetch_food_coupons { restaurantId, addressId, couponCode? }`, `apply_food_coupon { couponCode, addressId, cartId? }`; some require online payment (recipe).
- `place_food_order { addressId, paymentMethod?, intentApp?, generateUPIQR?, noteToRestaurant? }` → Cash: `{orderId, status:"CONFIRMED", normalizedStatus:"success", items[], totalAmount…}`; UPI: `PENDING_PAYMENT` with `paasId, transactionId, bridgeUrl, upiIntentUrl, isQrFlow, pollingIntervalInMs, maxTimeToPollForInMs, addressId, cartId, lat, lng` (reference). Not idempotent; check `get_food_orders` before retrying (ship-to-production).
- Food confirm contract: `confirm_order { orderId, addressId, lat, lng, cartId? }` — no `paasId`; `check_payment_status` must echo `addressId/lat/lng` or the order stays pending (pay-with-upi recipe, 2026-09-05).
- Builders Club Food orders capped at ₹1000 (changelog "known limitations"; recipe).
- Tracking: `track_food_order { orderId? }` (all active when omitted) → `orders[]{orderId, title, subtitle, etaText, orderStatus, progressPercentage}`; `get_food_delivery_status { orderId }` → `deliveryBy`, `etaText`, `delivered`, `cancelled`, `pollIntervalSec`; poll ≥ 10 s (reference, rate-limits).
- Cancellation: not via API — customer care 080-67466729 (place_food_order description).

## Relationships
- Shares the address book and address tools with [instamart-server](instamart-server.md) (create-address blog).
- Payment flow: [payment-stage](payment-stage.md), [headless-payments](../concepts/headless-payments.md).
- Cart semantics: [cart-state](../concepts/cart-state.md).
- CLI verbs: [swiggy-cli](swiggy-cli.md) `swiggy food …`.

## Contradictions & uncertainty
- The order-food recipe uses `items[{itemId}]`, `apply_food_coupon {code}`, `place_food_order {paymentMethod:"COD"}`; the reference uses `cartItems[{menu_item_id}]`, `{couponCode, addressId}`, `paymentMethod:"Cash"`. Reference wins.

## Changelog
- 2026-09-05 — created.
