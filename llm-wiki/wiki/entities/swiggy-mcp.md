---
title: Swiggy MCP
type: entity
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/swiggy-builders-docs, sources/live-captures-2026-09-05, sources/builders-club-launch-blog]
tags: [platform, mcp]
---
Swiggy's commerce platform exposed as Model Context Protocol servers: one Streamable-HTTP endpoint per business line, JSON-RPC 2.0, OAuth 2.1 sessions, uniform tool envelope. India-only (AWS Mumbai primary, Singapore failover). Operated by Bundl Technologies; developer program branded "Swiggy Builders Club".

## Facts
- Four servers: [Food](food-server.md) `/food` (20 tools), [Instamart](instamart-server.md) `/im` (16), [Dineout](dineout-server.md) `/dineout` (11), [Scenes](scenes-server.md) `/scenes` (15) — 62 tools (reference indexes and start/what-is, 2026-11-11). This JSON-RPC surface is Swiggy's only public API; "this site is MCP-only" (start/what-is, 2026-11-11).
- Transport: Streamable HTTP per MCP spec; protocol version `2025-06-18` accepted; JSON or SSE responses (docs; handshake capture 2026-09-05).
- Auth required even for `initialize` (handshake capture 2026-09-05). Session token shared across servers (docs, multi-turn-state page).
- Results: read `structuredContent` (always present on Food and Instamart); when missing or empty (Dineout, Scenes) the first `content` block is the envelope `{ success, data, message? }` / `{ success:false, error:{ message, reportId?, reportHint? } }`, with tool-specific fields next to `data`. JSON-RPC `-32001` auth, `-32603` internal, `-32003` forbidden, `-32000` too-many-requests (build/read-tool-results, reference/errors, 2026-11-11).
- Transport is stateless: "tracks no session and returns no per-call session id"; clients are still told never to `initialize` per tool call (build/ship-to-production, operate/rate-limits, 2026-11-11).
- Order placement (`place_food_order`, `checkout`, `book_table`, `place_event_order`) is not de-duplicated and has no idempotency key (build/ship-to-production, 2026-11-11).
- Versioning: SemVer at server level; 6-month deprecation window announced by email, blog and changelog. There is no `_meta.swiggy.deprecation` response field (operate/versioning, operate/changelog, 2026-11-11).
- Widgets: all four servers flagged `hasWidgets: true`; widget HTML is served over MCP `resources/read` under `ui://widget/…`; there is no public hosting layer (build/widgets, 2026-11-11).
- Compliance: DPDP 2023 posture, no-PII stance, data residency India (operate/data-and-compliance).
- Live `tools/list` differs per account (rollout gating) and can include tools the reference does not document (2026-09-05: `render_restaurants_dineout`, since documented; 2026-11-04: beta `add_gift_pack_to_cart` on Instamart); the reference's 62 is the documented surface, not necessarily what one account sees (live capture 2026-09-05; blog 2026-11-04).
- Support: builders@swiggy.in; `report_error` tool on every server returns a mailto + summary (reference, 2026-09-05).

## Relationships
- Program and access: [builders-club](builders-club.md).
- Mechanisms: [oauth-on-swiggy-mcp](../concepts/oauth-on-swiggy-mcp.md), [rate-limits-and-sessions](../concepts/rate-limits-and-sessions.md), [error-taxonomy](../concepts/error-taxonomy.md), [cart-state](../concepts/cart-state.md).
- Payments: [payment-stage](payment-stage.md), [swiggy-money](swiggy-money.md).
- Consumers: [swiggy-cli](swiggy-cli.md); official client configs in [swiggy-manifest-readme](../sources/swiggy-manifest-readme.md).

## Contradictions & uncertainty
- Tool counts quoted across the docs (2026-11-11): 62 on four servers (what-is, reference indexes) vs "Three MCP servers live: Food (20), Instamart (19), Dineout (12)" on the changelog page. Resolution: the per-server reference pages are generated from source; 20/16/11/15 is current.
- Rate limiting: settled on 2026-11-11. No in-app limiter, no headers, no published numbers; gateway 429 + `Retry-After` ([rate-limits-and-sessions](../concepts/rate-limits-and-sessions.md)).

## Changelog
- 2026-09-05 — created from the docs snapshot and live captures.
- 2026-11-11 — November snapshot. Superseded: "Three servers … 51 tools" (20/19/12); "`_meta.swiggy.deprecation` planned; URL pinning `/v1/food`, `/v2/food` planned"; "hosted iframe layer v1.1; Instamart/Dineout widgets v1.2"; the 49 / 35+ / 18+ count contradictions of the September snapshot.
