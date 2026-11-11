---
title: Scenes server
type: entity
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11]
tags: [scenes, events, tickets, server]
---
`POST https://mcp.swiggy.com/scenes` — events, shows and live performances at Dineout restaurants and standalone venues: discovery, show schedules, seat availability, ticket carts, free and UPI bookings, booking status. 15 tools as of 2026-11-11. It is the fourth Swiggy server; it did not exist in the 2026-09-05 snapshot.

## Details
| Stage | Tools |
| --- | --- |
| Discover | `get_saved_locations`, `discover_events`, `search_events`, `get_events_collection`, `get_event_details`, `get_event_venue_info` |
| Tickets | `list_event_shows`, `create_event_cart`, `get_event_cart` |
| Payment | `get_payment_options`, `check_payment_status`, `confirm_order` |
| Booking | `place_event_order`, `get_event_booking_status` |
| Support | `report_error` |

The booking path is fixed: `discover_events | search_events | get_events_collection` → `get_event_details` → `list_event_shows` → `create_event_cart` → `place_event_order` → `get_event_booking_status` (reference/scenes, 2026-11-11).

## Facts
- Location: `discover_events` needs `latitude` + `longitude` **or** an `addressId` from `get_saved_locations`; `search_events` and `get_events_collection` take either optionally. `get_saved_locations` returns `locations[]{index, id, addressLine, phoneNumber, addressCategory?, addressTag?}` without coordinates (reference, 2026-11-11).
- Discovery responses echo the resolved `latitude`/`longitude` next to `data` in the JSON envelope and in a `Location context: latitude=…, longitude=…` line in `content`; they are **not** in `structuredContent`. Swiggy asks clients to reuse exactly those coordinates on every follow-up call (reference/scenes/discover_events, build/read-tool-results, 2026-11-11).
- `discover_events` → `events[]{eventId, eventName, venueName, area, date, price}` + `collectionChips[]{collectionIdentifier, label}`. Genre queries go chip → `get_events_collection { collectionIdentifier }`. `search_events { query }` is auto-suggest for ONE named artist or title, at most 4 `suggestions[]{eventId, eventName, location}` (reference, 2026-11-11).
- `get_event_details { eventId, latitude?, longitude? }` is the only source of `venueId` (also returns `venueName`, `area`, `formattedAddress`, `venueLat`/`venueLng` as strings, `upcomingDate`, `price`) (reference, 2026-11-11).
- `list_event_shows { eventId, venueId?, showStartTime?, showEndTime?, … }` → `eventShowListing.dateGroupedEventShow[].eventShow[]{showId, show_time_unix, show_time_ist, availableSeats, tickets[]{ticketId, ticketTitle, price}}`. Without `venueId` the listing spans venues and "is not safe to book from". Show window ≤ 5 days, ≤ 100 shows; date-summary window ≤ 30 days. Started shows are removed (reference, 2026-11-11).
- `create_event_cart { venueId, showId, ticketId, showTime, guestCount (1–20), latitude, longitude }`: `showTime` must be `show_time_unix` unchanged. Returns `cartKey` and `checkoutMode: "FREE" | "UPI" | "UNAVAILABLE"`, plus `cart.bill.billToPay` / `skipPayment`. A sold-out show is a non-retryable error (reference, 2026-11-11).
- `place_event_order { cartKey, paymentMethod: "UPI" | "FREE", intentApp?, generateUPIQR?, …selection echo for FREE }`. FREE: echo `venueId, showId, ticketId, showTime, guestCount, latitude, longitude`; the cart is recreated and repriced and checks out only if still free; `status` is `CONFIRMED` or `PROCESSING`. UPI: `PENDING_PAYMENT` with `paasId`, `transactionId`, `upiIntentUrl`, `bridgeUrl?`, `isQrFlow`, `pollingIntervalInMs`, `maxTimeToPollForInMs` (reference, 2026-11-11).
- Payment: `get_payment_options { cartKey }` (required on Scenes); confirm with `orderId + paasId`. **Cash is never offered on Scenes**; Swiggy Money "does not apply to Dineout or Scenes" (reference; pay-with-upi recipe; Swiggy Money blog 2026-09-30).
- `get_event_booking_status { orderId }` returns the confirmation under **`booking`**, not `data`: `{orderId, restaurantId, restaurantName (the venue), restaurantLocation?, reservationDate, reservationTime, guestCount, dealTitle, status, bill?}`. `status: PROCESSING` is not final (reference, 2026-11-11).
- `get_event_cart { cartKey, latitude, longitude }` is a compatibility lookup; the normal flow skips it and a FREE cart cannot be read back. `get_event_venue_info` is for browsing venues, not booking (reference, 2026-11-11).
- `place_event_order` is not de-duplicated and takes no idempotency key; after a lost response `get_event_booking_status` cannot help because it needs the `orderId`, so the user must check the Swiggy app (build/ship-to-production, 2026-11-11).
- `structuredContent` can be missing or empty on Scenes; then the envelope is in the first `content` block (build/read-tool-results, 2026-11-11).
- Widgets: flagged `hasWidgets: true` (build/widgets, 2026-11-11).

## How the CLI covers it (0.3.0)
`swiggy scenes` (alias `events`): `locations`, `discover`, `search <name>`, `collection <chip>`, `details <event>`, `venue <event>`, `shows [event]` (fetches `get_event_details` itself when the venue is unknown), `cart --show <#> --guests <n>`, `show-cart`, `book [--pay upi --wait]`, `status <order>`, plus the shared `payment-options`, `payment-status`, `confirm-order`, `report-error`. Resolved coordinates are cached in `~/.swiggy/cache/scenes-coords.json`; the ticket cart and its selection in `scenes-cart.json` for 30 minutes. `book` sends `paymentMethod: "FREE"` with the selection echo for a free cart, requires `--pay upi` for a paid one and rejects `--pay cash` (repo `src/commands/scenes.ts`, `test/scenes.test.ts`, 2026-11-11).

## Relationships
- Platform: [swiggy-mcp](swiggy-mcp.md). Payment flow: [payment-stage](payment-stage.md), [headless-payments](../concepts/headless-payments.md).
- Took over `get_saved_locations` from [dineout-server](dineout-server.md); venues overlap with Dineout restaurants (booking fields reuse `restaurantName`, `reservationTime`).
- Result shape quirks: [error-taxonomy](../concepts/error-taxonomy.md). CLI: [swiggy-cli](swiggy-cli.md).

## Contradictions & uncertainty
- No live capture of Scenes is filed under `raw/`; everything here is from the reference and the CLI's mock-server tests. Whether `Mcp-Session-Id` is issued, real `content` shapes and real `checkoutMode` behaviour are unobserved ([open-questions](../synthesis/open-questions.md)).
- Brand guidelines give no "Powered by …" line for Scenes.

## Changelog
- 2026-11-11 — created from the November docs snapshot.
