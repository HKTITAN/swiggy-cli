---
name: swiggy-pay
description: Complete an in-flight Swiggy UPI payment with swiggy-cli — share the pay link, poll payment status on Swiggy's cadence, confirm the order, handle failure/refund/timeout. Use after a checkout or booking returned PENDING_PAYMENT, or when the user asks "did my payment go through".
license: MIT
compatibility: Requires swiggy-cli signed in and the paasId/orderId from the place-order response.
metadata:
  author: HKTITAN
  version: "0.2.4"
---

# swiggy-pay

A UPI order is created in `PENDING_PAYMENT` and becomes `PLACED` only after payment succeeds and `confirm_order` runs. The CLI does the whole loop for you; your job is to hand the user the link and report the terminal state truthfully.

## The one command

```bash
swiggy <server> payment-status --paas-id <paasId> --order-id <orderId> --wait --json --no-interactive
# Food additionally REQUIRES the echo values from the place-order response:
swiggy food payment-status --paas-id <paasId> --order-id <orderId> --address-id <addressId> --lat <lat> --lng <lng> --wait --json --no-interactive
```

`meta.payment.next` on the pending checkout response is this exact command — copy it. Without `addressId/lat/lng`, Swiggy cannot reconcile a Food order and it stays pending forever.

`--wait` polls `check_payment_status` every `pollingIntervalInMs` (a ~19 s server long-poll) up to `maxTimeToPollForInMs`, then calls `confirm_order` once on success (or once at the cap). It blocks; that is intended. Never poll faster than the server's interval by hand — it stresses Swiggy's payment cache and buys nothing.

## Before waiting

Give the user `meta.payment.bridgeUrl` from the checkout response: "Pay here — scan on desktop, tap on mobile: <url>". That link renders a QR plus an "open in UPI app" button, so you never need the device type or a UPI ID.

## Outcomes (exit code → say)

| exit | `meta.payment.outcome` | tell the user |
| ---: | --- | --- |
| 0 | `confirmed` | order placed; quote `meta.message`; hand off to `swiggy-track` |
| 10 | `failed` | payment failed, nothing charged; offer to retry: `swiggy <server> payment-options` then checkout again (fresh transaction, same cart) |
| 10 | `cancelled` | order cancelled; any debit is refunded automatically; do not retry on your own |
| 10 | `cart_changed` | price/stock changed so the order was NOT placed; re-read the cart with the user, then place again |
| 10 | `refund_initiated` | money was debited and a refund is already underway; stop |
| 10 | `timeout` | still pending at the cap; `confirm_order` was called once; a late success reconciles on Swiggy's side — check `swiggy <server> orders --active` before doing anything else |

## One-shot status (no wait)

`swiggy <server> payment-status --paas-id <paasId> --json` returns `data.status`, `data.terminal`, `data.confirmed`. Use it once when the user asks "did it go through?", not in a loop.

## Manual confirm (rare)

Only if `--wait` reported success but `data.confirmed` is false and no confirm ran:

```bash
swiggy food confirm-order --order-id <o> --address-id <a> --lat <lat> --lng <lng> --json --no-interactive
swiggy instamart confirm-order --order-id <o> --paas-id <p> --json --no-interactive
swiggy dineout confirm-order --order-id <o> --paas-id <p> --json --no-interactive
```

Food confirms by address + coordinates and never takes `paasId`; Instamart and Dineout confirm by `paasId`. `confirm_order` is idempotent and never places an unpaid order, so a duplicate call is harmless; confirming after a terminal failure is pointless — skip it.

## Swiggy Money

Swiggy announced Swiggy Money on MCP (Sept 2026): the user tops up once and the agent pays without a payment step per order. It appears as a payment-method group from `payment-options` (`SwiggyPay`). If listed, `--pay swiggypay` places the order with no pending leg; if not listed for this cart, do not pass it.
