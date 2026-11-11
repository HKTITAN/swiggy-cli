---
title: Error taxonomy
type: concept
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/swiggy-builders-docs]
tags: [errors, retries]
---
Swiggy tools report failures in a uniform envelope with a human message; transport-level auth failures use HTTP status and JSON-RPC codes. There is no symbolic `error.code`, so classification is message-prefix + HTTP / JSON-RPC status. Where the envelope sits in a result differs by server.

## Facts
- Envelope: `{ success:false, error:{ message, reportId?, reportHint? } }` with HTTP 200 for domain failures; a failed call usually also sets `isError: true`, but a few responses report failure only in the envelope, so check both (reference/errors, 2026-11-11).
- Reading results: `structuredContent` is the machine-readable payload and is always present on Food and Instamart (errors included). On Dineout and Scenes it can be missing or empty; then the first `content` text block is the JSON envelope `{ success, data, message }` with tool-specific fields next to `data` (Scenes `latitude`/`longitude`; `get_event_booking_status` returns `booking` instead of `data`), or on an error a plain message. `content` is otherwise prose for a model and must not be parsed (build/read-tool-results, 2026-11-11).
- JSON-RPC codes: `-32001` unauthenticated/expired, `-32603` internal, `-32003` forbidden, `-32000` too-many-requests / method-not-allowed (reference/errors, 2026-11-11).
- Buckets and reactions (reference/errors): 401 or JSON-RPC `-32001` → re-auth; 400 with `Invalid …`/`Missing …` → fix input, no retry; 504 or "timeout" → backoff ≤ 5; 502/503 → backoff ≤ 5; 200 `success:false` → terminal domain failure (out of stock, slot gone, closed) → surface, no retry; 500 or `-32603` → backoff once, then `report_error`.
- Symbolic codes: none. "There is no symbolic `error.code` field"; the September list of planned codes is no longer on the errors page (reference/errors, 2026-11-11).
- Idempotency: reads, tracking, cart mutations (they set absolute state) and `apply_food_coupon` are safe to retry. `place_food_order`, `checkout`, `book_table` and `place_event_order` are not: no idempotency key, no server-side de-duplication (Instamart `checkout` may reject a likely duplicate and ask for `confirmDuplicate`). After a lost response: wait 2–5 s; Food → `get_food_orders`; Instamart → `get_orders`, every store; Dineout/Scenes → the status tools need the lost `orderId`, so the user checks the Swiggy app. Retry only when the order is established as not placed (build/ship-to-production, reference/errors, 2026-11-11).
- `report_error { tool, errorMessage, domain?, flowDescription?, toolContext?, userNotes? }` → `{ mailto, summary{subject, body} }` (reference).

## How the CLI maps it
`AUTH_REQUIRED`/`AUTH_FAILED` (3), `MCP_ERROR` (6) for `success:false` / `isError` / JSON-RPC errors with the message verbatim and a hint, `RATE_LIMITED` (9), `PAYMENT_FAILED` (10). A `NETWORK` (5) error from an order-placing command carries `details.mayHavePlacedOrder: true` and a check-first hint (0.3.0). `extractToolPayload` follows the read-tool-results rule and `extractLocationContext` keeps the fields next to `data`. Skills tell agents to branch on the CLI code, never on message text, and never to retry order placement.

## Relationships
- [rate-limits-and-sessions](rate-limits-and-sessions.md), [headless-payments](headless-payments.md), [swiggy-cli](../entities/swiggy-cli.md).

## Changelog
- 2026-09-05 — created.
- 2026-11-11 — November snapshot. Superseded: "A symbolic `error.code` registry is planned but not emitted"; "Planned core codes: `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `SESSION_REVOKED` (419), `INSUFFICIENT_SCOPE`, `RATE_LIMITED`, `VALIDATION_ERROR`, `NOT_FOUND`, `UPSTREAM_TIMEOUT`, `UPSTREAM_ERROR`, `INTERNAL_ERROR`; domain codes per server — none emitted today"; envelope field `reportLink` (the errors page now shows `reportId`).
