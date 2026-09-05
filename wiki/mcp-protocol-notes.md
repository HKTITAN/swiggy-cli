# MCP protocol notes

Practical notes about how this CLI speaks the [Model Context Protocol](https://modelcontextprotocol.io) to the Swiggy servers. Start here to debug a session or replay a request by hand.

## Transport

Streamable HTTP: one endpoint per server, JSON-RPC 2.0 over POST, JSON or Server-Sent Events on the response.

| Server | Endpoint |
| --- | --- |
| `food` | `https://mcp.swiggy.com/food` |
| `instamart` | `https://mcp.swiggy.com/im` |
| `dineout` | `https://mcp.swiggy.com/dineout` |

Override via `SWIGGY_FOOD_URL` / `SWIGGY_INSTAMART_URL` / `SWIGGY_DINEOUT_URL` or profile `endpoints` (useful for the mock server in tests and for future `https://mcp.swiggy.com/v2/food`-style pinning).

## Headers we send

```
content-type: application/json
accept: application/json, text/event-stream
mcp-protocol-version: 2025-06-18
mcp-session-id: <from the first response>        # reused across processes via ~/.swiggy/cache/sessions.json
authorization: Bearer <token>                    # every request, including initialize (Swiggy requires it)
user-agent: swiggy-cli/<version> (+https://github.com/HKTITAN/swiggy-cli)
```

## Handshake and sessions

```
→ initialize { protocolVersion, capabilities: {tools:{}}, clientInfo }     ← Mcp-Session-Id header
→ notifications/initialized                                                 (202, body discarded)
→ tools/list · tools/call
```

Swiggy counts connection/initialize events against the rate limit separately from tool calls, so the CLI **persists the session id per server** and skips `initialize` on later invocations. If the server answers **404** to a request carrying a session id (session expired), the CLI drops it, re-initializes once and retries the call. `swiggy shell` keeps everything in one process. Never run several `swiggy` processes in parallel against one server.

## Status mapping

| Response | CLI |
| --- | --- |
| 401 without a token / 419 / JSON-RPC `-32001` | `AUTH_REQUIRED` (exit 3), session dropped |
| 401/403 with a token | `AUTH_FAILED` (exit 3) |
| 429 + `Retry-After` | `RATE_LIMITED` (exit 9), `details.retryAfterSeconds` |
| 404 with session id | re-initialize once, retry |
| JSON-RPC `error` | `MCP_ERROR` (exit 6) |
| `result.isError` | `MCP_ERROR` with the text block as message |
| `result` text block `{ success: false, error }` | `MCP_ERROR` with `error.message`, `reportLink` in the hint |
| `X-RateLimit-Limit/Remaining/Reset` | `meta.rateLimit` |
| `_meta["swiggy.deprecation"]` / `_meta.swiggy.deprecation` | `meta.deprecation` + a stderr warning |

## Response shapes

A tool result contains `structuredContent` (preferred, passed through) or `content[]` text blocks. Swiggy's blocks are the JSON envelope `{ success, data, message }`, sometimes followed by a prose block; `extractToolPayload` picks the envelope and `unwrapSwiggyEnvelope` lifts `data` out. See `src/lib/mcp.ts`.

## SSE handling

If the response is `text/event-stream`, the CLI reads events until it sees a JSON-RPC message whose `id` matches the request, then cancels the stream. Tools that stream multiple frames are simplified to the first matching frame; use `--raw` and a raw client if you need the whole stream.

## Rate limits (Swiggy, per authenticated user, per server)

70 requests/min (30/min for write tools), burst 2× over 10 s. Best practice: one `get_addresses` per session, cache low-churn data, poll `track_*` ≥ 10 s apart, back off on 5xx (500 ms → 8 s, ≤ 5 tries), honour `Retry-After` on 429 without stacking backoff.

## Manual replay

```bash
TOKEN=$(jq -r '.servers.food.accessToken' < ~/.swiggy/auth.json)
curl -s https://mcp.swiggy.com/food \
  -H "content-type: application/json" -H "accept: application/json, text/event-stream" \
  -H "mcp-protocol-version: 2025-06-18" -H "authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}' -i
```

A 401 here means the token is expired or revoked — `swiggy auth init`.
