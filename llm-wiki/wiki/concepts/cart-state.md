---
title: Cart state
type: concept
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/swiggy-builders-docs]
tags: [cart, state]
---
Carts live server-side, keyed to the authenticated session and separate per server. Agents must not cache cart contents: read at the top of any turn that touches the cart and again before placing, because the user may edit in the Swiggy app and prices/stock/coupons move between turns.

## Facts
- Food cart binds to **one restaurant**; adding from another flushes it (warn first). Instamart cart binds to the **delivery address**; `clear_cart` before switching (build/agent-patterns/multi-turn-state, 2026-09-05).
- Instamart `update_cart` **replaces** the entire cart with the `items` passed (reference). Food `update_food_cart` adds/updates items with customisations; retrying with the same args does not double-add (ship-to-production idempotency table).
- Cart TTL: abandoned carts may return `CART_EXPIRED`; rebuild and confirm (multi-turn-state).
- Limits: the ₹1000 Food cap and ₹99 Instamart minimum appear only in recipe prose and the v1.0 changelog notes, not in the reference; unverified as current limits. Relay the server's own `error.message` instead of quoting a number (docs snapshot 2026-11-11).
- Scenes ticket cart: `create_event_cart` returns a `cartKey` "for the immediate follow-up flow" and the authoritative `checkoutMode`; a FREE cart cannot be read back and is recreated and repriced at `place_event_order` (reference/scenes, 2026-11-11). The CLI keeps the cart key and selection for 30 minutes.
- Coupon semantics: `coupon_applied` with `coupon_discount: 0` is an auto-suggestion, not a saving (update_food_cart description).
- Customised Food items: quantity changes must ask about add-ons rather than replicate them (update_food_cart description).
- Cart responses carry the live payment methods (`availablePaymentMethods`, `paymentOptions`) so the agent can surface them before ordering (reference).

## How the CLI applies it
- `instamart add` reads the cart and merges before calling `update_cart` (so "add one more" behaves naturally); `set-cart` exposes the raw replace. Food `add` records the restaurant so later calls don't need `--restaurant-id`. Views print "suggested · not applied" for zero-discount coupons.

## Relationships
- [instamart-server](../entities/instamart-server.md), [food-server](../entities/food-server.md), [scenes-server](../entities/scenes-server.md), [native-cli-feel](native-cli-feel.md).

## Changelog
- 2026-09-05 — created.
- 2026-11-11 — Scenes cart added. Superseded: "Food cart cap ₹1000 for Builders Club orders; Instamart minimum ₹99" as stated facts.
