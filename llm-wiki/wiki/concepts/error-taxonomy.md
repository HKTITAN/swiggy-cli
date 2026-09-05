---
title: Error taxonomy
type: concept
updated: 2026-09-05
sources: [sources/swiggy-builders-docs]
tags: [errors, retries]
---
Swiggy tools report failures in a uniform envelope with a human message; transport-level auth failures use HTTP status and JSON-RPC codes. A symbolic `error.code` registry is planned but not emitted, so today's classification is message-prefix + HTTP status.

## Facts
- Envelope: `{ success:false, error:{ message, reportLink?, reportHint? } }` with HTTP 200 for domain failures (reference/errors, 2026-09-05).
- Buckets and reactions (reference/errors): 401 or JSON-RPC `-32001` → re-auth; 400 with `Invalid …`/`Missing …` → fix input, no retry; 504 or "timeout" → backoff ≤ 5; 502/503 → backoff ≤ 5; 200 `success:false` → terminal domain failure (out of stock, slot gone, closed) → surface, no retry; 500 or `-32603` → backoff once, then `report_error`.
- Planned core codes: `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `SESSION_REVOKED` (419), `INSUFFICIENT_SCOPE`, `RATE_LIMITED`, `VALIDATION_ERROR`, `NOT_FOUND`, `UPSTREAM_TIMEOUT`, `UPSTREAM_ERROR`, `INTERNAL_ERROR`; domain codes per server (`ITEM_OUT_OF_STOCK`, `CART_EXPIRED`, `ADDRESS_NOT_SERVICEABLE`, `MIN_ORDER_NOT_MET`; `RESTAURANT_CLOSED`, `ITEM_UNAVAILABLE`, `COUPON_*`; `SLOT_UNAVAILABLE`, `RESTAURANT_NOT_BOOKABLE`, `BOOKING_WINDOW_CLOSED`) — "none emitted today" (reference/errors).
- Idempotency: reads, tracking, cart mutations (same args) and `apply_food_coupon` are safe to retry; `place_food_order`, `checkout`, `book_table` are not — check-then-retry via `get_food_orders`/`get_orders`/`get_booking_status` (build/ship-to-production).
- `report_error { tool, errorMessage, domain?, flowDescription?, toolContext?, userNotes? }` → `{ mailto, summary{subject, body} }` (reference).

## How the CLI maps it
`AUTH_REQUIRED`/`AUTH_FAILED` (3), `MCP_ERROR` (6) for `success:false` / `isError` / JSON-RPC errors with the message verbatim and a hint (address, coordinates, minimum order, not-whitelisted), `RATE_LIMITED` (9), `PAYMENT_FAILED` (10). Skills tell agents to branch on the CLI code, never on message text, and never to retry order placement.

## Relationships
- [rate-limits-and-sessions](rate-limits-and-sessions.md), [headless-payments](headless-payments.md), [swiggy-cli](../entities/swiggy-cli.md).

## Changelog
- 2026-09-05 — created.
