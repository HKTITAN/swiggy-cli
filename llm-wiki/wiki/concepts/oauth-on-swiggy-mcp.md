---
title: OAuth on Swiggy MCP
type: concept
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/swiggy-builders-docs, sources/live-captures-2026-09-05, sources/swiggy-manifest-readme]
tags: [auth, oauth, pkce]
---
Every caller authenticates with OAuth 2.1 Authorization Code + PKCE (S256) against `https://mcp.swiggy.com/auth`. The user proves identity with phone + OTP in a browser; the client gets a 5-day bearer token that works on all four servers, plus a refresh token that extends the session 30 days at a time. Dynamic client registration means no pre-issued client id.

## How it works
1. Discovery: `GET https://mcp.swiggy.com/.well-known/oauth-authorization-server` (RFC 8414) → `authorization_endpoint /auth/authorize`, `token_endpoint /auth/token`, `registration_endpoint /auth/register`, scopes `mcp:tools mcp:resources mcp:prompts`, S256, grants `authorization_code` + `refresh_token`, token auth `none|client_secret_post|client_secret_basic` (live capture 2026-09-05). RFC 9728 resource metadata is at the per-path form `/food/.well-known/oauth-protected-resource`; the origin form serves HTML (capture).
2. Registration: MCP clients call `POST /auth/register` transparently (docs start/authenticate) — confirmed live by the presence of `registration_endpoint`.
3. Authorize: `/auth/authorize?response_type=code&client_id&redirect_uri&code_challenge&code_challenge_method=S256&state&scope=mcp:tools`; consent UI uses internal `/auth/send-otp`, `/auth/verify-otp` (docs).
4. Exchange: `POST /auth/token` with a JSON body (`grant_type: "authorization_code"`, `code`, `code_verifier`, `redirect_uri`). Response `access_token`, `refresh_token`, `token_type: Bearer`, `expires_in: 432000` (5 days), `scope` (start/authenticate, 2026-11-11).
5. Refresh: `POST /auth/token`, JSON body `{ grant_type: "refresh_token", refresh_token }`, no `Authorization` header (optional `user_id` must match). Response `expires_in: 2592000` (30 days) and a new `refresh_token` (it rotates; currently the same value as the new access token). Works only while the user's session is active; an expired token cannot be refreshed. Errors: `400 invalid_request`, `400 invalid_grant` (do not retry; re-authorize), `500 server_error` (start/authenticate, 2026-11-11).
6. Call: `Authorization: Bearer …` on every request, including `initialize` (handshake capture 2026-09-05).

## Facts
- Redirect URIs must exact-match an allowlist; loopback `http://localhost`, `http://localhost/callback`, `http://127.0.0.1`, `http://127.0.0.1/callback` are allowlisted (manifest README 2026-04-24; RFC 8252 lets any port match). Custom schemes for Claude/Cursor/VS Code/Windsurf/ChatGPT are allowlisted (docs + README).
- Lifetimes: access token 5 days; refreshed token 30 days from each refresh; user session 30 days idle sliding; auth code 120 s single-use (start/authenticate, 2026-11-11).
- Refresh tokens are supported and documented (start/authenticate, 2026-11-11). Guidance on a 401: refresh first, re-authorize only if the refresh fails; store tokens in secure storage and refresh before `expires_at`.
- Errors: 401 → re-auth; 419 → session revoked (full re-auth); 403 → scope; "Cannot resolve session" → missing header; JSON-RPC `-32001` at the transport layer (docs reference/errors).
- Scopes are server-level; per-domain read/write scopes are roadmap (docs).
- One token works on Food, Instamart, Dineout and Scenes; access is controlled at the user level; carts/orders remain per server (start/authenticate "Scopes", 2026-11-11).
- Platforms brokering many end users use the delegated on-behalf-of flow (docs enterprise/delegated-auth).

## Relationships
- Used by every tool on [swiggy-mcp](../entities/swiggy-mcp.md). Auth events count toward limits: [rate-limits-and-sessions](rate-limits-and-sessions.md).
- CLI implementation: [swiggy-cli](../entities/swiggy-cli.md) `src/lib/auth.ts` (RFC 9728 → 8414 discovery, DCR, shared token store, browser open, JSON-first token exchange with one form-encoded retry on 415). Since 0.3.0 it refreshes when under 24 hours remain (a one-shot CLI would almost never hit Swiggy's "≤ 60 s" window), refreshes once more on a 401 and replays the call, and writes the rotated pair to every server entry that shared the old token. Tokens sit in plaintext in `~/.swiggy/auth.json` (0600; ignored on Windows), which falls short of the docs' "secure storage" advice.

## Contradictions & uncertainty
- swiggy-cli 0.1.x docs claimed "Swiggy does not advertise dynamic client registration" — false as of 2026-09-05 (and probably at launch: the v1.1 roadmap lists DCR, yet the live metadata has it).

## Changelog
- 2026-09-05 — created.
- 2026-11-11 — refresh documented. Superseded: "Docs say refresh tokens are not issued in v1.0; a real sign-in on 2026-09-05 nevertheless returned a refresh token; whether `/auth/token` honours `refresh_token` is unverified"; "docs show a JSON body; standard form encoding is also expected to work (unverified)"; "works on all three servers".
