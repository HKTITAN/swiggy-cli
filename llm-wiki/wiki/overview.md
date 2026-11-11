---
title: Overview
type: synthesis
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/swiggy-builders-docs, sources/live-captures-2026-09-05, sources/swiggy-money-tweet]
tags: [overview]
---
Swiggy exposes its commerce platform as four MCP servers (Food, Instamart, Dineout, Scenes) under the "Builders Club" program. Since launch in April 2026 the surface grew from 35 to 62 tools, gained in-chat UPI payments (July), general-availability address creation (August), Swiggy Money on Food and Instamart (30 September) and an events-and-tickets server, Scenes (by November). That JSON-RPC-over-HTTPS surface is Swiggy's only public API, and `swiggy-cli` is a direct client for it, for humans and agents. Its 0.3.0 release (2026-11-11) adds Scenes, follows the November reference (five tools removed, Dineout search by coordinates only), refreshes tokens, and drops the rate-limit numbers Swiggy withdrew.

## The platform in one screen

| | Food | Instamart | Dineout | Scenes |
| --- | --- | --- | --- | --- |
| Endpoint | `https://mcp.swiggy.com/food` | `https://mcp.swiggy.com/im` | `https://mcp.swiggy.com/dineout` | `https://mcp.swiggy.com/scenes` |
| Tools | 20 | 16 | 11 | 15 |
| Place-order tool | `place_food_order` | `checkout` | `book_table` | `place_event_order` |
| Cart binds to | one restaurant | delivery address | a slot/deal via `create_cart` | one show + ticket via `create_event_cart` |
| Location input | `addressId` | `addressId` | `latitude`/`longitude` only | either; echoes the coordinates it resolved |
| Payment | Cash, UPI, Swiggy Money | Cash, UPI, Swiggy Money | free, or UPI for paid deals | FREE or UPI; never Cash |
| Cancellation | phone (080-67466729) | phone | Swiggy Dineout app or phone | not documented |

Shared: OAuth 2.1 + PKCE with dynamic registration, one login for all servers and working refresh tokens ([oauth-on-swiggy-mcp](concepts/oauth-on-swiggy-mcp.md)); `structuredContent` or the `{success, data, message}` envelope ([error-taxonomy](concepts/error-taxonomy.md)); gateway rate limiting with no published numbers ([rate-limits-and-sessions](concepts/rate-limits-and-sessions.md)); the three payment tools ([payment-stage](entities/payment-stage.md)). The "₹1000 Food cap" and "₹99 Instamart minimum" shown here until 2026-11-11 appear only in recipe prose, not in the reference, and are now treated as unverified.

## Where to go

- Platform: [swiggy-mcp](entities/swiggy-mcp.md) → server pages (incl. [scenes-server](entities/scenes-server.md)) → [payment-stage](entities/payment-stage.md), [swiggy-money](entities/swiggy-money.md).
- The CLI: [swiggy-cli](entities/swiggy-cli.md), [native-cli-feel](concepts/native-cli-feel.md), [rust-port-assessment](synthesis/rust-port-assessment.md).
- Agent packaging: [agent-skills](entities/agent-skills.md), [agent-plugins](entities/agent-plugins.md).
- History: [what-changed-apr-to-sep-2026](synthesis/what-changed-apr-to-sep-2026.md), [what-changed-sep-to-nov-2026](synthesis/what-changed-sep-to-nov-2026.md). Gaps: [open-questions](synthesis/open-questions.md).
