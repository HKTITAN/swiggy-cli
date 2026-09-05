# Live capture: `initialize` handshake without a token on `https://mcp.swiggy.com/food` (2026-09-05)

Context: a normal MCP client handshake sent by swiggy-cli before sign-in, to learn what the server expects (the MCP spec allows unauthenticated `initialize`; Swiggy requires a token).

Request: `POST /food` with `content-type: application/json`, `accept: application/json, text/event-stream`, `mcp-protocol-version: 2025-06-18`, body `{"jsonrpc":"2.0","id":"1","method":"initialize",…}`, no Authorization header.

Response:

```
HTTP/1.1 401 Unauthorized
Content-Type: application/json
www-authenticate: Bearer realm="mcp", resource_metadata="https://mcp.swiggy.com/.well-known/oauth-protected-resource"
X-Cache: Error from cloudfront
Via: 1.1 …cloudfront.net (CloudFront)
X-Amz-Cf-Pop: DEL54-P4
Strict-Transport-Security: max-age=31536000
X-Frame-Options: SAMEORIGIN

{"error": "invalid_token", "error_description": "Authentication required"}
```

Observations:
- Even `initialize` requires a bearer token (the MCP spec allows unauthenticated initialize; Swiggy does not).
- The `resource_metadata` URL in `WWW-Authenticate` points at the origin form, which serves HTML; the per-path form (`/food/.well-known/oauth-protected-resource`) serves the JSON. Clients should try both.
- Served through CloudFront (Delhi PoP for this capture); India-only hosting per docs (AWS Mumbai primary, Singapore failover).
- No `X-RateLimit-*` headers on the 401.
