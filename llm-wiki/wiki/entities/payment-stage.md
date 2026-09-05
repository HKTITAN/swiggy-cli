---
title: Payment stage
type: entity
updated: 2026-09-05
sources: [sources/upi-payments-blog, sources/swiggy-builders-docs, sources/swiggy-money-tweet]
tags: [payments, upi]
---
Three tools that exist with the same name and shape on all three servers — `get_payment_options`, `check_payment_status`, `confirm_order` — plus each server's place-order tool. Introduced with in-chat UPI payments on 2026-07-10; extended by Swiggy Money on 2026-09-04.

## Details
| Server | Place-order | UPI args | `confirm_order` args |
| --- | --- | --- | --- |
| Food | `place_food_order` | `addressId, paymentMethod:"UPI", intentApp \| generateUPIQR` | `orderId, addressId, lat, lng` (+`cartId`) |
| Instamart | `checkout` | `paymentMethod:"UPI", intentApp \| generateUPIQR` | `orderId, paasId` (+`transactionId`) |
| Dineout | `book_table` (after `create_cart`) | `cartKey, paymentMethod:"UPI", intentApp \| generateUPIQR` | `orderId, paasId` (+`transactionId`) |

## Facts
- `get_payment_options { addressId? (Food) }` → `platforms.mobile.methods[]` (UPI apps, `kind:"intent"`), `platforms.desktop.methods[]` (`kind:"qr"`), `cod{available,id,displayName}`, `allMethods[]`, `paymentAmount`, `placeOrderToolName` (reference, 2026-09-05). Only returned methods may be offered.
- UPI place-order returns `PENDING_PAYMENT` with `paasId`, `orderId`, `transactionId`, `bridgeUrl` (scan-or-tap page; present for intent **and** QR), `upiIntentUrl`, `isQrFlow`, `pollingIntervalInMs`, `maxTimeToPollForInMs` (reference).
- `check_payment_status { paasId, orderId?, +Food echo }` is a ~19 s long-poll; returns `status`, `terminal`, `isTerminalSuccess`, `isTerminalFailure`, `confirmed` (reference). Statuses: `success|paid`, `failed`, `cancelled`, `cart_changed`, `refund-initiated`, `pending` (pay-with-upi recipe).
- `confirm_order` is idempotent and never places an unpaid order; at the polling cap a still-pending order is marked failed and a late success reconciles server-side (blog 2026-07-10).
- Widget hosts auto-poll and auto-confirm; headless clients own the loop (recipe "Non-UI (headless) clients").
- NPCI: never ask for a UPI ID/VPA; Collect and saved VPAs are not surfaced (blog).
- `paymentMethod` groups documented: `"UPI"`, `"Cash"`/`"COD"`, `"SwiggyPay"` (Instamart `checkout` reference).

## Relationships
- Mechanics for CLI/agents: [headless-payments](../concepts/headless-payments.md).
- Wallet: [swiggy-money](swiggy-money.md).
- Servers: [food-server](food-server.md), [instamart-server](instamart-server.md), [dineout-server](dineout-server.md).

## Contradictions & uncertainty
- Food `confirm_order` reference table lists `paasId` as optional "IM/Dineout only"; the Instamart page's copy of the same table says `paasId` "yes for IM/Dineout". Consistent in effect.

## Changelog
- 2026-09-05 — created.
