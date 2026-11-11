---
title: Native CLI feel over an MCP
type: concept
updated: 2026-11-11
sources: [sources/grok-build-notes, sources/swiggy-builders-docs, sources/swiggy-builders-docs-2026-11, sources/how-to-write-good-skills]
tags: [cli, ux, design]
---
Swiggy's public API is tool-shaped (JSON-RPC calls named like `search_restaurants`). A CLI on such an API feels like a wrapper when it exposes tool names, raw JSON and id-passing. It feels first-party when it speaks the domain (restaurants, carts, bookings, tickets), remembers what it just showed you, and never makes you copy an id. swiggy-cli has applied six moves since 0.2.0 to get there; everything is derived from Swiggy's documented output schemas.

## The six moves
1. **Domain views, not generic tables.** One renderer per response shape (restaurants, menu, dishes, food cart with bill, products with variations, Instamart cart, orders, order detail, tracking with a progress bar, dineout results, details with deals, slots grouped by date, booking card, payment options with the matching `--pay` flag, placed-order card). Each ends with a "next:" hint naming the actual next command. Source: the `Output schema` blocks in the reference (2026-09-05).
2. **Numbered rows and positional references.** Every listing numbers rows and stores `{id, label, extra}` in `~/.swiggy/cache/recent.json`; the next command accepts `2` or `#2`: `food menu 1`, `food add 3 --qty 2`, `instamart add 1`, `dineout slots 1`, `dineout book 2 --guests 2`, `food order 1`. Raw ids still work. Follow-up context (restaurantId, restaurantName, slot fields, coordinates) rides along so the user never re-types it.
3. **Natural verbs and merge semantics.** `add` instead of `add-to-cart`; `instamart add` merges into the current cart because upstream `update_cart` replaces ([cart-state](cart-state.md)); `dineout book` on a paid slot creates the cart itself; positional queries (`food search biryani`).
4. **Plain-language progress and errors.** "Searching restaurants · food" instead of `tools/call search_restaurants`; errors say what to do next ("Run: swiggy food addresses…"); tool names appear only dimmed after success and in `--json`.
5. **Terminal craft from Grok Build.** Adaptive colour, OSC 8 links, synchronized-output status line with elapsed time, OSC 9;4 progress, SIGINT cleanup ([grok-build](../entities/grok-build.md)).
6. **Warm connection.** `swiggy shell` keeps the process alive; a remembered handshake (per server, 12 h, tied to the token) lets separate invocations skip `initialize` ([rate-limits-and-sessions](rate-limits-and-sessions.md)).
7. **Carried context for multi-step bookings (0.3.0).** Scenes needs a venue id, exact show and ticket ids and the coordinates Swiggy resolved; `scenes shows <#>` looks up the venue itself, `scenes cart --show <#>` copies the ids, and `scenes book` reuses the cart for 30 minutes ([scenes-server](../entities/scenes-server.md)).

## What still marks it as a wrapper (and why)
- Layer B (`call`, `schema`, `tools`) is deliberately exposed for agents and future tools.
- Views are built from documented schemas, not observed traffic; fields Swiggy adds later fall back to the generic table until the view is updated ([open-questions](../synthesis/open-questions.md): capture real responses once signed in).
- Startup is Node's (~100 ms), not a native binary's ([rust-port-assessment](../synthesis/rust-port-assessment.md)).

## Relationships
- [swiggy-cli](../entities/swiggy-cli.md), [grok-build](../entities/grok-build.md), [cart-state](cart-state.md).

## Changelog
- 2026-09-05 — created.
- 2026-11-11 — reframed (the CLI is a direct client for the API, not a layer over an MCP client); move 7 added. Superseded: "persisted `Mcp-Session-Id` makes even separate invocations skip the handshake" (the session id is optional now; the handshake record is what is kept).
