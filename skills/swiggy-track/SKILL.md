---
name: swiggy-track
description: List, inspect and live-track Swiggy Food and Instamart orders and Dineout bookings with swiggy-cli. Use when the user asks "where's my order", "what did I order", "is it delivered", "show my bookings".
license: MIT
compatibility: Requires swiggy-cli signed in.
metadata:
  author: HKTITAN
  version: "0.2.3"
---

# swiggy-track

All commands here are read-only. They are the right first move for any "my order/booking" question, and the required check before retrying a failed checkout.

## Commands

```bash
# history (Food needs an address; Instamart does not)
swiggy food orders --json --no-interactive               # add --active for in-progress only
swiggy instamart orders --count 10 --json --no-interactive

# one order
swiggy food order <orderId> --json --no-interactive
swiggy instamart order <orderId> --json --no-interactive

# live tracking
swiggy food track --json --no-interactive                # all active orders
swiggy food track <orderId> --json --no-interactive
swiggy instamart track <orderId> --lat <lat> --lng <lng> --json --no-interactive   # coordinates are REQUIRED upstream

# structured ETA for polling
swiggy food delivery-status <orderId> --json --no-interactive
swiggy instamart delivery-status <orderId> --json --no-interactive

# dineout
swiggy dineout status <orderId> --json --no-interactive
```

## Rules

1. **Poll no faster than every 10 seconds**, and use the interval the response gives you when present (`pollingIntervalSeconds` on `track`). Delivery-partner ETA updates arrive at that cadence; faster polling only spends rate budget.
2. **Stop polling on a terminal state** (`delivered`, `cancelled`, or `terminal: true` in `delivery-status`).
3. **Instamart `track` needs the delivery address coordinates.** Get `lat/lng` from the placed-order response or the address; without them tracking is inaccurate upstream, so the CLI requires them.
4. **Cancellations are not an API feature.** If the user wants to cancel a Food/Instamart order, say: "To cancel, call Swiggy customer care at 080-67466729." Do not call any tool. Dineout bookings can be cancelled — see `swiggy-dineout-booking`.
5. **After a failed checkout, look here before retrying.** `swiggy <server> orders --active --json`: if the order exists, the earlier failure was a success.

## What to report

From `track`: `status.statusMessage`, `status.etaText` (or `etaMinutes`), `deliveryInfo.fullAddress`, `items[]`. From `orders`: id, restaurant/store, total, status, placed time. Quote ETA text as given; do not compute your own.
