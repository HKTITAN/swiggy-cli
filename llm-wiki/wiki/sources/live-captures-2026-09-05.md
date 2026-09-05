---
title: Live captures, 2026-09-05
type: source
updated: 2026-09-05
sources: []
tags: [source, capture, auth]
---
Raw: `raw/2026-09-05-swiggy-oauth-metadata.json`, `raw/2026-09-05-swiggy-mcp-unauth-probe.md`. What the production endpoints actually returned on 2026-09-05, independent of the docs.

## Claims
- Authorization-server metadata confirms: issuer `https://mcp.swiggy.com/auth`, DCR endpoint `/auth/register`, scopes `mcp:tools mcp:resources mcp:prompts`, S256, grants `authorization_code` + `refresh_token`, token auth methods `none | client_secret_post | client_secret_basic`.
- Protected-resource metadata is served at the per-path form (`/food/.well-known/oauth-protected-resource`, RS256); the origin form serves the swiggy.com homepage HTML even though `WWW-Authenticate` points there.
- `initialize` without a token → 401 `{"error":"invalid_token"}`; CloudFront in front (DEL PoP); no rate-limit headers on the 401.

## What it changed in the wiki
Confirmed/added to [oauth-on-swiggy-mcp](../concepts/oauth-on-swiggy-mcp.md) and [swiggy-mcp](../entities/swiggy-mcp.md). Motivated the CLI's discovery order (per-path resource metadata first) and "auth even on initialize".
