---
title: Live captures, 2026-09-05
type: source
updated: 2026-09-05
sources: []
tags: [source, capture, auth]
---
Raw: `raw/2026-09-05-swiggy-oauth-metadata.json`, `raw/2026-09-05-swiggy-mcp-initialize-capture.md`. What the production endpoints actually returned on 2026-09-05, independent of the docs.

## Claims
- Authorization-server metadata confirms: issuer `https://mcp.swiggy.com/auth`, DCR endpoint `/auth/register`, scopes `mcp:tools mcp:resources mcp:prompts`, S256, grants `authorization_code` + `refresh_token`, token auth methods `none | client_secret_post | client_secret_basic`.
- Protected-resource metadata is served at the per-path form (`/food/.well-known/oauth-protected-resource`, RS256); the origin form serves the swiggy.com homepage HTML even though `WWW-Authenticate` points there.
- `initialize` without a token → 401 `{"error":"invalid_token"}`; CloudFront in front (DEL PoP); no rate-limit headers on the 401.

## Signed-in capture (later the same day)
Raw: `raw/2026-09-05-live-tools-and-schemas.md`.
- A refresh token **was** issued at sign-in (`hasRefresh: true`), contradicting the docs' "not wired in v1.0"; the refresh grant itself is untested.
- `tools/list` per account: Food 20 (in sync); Instamart 16 (`apply_coupon`, `list_coupons`, `get_order_details` absent); Dineout 12 (`cancel_booking` absent; undocumented `render_restaurants_dineout` present — a widget-rendering tool taking `restaurantIds[]` + `searches[]`).
- Live schemas match the reference for `update_food_cart`, `update_cart`, `place_food_order`, `checkout`, `search_products`; extras: `book_table.tidOverride`, deprecated `get_payment_options.cartAmount`.
- No `X-RateLimit-*` headers on any response.
- Instamart `get_payment_options` on an empty cart → `allMethods: []` (Swiggy Money still unobserved).

## What it changed in the wiki
Confirmed/added to [oauth-on-swiggy-mcp](../concepts/oauth-on-swiggy-mcp.md) and [swiggy-mcp](../entities/swiggy-mcp.md). Motivated the CLI's discovery order (per-path resource metadata first) and "auth even on initialize".
