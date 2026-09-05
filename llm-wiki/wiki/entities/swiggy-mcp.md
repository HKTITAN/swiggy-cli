---
title: Swiggy MCP
type: entity
updated: 2026-09-05
sources: [sources/swiggy-builders-docs, sources/live-captures-2026-09-05, sources/builders-club-launch-blog]
tags: [platform, mcp]
---
Swiggy's commerce platform exposed as Model Context Protocol servers: one Streamable-HTTP endpoint per business line, JSON-RPC 2.0, OAuth 2.1 sessions, uniform tool envelope. India-only (AWS Mumbai primary, Singapore failover). Operated by Bundl Technologies; developer program branded "Swiggy Builders Club".

## Facts
- Three servers: [Food](food-server.md) `/food` (20 tools), [Instamart](instamart-server.md) `/im` (19), [Dineout](dineout-server.md) `/dineout` (12) — 51 tools (reference index, 2026-09-05). Other pages on the same site still say 49, 35+ or 18+ (see Contradictions).
- Transport: Streamable HTTP per MCP spec; protocol version `2025-06-18` accepted; JSON or SSE responses (docs; handshake capture 2026-09-05).
- Auth required even for `initialize` (handshake capture 2026-09-05). Session token shared across servers (docs, multi-turn-state page).
- Envelope: `{ success, data, message? }` / `{ success:false, error:{ message, reportLink?, reportHint? } }`; JSON-RPC `-32001` for auth, `-32603` internal (reference/errors, 2026-09-05).
- Versioning: SemVer at server level; `implementation.version` in `initialize`; 6-month deprecation window; `_meta.swiggy.deprecation` planned; URL pinning `/v1/food`, `/v2/food` planned (operate/versioning, 2026-09-05).
- Widgets: Food widget registry wired (`hasWidgets: true`), hosted iframe layer "v1.1"; Instamart/Dineout widgets "v1.2" (build/widgets, changelog).
- Compliance: DPDP 2023 posture, no-PII stance, data residency India (operate/data-and-compliance).
- Support: builders@swiggy.in; `report_error` tool on every server returns a mailto + summary (reference, 2026-09-05).

## Relationships
- Program and access: [builders-club](builders-club.md).
- Mechanisms: [oauth-on-swiggy-mcp](../concepts/oauth-on-swiggy-mcp.md), [rate-limits-and-sessions](../concepts/rate-limits-and-sessions.md), [error-taxonomy](../concepts/error-taxonomy.md), [cart-state](../concepts/cart-state.md).
- Payments: [payment-stage](payment-stage.md), [swiggy-money](swiggy-money.md).
- Consumers: [swiggy-cli](swiggy-cli.md); official client configs in [swiggy-manifest-readme](../sources/swiggy-manifest-readme.md).

## Contradictions & uncertainty
- Tool counts quoted across the docs: 51 (reference index), 49 (docs home, what-is page), 35+ (llms.txt intro), 18+ (launch blog), Food 20 vs 18 (changelog) vs 14 (coding-agents smoke test). Resolution: the per-server reference pages are generated from source; 20/19/12 is current.
- Rate limiting: operate/rate-limits says enforced with 429 + headers; changelog "known limitations" and build/ship-to-production say not enforced in v1.0. Resolution: treat as enforced (newer page, and the CLI handles 429 either way).

## Changelog
- 2026-09-05 — created from the docs snapshot and live captures.
