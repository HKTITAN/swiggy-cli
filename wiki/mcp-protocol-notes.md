# MCP protocol notes

Practical notes about how this CLI speaks the [Model Context Protocol](https://modelcontextprotocol.io) to the Swiggy MCP servers. If you're trying to debug a session or replay a request manually, start here.

## Transport

The Swiggy servers use **Streamable HTTP** (the post-SSE-only successor transport). One HTTP endpoint per server, JSON-RPC 2.0 over POST, with optional Server-Sent Events on the response when the server wants to stream.

| Server      | Endpoint                              |
| ----------- | ------------------------------------- |
| `food`      | `https://mcp.swiggy.com/food`         |
| `instamart` | `https://mcp.swiggy.com/im`           |
| `dineout`   | `https://mcp.swiggy.com/dineout`      |

Override via `SWIGGY_<SERVER>_URL` (e.g. `SWIGGY_FOOD_URL`) — handy for staging.

## Headers we send

```
content-type: application/json
accept: application/json, text/event-stream
mcp-protocol-version: 2025-06-18
mcp-session-id: <set after first response>           # only on subsequent calls
authorization: Bearer <token>                        # all but `initialize`
```

The `mcp-session-id` is captured from the response of the first request and reused for the lifetime of the process.

## Handshake

```
→ initialize { protocolVersion, capabilities: {tools:{}}, clientInfo }
← initialize result
→ notifications/initialized        (best-effort, no response)
```

After that, normal RPCs:

```
→ tools/list
← { tools: [...] }

→ tools/call { name, arguments }
← { content: [...] | structuredContent: ... | isError: true }
```

## Response shapes

A tool result can contain:

- `structuredContent` — JSON object. Preferred when present; this CLI passes it through unchanged.
- `content[]` — array of `{ type: "text", text: "..." }` etc. The CLI extracts and parses text blocks (single block → JSON-or-string; multiple → array of strings).
- `isError: true` — promote to a `MCP_ERROR` (exit 6).

See `extractToolPayload()` in `src/lib/mcp.ts`.

## SSE handling

If the response `content-type` is `text/event-stream`, we read frames until we see one with an `id` matching the request, then close the body. Multi-frame streams are intentionally simplified — for tools that genuinely stream multiple events, use `--raw` and parse the SSE yourself.

## Sessions

The `mcp-session-id` returned by Swiggy ties to a logged-in user. If you swap users (or `swiggy auth logout` then re-`init`), kill the CLI process so the next run negotiates a fresh session.

## Manual replay

If you want to send a tool call by hand:

```bash
TOKEN=$(jq -r '.servers.food.accessToken' < ~/.swiggy/auth.json)
curl -s https://mcp.swiggy.com/food \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "mcp-protocol-version: 2025-06-18" \
  -H "authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}'
```

If that returns 401, the token is expired or revoked — re-auth.
