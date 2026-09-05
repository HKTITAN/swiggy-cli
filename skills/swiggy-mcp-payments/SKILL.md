---
name: swiggy-mcp-payments
description: Take payment on Swiggy MCP — the shared Payment stage (get_payment_options → place-order → check_payment_status → confirm_order) for Food, Instamart and Dineout, with UPI app intent, scan-QR, Cash and Swiggy Money, in both widget and headless clients. Use whenever an order or paid booking must be paid for, a place-order tool returned PENDING_PAYMENT, or the user asks about payment status. Assumes the swiggy-mcp skill.
license: MIT
compatibility: Requires a Swiggy MCP server connected and the user signed in. UPI is India-only.
metadata:
  author: HKTITAN
  version: "0.2.1"
  reference: https://mcp.swiggy.com/builders/docs/build/recipes/pay-with-upi/
---

# swiggy-mcp-payments

```
cart ready → get_payment_options → place-order (paymentMethod …) → PENDING_PAYMENT { paasId, orderId, bridgeUrl, pollingIntervalInMs, maxTimeToPollForInMs }
           → check_payment_status (long-poll ~19 s)  → confirm_order → PLACED  → track
```

Place-order tools: Food `place_food_order`, Instamart `checkout`, Dineout `book_table` (paid deal, after `create_cart`). The three payment tools have the same name and shape on every server.

## Rules

1. **`get_payment_options` is the only source of methods.** Offer exactly what `data.allMethods` (or `platforms.mobile/desktop.methods`, `cod`) returns; never invent a method. Food: pass the same `addressId` used for `get_food_cart` so the picker can place directly.
2. **Never ask which device the user is on and never ask for a UPI ID/VPA.** The picker/QR handle it; UPI Collect and saved VPAs are not surfaced (NPCI compliance).
3. **Pass the user's pick byte-for-byte.** UPI app → `paymentMethod: "UPI"` + `intentApp: <method.id>`. Desktop scan-QR → `paymentMethod: "UPI"` + `generateUPIQR: true`, no `intentApp`. Cash → `paymentMethod: "Cash"` (only when `cod.available`). Swiggy Money → `paymentMethod: "SwiggyPay"` only if a method with that group is returned. `paymentMethod` is always the group name, never an app id.
4. **`PENDING_PAYMENT` is not an order.** Say "Complete the payment in your UPI app — I'll confirm your order once payment succeeds." Never say placed/confirmed/successful until `confirm_order` succeeds (or `check_payment_status` reports `confirmed: true`). Only then use the branded `message` ("Swiggy order placed successfully").
5. **Widget hosts (Claude Desktop, ChatGPT, Cursor…): do not poll.** The confirmation widget polls `check_payment_status` and auto-finalizes. Call it once only if the user asks "did my payment go through?". Call `confirm_order` yourself only if the result says auto-confirm could not run.
6. **Headless clients (no widget): you own the loop.** Give the user `data.bridgeUrl` (opens a scan-or-tap page: QR on desktop, app button on mobile; present for both intent and QR choices — read it from `data`, do not parse `message`). Then poll `check_payment_status` every `pollingIntervalInMs`, capped at `maxTimeToPollForInMs`. Never tight-loop: it is a long-poll and hammering it stresses the payment cache.
7. **Echo identifiers; never reconstruct them.**

| Server | `check_payment_status` args | `confirm_order` args |
| --- | --- | --- |
| Food | `paasId, orderId, addressId, cartId, lat, lng` (all echoed from `place_food_order`; without them the order stays pending) | `orderId, addressId, lat, lng` (+`cartId`) — **no `paasId`** |
| Instamart | `paasId, orderId` | `orderId, paasId` (+`transactionId`) |
| Dineout | `paasId, orderId` | `orderId, paasId` (+`transactionId`) |

`paasId` is the payment transaction id from the place-order response — never `"UPI"`, `"PayWithQR"` or an app id. If you do not have a real `paasId`, do not call the tool.

## Branch on `check_payment_status.data`

| `status` / flags | Then |
| --- | --- |
| `success` / `paid` (`isTerminalSuccess`) | if `confirmed` is true → done; else `confirm_order` once |
| `failed` (`isTerminalFailure`) | **do not confirm**; re-show `get_payment_options` and place again (fresh transaction, same cart) |
| `cancelled` | order cancelled; any debit is refunded; do not retry on your own |
| `cart_changed` | not a payment failure: price/stock changed, order NOT placed; review the cart with the user, then place again |
| `refund-initiated` | debited and refund underway; tell the user; stop |
| `pending`, `terminal: false` | keep waiting on the cadence; at the cap call `confirm_order` once (backend marks it failed if still unpaid; a late success reconciles server-side) |

`confirm_order` is idempotent and never places an unpaid order; a duplicate call is harmless, a call after a terminal failure is pointless.

## Cash

No payment leg: place with `paymentMethod: "Cash"` and go straight to tracking. Cash is the automatic fallback when UPI is unavailable for the cart (`platforms` omitted, only `cod`).

## Swiggy Money

Announced for MCP on 4 Sept 2026: the user adds money once and the agent pays without a per-order payment step. It surfaces as a `SwiggyPay` group in `get_payment_options` when enabled for the account and cart; treat it like Cash (no pending leg) and never pass it when it is not listed.
