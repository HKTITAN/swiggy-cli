---
title: OAuth on Swiggy MCP
type: concept
updated: 2026-09-05
sources: [sources/swiggy-builders-docs, sources/live-captures-2026-09-05, sources/swiggy-manifest-readme]
tags: [auth, oauth, pkce]
---
Every caller authenticates with OAuth 2.1 Authorization Code + PKCE (S256) against `https://mcp.swiggy.com/auth`. The user proves identity with phone + OTP in a browser; the client gets a 5-day bearer token that works on all three servers. Dynamic client registration means no pre-issued client id.

## How it works
1. Discovery: `GET https://mcp.swiggy.com/.well-known/oauth-authorization-server` (RFC 8414) → `authorization_endpoint /auth/authorize`, `token_endpoint /auth/token`, `registration_endpoint /auth/register`, scopes `mcp:tools mcp:resources mcp:prompts`, S256, grants `authorization_code` + `refresh_token`, token auth `none|client_secret_post|client_secret_basic` (live capture 2026-09-05). RFC 9728 resource metadata is at the per-path form `/food/.well-known/oauth-protected-resource`; the origin form serves HTML (capture).
2. Registration: MCP clients call `POST /auth/register` transparently (docs start/authenticate) — confirmed live by the presence of `registration_endpoint`.
3. Authorize: `/auth/authorize?response_type=code&client_id&redirect_uri&code_challenge&code_challenge_method=S256&state&scope=mcp:tools`; consent UI uses internal `/auth/send-otp`, `/auth/verify-otp` (docs).
4. Exchange: `POST /auth/token` — docs show a JSON body; standard form encoding is also expected to work (unverified; [open-questions](../synthesis/open-questions.md)). Response `access_token`, `token_type: Bearer`, `expires_in: 432000` (5 days), `scope`.
5. Call: `Authorization: Bearer …` on every request, including `initialize` (handshake capture 2026-09-05).

## Facts
- Redirect URIs must exact-match an allowlist; loopback `http://localhost`, `http://localhost/callback`, `http://127.0.0.1`, `http://127.0.0.1/callback` are allowlisted (manifest README 2026-04-24; RFC 8252 lets any port match). Custom schemes for Claude/Cursor/VS Code/Windsurf/ChatGPT are allowlisted (docs + README).
- Lifetimes: access token 5 days; user session 30 days idle sliding; auth code 120 s single-use (docs).
- **Refresh tokens are not issued in v1.0** despite the metadata advertising the grant; re-run authorization on expiry (docs start/authenticate; roadmap v1.1).
- Errors: 401 → re-auth; 419 → session revoked (full re-auth); 403 → scope; "Cannot resolve session" → missing header; JSON-RPC `-32001` at the transport layer (docs reference/errors).
- Scopes are server-level; per-domain read/write scopes are roadmap (docs).
- One token works on Food, Instamart and Dineout; carts/orders remain per server (docs multi-turn-state).
- Platforms brokering many end users use the delegated on-behalf-of flow (docs enterprise/delegated-auth).

## Relationships
- Used by every tool on [swiggy-mcp](../entities/swiggy-mcp.md). Auth events count toward limits: [rate-limits-and-sessions](rate-limits-and-sessions.md).
- CLI implementation: [swiggy-cli](../entities/swiggy-cli.md) `src/lib/auth.ts` (RFC 9728 → 8414 discovery, DCR, shared token store, browser open, form-then-JSON exchange).

## Contradictions & uncertainty
- swiggy-cli 0.1.x docs claimed "Swiggy does not advertise dynamic client registration" — false as of 2026-09-05 (and probably at launch: the v1.1 roadmap lists DCR, yet the live metadata has it).

## Changelog
- 2026-09-05 — created.
