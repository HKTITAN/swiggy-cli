---
title: Rate limits and session hygiene
type: concept
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/swiggy-builders-docs, sources/live-captures-2026-09-05]
tags: [rate-limits, sessions, mcp]
---
Swiggy's API gateway enforces per-user and aggregate request caps but publishes no numbers and sends no quota headers; the only signal is HTTP 429 with `Retry-After`. The transport is stateless, yet every `initialize` handshake is an auth event, so a client that handshakes per tool call is still the main way to get blocked.

## Facts
- Quotas: not published. "Exact caps aren't published here and may change"; builders planning scale are told to email builders@swiggy.in (operate/rate-limits, 2026-11-11).
- Signals: no `X-RateLimit-*` headers and no in-app limiter; `429 Too Many Requests` + `Retry-After` from the gateway, JSON-RPC `-32000` at the MCP layer; OTP endpoints are throttled separately (operate/rate-limits, build/ship-to-production, 2026-11-11).
- Hygiene rules (operate/rate-limits, 2026-11-11): one session per user, not per request; initialize domains sequentially, never `/im` + `/food` + `/dineout` + `/scenes` in parallel; never a new `initialize` per tool call; back off on auth errors instead of looping; keep concurrency reasonable; batch (`get_addresses` once per session); cache low-churn data; poll `track_*` ≥ 10 s apart; exponential backoff with jitter on 5xx.
- Retry policy elsewhere: 500 ms → 8 s backoff, ≤ 5 tries, 30 s total wall-clock for user-facing flows; honour `Retry-After` on 429 without stacking backoff (build/ship-to-production, reference/errors).
- Sessions: "The MCP HTTP transport is stateless - it tracks no session and returns no per-call session id"; clients generate their own correlation ids (build/ship-to-production "Observability", 2026-11-11). Whether any server still returns `Mcp-Session-Id` on `initialize` is unobserved since September ([open-questions](../synthesis/open-questions.md)).

## How the CLI applies it
- Records one handshake per server in `~/.swiggy/cache/sessions.json` (URL, time, a SHA-256 fingerprint of the token, and the `Mcp-Session-Id` only if one was issued), trusted for 12 hours and only for the same token, so consecutive processes skip `initialize`. If a call on a remembered handshake is rejected (404 with a session id; 400/404; a "not initialized" JSON-RPC error) it handshakes once and replays the call, which is safe because the call did not run (0.3.0).
- Maps 429 to exit 9 with `retryAfterSeconds`; skills instruct agents to wait exactly `Retry-After`. `meta.rateLimit` was removed in 0.3.0: it parsed headers Swiggy never sent.
- `swiggy shell` keeps one process (and session) alive across many commands; the payment poll never runs faster than Swiggy's interval.

## Relationships
- [oauth-on-swiggy-mcp](oauth-on-swiggy-mcp.md) (auth events), [headless-payments](headless-payments.md) (long-poll cadence), [swiggy-mcp](../entities/swiggy-mcp.md).

## Contradictions & uncertainty
- Resolved 2026-11-11: the docs now agree with the live capture of 2026-09-05 (no headers). What remains unknown is the size of the caps and typical `Retry-After` values.

## Changelog
- 2026-09-05 — created.
- 2026-11-11 — November snapshot. Superseded: "Quotas: 70 requests/min per user per server; 30/min for write tools; burst 2× over 10 s"; "`X-RateLimit-Limit/Remaining/Reset` on every successful response; symbolic `RATE_LIMITED` code planned"; "`Mcp-Session-Id` returned on `initialize`, sent on later requests"; CLI "Surfaces headers in `meta.rateLimit`".
