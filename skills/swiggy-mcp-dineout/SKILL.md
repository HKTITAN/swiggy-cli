---
name: swiggy-mcp-dineout
description: Book restaurant tables through the Swiggy Dineout MCP server (mcp.swiggy.com/dineout) — location → search → details → slots → book (free) or create_cart + book_table with UPI (paid deal) → status / cancel. Use when an agent with Swiggy Dineout tools must find a place to eat out, check availability, reserve, or cancel. Assumes the swiggy-mcp skill.
license: MIT
compatibility: Requires the Swiggy Dineout MCP server connected and the user signed in.
metadata:
  author: HKTITAN
  version: "0.2.3"
  reference: https://mcp.swiggy.com/builders/docs/reference/dineout/
---

# swiggy-mcp-dineout

```
get_saved_locations → search_restaurants_dineout → get_restaurant_details → get_available_slots
   → book_table (free)  |  create_cart → get_payment_options → book_table (UPI) → check_payment_status → confirm_order
   → get_booking_status → cancel_booking
```

Dineout tools take `latitude`/`longitude` (not `lat`/`lng`). Saved locations do not return coordinates; `search_restaurants_dineout` and `get_restaurant_details` do — reuse those exact values for slots, cart and booking.

## Step rules

1. **Location.** "Near me / home / office" → `get_saved_locations` → show the numbered list → ask which → pass its `id` as `addressId` to the search (coordinates resolve upstream). A named city/area → pass `latitude`/`longitude` (Bangalore 12.9716, 77.5946 · Koramangala 12.9352, 77.6245 · Indiranagar 12.9784, 77.6408 · Mumbai 19.0760, 72.8777 · Delhi 28.6139, 77.2090). Unknown place → ask; never substitute another city.
2. **`search_restaurants_dineout { query, addressId | latitude+longitude, limit?, offset? }` with ONE term** — a name, cuisine, area, kind of place ("pub", "cafe") or vibe ("rooftop", "buffet", "live music"). A dish becomes its cuisine. Do not add location words when coordinates are given. Empty result → say nothing matched and offer another term; never present unrelated restaurants. Default 10 results, max 30; more via `offset`. **Let the user pick; do not auto-call details or slots.**
3. **`get_restaurant_details { restaurantId, latitude, longitude }`** → deals (`offerCategory` prebooking/walkin, `coverCharge`, `discountPercentage`), amenities, menu images, timings. Show deals before asking about slots.
4. **`get_available_slots { restaurantId, date, latitude, longitude }`** — `date` as `YYYY-MM-DD` (or epoch seconds); returns 7 days from that date. Match the user's date+time against `slots[].dateStr` + `displayTime` **for that date** — never judge a different date by today's summary. Every 15-minute time inside a returned window is bookable; trust the data. Times are IST.
5. **Confirm before booking**, unless the user message starts with `Confirm booking:` (they already confirmed in the booking UI — book immediately, no summary). Otherwise state restaurant, date, time, guests (1–20) and free/₹price, and ask.
6. **Free deal (`isFree: true`):** `book_table { restaurantId, slotId, itemId, reservationTime, guestCount, latitude, longitude }` — copy `slotId`, `itemId` (`restaurantId-ticketId`) and `reservationTime` from the chosen slot/deal exactly. One step; returns `orderId`.
7. **Paid prebook deal (`isFree: false`):** `create_cart { restaurantId, cartType: "DEAL_TICKET_PURCHASE", slotId, itemId, reservationTime, guestCount, latitude, longitude }` → shows a booking summary and **stops**. Only after the user chooses to pay: `get_payment_options`, then `book_table { …same slot fields…, paymentMethod: "UPI", intentApp | generateUPIQR: true, cartKey }`. It returns `PENDING_PAYMENT` → follow `swiggy-mcp-payments` (Dineout confirms with `orderId + paasId`). Bill payment at the table uses `cartType: "DINEOUT"` with `billAmount`.
8. **`get_booking_status { orderId }`** → `status`, `canCancel`, reservation details. Send the user the confirmation and the restaurant address.
9. **`cancel_booking { orderId, cancellationReason? }`** only when the user clearly asks, only with an `orderId` from this conversation or from the user, and only after "Are you sure you want to cancel order <orderId>?". The tool is still rolling out; on `success: false` direct the user to the Swiggy app or 080-67466729.

## Failure → response

- Slot unavailable → refetch `get_available_slots` and offer alternatives.
- Restaurant not bookable → suggest walk-in or a Food order.
- Booking window closed → present the next available day.
- 5xx on `book_table` → `get_booking_status` before any retry (not idempotent).

## Agent prompt

> You help users book tables on Swiggy Dineout. Resolve location first (saved location or coordinates), search with a single term, and let the user pick a restaurant. Always confirm date, time and party size before `book_table`. Paid deals need `create_cart` first and finish through UPI; never announce a paid booking as confirmed on a `PENDING_PAYMENT` response.
