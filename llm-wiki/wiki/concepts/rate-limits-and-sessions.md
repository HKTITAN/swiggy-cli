---
title: Rate limits and session hygiene
type: concept
updated: 2026-09-05
sources: [sources/swiggy-builders-docs]
tags: [rate-limits, sessions, mcp]
---
Swiggy limits requests per authenticated user per server and — separately — counts connection/initialize handshakes as "auth events". A client that reconnects per tool call breaches the limit long before its tool-call volume does.

## Facts
- Quotas: 70 requests/min per user per server; 30/min for write tools; burst 2× over 10 s (operate/rate-limits, 2026-09-05).
- Signals: `X-RateLimit-Limit/Remaining/Reset` on every successful response; `429 Too Many Requests` + `Retry-After` when throttled; symbolic `RATE_LIMITED` code planned (operate/rate-limits).
- Hygiene rules (operate/rate-limits): one session per user, not per request; initialize domains sequentially, never `/im` + `/food` + `/dineout` in parallel; never a new `initialize` per tool call; stop all connection attempts immediately on a block; batch (`get_addresses` once per session); cache low-churn data; poll `track_*` ≥ 10 s apart; exponential backoff with jitter on transient errors, ≤ 5 retries.
- Retry policy elsewhere: 500 ms → 8 s backoff, ≤ 5 tries, 30 s total wall-clock for user-facing flows; honour `Retry-After` on 429 without stacking backoff (build/ship-to-production, reference/errors).
- Streamable HTTP sessions: `Mcp-Session-Id` returned on `initialize`, sent on later requests; MCP spec says 404 for an expired session (MCP spec; docs do not elaborate).

## How the CLI applies it
- Persists `Mcp-Session-Id` per server in `~/.swiggy/cache/sessions.json` so consecutive processes skip `initialize`; on 404 with a session id it re-initializes once and retries.
- Surfaces headers in `meta.rateLimit`; maps 429 to exit 9 with `retryAfterSeconds`; skills instruct agents to wait exactly `Retry-After`.
- `swiggy shell` keeps one process (and session) alive across many commands; the payment poll never runs faster than Swiggy's interval.

## Relationships
- [oauth-on-swiggy-mcp](oauth-on-swiggy-mcp.md) (auth events), [headless-payments](headless-payments.md) (long-poll cadence), [swiggy-mcp](../entities/swiggy-mcp.md).

## Contradictions & uncertainty
- changelog/ship-to-production say MCP-layer limiting was not enforced in v1.0; rate-limits page (newer wording: "you will see 429") says it is. **Observed 2026-09-05: no `X-RateLimit-*` headers on any successful response** (live capture), so the headers at least are not shipped yet. The CLI handles 429 either way.

## Changelog
- 2026-09-05 — created.
