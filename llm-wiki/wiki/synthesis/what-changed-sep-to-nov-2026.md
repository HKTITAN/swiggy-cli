---
title: What changed on Swiggy MCP, September → November 2026
type: synthesis
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/swiggy-builders-docs, sources/live-captures-2026-09-05, sources/swiggy-money-tweet]
tags: [timeline, changelog]
---
Between swiggy-cli 0.2.x (built against the 2026-09-05 docs: three servers, 51 tools) and 0.3.0 (2026-11-11), Swiggy added a fourth server, removed five tools, changed a required parameter on Dineout search, turned refresh tokens on, withdrew its published rate-limit numbers and documented how results and order placement really behave. Continues [what-changed-apr-to-sep-2026](what-changed-apr-to-sep-2026.md).

## Timeline
| Date | Change | Source |
| --- | --- | --- |
| 2026-09-30 | Swiggy Money generally available on Food and Instamart (`paymentMethod: "SwiggyPay"`, debit during placement); not on Dineout or Scenes | [swiggy-builders-docs-2026-11](../sources/swiggy-builders-docs-2026-11.md) (blog) |
| 2026-11-04 | Gift packs on Instamart; beta tool `add_gift_pack_to_cart`, per-account, not in the reference | same (blog) |
| by 2026-11-11 | Scenes server live at `/scenes` with 15 tools: events, shows, ticket booking | same (reference) |
| by 2026-11-11 | Reference drops Instamart `apply_coupon`, `list_coupons`, `get_order_details` and Dineout `cancel_booking`, `get_saved_locations`; adds Dineout `render_restaurants_dineout`. Totals: Food 20, Instamart 16, Dineout 11, Scenes 15 = 62 | same |
| by 2026-11-11 | Dineout search requires `latitude`/`longitude`, no `addressId`; new `filters`, `sortKey` | same |
| by 2026-11-11 | Refresh tokens documented and working: JSON `grant_type=refresh_token`, 30-day token, rotation; expired tokens cannot be refreshed | same (start/authenticate) |
| by 2026-11-11 | Rate-limit numbers and `X-RateLimit-*` headers withdrawn from the docs; gateway 429 + `Retry-After` only | same (operate/rate-limits) |
| by 2026-11-11 | "Read tool results" page: `structuredContent` first, envelope in `content` as the fallback on Dineout and Scenes, fields next to `data` | same |
| by 2026-11-11 | Docs state plainly: no `_meta.swiggy.deprecation`, no symbolic `error.code`, stateless transport, no de-duplication or idempotency key on order placement (`confirmDuplicate` on Instamart `checkout`) | same |
| by 2026-11-11 | Brand guidelines page (per-service "Powered by …", no "official"/"certified" claims) | same |

## What was predicted in September and how it turned out
- "A refresh token is issued but the grant is untested" ([live-captures-2026-09-05](../sources/live-captures-2026-09-05.md)) → the grant works and is documented.
- "No `X-RateLimit-*` headers observed" → now the documented behaviour; the 70/30 numbers were removed rather than implemented.
- "`render_restaurants_dineout` is undocumented" → documented as a Dineout tool for widget hosts.
- "`cancel_booking` and the Instamart coupon tools are gated per account" → removed from the reference entirely.
- "Swiggy Money is undocumented; `SwiggyPay` passed on faith" → documented, with `swiggyMoney.available` as the gate.
- "`_meta.swiggy.deprecation` planned for v1.1" → the docs now say it does not exist; email and changelog instead.

## Impact on the CLI (what 0.3.0 did)
1. New `swiggy scenes` group (alias `events`) covering all 15 tools, with remembered coordinates and a 30-minute ticket cart ([scenes-server](../entities/scenes-server.md)).
2. `dineout search` rejects `--address-id` (exit 2), needs `--lat/--lng` (or profile defaults, or the last coordinates seen), gains `--sort`.
3. Commands for the five removed tools stay, marked `[legacy: …]` in `--help`, excluded from the catalog count and from drift reports (`LEGACY_TOOLS`).
4. Token refresh: when under 24 hours remain and once on a 401; all server entries that share the token are updated together.
5. Handshake recorded per server in `sessions.json` (session id only if issued, token fingerprint, 12-hour TTL); a rejected remembered handshake is redone once and the call replayed.
6. `meta.rateLimit` removed from the envelope; `meta.deprecation` kept and documented as not emitted today.
7. Result reading follows Swiggy's rule, including fields next to `data` and the Scenes `booking` shape.
8. A network failure on an order-placing command returns `details.mayHavePlacedOrder: true` and a check-first hint.
9. `scripts/gen-tools-reference.mjs` regenerates both tool references from `llms-full.txt`; `--check` compares with `TOOL_CATALOG`.
10. Two new skills (`swiggy-scenes`, `swiggy-mcp-scenes`), 16 in total; `skills.sh.json` groups them on skills.sh.
11. Positioning: the project describes itself as a direct client for Swiggy's public API (JSON-RPC over HTTPS with `fetch`), not as a wrapper around an MCP client. The hardcoded "₹1000 Food cap" and "₹99 Instamart minimum" hints were removed because no reference page states them.

## Still open
See [open-questions](open-questions.md): no live Scenes capture, plaintext token storage, whether the legacy tools still answer for any account.
