# Payments

Swiggy MCP added in-chat payments in July 2026 (<https://mcp.swiggy.com/builders/blog/2026-07-10-mcp-payments-upi/>) and announced **Swiggy Money on MCP** on 4 September 2026 (top up once, let the agent pay). The shared Payment stage is three tools that exist with the same shape on every server:

```
cart ready  ──► get_payment_options ──► place-order  ──► PENDING_PAYMENT  ──► check_payment_status ──► confirm_order ──► PLACED ──► track
                                       food: place_food_order · instamart: checkout · dineout: book_table (after create_cart for paid deals)
```

## `--pay` on checkout / book

| `--pay` | Sent upstream | Result |
| --- | --- | --- |
| `cash` / `cod` | `paymentMethod: "Cash"` | placed immediately; no payment leg |
| `upi` / `qr` | `paymentMethod: "UPI", generateUPIQR: true` | `PENDING_PAYMENT` + `bridgeUrl` (scan-or-tap page: QR on desktop, "open UPI app" on mobile) |
| `upi:<intentApp>` | `paymentMethod: "UPI", intentApp: "<id>"` | `PENDING_PAYMENT` + `bridgeUrl` / `upiIntentUrl`; `<id>` copied verbatim from `payment-options` |
| `swiggypay` / `swiggy-money` | `paymentMethod: "SwiggyPay"` | treated like Cash when the server offers the group; error otherwise |
| `<AnyGroup>` | `paymentMethod: "<AnyGroup>"` | pass-through for future method groups |
| (omitted) | nothing | the server's default (usually Cash when it is the only method) |

`swiggy <server> payment-options` lists what this cart can pay with and prints the matching `--pay` value next to each method. The CLI never invents a method.

## `--wait`

With `--wait`, `checkout`/`book` become one blocking command:

1. place the order (`PENDING_PAYMENT` → `paasId`, `orderId`, `bridgeUrl`, `pollingIntervalInMs`, `maxTimeToPollForInMs`);
2. print the pay link to stderr (clickable), keep stdout clean;
3. poll `check_payment_status` every `pollingIntervalInMs` (floored at 1 s — it is a ~19 s server long-poll; `--interval-ms` overrides down to 50 ms for tests) up to `maxTimeToPollForInMs` (`--max-wait-ms` overrides);
4. on `success` → `confirm_order` unless `confirmed: true` already; at the cap while still `pending` → `confirm_order` once (Swiggy marks it failed if unpaid; a late success reconciles server-side);
5. exit 0 with `data.status: "PLACED"` and `meta.payment.outcome: "confirmed"`, or exit **10** (`PAYMENT_FAILED`) with `meta.payment.outcome` ∈ `failed | cancelled | cart_changed | refund_initiated | timeout` and a hint.

Without `--wait`, the pending envelope carries `meta.payment.bridgeUrl` and `meta.payment.next` — the exact `payment-status --wait` command to resume with later.

## Per-server confirm contract

| Server | `check_payment_status` args | `confirm_order` args |
| --- | --- | --- |
| Food | `paasId, orderId, addressId, cartId, lat, lng` — echoed from `place_food_order`; without them the order cannot be reconciled and stays pending | `orderId, addressId, lat, lng` (+`cartId`); **no `paasId`** |
| Instamart | `paasId, orderId` | `orderId, paasId` (+`transactionId`) |
| Dineout | `paasId, orderId` | `orderId, paasId` (+`transactionId`) |

`src/lib/payments.ts` (`paymentStatusArgs`, `confirmArgs`) encodes this; `test/payments.test.ts` pins it.

## Status classification

`classifyPaymentStatus` reads `terminal`, `isTerminalSuccess`, `isTerminalFailure`, `confirmed` and `status`:

| status | class | CLI action |
| --- | --- | --- |
| `success` / `paid` | success | confirm if not already confirmed |
| `failed` | failed | never confirm; hint to re-run `payment-options` and place again |
| `cancelled` | cancelled | stop; refund is automatic |
| `cart_changed` | cart_changed | order NOT placed; review the cart and place again |
| `refund-initiated` | refund_initiated | stop |
| `pending` | pending | keep polling on cadence, confirm once at the cap |

## Rules the CLI enforces (from Swiggy's guidance)

- Never announce success on `PENDING_PAYMENT`; the human renderer prints "Payment pending" and the pay link.
- Never ask the user for a UPI ID / VPA (NPCI compliance) — the link handles it.
- Never tight-loop the long-poll.
- `confirm_order` is idempotent and never places an unpaid order; calling it after a terminal failure is skipped.
- Place-order tools are not idempotent: on a transport error the CLI does not retry; check `orders --active` first.

## Dineout paid deals

`swiggy dineout cart --type DEAL_TICKET_PURCHASE …` returns `cartKey`; `swiggy dineout book … --cart-key <key> --pay upi --wait` completes it. Free deals (`isFree: true`) book directly without a payment leg. Bill payment at the table uses `--type DINEOUT --bill-amount <₹>`.
