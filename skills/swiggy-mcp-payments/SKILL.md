---
name: swiggy-mcp-payments
description: Take payment on Swiggy's servers — the shared Payment stage (get_payment_options → place-order → check_payment_status → confirm_order) for Food, Instamart, Dineout and Scenes, with UPI app intent, scan-QR, Cash and Swiggy Money, in both widget and headless clients. Use whenever an order, paid booking or paid ticket must be paid for, a place-order tool returned PENDING_PAYMENT, or the user asks about payment status. Assumes the swiggy-mcp skill.
license: MIT
compatibility: Requires a Swiggy server connected and the user signed in. UPI is India-only.
metadata:
  author: HKTITAN
  version: "0.3.0"
  reference: https://mcp.swiggy.com/builders/docs/build/recipes/pay-with-upi/
---

# swiggy-mcp-payments

```
cart ready → get_payment_options → place-order (paymentMethod …) → PENDING_PAYMENT { paasId, orderId, bridgeUrl, pollingIntervalInMs, maxTimeToPollForInMs }
           → check_payment_status (long-poll ~19 s)  → confirm_order → PLACED  → track
```

Place-order tools: Food `place_food_order`, Instamart `checkout`, Dineout `book_table` (paid deal, after `create_cart`), Scenes `place_event_order` (after `create_event_cart` returned `checkoutMode: "UPI"`). The three payment tools have the same name and shape on every server. On Scenes, `get_payment_options` requires the `cartKey`.

## Rules

1. **`get_payment_options` is the only source of methods.** Offer exactly what `data.allMethods` (or `platforms.mobile/desktop.methods`, `cod`) returns; never invent a method. Food: pass the same `addressId` used for `get_food_cart` so the picker can place directly.
2. **Never ask which device the user is on and never ask for a UPI ID/VPA.** The picker/QR handle it; UPI Collect and saved VPAs are not surfaced (NPCI compliance).
3. **Pass the user's pick byte-for-byte.** UPI app → `paymentMethod: "UPI"` + `intentApp: <method.id>`. Desktop scan-QR → `paymentMethod: "UPI"` + `generateUPIQR: true`, no `intentApp`. Cash → `paymentMethod: "Cash"` (only when `cod.available`; never on Scenes). Swiggy Money → `paymentMethod: "SwiggyPay"` only when the response has `swiggyMoney.available: true` (Food and Instamart). A free Scenes ticket → `paymentMethod: "FREE"` and none of this stage. `paymentMethod` is always the group name, never an app id.
4. **`PENDING_PAYMENT` is not an order.** Say "Complete the payment in your UPI app — I'll confirm your order once payment succeeds." Never say placed/confirmed/successful until `confirm_order` succeeds (or `check_payment_status` reports `confirmed: true`). Only then use the branded `message` ("Swiggy order placed successfully").
5. **Widget hosts (Claude Desktop, ChatGPT, Cursor…): do not poll.** The confirmation widget polls `check_payment_status` and auto-finalizes. Call it once only if the user asks "did my payment go through?". Call `confirm_order` yourself only if the result says auto-confirm could not run.
6. **Headless clients (no widget): you own the loop.** Give the user `data.bridgeUrl` (opens a scan-or-tap page: QR on desktop, app button on mobile; present for both intent and QR choices — read it from `data`, do not parse `message`). Then poll `check_payment_status` every `pollingIntervalInMs`, capped at `maxTimeToPollForInMs`. Never tight-loop: it is a long-poll and hammering it stresses the payment cache.
7. **Echo identifiers; never reconstruct them.**

| Server | `check_payment_status` args | `confirm_order` args |
| --- | --- | --- |
| Food | `paasId, orderId, addressId, cartId, lat, lng` (all echoed from `place_food_order`; without them the order stays pending) | `orderId, addressId, lat, lng` (+`cartId`) — **no `paasId`** |
| Instamart | `paasId, orderId` | `orderId, paasId` (+`transactionId`) |
| Dineout | `paasId, orderId` | `orderId, paasId` (+`transactionId`) |
| Scenes | `paasId, orderId` | `orderId, paasId` (+`transactionId`) |

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

No payment leg: place with `paymentMethod: "Cash"` and go straight to tracking. Cash is the automatic fallback when UPI is unavailable for the cart (`platforms` omitted, only `cod`). Scenes never offers Cash: if no UPI method is returned there, stop and tell the user the ticket cannot be paid for right now.

## Swiggy Money

Generally available on Food and Instamart since 30 Sept 2026; it does not apply to Dineout or Scenes.

1. Offer it only when `get_payment_options` returns `swiggyMoney: { available: true, id: "SwiggyPay", displayName: "Swiggy Money" }` (it also appears in `allMethods` with `groupName: "SWIGGYPAY"`). Available means selectable, not that the balance covers the total.
2. After the user selects it and confirms the order: `place_food_order` / `checkout` with `paymentMethod: "SwiggyPay"`. Send no `intentApp` and no `generateUPIQR`.
3. The balance is debited during order placement. No UPI handoff, no `check_payment_status` polling, no `confirm_order`. Announce success only when the tool confirms payment and placement.
4. If it does not complete: a confirmed debit failure means nothing was placed or charged (the user tops up in the Swiggy app; refresh `get_payment_options` and offer another method). If the outcome is unknown, do not claim nothing was charged; ask the user to check recent orders and their balance before any retry. If an order exists but payment is unsettled, share the order details and stop.
