# MCP protocol notes

Swiggy's only public API is JSON-RPC 2.0 over HTTPS, using the [Model Context Protocol](https://modelcontextprotocol.io) "Streamable HTTP" transport. This page records how the CLI speaks it. The client is `src/lib/mcp.ts`: plain `fetch`, no SDK, no child process. Start here to debug a call or replay a request by hand.

## Transport

One endpoint per service, one POST per call, JSON or Server-Sent Events on the response.

| Server | Endpoint | Tools |
| --- | --- | ---: |
| `food` | `https://mcp.swiggy.com/food` | 20 |
| `instamart` | `https://mcp.swiggy.com/im` | 16 |
| `dineout` | `https://mcp.swiggy.com/dineout` | 11 |
| `scenes` | `https://mcp.swiggy.com/scenes` | 15 |

Override via `SWIGGY_FOOD_URL` / `SWIGGY_INSTAMART_URL` / `SWIGGY_DINEOUT_URL` / `SWIGGY_SCENES_URL` or profile `endpoints` (useful for the mock server in tests).

## Headers we send

```
content-type: application/json
accept: application/json, text/event-stream
mcp-protocol-version: 2025-06-18
mcp-session-id: <only if the server issued one>
authorization: Bearer <token>                    # every request, including initialize (Swiggy requires it)
user-agent: swiggy-cli/<version> (+https://github.com/HKTITAN/swiggy-cli)
```

## Handshake, once

```
→ initialize { protocolVersion, capabilities: {tools:{}}, clientInfo }     ← Mcp-Session-Id header, if the server issues one
→ notifications/initialized                                                 (202, body discarded)
→ tools/list · tools/call
```

Swiggy documents the transport as **stateless**: it tracks no session and may return no `Mcp-Session-Id`. Its guidance is still "never create a new initialize handshake per tool invocation", because every handshake is an auth event. A one-shot CLI process cannot hold a connection open, so the CLI **records the handshake per server** in `~/.swiggy/cache/sessions.json`:

```json
{ "food": { "url": "https://mcp.swiggy.com/food", "savedAt": 1762819200000, "token": "<16-char fingerprint>", "sessionId": "<only if issued>" } }
```

Later invocations skip `initialize` and go straight to the call when the record is for the same URL, was made with the same token (compared by fingerprint, never the token itself) and is under 12 hours old.

If the server rejects a call made on a remembered handshake (HTTP 404 with a session id, HTTP 400/404 on a handshake this process only remembered, or a JSON-RPC error saying "not initialized" / "session expired"), the CLI drops the record, handshakes once and replays the call once. Such a rejection means the call did not run, so the replay is safe even for order placement.

`swiggy shell` and the app keep everything in one process. Do not run several `swiggy` processes in parallel against one server; Swiggy asks clients to connect to services one after another, not all at once.

## Status mapping

| Response | CLI |
| --- | --- |
| 401 with a token | refresh the token once, handshake, replay once; if that fails → `AUTH_FAILED` (exit 3) |
| 401 without a token | `AUTH_REQUIRED` (exit 3) |
| 419 / JSON-RPC `-32001` | `AUTH_REQUIRED` (exit 3), handshake record dropped |
| 403 | `AUTH_FAILED` (exit 3), scope hint |
| 429 + `Retry-After` | `RATE_LIMITED` (exit 9), `details.retryAfterSeconds` |
| rejected remembered handshake (see above) | handshake once, replay once |
| JSON-RPC `error` | `MCP_ERROR` (exit 6) |
| `result.isError` | `MCP_ERROR` with the server's own message |
| `{ success: false, error }` in the payload | `MCP_ERROR` with `error.message`; `reportLink` in the hint when present |
| `fetch` threw | `NETWORK` (exit 5). On `place_food_order`, `checkout`, `book_table`, `place_event_order`: `details.mayHavePlacedOrder: true` and a hint to check orders first |

