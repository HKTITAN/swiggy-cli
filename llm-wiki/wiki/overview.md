---
title: Overview
type: synthesis
updated: 2026-09-05
sources: [sources/swiggy-builders-docs, sources/live-captures-2026-09-05, sources/swiggy-money-tweet]
tags: [overview]
---
Swiggy exposes its commerce platform as three MCP servers (Food, Instamart, Dineout) under the "Builders Club" program. Since launch in April 2026 the surface grew from 35 to 51 tools, gained in-chat UPI payments (July), general-availability address creation (August) and a wallet product for agents, Swiggy Money on MCP (announced 4 September). `swiggy-cli` wraps those servers for humans and agents; its 0.2.0 release (this week) re-aligns every command with the documented parameter names, adds the payment stage, and ships skills and plugin manifests so agents can use either the CLI or the servers directly.

## The platform in one screen

| | Food | Instamart | Dineout |
| --- | --- | --- | --- |
| Endpoint | `https://mcp.swiggy.com/food` | `https://mcp.swiggy.com/im` | `https://mcp.swiggy.com/dineout` |
| Tools | 20 | 19 | 12 |
| Place-order tool | `place_food_order` | `checkout` | `book_table` |
| Cart binds to | one restaurant | delivery address | a slot/deal via `create_cart` |
| Limits | ₹1000 cap (Builders Club) | ₹99 minimum | guests 1–20 |
| Cancellation | phone (080-67466729) | phone | `cancel_booking` (rolling out) |

Shared: OAuth 2.1 + PKCE with dynamic registration and one token for all servers ([oauth-on-swiggy-mcp](concepts/oauth-on-swiggy-mcp.md)); the `{success, data, message}` envelope ([error-taxonomy](concepts/error-taxonomy.md)); 70/30 requests per minute ([rate-limits-and-sessions](concepts/rate-limits-and-sessions.md)); the three payment tools ([payment-stage](entities/payment-stage.md)).

## Where to go

- Platform: [swiggy-mcp](entities/swiggy-mcp.md) → server pages → [payment-stage](entities/payment-stage.md), [swiggy-money](entities/swiggy-money.md).
- The CLI: [swiggy-cli](entities/swiggy-cli.md), [native-cli-feel](concepts/native-cli-feel.md), [rust-port-assessment](synthesis/rust-port-assessment.md).
- Agent packaging: [agent-skills](entities/agent-skills.md), [agent-plugins](entities/agent-plugins.md).
- History: [what-changed-apr-to-sep-2026](synthesis/what-changed-apr-to-sep-2026.md). Gaps: [open-questions](synthesis/open-questions.md).
