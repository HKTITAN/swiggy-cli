---
name: swiggy-mcp-food
description: Order food for delivery through the Swiggy Food MCP server (mcp.swiggy.com/food) — address → search → menu → cart → coupon → place order → track. Use when an agent with Swiggy Food tools must find restaurants or dishes, build a cart, apply coupons, place or track a delivery order. Assumes the swiggy-mcp skill.
license: MIT
compatibility: Requires the Swiggy Food MCP server connected and the user signed in.
metadata:
  author: HKTITAN
  version: "0.2.1"
  reference: https://mcp.swiggy.com/builders/docs/reference/food/
---

# swiggy-mcp-food

```
get_addresses → search_restaurants | search_menu → get_restaurant_menu → update_food_cart → get_food_cart
   → fetch_food_coupons / apply_food_coupon → get_payment_options → place_food_order → track_food_order
```

## Step rules

1. **`get_addresses` first, once.** Every search, cart and order call needs `addressId` from `data.addresses[].id`. Never guess it; results depend on serviceability at that address. Create one with `create_address` if none fits (see the `swiggy-address` rules: ask only for full address, name, phone, category; omit coordinates).
2. **Search with one term.** `search_restaurants { addressId, query }` for a restaurant/cuisine; `search_menu { addressId, query }` for a dish (`vegFilter: 1` for veg-only; there is no non-veg-only filter — say so if asked). Set `collection` only when intent is unambiguous: healthy → `EATRIGHT`, ~10-min → `BOLT`, ~₹99 → `STORE_99`. Recommend only restaurants with `availabilityStatus: "OPEN"`. Paginate with the returned `nextOffset`.
3. **Cart items use `menu_item_id`**, copied from `search_menu`/`get_restaurant_menu`. `update_food_cart { restaurantId, addressId, cartItems: [{ menu_item_id, quantity, variants?, addons? }] }`. An item uses **either** `variations` **or** `variantsV2` — send the same format the item came with, never both. Keep `group_id` and `variation_id`/addon `id` paired exactly as returned; pick addons from `valid_addons` after choosing the variant.
4. **`update_food_cart` renders nothing.** Immediately call `get_food_cart { addressId }` and show the cart; say "Added 2× Chicken Biryani", never "your cart is shown above".
5. **Quantity change on a customised item: ask** whether the extra unit gets the same add-ons (and mention unpicked ones) before updating. Items without variants/addons can change directly.
6. **One restaurant per cart.** Adding from another restaurant flushes the cart — warn with what will be lost and get a yes. Use `flush_food_cart` only when the user says start over.
7. **Coupons:** `fetch_food_coupons { restaurantId, addressId }` then `apply_food_coupon { couponCode, addressId }`. A coupon is applied only when `offers.coupon_discount > 0`; `coupon_applied` with `coupon_discount: 0` is a suggestion, not a saving. Coupons that require online payment do not work on Cash — pay by UPI or skip.
8. **Before `place_food_order`:** `get_food_cart` again; state the items, `pricing.to_pay`, the exact delivery address text and the payment method; ask "Do you want to proceed with placing this order to this address?"; wait for a clear yes. Builders Club Food carts are capped at ₹1000.
9. **Place:** `place_food_order { addressId, paymentMethod?, intentApp?, generateUPIQR?, noteToRestaurant? }`. Cash → placed immediately; use `message` verbatim ("Swiggy order placed successfully"). UPI → `status: "PENDING_PAYMENT"` — **not placed yet**; say "Complete the payment in your UPI app — I'll confirm once payment succeeds" and follow `swiggy-mcp-payments`. Never claim placement on a pending response.
10. **Track:** `track_food_order { orderId? }` (omit for all active orders) or `get_food_delivery_status { orderId }` for structured ETA + terminal state. Poll ≥ 10 s apart. History: `get_food_orders { addressId, activeOnly? }`, details: `get_food_order_details { orderId }`.
11. **Cancellation:** do not call any tool; say "To cancel your order, please call Swiggy customer care at 080-67466729."

## Failure → response

- Restaurant closed between search and order → re-run `search_restaurants`.
- Minimum order not met / cart over ₹1000 → ask the user to adjust items.
- Coupon requires online payment → offer UPI or drop the coupon.
- 5xx on `place_food_order` → `get_food_orders { addressId, activeOnly: true }` before any retry.

## Agent prompt (paste into your system prompt)

> You help users order food on Swiggy. Resolve the saved address with `get_addresses` before searching. Recommend only `OPEN` restaurants. Read the cart before every mutation and before placing. Confirm items, total and address, and get an explicit yes before `place_food_order` — it places a real order. On a `PENDING_PAYMENT` response, tell the user to complete payment; never say the order is placed until `confirm_order` succeeds. Never exceed a ₹1000 cart.