There is no `X-RateLimit-*` header and no `_meta.swiggy.deprecation` field. See "Rate limits" and "Deprecations" below.

## Reading a tool result

Swiggy's rule (<https://mcp.swiggy.com/builders/docs/build/read-tool-results/>), implemented by `extractToolPayload`, `unwrapSwiggyEnvelope` and `extractLocationContext`:

1. Read **`structuredContent`** when it is present and non-empty. Food and Instamart always send it.
2. When it is missing or empty (possible on Dineout and Scenes), the first `content` text block is the JSON envelope `{ success, data, message? }`. The CLI lifts `data` out and puts `message` in `meta.message`.
3. Keep the fields that sit **next to** `data`. Scenes discovery tools put the resolved `latitude` / `longitude` there, and the CLI remembers them for follow-up calls. `get_event_booking_status` returns `booking` instead of `data`; the CLI then uses the remaining fields as the payload, so `data.booking` holds the confirmation.
4. Prose in `content` is a summary for a model to relay. It is returned as-is only when there is nothing machine-readable.

A failed call sets `isError: true`, or reports `success: false` with an `error` in the envelope; the CLI checks both. There is no symbolic `error.code` upstream, only `error.message` plus the HTTP / JSON-RPC status.

## SSE handling

If the response is `text/event-stream`, the CLI reads events until it sees a JSON-RPC message whose `id` matches the request, then cancels the stream. Tools that stream multiple frames are simplified to the first matching frame; use `--raw` and a raw client if you need the whole stream.

## Rate limits

Swiggy publishes no numbers and sends no `X-RateLimit-*` headers. Its API gateway enforces per-user and aggregate caps and answers **HTTP 429 with `Retry-After`** (JSON-RPC `-32000`) when one is hit. The CLI maps that to `RATE_LIMITED` (exit 9) with `details.retryAfterSeconds` and does not retry on its own. Earlier versions of this page quoted "70 requests/min, 30/min for writes"; those figures are gone from Swiggy's docs and the envelope's `meta.rateLimit` was removed in 0.3.0 because it reported numbers Swiggy never sent.

What Swiggy does ask for: one `get_addresses` per session, cache low-churn data, poll `track_*` no faster than every 10 s, back off on 5xx (500 ms → 8 s, at most 5 tries) for reads only, honour `Retry-After` on 429 without stacking backoff.

## Order placement is not de-duplicated

`place_food_order`, `checkout`, `book_table` and `place_event_order` take no idempotency key and Swiggy does not de-duplicate them. A retry after a timeout or a lost response can place a second order. The CLI never retries these (`NON_IDEMPOTENT_TOOLS` in `src/lib/aliases.ts`). On a network failure it returns `details.mayHavePlacedOrder: true` and tells the caller what to check: `swiggy food orders`, `swiggy instamart orders` (a multi-store checkout places one order per store and can partly succeed), or the bookings in the Swiggy app for Dineout and Scenes, whose status tools need the order id from the lost response. Instamart `checkout` may reject a likely duplicate and ask for `confirmDuplicate`; pass it through `--input` only when that rejection asks for it and the user agrees.

## Deprecations

Swiggy announces deprecations by email and in its changelog, with a 6-month window. No `_meta.swiggy.deprecation` field exists today. The CLI still passes one through as `meta.deprecation` if it ever appears (`extractDeprecation`), and `swiggy doctor` reports tools that appear in or vanish from `tools/list`.

## Manual replay

```bash
TOKEN=$(jq -r '.servers.food.accessToken' < ~/.swiggy/auth.json)
curl -s https://mcp.swiggy.com/food \
  -H "content-type: application/json" -H "accept: application/json, text/event-stream" \
  -H "mcp-protocol-version: 2025-06-18" -H "authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}' -i
```

A 401 here means the token is expired or revoked. Run any `swiggy` command to let the CLI refresh it, or `swiggy auth init`.
