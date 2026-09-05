---
title: Swiggy Builders Club docs (llms-full.txt snapshot)
type: source
updated: 2026-09-05
sources: []
tags: [source, docs]
---
`https://mcp.swiggy.com/builders/llms-full.txt`, fetched 2026-09-05 06:32 UTC, 418,885 bytes; index `llms.txt` 12,845 bytes. Every docs page concatenated: Start (what-is, authenticate, coding-agents, consumer configs, developer quickstart, enterprise/delegated auth), Build (recipes: order food, order groceries, book a table, combined, pay with UPI; agent patterns: multi-turn cart state, voice vs chat; widgets; ship to production), Operate (access, changelog, data & compliance, rate limits, SLA, support, versioning), Reference (index + 51 tool pages with Parameters / Response / Output schema / Schema notes / Details), and three blog posts.

## Claims extracted
- 51 tools: Food 20, Instamart 19, Dineout 12 with exact camelCase parameters → [swiggy-mcp](../entities/swiggy-mcp.md) and server pages; the full parameter table is regenerated into `skills/swiggy-mcp/references/tools.md` and `wiki/tools-catalog.md` by a script.
- Auth, rate limits, errors, versioning, payments as recorded on the concept pages.
- Roadmap markers: symbolic `error.code`, `_meta.swiggy.deprecation`, refresh tokens, widgets for IM/Dineout, URL pinning.

## Known inconsistencies inside the snapshot
- Tool counts vary by page (51 / 49 / 35+ / 18+; Food 20 / 18 / 14).
- Recipe pages use older parameter names (`items`, `itemId`, `code`, `lat`/`lng`, `guestCount` on slots, `bookingId`) that the reference pages replace.
- Rate limiting described as both enforced and not enforced.
- Coding-agents smoke test expects "14" Food tools.
Resolution rule (SCHEMA): reference pages > live captures > blog/changelog > prose pages.

## What it changed in the wiki
Created most entity and concept pages on 2026-09-05. Drove swiggy-cli 0.2.0 ([what-changed-apr-to-sep-2026](../synthesis/what-changed-apr-to-sep-2026.md)).
