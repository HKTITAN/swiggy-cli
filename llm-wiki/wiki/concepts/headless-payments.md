---
title: Headless payments
type: concept
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/upi-payments-blog, sources/swiggy-builders-docs]
tags: [payments, upi, headless]
---
How a client with no widget (a CLI, a server-to-server agent) completes a UPI payment: present `allMethods` as text, place the order, hand the user the `bridgeUrl` (a hosted scan-or-tap page), poll `check_payment_status` on Swiggy's cadence, then `confirm_order`. Widget hosts do the last two automatically.

## How it works
1. `get_payment_options` (Food: pass the cart's `addressId`) → `allMethods[]` (+ `platforms`, `cod`). Offer only these; never ask device type or UPI ID (recipe pay-with-upi, 2026-09-05).
2. Place with `paymentMethod:"UPI"` and `intentApp:<method.id>` **or** `generateUPIQR:true` → `PENDING_PAYMENT` with `paasId`, `orderId`, `bridgeUrl`, `pollingIntervalInMs`, `maxTimeToPollForInMs`; Food also echoes `addressId`, `cartId`, `lat`, `lng` (reference).
3. Share `data.bridgeUrl` ("scan on desktop, tap on mobile"); the intent flow also relays it in `message`, the QR flow does not — read `data` (recipe).
4. Loop: `check_payment_status` (Food: echo `addressId/lat/lng` or the order cannot be reconciled) every `pollingIntervalInMs`, capped by `maxTimeToPollForInMs`; it is a ~19 s long-poll — never tight-loop (recipe, blog).
5. Branch: `success|paid` → `confirm_order` unless `confirmed` already; `failed` → don't confirm, re-offer methods; `cancelled` → stop (auto-refund); `cart_changed` → order not placed, review cart, place again; `refund-initiated` → stop; `pending` at cap → `confirm_order` once (backend marks failed if unpaid; late success reconciles) (recipe).
6. Confirm args differ per server: Food `orderId+addressId+lat+lng`; Instamart/Dineout/Scenes `orderId+paasId` (recipe "per-server contract", 2026-11-11).
7. Cash: no payment leg; place with `paymentMethod:"Cash"` and track. Never offered on Scenes: if no UPI method is returned there, stop (recipe, 2026-11-11).
8. Swiggy Money (Food, Instamart): `paymentMethod:"SwiggyPay"` when `swiggyMoney.available`; completes inside the place-order call, so there is no link, no poll and no confirm ([swiggy-money](../entities/swiggy-money.md)).
9. Scenes: `create_event_cart` decides. `checkoutMode: FREE` → `place_event_order` with `paymentMethod:"FREE"` and the selection echoed, no payment tools. `UPI` → `get_payment_options { cartKey }` then steps 2–6. `UNAVAILABLE` → stop ([scenes-server](../entities/scenes-server.md)).

## How the CLI applies it
`--pay upi [--wait]` on `food checkout`, `instamart checkout`, `dineout book` and `scenes book`: prints the link to stderr, polls with a floor of 1 s on Swiggy's interval, confirms with the right contract, exits 0 only on `PLACED`, else 10 with `meta.payment.outcome`. Two-step alternative: the pending envelope carries `meta.payment.next` (the exact `payment-status --wait` command). `scenes book` refuses `--pay cash`, refuses `--pay` on a free cart and refuses an `UNAVAILABLE` cart. Pure logic in `src/lib/payments.ts`, tested with a virtual clock.

## Relationships
- [payment-stage](../entities/payment-stage.md), [swiggy-money](../entities/swiggy-money.md), [rate-limits-and-sessions](rate-limits-and-sessions.md).

## Changelog
- 2026-09-05 — created.
- 2026-11-11 — Scenes, Swiggy Money. Superseded: "Instamart/Dineout `orderId+paasId`" as the full list of `paasId` servers.
