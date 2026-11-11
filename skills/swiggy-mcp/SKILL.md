---
name: swiggy-mcp
description: Call Swiggy's four servers directly (Food at mcp.swiggy.com/food, Instamart at /im, Dineout at /dineout, Scenes at /scenes, 62 tools) from any MCP client or agent framework. Use when an agent has Swiggy tools available, or when writing code that calls them. Covers auth (OAuth 2.1 + PKCE, one login, 5-day token, refresh), how to read a tool result, error handling, rate limits and handshake hygiene, and the safety rules every Swiggy tool call must follow.
license: MIT
compatibility: Needs an MCP client that supports Streamable HTTP with OAuth (Claude Desktop/Code, Cursor, VS Code, Windsurf, ChatGPT, or any SDK). India-only user base.
metadata:
  author: HKTITAN
  version: "0.3.0"
  docs: https://mcp.swiggy.com/builders/docs/
---

# swiggy-mcp

Four independent servers over Streamable HTTP (JSON-RPC 2.0, one POST per call). Carts, orders and tools are per server; the login is shared.

| Server | URL | Tools | Place-order tool |
| --- | --- | ---: | --- |
| Food | `https://mcp.swiggy.com/food` | 20 | `place_food_order` |
| Instamart | `https://mcp.swiggy.com/im` | 16 | `checkout` |
| Dineout | `https://mcp.swiggy.com/dineout` | 11 | `book_table` |
| Scenes (events, tickets) | `https://mcp.swiggy.com/scenes` | 15 | `place_event_order` |

Every tool's exact parameters: [references/tools.md](references/tools.md) (generated from Swiggy's docs on 2026-11-11). Journeys: `swiggy-mcp-food`, `swiggy-mcp-instamart`, `swiggy-mcp-dineout`, `swiggy-mcp-scenes`; payments: `swiggy-mcp-payments`; docs lookup for coding agents: `swiggy-mcp-docs`.

Use only the tools `tools/list` returns for this account. Swiggy enables tools per account, and its November 2026 reference dropped Instamart `list_coupons`, `apply_coupon`, `get_order_details` and Dineout `cancel_booking`, `get_saved_locations` (saved locations are now a Scenes tool).

## Non-negotiable rules

1. **Never invent a tool name, parameter or id.** Parameters are camelCase (`addressId`, `restaurantId`, `orderId`, `spinId`) and are listed in the reference; ids come only from a previous tool response in this conversation. A guessed `addressId` fails silently in dev and load-bearing in prod.
2. **Get explicit user confirmation before `place_food_order`, `checkout`, `book_table`, `place_event_order`, `flush_food_cart`, `clear_cart`, `delete_address`.** Show items + total + delivery address (or event, show time and ticket count), ask "proceed?", wait for a clear yes. These spend money or destroy state and orders cannot be cancelled via the API.
3. **Never blind-retry an order-placing tool.** `place_food_order`, `book_table` and `place_event_order` take no idempotency key and Swiggy does not de-duplicate them; a retry after a timeout or lost response can place a second order. Turn off transport and framework retries for these four tools. On a network error or 5xx: wait 2–5 s, then check. Food → `get_food_orders`. Instamart → `get_orders`, checking every store (a multi-store checkout places one order per store and can partly succeed). Dineout and Scenes → the status tools need the `orderId` from the lost response, so ask the user to check their bookings in the Swiggy app. Retry only when you can establish the order was not placed. Instamart `checkout` may reject a likely duplicate; set `confirmDuplicate` only when that rejection asks for it and the user confirms.
4. **Read the cart at the start of any turn that touches it and again before placing.** Cart state is server-side and the user may have changed it in the app; prices and stock move between turns. Never rely on what you remember.
5. **Session credentials are never tool arguments.** Auth is the bearer token on the connection.

## Reading a tool result

Every call returns a standard `CallToolResult`.

1. **Read `structuredContent`.** It holds the fields listed under "Output schema" in the reference. Food and Instamart always send it.
2. **When it is missing or empty (possible on Dineout and Scenes)**, the first `content` text block is the JSON envelope. Parse that block and use `data`:

```json
{ "success": true,  "data": { …tool payload… }, "message": "optional human text" }
{ "success": false, "error": { "message": "…", "reportId": "ERR-…", "reportHint": "…" } }
```

