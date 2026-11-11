---
name: swiggy-mcp-dineout
description: Book restaurant tables through the Swiggy Dineout server (mcp.swiggy.com/dineout, 11 tools) by calling its tools directly (search by coordinates, details, slots, then a free booking or create_cart + book_table with UPI for a paid deal, then booking status). Use when an agent with Swiggy Dineout tools must find a place to eat out, check availability, reserve, or answer a cancellation request. Assumes the swiggy-mcp skill.
license: MIT
compatibility: Requires the Swiggy Dineout server connected and the user signed in.
metadata:
  author: HKTITAN
  version: "0.3.0"
  reference: https://mcp.swiggy.com/builders/docs/reference/dineout/
---

# swiggy-mcp-dineout

```
search_restaurants_dineout → (render_restaurants_dineout, widget hosts) → get_restaurant_details → get_available_slots
   → book_table (free)  |  create_cart → get_payment_options → book_table (UPI) → check_payment_status → confirm_order
   → get_booking_status
```

Dineout tools take `latitude`/`longitude` (not `lat`/`lng`). Reuse the exact values from the search for details, slots, cart and booking.

## Step rules

1. **Location is coordinates, always.** `search_restaurants_dineout` requires `latitude` + `longitude` for the city or area the user named; a saved `addressId` is no longer accepted and `get_saved_locations` is no longer a Dineout tool (November 2026). Bangalore 12.9716, 77.5946 · Koramangala 12.9352, 77.6245 · Indiranagar 12.9784, 77.6408 · Mumbai 19.0760, 72.8777 · Delhi 28.6139, 77.2090. "Near me" with no place named → ask which city or area; never substitute another city.
2. **`search_restaurants_dineout { query, latitude, longitude, limit?, offset?, filters?, sortKey?, entityType? }` with ONE term**: a name, cuisine, area, kind of place ("pub", "cafe") or vibe ("rooftop", "buffet", "live music"). A dish becomes its cuisine. No location words when the coordinates already cover the place. `filters` are ids from `availableFilters` and `sortKey` a key from `availableSorts` of a previous response, echoed verbatim; never invent one. Empty result → say nothing matched and offer another term; never present unrelated restaurants. Default 10 results, max 30; more via `offset`. **Let the user pick; do not auto-call details or slots.**
3. **`render_restaurants_dineout { restaurantIds, searches }` is for widget hosts only.** Call it once after searching, with the ids in display order and every search you ran (including its `filters` and `sortKey`); the server re-fetches and draws the cards. A text-only agent skips it.
4. **`get_restaurant_details { restaurantId, latitude, longitude }`** → deals, amenities, menu images, timings. Show deals before asking about slots.
5. **`get_available_slots { restaurantId, date, latitude, longitude }`**: `date` as `YYYY-MM-DD` (or epoch seconds); returns up to 7 days from that date. Match the user's date+time against `slots[].dateStr` + `displayTime` **for that date**; never judge a different date by today's summary. Every 15-minute time inside a returned window is bookable; trust the data. Surface both free and paid deals.
6. **Confirm before booking**, unless the user message starts with `Confirm booking:` (they already confirmed in the booking UI: book immediately, no summary). Otherwise state restaurant, date, time, guests (1–20) and free/₹price, and ask.
7. **Free deal (`isFree: true`):** `book_table { restaurantId, slotId, itemId, reservationTime, guestCount, latitude, longitude }`. Copy `slotId`, `itemId` (`restaurantId-ticketId`) and `reservationTime` from the chosen slot/deal exactly. One step; returns `orderId`.
8. **Paid prebook deal (`isFree: false`):** `create_cart { restaurantId, cartType: "DEAL_TICKET_PURCHASE", slotId, itemId, reservationTime, guestCount, latitude, longitude }` → shows a booking summary and **stops**. Only after the user chooses to pay: `get_payment_options`, then `book_table { …same slot fields…, paymentMethod: "UPI", intentApp | generateUPIQR: true, cartKey }`. It returns `PENDING_PAYMENT` → follow `swiggy-mcp-payments` (Dineout confirms with `orderId + paasId`). Swiggy Money does not apply to Dineout. Bill payment at the table uses `cartType: "DINEOUT"` with `billAmount`.
9. **`get_booking_status { orderId }`** → status and reservation details. Send the user the confirmation and the restaurant address.
10. **Cancellation: no tool.** `cancel_booking` is gone from the published reference. Say: "Cancel it from the Swiggy Dineout app, or call Swiggy customer care at 080-67466729." If `tools/list` still shows `cancel_booking` for this account, it is a leftover; use it only when the user clearly asks and confirms the `orderId`.

## Reading Dineout results

Dineout can omit `structuredContent` or send it empty. Then the first `content` text block is the JSON envelope `{ success, data, message }`, sometimes with `latitude`/`longitude` next to `data`. On an error the block can be a plain message, so check `isError` first.

## Failure → response

- Slot unavailable → refetch `get_available_slots` and offer alternatives.
- Restaurant not bookable → suggest walk-in or a Food order.
- Booking window closed → present the next available day.
- Network error or 5xx on `book_table` → **do not retry**. It is not de-duplicated and `get_booking_status` needs the `orderId` from the lost response; ask the user to check their bookings in the Swiggy app.

## Agent prompt

> You help users book tables on Swiggy Dineout. Get the city or area and use its coordinates, search with a single term, and let the user pick a restaurant. Always confirm date, time and party size before `book_table`. Paid deals need `create_cart` first and finish through UPI; never announce a paid booking as confirmed on a `PENDING_PAYMENT` response. To cancel, point the user to the Swiggy Dineout app or 080-67466729.
