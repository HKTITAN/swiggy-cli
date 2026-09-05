# Log

Append-only. `grep "^## \[" log.md | tail -5` shows recent activity.

## [2026-09-05] bootstrap | wiki created
- Instantiated Karpathy's LLM-wiki pattern for the swiggy-cli research memory: `SCHEMA.md`, `index.md`, this log, `raw/`, `wiki/{entities,concepts,sources,synthesis}`.

## [2026-09-05] ingest | Swiggy Builders Club docs (llms-full.txt, 418 KB)
- New: entities/swiggy-mcp, food-server, instamart-server, dineout-server, payment-stage, builders-club; concepts/oauth-on-swiggy-mcp, rate-limits-and-sessions, error-taxonomy, cart-state, headless-payments; sources/swiggy-builders-docs, upi-payments-blog, create-address-ga-blog, builders-club-launch-blog.
- Contradictions recorded: coding-agents page says "Food exposes 14 tools" (reference says 20); changelog says "Food (18 tools)" and "MCP-layer rate limiting not enforced" while rate-limits page says enforced; ship-to-production says 429 not seen "in v1.0"; recipe pages use `items`/`itemId`/`code`/`lat`/`bookingId` while reference uses `cartItems`/`menu_item_id`/`couponCode`/`latitude`/`orderId`. Resolved in favour of the reference.

## [2026-09-05] ingest | live captures (OAuth metadata, unauthenticated probe)
- Confirmed dynamic client registration endpoint, scopes, S256, refresh grant advertised; `initialize` requires auth; resource-metadata URL in WWW-Authenticate serves HTML at the origin form. → sources/live-captures-2026-09-05, concepts/oauth-on-swiggy-mcp.

## [2026-09-05] ingest | Swiggy Money on MCP tweet + manifest issue #49
- New: entities/swiggy-money, sources/swiggy-money-tweet. Payment-stage page gains the `SwiggyPay` group note.

## [2026-09-05] ingest | Swiggy manifest README
- sources/swiggy-manifest-readme; redirect-URI allowlist recorded in concepts/oauth-on-swiggy-mcp; staleness flagged ("COD only").

## [2026-09-05] ingest | Agent Skills spec, skills.sh README, Agent Plugins spec, "How to write good skills"
- New: entities/agent-skills, entities/agent-plugins; sources/agent-skills-spec, agent-plugins-spec, how-to-write-good-skills.

## [2026-09-05] ingest | xai-org/grok-build reading notes
- New: entities/grok-build, sources/grok-build-notes; concepts/native-cli-feel draws on it.

## [2026-09-05] query | "Is Node necessary? Could swiggy-cli move to Rust like Grok Build?"
- Filed as synthesis/rust-port-assessment.

## [2026-09-05] query | "What changed on Swiggy MCP since the CLI's last update (April 2026)?"
- Filed as synthesis/what-changed-apr-to-sep-2026; drove the 0.2.0 release scope.

## [2026-09-05] lint | initial pass
- 0 orphans (every page linked from index and ≥1 sibling). Open items moved to synthesis/open-questions: Swiggy Money tool surface, `your_go_to_items`/`list_coupons` output schemas (truncated in snapshot), whether the token endpoint accepts form encoding, widget `_meta` shape.
