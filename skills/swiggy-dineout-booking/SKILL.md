---
name: swiggy-dineout-booking
description: Find a restaurant, check table slots and book (free or paid deal) on Swiggy Dineout with swiggy-cli; also check a booking and handle a cancellation request. Use when the user says "book a table", "reserve", "is X free at 8pm", "cancel my reservation".
license: MIT
compatibility: Requires swiggy-cli 0.3.0 or later, signed in. Booking a paid deal spends money via UPI.
metadata:
  author: HKTITAN
  version: "0.3.0"
---

# swiggy-dineout-booking

```
search (coordinates) → details → slots → (cart, paid only) → book → status
```

Every Dineout call takes `latitude`/`longitude` for the city or area. The CLI remembers the ones from the last `search`/`details` and reuses them for `slots`, `cart` and `book`. Keep the steps in this order and the coordinates take care of themselves.

## 1. Search by coordinates

```bash
swiggy dineout search -q italian --lat 12.9716 --lng 77.5946 --json --no-interactive
swiggy dineout search -q rooftop --lat 12.9352 --lng 77.6245 --sort <sortKey> --json --no-interactive
```

- **Coordinates are required.** Since November 2026 Swiggy's Dineout search no longer accepts a saved address: `--address-id` exits 2. Pass `--lat/--lng` for the place the user named (Bangalore 12.9716,77.5946 · Koramangala 12.9352,77.6245 · Indiranagar 12.9784,77.6408 · Mumbai 19.0760,72.8777 · Delhi 28.6139,77.2090). If the profile has `defaultLat`/`defaultLng`, they are used when the flags are omitted.
- "Near me" with no place named → ask which city or area. Never guess a different city, and never ask the user to type coordinates.
- One term only (name, cuisine, area, "pub", "rooftop", "buffet"), with no location words when coordinates already cover the place. A dish becomes its cuisine ("dosa" → "South Indian").
- `--sort` takes a key from `data.availableSorts` of a previous search; facet ids from `data.availableFilters` go in `--input '{"filters":["<group:value>"]}'`. Copy both verbatim; never invent one.
- Empty results mean nothing matched: say so and offer another term; never present unrelated restaurants as matches.

## 2. Details (optional) and slots

```bash
swiggy dineout details <restaurantId> --json --no-interactive
swiggy dineout slots --restaurant-id <id> --date 2026-11-14 --json --no-interactive   # 7 days from the date
```

`data.slots[]` has `dateStr`, `displayTime`, `reservationTime`, `slotId`, and `deals[]` with `itemId`, `isFree`, `bookingPrice`. Match the user's date+time against `dateStr` + `displayTime` for THAT date; every 15-minute time inside a returned window is bookable. Trust the data: do not tell the user a listed time is unavailable. Surface both free and paid deals.

## 3. Confirm, then book

Ask: "Book <restaurant> for <n> guests on <date> at <time>, <free / ₹price deal>?" Wait for yes.

```bash
# Free deal (isFree=true): one step
swiggy dineout book --restaurant-id <id> --slot-id <slotId> --item-id <itemId> --reservation-time <reservationTime> --guests <n> --yes --json --no-interactive

# Paid prebook deal (isFree=false): cart first, then book with UPI
swiggy dineout cart --restaurant-id <id> --type DEAL_TICKET_PURCHASE --slot-id <slotId> --item-id <itemId> --reservation-time <reservationTime> --guests <n> --json --no-interactive
swiggy dineout book --restaurant-id <id> --slot-id <slotId> --item-id <itemId> --reservation-time <reservationTime> --guests <n> --cart-key <cartKey> --pay upi --wait --yes --json --no-interactive
```

Copy `slotId`, `itemId` (format `restaurantId-ticketId`) and `reservationTime` from the chosen slot exactly; never derive them from the display time. Guests must be 1–20. A paid booking returns `PENDING_PAYMENT`: that is not a booking yet; follow `swiggy-pay` (Dineout confirms with `orderId + paasId`). Swiggy Money does not apply to Dineout.

## 4. Status

```bash
swiggy dineout status <orderId> --json --no-interactive          # data.status, reservation details
```

## Cancelling

Swiggy removed `cancel_booking` from its published reference in November 2026. Tell the user: "Cancel it from the Swiggy Dineout app, or call Swiggy customer care at 080-67466729." Do not run `swiggy dineout cancel` unless the user insists and `swiggy tools dineout --json` still lists `cancel_booking` for their account; it is a legacy command and fails with `MCP_ERROR` otherwise. The same applies to `swiggy dineout locations` (for saved locations use `swiggy scenes locations`).

## Never

- Auto-call `details` or `slots` right after a search; let the user pick a restaurant first.
- Book without the explicit question in step 3.
- Retry `book` after an error. `book_table` is not de-duplicated. On exit 5 with `error.details.mayHavePlacedOrder: true`, ask the user to check their bookings in the Swiggy app; `status` needs the order id from the response that was lost.
