---
name: swiggy-mcp
description: Use the official Swiggy MCP servers (Food at mcp.swiggy.com/food, Instamart at /im, Dineout at /dineout — 51 tools) correctly from any MCP client or agent framework. Use when an agent has Swiggy MCP tools available, or when writing code that calls them. Covers auth (OAuth 2.1 + PKCE, one token, 5-day expiry), the {success,data,message} envelope, error handling, rate limits and session hygiene, and the safety rules every Swiggy tool call must follow.
license: MIT
compatibility: Needs an MCP client that supports Streamable HTTP with OAuth (Claude Desktop/Code, Cursor, VS Code, Windsurf, ChatGPT, or any SDK). India-only user base.
metadata:
  author: HKTITAN
  version: "0.2.4"
  docs: https://mcp.swiggy.com/builders/docs/
---

# swiggy-mcp

Three independent MCP servers over Streamable HTTP. Carts, orders and tools are per server; the login is shared.

| Server | URL | Tools | Place-order tool |
| --- | --- | ---: | --- |
| Food | `https://mcp.swiggy.com/food` | 20 | `place_food_order` |
| Instamart | `https://mcp.swiggy.com/im` | 19 | `checkout` |
| Dineout | `https://mcp.swiggy.com/dineout` | 12 | `book_table` |

Every tool's exact parameters: [references/tools.md](references/tools.md). Journeys: `swiggy-mcp-food`, `swiggy-mcp-instamart`, `swiggy-mcp-dineout`; payments: `swiggy-mcp-payments`; docs lookup for coding agents: `swiggy-mcp-docs`.

## Non-negotiable rules

1. **Never invent a tool name, parameter or id.** Parameters are camelCase (`addressId`, `restaurantId`, `orderId`, `spinId`) and are listed in the reference; ids come only from a previous tool response in this conversation. A guessed `addressId` fails silently in dev and load-bearing in prod.
2. **Get explicit user confirmation before `place_food_order`, `checkout`, `book_table`, `cancel_booking`, `flush_food_cart`, `clear_cart`, `delete_address`.** Show items + total + delivery address, ask "proceed?", wait for a clear yes. These spend money or destroy state and orders cannot be cancelled via the API.
3. **Never blind-retry an order-placing tool.** On a network error or 5xx, call `get_food_orders` / `get_orders` / `get_booking_status` first; if the order exists, treat the failure as success. Reads and cart mutations are safe to retry (cart updates are idempotent for the same args).
4. **Read the cart at the start of any turn that touches it and again before placing.** Cart state is server-side and the user may have changed it in the app; prices and stock move between turns. Never rely on what you remember.
5. **Session credentials are never tool arguments.** Auth is the bearer token on the connection.

## Response envelope

```json
{ "success": true,  "data": { …tool payload… }, "message": "optional human text" }
{ "success": false, "error": { "message": "…", "reportLink": "https://…", "reportHint": "…" } }
```

`success: false` with HTTP 200 is a **domain** failure (out of stock, slot gone, restaurant closed, coupon invalid): read `error.message`, tell the user, do not retry. Some responses add top-level fields outside `data` (Dineout `latitude`/`longitude`) — keep them for follow-up calls.

## Auth (OAuth 2.1 + PKCE)

- Authorization server `https://mcp.swiggy.com/auth`; metadata at `/.well-known/oauth-authorization-server`; **dynamic client registration is supported** (`/auth/register`) so no client id is required. Scope `mcp:tools mcp:resources mcp:prompts`.
- The user signs in with phone + OTP in a browser. **One token works on all three servers.**
- Access token lives **5 days**; refresh tokens are **not** issued (v1.0) — on 401 re-run the flow. 419 = session revoked → full re-auth. 403 = scope. Never retry with the same token after a 401.
- An agent cannot complete the browser step; tell the user to reconnect the Swiggy connector.

## Errors and retries

| Signal | Meaning | Do |
| --- | --- | --- |
| HTTP 401 / JSON-RPC `-32001` | not authenticated / expired | re-auth |
| HTTP 400, message `Invalid …` / `Missing …` | bad input | fix arguments; no retry |
| HTTP 429 + `Retry-After` | rate limited | stop; wait exactly `Retry-After`; no exponential stacking |
| HTTP 502/503/504, message contains `timeout` | upstream | backoff 500ms → 8s with jitter, max 5 tries, 30 s total |
| HTTP 200 `success:false` | domain failure | surface `error.message`; no retry |
| any persistent failure | — | call `report_error` (tool, errorMessage, toolContext with every id involved) and give the user the returned link |

A symbolic `error.code` is planned but not emitted today; branch on message text + HTTP status.

## Rate limits and session hygiene

- 70 requests/min per user per server; 30/min for write tools; burst 2× over 10 s. `X-RateLimit-*` headers on every response.
- Auth events (connect + `initialize`) are counted separately. **One session per user, not per call.** Connect to `/food`, `/im`, `/dineout` sequentially, never in parallel. Never re-initialize per tool call. Stop all connection attempts immediately on a block.
- `get_addresses` once per session is enough; cache low-churn data (addresses, restaurant metadata). Poll `track_*` no faster than 10 s.

## Multi-server sessions

Carts are per server (a Food cart does not affect Instamart). Orders are per server (`get_food_orders` will not show Instamart). Auth is shared. A Food cart binds to one restaurant (switching flushes it — warn first); an Instamart cart binds to the delivery address (`clear_cart` before switching address).

## Support

`report_error` exists on every server. Cancellation of Food/Instamart orders is not an API feature: tell the user to call Swiggy customer care at 080-67466729. Builders: builders@swiggy.in.
