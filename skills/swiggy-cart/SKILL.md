---
name: swiggy-cart
description: Read and change a Swiggy Food or Instamart cart with swiggy-cli — add items, change quantities, apply coupons, clear. Use when the user says "add X", "make it two", "what's in my cart", "apply coupon", "empty my cart".
license: MIT
compatibility: Requires swiggy-cli signed in and a saved address (or defaultAddressId in the profile).
metadata:
  author: HKTITAN
  version: "0.2.1"
---

# swiggy-cart

Carts live on Swiggy's side, keyed to the account. Food and Instamart carts are separate. Everything here except clearing is safe to re-run; retrying the same `add-to-cart` does not double-add.

## Rules

1. **Read the cart at the start of every turn that touches it**, and again before any checkout. The user may have edited it in the Swiggy app; prices and stock change between turns. Never trust what you remember.
2. **Food: one restaurant per cart.** Adding from a second restaurant flushes the first. Before doing that, tell the user what they will lose and get a yes.
3. **Instamart: upstream `update_cart` replaces the whole cart.** Use `swiggy instamart add` (it reads the cart and merges) for "add X"; use `set-cart` only when the user wants exactly that list. Sending only the new item through `set-cart` silently deletes the rest.
4. **Use the ids the search gave you, verbatim.** Food needs `menu_item_id` (from `search-menu`/`menu`); Instamart needs the variation's `spinId` (+ `skuId`). Names and `productId` are not accepted.
5. **A coupon counts as applied only when the cart shows a positive discount.** Swiggy auto-suggests coupons with `coupon_discount: 0`; do not tell the user they saved money unless the number is > 0.
6. **Quantity changes on customised Food items need a decision.** If the item has variants/addons, ask whether the extra unit gets the same add-ons before sending the update; do not silently replicate them.

## Read

```bash
swiggy food cart --json --no-interactive           # data.data.items[], pricing.to_pay, offers, availablePaymentMethods
swiggy instamart cart --json --no-interactive      # data.items[], billBreakdown.toPay, unserviceableItems, paymentOptions
```

## Add / change

```bash
# Food: plain item (ids from search-menu / menu)
swiggy food add --item-id <menu_item_id> --restaurant-id <rid> --qty 2 --json --no-interactive
# Food: item with a variant + addon (ids and group ids copied exactly from the menu response)
swiggy food add --restaurant-id <rid> --items '[{"menu_item_id":"<id>","quantity":1,"variants":[{"group_id":"<g>","variation_id":"<v>"}],"addons":[{"group_id":"<g>","id":"<a>"}]}]' --json --no-interactive

# Instamart: add ONE product — the CLI reads the cart and merges (safe default)
swiggy instamart add --spin-id <spinId> --sku-id <skuId> --qty 2 --json --no-interactive
# Instamart: set the FULL cart explicitly (raw replace semantics)
swiggy instamart set-cart --items '[{"spinId":"<s1>","skuId":"<k1>","quantity":2},{"spinId":"<s2>","skuId":"<k2>","quantity":1}]' --json --no-interactive
```

Row numbers (`swiggy food add 3`) refer to the last listing made in the same shell session; agents pass explicit ids — a number could point at a listing another process made.

After any change, read the cart again and tell the user the new total from `pricing.to_pay` (Food) or `billBreakdown.toPay` (Instamart). `add-to-cart` renders nothing on its own upstream.

## Coupons

```bash
swiggy food list-coupons --restaurant-id <rid> --json --no-interactive
swiggy food apply-coupon <CODE> --json --no-interactive
swiggy instamart list-coupons --json --no-interactive
swiggy instamart apply-coupon <CODE> --json --no-interactive
```

Some coupons require online payment; on a cash order they will not apply. If the user wants that coupon, route them to `swiggy-pay` (UPI). Instamart `list-coupons` / `apply-coupon` (and `order <id>`) are rolled out per account; on `NOT_FOUND` (exit 4) tell the user the feature is not enabled for their account yet and continue without it.

## Clear (destructive)

```bash
swiggy food clear-cart --yes --json --no-interactive
swiggy instamart clear-cart --yes --json --no-interactive
```

Add `--yes` only after the user asked to empty the cart in this conversation. Exit 7 without it is the CLI doing its job.

## What can go wrong

- `MCP_ERROR` mentioning stock/serviceability → item unavailable at this address; offer alternatives from a new search.
- `MCP_ERROR` "minimum order" → Instamart needs ₹99; Food Builders-Club orders are capped at ₹1000.
- `CART_EXPIRED` / empty cart after a long pause → rebuild from the user's last confirmed list, then confirm with them.
