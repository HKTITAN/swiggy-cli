---
title: Dineout server
type: entity
updated: 2026-09-05
sources: [sources/swiggy-builders-docs, sources/upi-payments-blog]
tags: [dineout, server]
---
`POST https://mcp.swiggy.com/dineout` — restaurant discovery for eating out, deals, 7-day slot availability, free and paid table bookings, booking status and cancellation. 12 tools as of 2026-09-05.

## Details
| Stage | Tools |
| --- | --- |
| Find | `get_saved_locations`, `search_restaurants_dineout`, `get_restaurant_details` |
| Reserve | `get_available_slots`, `create_cart`, `book_table` |
| Payment | `get_payment_options`, `check_payment_status`, `confirm_order` |
| Manage | `get_booking_status`, `cancel_booking` |
| Support | `report_error` |

## Facts
- Coordinates are `latitude`/`longitude` (not `lat`/`lng`). `get_saved_locations` returns `locations[]{index, id, addressLine}` **without** coordinates; `search_restaurants_dineout` returns `latitude`/`longitude` in `data`; `get_restaurant_details` returns them as top-level fields outside `data` (reference, 2026-09-05).
- `search_restaurants_dineout { query, addressId | latitude+longitude, entityType?, limit? (≤30), offset? }` — query must be ONE term; docs give city coordinates (Bangalore 12.9716, 77.5946; Koramangala 12.9352, 77.6245; Indiranagar 12.9784, 77.6408; Mumbai 19.0760, 72.8777; Delhi 28.6139, 77.2090) (reference).
- `get_available_slots { restaurantId, date (YYYY-MM-DD or epoch), latitude, longitude }` → 7 days of `slots[]{slotId, displayTime, reservationTime, dateStr, isFree, deals[]{itemId ("restaurantId-ticketId"), slotId, isFree, bookingPrice, coverCharge}}` (reference).
- Free deal: `book_table { restaurantId, slotId, itemId, reservationTime, guestCount (1–20), latitude, longitude }` books directly. Paid deal: `create_cart { cartType:"DEAL_TICKET_PURCHASE", … }` → `cartKey`; then `book_table { …, paymentMethod:"UPI", intentApp | generateUPIQR, cartKey }` → `PENDING_PAYMENT`; confirm with `{ orderId, paasId }` (reference, pay-with-upi).
- `create_cart { cartType:"DINEOUT", billAmount, restaurantId, latitude, longitude }` is bill payment at the table (reference).
- Slot-matching rules in `book_table`'s description: judge the requested date by that date's window; every 15-minute time inside a window is bookable; `Confirm booking:` prefix means the UI already confirmed (reference).
- `get_booking_status { orderId }` → `status`, `canCancel`, reservation details. `cancel_booking { orderId, cancellationReason? }` — "not completely rolled out; may not appear in tools/list for every user" (reference).
- Bookings are not idempotent; check `get_booking_status` before retrying (ship-to-production).

## Relationships
- [payment-stage](payment-stage.md) for paid deals; [headless-payments](../concepts/headless-payments.md).
- CLI remembers coordinates from search/details for slots/cart/book: [native-cli-feel](../concepts/native-cli-feel.md).

## Contradictions & uncertainty
- The book-a-table recipe uses `lat`/`lng`, `guestCount` on `get_available_slots`, `bookingId` on `get_booking_status`, and says saved locations return coordinates. The reference contradicts all four; reference wins.

## Changelog
- 2026-09-05 — created.
