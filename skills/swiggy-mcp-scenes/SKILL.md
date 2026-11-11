---
name: swiggy-mcp-scenes
description: Find events and book tickets through the Swiggy Scenes server (mcp.swiggy.com/scenes, 15 tools) by calling its tools directly (location, discover or search, event details, show listing, ticket cart, then a free booking or a UPI payment, then booking status). Use when an agent with Swiggy Scenes tools must find events, shows or gigs, check show times and seats, or book and confirm tickets. Assumes the swiggy-mcp skill.
license: MIT
compatibility: Requires the Swiggy Scenes server connected and the user signed in.
metadata:
  author: HKTITAN
  version: "0.3.0"
  reference: https://mcp.swiggy.com/builders/docs/reference/scenes/
---

# swiggy-mcp-scenes

```
get_saved_locations → discover_events | search_events | get_events_collection → get_event_details → list_event_shows
   → create_event_cart → checkoutMode FREE: place_event_order (FREE)
                         checkoutMode UPI:  get_payment_options → place_event_order (UPI) → check_payment_status → confirm_order
   → get_event_booking_status
```

Scenes tools take `latitude`/`longitude` (not `lat`/`lng`). Every parameter is in the `swiggy-mcp` skill's `references/tools.md`.

## Step rules

1. **Location first.** `discover_events` needs `latitude` + `longitude`, or an `addressId` from `get_saved_locations` ("near my home/office": show the list, ask which, pass its `id`). Neither available → ask for a city or area. Never substitute another city.
2. **Reuse the coordinates Swiggy resolved.** Discovery responses echo `latitude` and `longitude` next to `data` in the JSON envelope and in a `Location context: latitude=…, longitude=…` line in `content`. They are not in `structuredContent`. Read them and pass exactly those values to every follow-up Scenes call, so venue and price context match.
3. **Pick the finder by intent.** Genre or open browsing ("comedy shows", "what's on this weekend") → `discover_events`, then `get_events_collection { collectionIdentifier }` with the chip from `collectionChips[]` whose `label` matches. A named artist or exact title → `search_events { query }`: auto-suggest, at most 4 `suggestions[]`. Never use `search_events` for a genre. Empty suggestions → say so and offer `discover_events`; do not retry the same query.
4. **`get_event_details { eventId, latitude, longitude }` before any show listing.** It is the only tool that returns `venueId`. `venueLat`/`venueLng` describe the venue, not the user; keep passing the user's coordinates.
5. **`list_event_shows { eventId, venueId, latitude, longitude }`.** Without `venueId` the listing spans venues and is not safe to book from. Show `show_time_ist` to the user verbatim. Shows that already started are removed, so an empty result means nothing is left in the window (`showStartTime`/`showEndTime`, at most 5 days, 100 shows). Skip `get_event_venue_info`; it is for browsing venues, not booking.
6. **`create_event_cart { venueId, showId, ticketId, showTime, guestCount, latitude, longitude }`** only after the user picked a show, a ticket type and a guest count (1–20). `showTime` is `show_time_unix` from the chosen show, **exactly as returned**. Converting the ISO time yourself produces a wrong value and the booking fails. A sold-out show returns a non-retryable error: show the message and offer another show.
7. **Branch on `checkoutMode`. Show the cart summary and get an explicit yes in every branch.**

| `checkoutMode` | Then |
| --- | --- |
| `FREE` | `place_event_order { cartKey, paymentMethod: "FREE", venueId, showId, ticketId, showTime, guestCount, latitude, longitude }`. Echo the whole selection; Swiggy recreates and reprices the cart and books only if it is still free. No payment tools, no `get_event_cart` (a free cart cannot be read back) |
| `UPI` | `get_payment_options { cartKey }` → user picks → `place_event_order { cartKey, paymentMethod: "UPI", intentApp: <method.id> }` or `{ cartKey, paymentMethod: "UPI", generateUPIQR: true }` → `PENDING_PAYMENT` → follow `swiggy-mcp-payments` (Scenes confirms with `orderId + paasId`) |
| `UNAVAILABLE` | stop; say the selection cannot be booked and offer another show |

8. **No Cash, no Swiggy Money on Scenes.** If `get_payment_options` offers no UPI method, tell the user the ticket cannot be paid for right now. Never invent a method.
9. **`get_event_booking_status { orderId }` returns `booking`, not `data`.** A client that reads only `data` sees nothing. `booking.status` `PROCESSING` means not final: wait and check again. `restaurantName`/`restaurantLocation` are the venue; `reservationDate`, `reservationTime`, `guestCount` are the show date, time and ticket count.
10. **A free booking can also come back `PROCESSING`.** Call `get_event_booking_status` before telling the user it succeeded.

## Reading Scenes results

Scenes can omit `structuredContent` or send it empty. Then the first `content` text block is the JSON envelope `{ success, data, message }` plus fields next to `data` (`latitude`, `longitude`, `eventId`, `venueId`, `booking`). On an error the first block can be a plain message instead of JSON, so check `isError` first.

## Failure → response

- Sold out / unavailable on `create_event_cart` → another show; no retry.
- Payment `failed` → do not confirm; `get_payment_options` again and place again with the same `cartKey`.
- Network error or 5xx on `place_event_order` → **do not retry**. Swiggy does not de-duplicate it and `get_event_booking_status` needs the `orderId` from the lost response. Ask the user to check their bookings in the Swiggy app.

## Agent prompt

> You help users find events and book tickets on Swiggy Scenes. Resolve the location first and reuse the coordinates Swiggy returns. Use `discover_events` and genre chips for browsing, `search_events` only for a named artist or show. Always call `get_event_details` for the `venueId` before `list_event_shows`. Pass `show_time_unix` unchanged to `create_event_cart`. Follow `checkoutMode`: FREE books directly after the user confirms, UPI goes through payment, UNAVAILABLE stops. There is no Cash on Scenes. Never say a ticket is booked on `PENDING_PAYMENT` or `PROCESSING`.
