---
name: swiggy-dineout-booking
description: Find a restaurant, check table slots and book (free or paid deal) on Swiggy Dineout with swiggy-cli; also check or cancel a booking. Use when the user says "book a table", "reserve", "is X free at 8pm", "cancel my reservation".
license: MIT
compatibility: Requires swiggy-cli signed in. Booking a paid deal spends money via UPI.
metadata:
  author: HKTITAN
  version: "0.2.0"
---

# swiggy-dineout-booking

```
locations → search → details → slots → (cart, paid only) → book → status
```

Dineout tools take `latitude`/`longitude`. Saved locations do not expose coordinates, so the CLI captures them from the `search`/`details` response and reuses them for `slots`, `cart` and `book`. Keep the steps in this order and the coordinates take care of themselves.

## 1. Location, then search

```bash
swiggy dineout locations --json --no-interactive                  # "near me / home / office" → pick an id
swiggy dineout search -q italian --address-id <id> --json --no-interactive
swiggy dineout search -q rooftop --lat 12.9352 --lng 77.6245 --json --no-interactive   # named area
```

One term only (name, cuisine, area, "pub", "rooftop", "buffet"). A dish becomes its cuisine ("dosa" → "South Indian"). Empty results mean nothing matched: say so and offer another term; never present unrelated restaurants as matches.

## 2. Details (optional) and slots

```bash
swiggy dineout details <restaurantId> --json --no-interactive
swiggy dineout slots --restaurant-id <id> --date 2026-09-06 --json --no-interactive   # 7 days from the date
```

`data.slots[]` has `dateStr`, `displayTime`, `reservationTime`, `slotId`, and `deals[]` with `itemId`, `isFree`, `bookingPrice`. Match the user's date+time against `dateStr` + `displayTime` for THAT date; every 15-minute time inside a returned window is bookable. Trust the data — do not tell the user a listed time is unavailable.

## 3. Confirm, then book

Ask: "Book <restaurant> for <n> guests on <date> at <time>, <free / ₹price deal>?" Wait for yes.

```bash
# Free deal (isFree=true): one step
swiggy dineout book --restaurant-id <id> --slot-id <slotId> --item-id <itemId> --reservation-time <reservationTime> --guests <n> --yes --json --no-interactive

# Paid prebook deal (isFree=false): cart first, then book with UPI
swiggy dineout cart --restaurant-id <id> --type DEAL_TICKET_PURCHASE --slot-id <slotId> --item-id <itemId> --reservation-time <reservationTime> --guests <n> --json --no-interactive
swiggy dineout book --restaurant-id <id> --slot-id <slotId> --item-id <itemId> --reservation-time <reservationTime> --guests <n> --cart-key <cartKey> --pay upi --wait --yes --json --no-interactive
```

Copy `slotId`, `itemId` (format `restaurantId-ticketId`) and `reservationTime` from the chosen slot exactly; never derive them from the display time. Guests must be 1–20. A paid booking returns `PENDING_PAYMENT` — that is not a booking yet; follow `swiggy-pay` (Dineout confirms with `orderId + paasId`).

## 4. Status and cancel

```bash
swiggy dineout status <orderId> --json --no-interactive          # data.status, data.canCancel
swiggy dineout cancel <orderId> --reason "plan changed" --yes --json --no-interactive
```

Cancel only when the user clearly asked, and only with an `orderId` you have (from a booking in this conversation or from the user). `cancel_booking` is still rolling out; if it returns `MCP_ERROR`, direct the user to the Swiggy app or 080-67466729.

## Never

- Auto-call `details` or `slots` right after a search; let the user pick a restaurant first.
- Book without the explicit question in step 3.
- Retry `book` after an error; run `status` first — `book_table` is not idempotent.
