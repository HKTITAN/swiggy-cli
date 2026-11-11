---
name: swiggy-checkout
description: Place a Swiggy Food or Instamart order with swiggy-cli, choosing Cash, UPI or Swiggy Money and getting explicit consent first. Use only when the user has said to place/confirm the order — never as an automatic continuation of adding to cart.
license: MIT
compatibility: Requires swiggy-cli signed in. Places real orders that cost real money.
metadata:
  author: HKTITAN
  version: "0.3.0"
---

# swiggy-checkout

`checkout` calls `place_food_order` / `checkout` upstream. Orders cannot be cancelled through the API (Swiggy customer care: 080-67466729), and Swiggy does not de-duplicate order placement, so this skill is strict about consent and about retries. Table bookings and event tickets have their own skills (`swiggy-dineout-booking`, `swiggy-scenes`).

## Pre-flight (all three, every time)

1. `swiggy <server> cart --json --no-interactive` — read the live cart. Show items, quantities and the payable total.
2. Confirm the delivery address by text (`swiggy <server> addresses --json` → `addressLine`). "Delivering to: <addressLine>."
3. Ask one direct question: "Place this order for ₹<total> to <address>, paying by <method>?" Wait for an explicit yes. "Go ahead" after a search is not consent to spend money; "yes, place it" is.

## Payment decision

```
Did the user name a method?
├── "cash" / "COD"                        → --pay cash
├── "UPI" / "GPay" / "PhonePe" / "Paytm"  → is a specific app id in payment-options?
│      ├── yes                            → --pay upi:<id copied exactly>
│      └── no / desktop / unknown device  → --pay upi          (scan-or-tap link works everywhere)
├── "Swiggy Money" / "wallet"             → run payment-options; use --pay swiggypay ONLY if the server lists it
└── nothing                               → run payment-options and show the list; do not pick for them
```

`swiggy <server> payment-options --json` is the source of truth: offer only methods it returns. Never ask the user for a UPI ID/VPA (not supported, NPCI rule).

Swiggy Money (Food and Instamart): offer it only when `payment-options` lists it (`data.swiggyMoney.available: true`). That means it can be chosen, not that the balance covers the order. `--pay swiggypay` debits the balance during order placement: no pay link, no polling, no confirm step.

## Run

```bash
# Cash: order is placed immediately, no payment leg
swiggy food checkout --pay cash --yes --json --no-interactive
swiggy instamart checkout --pay cash --yes --json --no-interactive

# UPI: one command that places, shares the pay link, polls and confirms (blocks up to Swiggy's cap, ~5 min)
swiggy food checkout --pay upi --wait --yes --json --no-interactive
# UPI in two steps (agent hands the link over, resumes later) — see swiggy-pay
swiggy food checkout --pay upi --yes --json --no-interactive
# Swiggy Money, only when payment-options offered it
swiggy instamart checkout --pay swiggypay --yes --json --no-interactive
```

`--note "<text>"` (Food only) sends a note to the restaurant, e.g. "less spicy". It is not for delivery instructions.

## Read the result

- `meta.payment.pending === false` and `data.status` `CONFIRMED`/`PLACED` → placed. Quote `meta.message` verbatim (it carries Swiggy branding) and save `data.orderId`.
- `meta.payment.pending === true` → **not placed yet.** Say "Complete the payment in your UPI app, I'll confirm once it succeeds", give `meta.payment.bridgeUrl`, then follow `swiggy-pay` using `meta.payment.next`.
- exit 10 `PAYMENT_FAILED` → read `error.hint`; do not call checkout again blindly.
- exit 6 `MCP_ERROR` → surface `error.message`; then run `swiggy <server> orders --active --json` before any retry, because a 5xx may have placed the order anyway. If a Swiggy Money payment failed, do not say "nothing was charged" unless the message says so; ask the user to check recent orders and their balance in the Swiggy app.
- exit 5 `NETWORK` with `error.details.mayHavePlacedOrder: true` → the request may have reached Swiggy. Do not run checkout again. Run `swiggy <server> orders --json` (Instamart: check every store; a multi-store checkout places one order per store and can partly succeed). Place again only if the order is not there and the user agrees.

## Never

- Add `--yes` without the question in Pre-flight step 3 being answered "yes" in this conversation.
- Call checkout twice for the same cart.
- Announce success on a `PENDING_PAYMENT` response.
- Substitute another address if the one the user named is missing; ask.
