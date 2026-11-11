# Index

Catalogue of every page. One line each; the agent reads this first when answering a question. Updated on every ingest.

## Overview
- [overview](wiki/overview.md) — what Swiggy MCP is, where swiggy-cli fits, and the state of both as of 2026-11-11.

## Entities
- [swiggy-mcp](wiki/entities/swiggy-mcp.md) — the platform: four Streamable-HTTP servers at mcp.swiggy.com, 62 tools, OAuth 2.1 with refresh, India-only.
- [food-server](wiki/entities/food-server.md) — `/food`, 20 tools, cart bound to one restaurant, Cash + UPI + Swiggy Money.
- [instamart-server](wiki/entities/instamart-server.md) — `/im`, 16 tools (coupon and order-detail tools removed Nov 2026), `update_cart` replaces, multi-store checkout, `confirmDuplicate`.
- [dineout-server](wiki/entities/dineout-server.md) — `/dineout`, 11 tools, coordinates-only search, free vs paid deals, no cancel tool since Nov 2026.
- [scenes-server](wiki/entities/scenes-server.md) — `/scenes`, 15 tools, events and ticket booking, `checkoutMode` FREE | UPI | UNAVAILABLE, no Cash.
- [payment-stage](wiki/entities/payment-stage.md) — the three shared payment tools and the four place-order tools; which methods each server takes.
- [swiggy-money](wiki/entities/swiggy-money.md) — wallet payments, GA on Food and Instamart since 2026-09-30 as `SwiggyPay`; gated by `swiggyMoney.available`.
- [builders-club](wiki/entities/builders-club.md) — Swiggy's ecosystem program: docs site, access process, support, SLAs, roadmap.
- [swiggy-cli](wiki/entities/swiggy-cli.md) — this project: a direct client for Swiggy's API; versions, contracts, what 0.2.0 and 0.3.0 changed.
- [agent-skills](wiki/entities/agent-skills.md) — the Agent Skills spec and skills.sh CLI; the 16 skills shipped here.
- [agent-plugins](wiki/entities/agent-plugins.md) — the Agent Plugins 1.0.0 format and the Claude Code plugin format; how this repo satisfies both.
- [grok-build](wiki/entities/grok-build.md) — xAI's Rust TUI and the terminal techniques borrowed from it.

## Concepts
- [oauth-on-swiggy-mcp](wiki/concepts/oauth-on-swiggy-mcp.md) — PKCE flow, dynamic registration, one shared token, 5-day expiry, refresh (30 days, rotating), 401/419.
- [rate-limits-and-sessions](wiki/concepts/rate-limits-and-sessions.md) — no published numbers or headers, gateway 429 + Retry-After, stateless transport, handshake hygiene.
- [error-taxonomy](wiki/concepts/error-taxonomy.md) — reading results (`structuredContent` vs envelope), the `{success:false,error}` shape, HTTP/JSON-RPC buckets, no symbolic codes, order placement not de-duplicated.
- [cart-state](wiki/concepts/cart-state.md) — server-side carts, refresh-at-turn-boundary, restaurant/address binding, replace semantics.
- [headless-payments](wiki/concepts/headless-payments.md) — bridgeUrl, polling cadence, per-server confirm contract, status branches.
- [native-cli-feel](wiki/concepts/native-cli-feel.md) — what makes a CLI on a tool-shaped API feel first-party: views, numbered refs, labels, a remembered handshake.

## Sources
- [swiggy-builders-docs-2026-11](wiki/sources/swiggy-builders-docs-2026-11.md) — llms-full.txt snapshot of 2026-11-11 (630 KB): four servers, 62 tools, refresh tokens, no rate numbers; known inconsistencies.
- [swiggy-builders-docs](wiki/sources/swiggy-builders-docs.md) — llms-full.txt snapshot of 2026-09-05: structure, counts, known inconsistencies. Superseded by the November snapshot.
- [upi-payments-blog](wiki/sources/upi-payments-blog.md) — "Pay in Chat" (2026-07-10).
- [create-address-ga-blog](wiki/sources/create-address-ga-blog.md) — "Address, Created" (2026-08-24).
- [builders-club-launch-blog](wiki/sources/builders-club-launch-blog.md) — launch post (2026-04-17).
- [swiggy-money-tweet](wiki/sources/swiggy-money-tweet.md) — @aannuujX announcement (2026-09-04) + GitHub issue #49.
- [swiggy-manifest-readme](wiki/sources/swiggy-manifest-readme.md) — github.com/Swiggy/swiggy-mcp-server-manifest (stale but authoritative for redirect URIs).
- [live-captures-2026-09-05](wiki/sources/live-captures-2026-09-05.md) — OAuth metadata + initialize handshake capture.
- [agent-skills-spec](wiki/sources/agent-skills-spec.md) — agentskills.io + skills.sh.
- [agent-plugins-spec](wiki/sources/agent-plugins-spec.md) — agent-plugins.org.
- [how-to-write-good-skills](wiki/sources/how-to-write-good-skills.md) — Emil Kowalski's rules.
- [grok-build-notes](wiki/sources/grok-build-notes.md) — reading notes on the Rust TUI.
- [karpathy-llm-wiki](wiki/sources/karpathy-llm-wiki.md) — the pattern this wiki follows.

## Synthesis
- [what-changed-apr-to-sep-2026](wiki/synthesis/what-changed-apr-to-sep-2026.md) — timeline of Swiggy MCP changes and their impact on the CLI (drove 0.2.0).
- [what-changed-sep-to-nov-2026](wiki/synthesis/what-changed-sep-to-nov-2026.md) — Scenes, removed tools, refresh tokens, withdrawn rate numbers; what 0.3.0 did about each.
- [open-questions](wiki/synthesis/open-questions.md) — things the sources do not answer yet, with the fetch that would answer them.
- [rust-port-assessment](wiki/synthesis/rust-port-assessment.md) — should swiggy-cli move to Rust like Grok Build? Trade-offs and a staged plan.
