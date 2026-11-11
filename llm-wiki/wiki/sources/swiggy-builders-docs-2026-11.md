---
title: Swiggy Builders Club docs (llms-full.txt snapshot, 2026-11-11)
type: source
updated: 2026-11-11
sources: []
tags: [source, docs]
---
`https://mcp.swiggy.com/builders/llms-full.txt`, fetched 2026-11-11, 629,716 bytes (13,871 lines); index `llms.txt` 30,097 bytes. Not vendored into `raw/` (same rule as the September snapshot; re-fetch to re-ingest). It replaces [swiggy-builders-docs](swiggy-builders-docs.md) (2026-09-05, 418,885 bytes) as the newest reference. The site now has a Build page "Read tool results", an Operate page "Brand guidelines", a fourth server (Scenes) in the reference, and five blog posts.

## Claims extracted
- **Four servers, 62 tools**: Food 20 (`/food`), Instamart 16 (`/im`), Dineout 11 (`/dineout`), Scenes 15 (`/scenes`) (start/what-is-swiggy-mcp; reference indexes). One login covers all four (start/authenticate, "Scopes").
- **Removed from the reference** since September: Instamart `apply_coupon`, `list_coupons`, `get_order_details`; Dineout `cancel_booking`, `get_saved_locations`. **Added**: Dineout `render_restaurants_dineout` (widget cards); the whole Scenes server, which now carries `get_saved_locations`.
- **Dineout search** requires `latitude` + `longitude`; no `addressId`. New optional `filters` (ids from `availableFilters`) and `sortKey` (from `availableSorts`) (reference/dineout/search_restaurants_dineout).
- **Dineout cancellation** text in `book_table` / `get_booking_status`: cancel from the Swiggy Dineout app or call 080-67466729.
- **Refresh tokens work** (start/authenticate): `POST /auth/token`, JSON body `{ grant_type: "refresh_token", refresh_token }`, no `Authorization` header; response `expires_in: 2592000` (30 days) and a rotated `refresh_token`; an expired token cannot be refreshed; errors `400 invalid_request`, `400 invalid_grant`, `500 server_error`. Access token 5 days; code exchange response now includes `refresh_token`.
- **Rate limits** (operate/rate-limits): no in-app limiter, no `X-RateLimit-*` headers, no published numbers; the gateway enforces per-user and aggregate caps and returns 429 + `Retry-After` (JSON-RPC `-32000`). The 70/30 per-minute figures of the September snapshot are gone.
- **Reading results** (build/read-tool-results): read `structuredContent`; when missing or empty (Dineout, Scenes) the first `content` block is the JSON envelope, with tool-specific fields next to `data` (Scenes `latitude`/`longitude`; `get_event_booking_status` returns `booking`).
- **No `_meta.swiggy.deprecation`** and **no symbolic `error.code`** (operate/changelog "known limitations", operate/versioning, reference/errors). Deprecations go out by email and changelog, 6-month window.
- **Stateless transport** (build/ship-to-production, "Observability"): "tracks no session and returns no per-call session id"; guidance stays "never create a new initialize handshake per tool invocation" and "initialize domains sequentially" (operate/rate-limits).
- **Order placement is not de-duplicated** (build/ship-to-production, reference/errors): `place_food_order`, `checkout`, `book_table`, `place_event_order`; no idempotency key; Instamart `checkout` has `confirmDuplicate` for a rejected likely duplicate; check-then-retry rules per server.
- **Swiggy Money** documented on Food and Instamart `get_payment_options` pages (`swiggyMoney { available, id: "SwiggyPay", displayName }`, `allMethods[].groupName: "SWIGGYPAY"`) and in the blog post of 2026-09-30; not on Dineout or Scenes.
- **Scenes**: 15 tools, fixed booking path, `checkoutMode` FREE | UPI | UNAVAILABLE, no Cash (reference/scenes; recipe pay-with-upi "Cash is never offered on Scenes").
- **Widgets**: all four servers flagged `hasWidgets: true`; HTML served over MCP `resources/read`, no public hosting layer (build/widgets).
- **Brand guidelines** at `/docs/operate/brand-guidelines/`: "Powered by Swiggy" / "Powered by Instamart" / "Powered by Dineout" with the matching square logo; avoid "official app", "certified" or endorsement claims.
- **Blog**: gift packs on Instamart (2026-11-04; beta tool `add_gift_pack_to_cart`, visible in `tools/list` only for beta accounts, not in the reference), Swiggy Money (2026-09-30), plus the three posts already ingested.

## Known inconsistencies inside the snapshot
- operate/changelog still describes v1.0 as "Three MCP servers live: Food (20 tools), Instamart (19 tools), Dineout (12 tools)" and lists "Cash-on-delivery only on Food", "Food cart cap ₹1000" and "Instamart and Dineout widgets not shipped" as known limitations. The reference and build/widgets contradict the server count, the payment methods and the widget state.
- The order-food recipe and the voice-vs-chat page still mention the ₹1000 Food cap, and the order-groceries recipe a ₹99 Instamart minimum. No reference page states either. Treated as unverified; the CLI no longer hardcodes them.
- start/what-is promises "canonical error codes your code can branch on"; reference/errors says there is no symbolic `error.code`.
- One warning in build/ship-to-production names only three order tools; the table above it lists four.
- Brand guidelines name three brands; there is no attribution line for Scenes.
- start/authenticate says "Never log tokens to disk in plaintext" and recommends a keychain; swiggy-cli stores `auth.json` in plaintext (recorded on [swiggy-cli](../entities/swiggy-cli.md)).
Resolution rule (SCHEMA): reference pages > live captures > blog/changelog > prose pages.

## What it changed in the wiki
New: [scenes-server](../entities/scenes-server.md), [what-changed-sep-to-nov-2026](../synthesis/what-changed-sep-to-nov-2026.md). Updated: [swiggy-mcp](../entities/swiggy-mcp.md), [food-server](../entities/food-server.md), [instamart-server](../entities/instamart-server.md), [dineout-server](../entities/dineout-server.md), [payment-stage](../entities/payment-stage.md), [swiggy-money](../entities/swiggy-money.md), [builders-club](../entities/builders-club.md), [swiggy-cli](../entities/swiggy-cli.md), [agent-skills](../entities/agent-skills.md), [agent-plugins](../entities/agent-plugins.md), [oauth-on-swiggy-mcp](../concepts/oauth-on-swiggy-mcp.md), [rate-limits-and-sessions](../concepts/rate-limits-and-sessions.md), [error-taxonomy](../concepts/error-taxonomy.md), [cart-state](../concepts/cart-state.md), [headless-payments](../concepts/headless-payments.md), [native-cli-feel](../concepts/native-cli-feel.md), [overview](../overview.md), [open-questions](../synthesis/open-questions.md). Drove swiggy-cli 0.3.0.
