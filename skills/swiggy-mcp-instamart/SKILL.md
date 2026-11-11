---
name: swiggy-mcp-instamart
description: Order groceries through the Swiggy Instamart server (mcp.swiggy.com/im, 16 tools) by calling its tools directly — address → search or go-to items → set cart → checkout → track. Use when an agent with Swiggy Instamart tools must find products, build or edit a grocery cart, check out or track a delivery. Assumes the swiggy-mcp skill.
license: MIT
compatibility: Requires the Swiggy Instamart server connected and the user signed in.
metadata:
  author: HKTITAN
  version: "0.3.0"
  reference: https://mcp.swiggy.com/builders/docs/reference/instamart/
---

# swiggy-mcp-instamart

```
get_addresses → your_go_to_items | search_products → update_cart → get_cart
   → get_payment_options → checkout → track_order
```

## Step rules

1. **`get_addresses` once; pass `addressId` to every search.** Stock and serviceability are per address, so a search without it is meaningless. `create_address` if none fits (ask only for full address, name, phone, category; no coordinates).
2. **Returning user? `your_go_to_items { addressId }` first.** One call replaces 3–5 searches and is what Swiggy recommends for reorders.
3. **`search_products { addressId, query }` returns products with `variations[]`.** The cart takes the **variation** ids: `spinId` (+ `skuId`), never `productId`. Check `isInStockAndAvailable` and `maxQuantity` before offering a variation. Show `similarProducts` in a separate section when present. Paginate with `nextOffset`.
4. **`update_cart` REPLACES the whole cart.** `update_cart { selectedAddressId, items: [{ spinId, skuId, quantity }] }` must contain every item the user wants, not just the new one. To add one item: `get_cart`, merge, send the full list. The response may include `removedOutOfStockItems` and `reducedQuantityItems` — tell the user about each with its `reason`.
5. **Show the cart after every change:** `get_cart` → `items[]`, `billBreakdown.toPay`, `unserviceableItems`, `cartWarning`. Read the cart again before checkout.
6. **Do not switch address mid-cart.** Carts bind to the delivery address; call `clear_cart` first, then rebuild at the new address.
7. **No coupon tools.** `list_coupons`, `apply_coupon` and `get_order_details` left the published reference in November 2026. If `tools/list` still shows one for this account it is a leftover; do not build a flow on it. Report savings only from what `get_cart` returns. Gift packs: `add_gift_pack_to_cart` is a beta tool that appears in `tools/list` only for accounts in the beta and is not in the reference; use it only when listed.
8. **Before `checkout`:** state items, `billBreakdown.toPay`, the exact delivery address, the payment method, and — if the cart spans multiple stores — "Your cart contains items from N stores; Swiggy will create one order per store." Ask "Do you want to proceed with placing this order to this address?" and wait for a clear yes.
9. **Place:** `checkout { addressId, paymentMethod?, intentApp?, generateUPIQR? }`. `paymentMethod` is a GROUP — `"UPI"`, `"Cash"`/`"COD"`, `"SwiggyPay"` — never an app id; the app id goes in `intentApp` with `paymentMethod: "UPI"`. Cash → placed; use `message` verbatim ("Instamart order placed successfully"). UPI → `PENDING_PAYMENT`, not placed yet → `swiggy-mcp-payments` (Instamart confirms with `orderId + paasId`). Swiggy Money → only when `get_payment_options` returned `swiggyMoney.available: true` and the user chose it: `paymentMethod: "SwiggyPay"`, no `intentApp`, no `generateUPIQR`; debited during checkout, no polling, no `confirm_order`. Report multi-store results per order.
10. **Track:** `track_order { orderId, lat, lng }` — coordinates are **required**; take them from the address/order context. Respect `pollingIntervalSeconds`, never faster than 10 s. `get_delivery_status { orderId, addressId }` for structured ETA. History and order details: `get_orders { count?, orderType?, activeOnly? }`.
11. **Cancellation:** no tool; say "To cancel your order, please call Swiggy customer care at 080-67466729."

## Failure → response

- Item out of stock at this address → suggest alternatives from a new `search_products`.
- Address not serviceable → ask for another address (or offer Food delivery instead).
- Minimum order not met → relay `error.message` and ask the user to add items. Do not quote an amount from memory.
- Cart expired → rebuild from the user's confirmed list, confirm, then continue.
- Network error or 5xx on `checkout` → wait 2–5 s, then `get_orders` and check every store in the cart (a multi-store checkout places one order per store and can partly succeed). Never replay a partly placed checkout. If `checkout` rejects a likely duplicate, set `confirmDuplicate` only when that rejection asks for it and the user confirms.

## Agent prompt

> You help users shop on Swiggy Instamart. Resolve the saved address first. Offer `your_go_to_items` for reorders; use `search_products` for new items; add variation `spinId`s. `update_cart` replaces the cart, so always send the full list. Show the cart and total, get an explicit yes before `checkout`, and never announce success on a `PENDING_PAYMENT` response.
