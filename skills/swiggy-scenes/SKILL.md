---
name: swiggy-scenes
description: Find events and shows and book tickets on Swiggy Scenes with swiggy-cli (discover what's on, open a genre, look up an artist, pick a show, create the ticket cart, book it free or by UPI, check the booking). Use when the user says "what's on this weekend", "comedy shows near me", "book tickets for <artist>", "get me 2 tickets", "is my ticket confirmed".
license: MIT
compatibility: Requires swiggy-cli 0.3.0 or later, signed in. Booking a paid ticket spends money via UPI.
metadata:
  author: HKTITAN
  version: "0.3.0"
---

# swiggy-scenes

```
discover | search | collection → shows <event> → cart → book → status
```

Swiggy fixes this order. `shows` needs the event's `venueId`, the cart needs the exact show and ticket ids, and `book` needs the cart. The CLI carries those from step to step; your job is to keep the steps in order and let the user choose at each one.

## 1. Location, then find events

```bash
swiggy scenes locations --json --no-interactive                       # "near me / home / office": data.locations[] → id, addressLine
swiggy scenes discover --address-id <id> --json --no-interactive       # what's on near a saved location
swiggy scenes discover --lat 12.9716 --lng 77.5946 --json --no-interactive   # a named city or area
```

- `discover` needs a location. Use a saved location id, or coordinates for the place the user named (Bangalore 12.9716,77.5946 · Mumbai 19.0760,72.8777 · Delhi 28.6139,77.2090). Unknown place → ask; never substitute another city.
- The response's `data.latitude` / `data.longitude` are the coordinates Swiggy resolved. The CLI remembers them and sends them on every later Scenes command, so do not pass different `--lat/--lng` mid-flow: venue and price context would stop matching.
- `data.events[]` → `eventId`, `eventName`, `venueName`, `area`, `date`, `price`. `data.collectionChips[]` → `collectionIdentifier`, `label` (Comedy, Music, Theatre, …).

Pick the finder by what the user asked for:

| The user wants | Command | Why |
| --- | --- | --- |
| "what's on", a weekend plan | `swiggy scenes discover …` | the general listing |
| a genre ("comedy shows", "music") | `discover`, then `swiggy scenes collection <collectionIdentifier>` for the matching chip | the chip listing is the full genre catalogue |
| one named artist or show title | `swiggy scenes search "<name>"` | auto-suggest: at most 4 results in `data.suggestions[]` |

Never use `search` for a genre: it returns one result or none. If `search` finds nothing, say so and offer `discover`; do not retry the same query.

## 2. Shows for the event the user picked

```bash
swiggy scenes shows <eventId> --json --no-interactive
```

The CLI first fetches the event's details to get its `venueId` (the only tool that returns it), then lists shows for that venue. Read `data.eventShowListing.dateGroupedEventShow[].eventShow[]`: `showId`, `show_time_ist`, `show_time_unix`, `availableSeats`, `tickets[]` (`ticketId`, `ticketTitle`, `price`), and `data.eventShowListing.venueDetails.venueId`.

- Show times to the user from `show_time_ist`, verbatim. Never compute a time from another field.
- An empty listing means nothing is left to book in the next 5 days; widen with `--from <iso> --to <iso>` (window of at most 5 days).
- Never book from `--all-venues`: that listing spans venues and Swiggy says it is not safe to book from.

`swiggy scenes details <eventId>` shows venue, address, next date and starting price when the user asks about the event itself.

## 3. Create the ticket cart

Ask which show, which ticket type and how many guests (1–20). Then:

```bash
swiggy scenes cart --venue-id <venueId> --show-id <showId> --ticket-id <ticketId> --show-time <show_time_unix> --guests <n> --json --no-interactive
```

Copy `showId`, `ticketId` and `show_time_unix` from the show the user chose, exactly as returned. A converted or rounded show time makes the booking fail. (`--show <#>` picks a row from the last `shows` listing; use it only when you made that listing in the same session.)

`data.checkoutMode` decides what happens next:

| `checkoutMode` | Next |
| --- | --- |
| `FREE` | step 4 without `--pay` |
| `UPI` | step 4 with `--pay upi --wait` |
| `UNAVAILABLE` | stop; tell the user and offer another show |

A sold-out show returns `MCP_ERROR`; show the message and offer another show, do not retry. The CLI keeps the cart for 30 minutes, so `book` needs no `--cart-key`.

## 4. Confirm, then book

Ask: "Book <n> tickets for <event> at <venue>, <show_time_ist>, <free / ₹total>?" Wait for a clear yes. `--yes` is that consent; never add it on your own.

```bash
# Free ticket
swiggy scenes book --yes --json --no-interactive
# Paid ticket: places the order, prints the pay link on stderr, polls on Swiggy's cadence, confirms
swiggy scenes book --pay upi --wait --yes --json --no-interactive
```

- **Scenes has no Cash and no Swiggy Money.** `--pay cash` is rejected (exit 2). If UPI is not offered by `swiggy scenes payment-options`, tell the user the ticket cannot be paid for right now.
- Without `--wait`, a paid booking returns `meta.payment.pending: true` with `meta.payment.bridgeUrl` (give it to the user: scan on desktop, tap on mobile) and `meta.payment.next`. That is not a booking yet; follow `swiggy-pay` (Scenes confirms with `orderId + paasId`).
- `data.status` `CONFIRMED` → booked. `PROCESSING` → not final; go to step 5 before saying it worked.

## 5. Status

```bash
swiggy scenes status <orderId> --json --no-interactive     # data.booking → status, restaurantName (the venue), reservationDate, reservationTime, guestCount
```

Read `data.booking`, not `data` itself. While `status` is `PROCESSING`, wait and check again; never report it as confirmed.

## Never

- Skip `shows` and guess a `showId`, `ticketId` or show time.
- Retry `book` after an error. Swiggy does not de-duplicate ticket orders. On exit 5 with `error.details.mayHavePlacedOrder: true`, ask the user to check their bookings in the Swiggy app first; `status` needs the order id from the response that was lost.
- Announce a booking on `PENDING_PAYMENT` or `PROCESSING`.
- Call `show-cart` in the normal flow; `cart` already returned everything, and a free cart cannot be read back.