3. **Keep the fields next to `data`.** Scenes discovery tools put the resolved `latitude`/`longitude` there (reuse them on every follow-up call), and `get_event_booking_status` returns `booking` instead of `data`.
4. **Never parse `content` as JSON when `structuredContent` is present.** It is a summary for a model to relay and can be prose.

A failed call sets `isError: true`, or reports `success: false` with an `error`; check both. `success: false` with HTTP 200 is a **domain** failure (out of stock, slot gone, restaurant closed, show sold out): read `error.message`, tell the user, do not retry.

## Auth (OAuth 2.1 + PKCE)

- Authorization server `https://mcp.swiggy.com/auth`; metadata at `/.well-known/oauth-authorization-server`; **dynamic client registration is supported** (`/auth/register`) so no client id is required. Scope `mcp:tools mcp:resources mcp:prompts`.
- The user signs in with phone + OTP in a browser. **One login covers all four servers.**
- Access token lives **5 days**. **Refresh tokens work:** `POST /auth/token` with the JSON body `{ "grant_type": "refresh_token", "refresh_token": "…" }` returns a token valid for 30 days and a new refresh token (it rotates; store the latest). An already-expired token cannot be refreshed, so refresh before expiry.
- On 401: refresh first; re-run authorization only if the refresh fails. 419 = session revoked → full re-auth. 403 = scope. Never retry with the same token after a 401.
- An agent cannot complete the browser step; tell the user to reconnect the Swiggy connector.

## Errors and retries

| Signal | Meaning | Do |
| --- | --- | --- |
| HTTP 401 / JSON-RPC `-32001` | not authenticated / expired | refresh, then re-auth |
| HTTP 400, message `Invalid …` / `Missing …` | bad input | fix arguments; no retry |
| HTTP 429 + `Retry-After` (JSON-RPC `-32000`) | rate limited | stop; wait exactly `Retry-After`; no exponential stacking |
| HTTP 502/503/504, message contains `timeout` | upstream | reads only: backoff 500ms → 8s with jitter, max 5 tries, 30 s total. Order placement: rule 3 |
| HTTP 200 `success:false` | domain failure | surface `error.message`; no retry |
| any persistent failure | — | call `report_error` (tool, errorMessage, toolContext with every id involved) and give the user the returned link |

There is no symbolic `error.code`; branch on message text + HTTP / JSON-RPC status.

## Rate limits and handshake hygiene

- **Swiggy publishes no numbers and sends no `X-RateLimit-*` headers.** Its gateway enforces per-user and aggregate caps and answers 429 with `Retry-After`. You cannot read remaining quota; build as though limits exist.
- **Never send `initialize` per tool call.** The transport is stateless and may return no `Mcp-Session-Id`, but every handshake is an auth event. Handshake once per user per server and reuse it. Connect to `/food`, `/im`, `/dineout`, `/scenes` one after another, never in parallel. If connection attempts fail, back off; do not loop.
- `get_addresses` once per session is enough; cache low-churn data (addresses, restaurant metadata). Poll `track_*` no faster than 10 s.
- There is no `_meta.swiggy.deprecation` field. Deprecations are announced by email and in Swiggy's changelog; watch `tools/list` for tools that disappear.

## Multi-server sessions

Carts are per server (a Food cart does not affect Instamart). Orders are per server (`get_food_orders` will not show Instamart). Auth is shared. A Food cart binds to one restaurant (switching flushes it: warn first); an Instamart cart binds to the delivery address (`clear_cart` before switching address). Food and Instamart identify a place by `addressId`; Dineout takes `latitude`/`longitude` only; Scenes takes either and tells you the coordinates it resolved.

## Payment methods by server

| | Cash | UPI | Swiggy Money (`SwiggyPay`) |
| --- | --- | --- | --- |
| Food | yes | yes | when `get_payment_options` offers it |
| Instamart | yes | yes | when `get_payment_options` offers it |
| Dineout | free deals only | paid deals | no |
| Scenes | never | paid tickets (`checkoutMode: UPI`) | no; free tickets use `paymentMethod: "FREE"` |

## Support and attribution

`report_error` exists on every server. Cancellation is not an API feature: for Food/Instamart orders tell the user to call Swiggy customer care at 080-67466729; for a Dineout booking, the Swiggy Dineout app or the same number. Builders: builders@swiggy.in. If you ship a product on these servers, follow <https://mcp.swiggy.com/builders/docs/operate/brand-guidelines/>: "Powered by Swiggy" / "Powered by Instamart" / "Powered by Dineout" next to the matching service, and no "official" or "certified" claims.
