---
title: Instamart server
type: entity
updated: 2026-09-05
sources: [sources/swiggy-builders-docs, sources/create-address-ga-blog, sources/upi-payments-blog]
tags: [instamart, server]
---
`POST https://mcp.swiggy.com/im` — quick-commerce grocery: product search with SKU-level variations, a cart bound to the delivery address, coupons, multi-store checkout (Cash / UPI / SwiggyPay), tracking. 19 tools as of 2026-09-05.

## Details
| Stage | Tools |
| --- | --- |
| Discover | `get_addresses`, `create_address`, `delete_address`, `search_products`, `your_go_to_items` |
| Cart | `get_cart`, `update_cart`, `clear_cart`, `list_coupons`, `apply_coupon` |
| Payment | `get_payment_options`, `check_payment_status`, `confirm_order` |
| Order | `checkout` |
| Track | `track_order`, `get_delivery_status`, `get_orders`, `get_order_details` |
| Support | `report_error` |

## Facts
- `search_products { addressId, query, offset? }` → `products[]{displayName, brand, productId, variations[]{spinId, skuId, quantityDescription, price{mrp, offerPrice}, isInStockAndAvailable, maxQuantity, sla}}`, `similarProducts[]`, `nextOffset` (reference, 2026-09-05). Carts take variation ids, not `productId`.
- `your_go_to_items { addressId, offset? }` — frequently/recently ordered; Swiggy recommends it for reorders (rate-limits "voice guidance").
- `update_cart { selectedAddressId, items: [{ spinId, skuId, quantity }] }` **replaces** the cart; response may include `removedOutOfStockItems`, `reducedQuantityItems{requestedQuantity, cappedQuantity, reason}` (reference).
- `get_cart {}` → `selectedAddressDetails`, `items[]{spinId, skuId, itemName, itemVariant, quantity, mrp, discountedFinalPrice, isInStockAndAvailable}`, `billBreakdown{lineItems[], toPay}`, `cartTotalAmount`, `unserviceableItems`, `cartWarning`, `availablePaymentMethods`, `paymentOptions` (reference).
- Coupons: `list_coupons { addressId }`, `apply_coupon { couponCode }` (case-insensitive; returns the cart) (reference).
- `checkout { addressId, paymentMethod?, intentApp?, generateUPIQR? }`; `paymentMethod` is a **group**: `"UPI"`, `"Cash"`/`"COD"`, `"SwiggyPay"`; multi-store carts create one order per store with per-order results; UPI returns `PENDING_PAYMENT` (reference). Not idempotent.
- Confirm contract: `confirm_order { orderId, paasId, transactionId? }` (pay-with-upi recipe).
- Minimum order ₹99; service-area restrictions (order-groceries recipe).
- `track_order { orderId, lat, lng }` — coordinates required; response includes `pollingIntervalSeconds`, `mapInfo`, `etaText` (reference). `get_delivery_status { orderId, addressId }`.
- `get_orders { count?, orderType?, activeOnly? }` → rich order list with `storeName`, `items[]`, `billDetails`, `paymentStatus`, `refundStatus`; `get_order_details { orderId }` → `items[]{removed}`, `bill.grandTotal`, `hasRefunds` (reference).
- Cancellation: not via API — 080-67466729.

## Relationships
- Address book shared with [food-server](food-server.md).
- Replace semantics drive the CLI's merge-on-add behaviour: [cart-state](../concepts/cart-state.md), [native-cli-feel](../concepts/native-cli-feel.md).
- Payments: [payment-stage](payment-stage.md); wallet: [swiggy-money](swiggy-money.md) (the `SwiggyPay` group appears in this server's `checkout` docs).

## Rollout gating (observed 2026-09-05)
`apply_coupon`, `list_coupons` and `get_order_details` were absent from this account's `tools/list` (16 of 19 tools present). Swiggy gates tools per account; agents must use only what `tools/list` returns (live capture).

## Contradictions & uncertainty
- Recipe `update_cart { items:[{spinId, quantity}] }` omits `selectedAddressId` that the reference marks required. Reference wins.
- `your_go_to_items` and `list_coupons` output schemas were truncated in the 2026-09-05 snapshot ([open-questions](../synthesis/open-questions.md)).

## Changelog
- 2026-09-05 — created.
