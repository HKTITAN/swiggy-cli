---
title: Dineout server
type: entity
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/swiggy-builders-docs, sources/upi-payments-blog]
tags: [dineout, server]
---
`POST https://mcp.swiggy.com/dineout` — restaurant discovery for eating out, deals, 7-day slot availability, free and paid table bookings, booking status. 11 tools as of 2026-11-11 (12 on 2026-09-05).

## Details
| Stage | Tools |
| --- | --- |
| Find | `search_restaurants_dineout`, `render_restaurants_dineout`, `get_restaurant_details` |
| Reserve | `get_available_slots`, `create_cart`, `book_table` |
| Payment | `get_payment_options`, `check_payment_status`, `confirm_order` |
| Manage | `get_booking_status` |
| Support | `report_error` |

## Facts
- Coordinates are `latitude`/`longitude` (not `lat`/`lng`) and are the only location input. `get_saved_locations` is no longer a Dineout tool; it lives on [Scenes](scenes-server.md) (reference, 2026-11-11). `structuredContent` can be missing or empty; then `latitude`/`longitude` may sit next to `data` in the envelope (build/read-tool-results, 2026-11-11).
- `search_restaurants_dineout { query, latitude, longitude, entityType?, limit? (≤30), filters?, sortKey?, offset? }` — `latitude`/`longitude` are **required**; a saved `addressId` is no longer accepted. `filters` are ids from `availableFilters`, `sortKey` from `availableSorts` of a previous response. Query must be ONE term; docs give city coordinates (Bangalore 12.9716, 77.5946; Koramangala 12.9352, 77.6245; Indiranagar 12.9784, 77.6408; Mumbai 19.0760, 72.8777; Delhi 28.6139, 77.2090); "near me" with no place named → ask the user (reference, 2026-11-11).
- `render_restaurants_dineout { restaurantIds[], searches[] }` — documented since 2026-11-11: draws restaurant cards in widget hosts; the server replays the searches (pass the same `filters`/`sortKey`) (reference, 2026-11-11).
- `get_available_slots { restaurantId, date (YYYY-MM-DD or epoch), latitude, longitude }` → 7 days of `slots[]{slotId, displayTime, reservationTime, dateStr, isFree, deals[]{itemId ("restaurantId-ticketId"), slotId, isFree, bookingPrice, coverCharge}}` (reference).
- Free deal: `book_table { restaurantId, slotId, itemId, reservationTime, guestCount (1–20), latitude, longitude }` books directly. Paid deal: `create_cart { cartType:"DEAL_TICKET_PURCHASE", … }` → `cartKey`; then `book_table { …, paymentMethod:"UPI", intentApp | generateUPIQR, cartKey }` → `PENDING_PAYMENT`; confirm with `{ orderId, paasId }` (reference, pay-with-upi).
- `create_cart { cartType:"DINEOUT", billAmount, restaurantId, latitude, longitude }` is bill payment at the table (reference).
- Slot-matching rules in `book_table`'s description: judge the requested date by that date's window; every 15-minute time inside a window is bookable; `Confirm booking:` prefix means the UI already confirmed (reference).
- `get_booking_status { orderId }` → status and reservation details. Cancellation has no tool: `book_table` and `get_booking_status` tell the model to send the user to the Swiggy Dineout app or 080-67466729 (reference, 2026-11-11).
- `book_table` is not de-duplicated and takes no idempotency key. After a lost response `get_booking_status` cannot help (it needs the `orderId`), so the user must check the Swiggy app (build/ship-to-production, 2026-11-11).

## Relationships
- [payment-stage](payment-stage.md) for paid deals; [headless-payments](../concepts/headless-payments.md).
- CLI remembers coordinates from search/details for slots/cart/book: [native-cli-feel](../concepts/native-cli-feel.md).

## Observed 2026-09-05 (live capture)
- `cancel_booking` absent for this account (matches the docs' "not completely rolled out").
- **Undocumented tool `render_restaurants_dineout`** present: `{ restaurantIds: string[1..50] (display order ranked by user intent), searches: [{ query, latitude, longitude, entityType? }][1..5] }`; the server re-runs the searches to build rich restaurant cards for widget hosts. Call once after `search_restaurants_dineout` with the final curated order. Not in the 51-tool reference; reachable via `swiggy call dineout render_restaurants_dineout`.
- `book_table` accepts an undocumented optional `tidOverride` ("override transaction id from auth context").

## Contradictions & uncertainty
- The book-a-table recipe uses `lat`/`lng`, `guestCount` on `get_available_slots`, `bookingId` on `get_booking_status`, and says saved locations return coordinates. The reference contradicts all four; reference wins.

## Changelog
- 2026-09-05 — created.
- 2026-11-11 — November snapshot. Superseded: "12 tools"; "`get_saved_locations` returns `locations[]{index, id, addressLine}` without coordinates" (tool moved to Scenes); "`search_restaurants_dineout { query, addressId | latitude+longitude, … }`"; "`cancel_booking { orderId, cancellationReason? }` — not completely rolled out" (removed from the reference; swiggy-cli keeps `dineout cancel` and `dineout locations` as legacy); "`render_restaurants_dineout` undocumented".
