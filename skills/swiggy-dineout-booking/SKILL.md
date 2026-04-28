---
name: swiggy-dineout-booking
description: Discover Swiggy Dineout restaurants, check available reservation slots, and book a table via swiggy-cli. Use when the user asks "book a table at X" or "is Y free at 8pm tomorrow".
---

# swiggy-dineout-booking

Reservations go through the `dineout` server. The flow is:

```
search → details → slots → cart → book → status
```

## 1. Search

```bash
swiggy dineout search -q "italian" -c Delhi --json --no-interactive
```

Pick a restaurant id from `data`.

## 2. Details (optional, but recommended)

```bash
swiggy dineout details <restaurant_id> --json --no-interactive
```

Surface menu highlights, ratings, and offers to the human.

## 3. Available slots

```bash
swiggy dineout slots --restaurant-id <id> --date 2026-05-01 --guests 2 --json --no-interactive
```

Present the slots and let the human choose one.

## 4. Cart

```bash
swiggy dineout cart --input '{"restaurant_id":"<id>","slot_id":"<slot>","guests":2}' --json
```

## 5. Book (destructive — requires explicit confirmation)

```bash
swiggy dineout book --input '{"slot_id":"<slot>","guests":2,"restaurant_id":"<id>"}' --yes --json --no-interactive
```

`book_table` is destructive. Confirm the human has explicitly approved before adding `--yes`.

## 6. Status

```bash
swiggy dineout status <booking_id> --json --no-interactive
```

## Constraints

- Only **free** bookings are supported by the upstream MCP. Paid prepaid reservations will fail with `MCP_ERROR`.
- Slots are time-bounded; if `slots` returns nothing, suggest a different date / guest count rather than guessing.
