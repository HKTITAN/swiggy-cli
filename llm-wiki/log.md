# Log

Append-only. `grep "^## \[" log.md | tail -5` shows recent activity.

## [2026-09-05] bootstrap | wiki created
- Instantiated Karpathy's LLM-wiki pattern for the swiggy-cli research memory: `SCHEMA.md`, `index.md`, this log, `raw/`, `wiki/{entities,concepts,sources,synthesis}`.

## [2026-09-05] ingest | Swiggy Builders Club docs (llms-full.txt, 418 KB)
- New: entities/swiggy-mcp, food-server, instamart-server, dineout-server, payment-stage, builders-club; concepts/oauth-on-swiggy-mcp, rate-limits-and-sessions, error-taxonomy, cart-state, headless-payments; sources/swiggy-builders-docs, upi-payments-blog, create-address-ga-blog, builders-club-launch-blog.
- Contradictions recorded: coding-agents page says "Food exposes 14 tools" (reference says 20); changelog says "Food (18 tools)" and "MCP-layer rate limiting not enforced" while rate-limits page says enforced; ship-to-production says 429 not seen "in v1.0"; recipe pages use `items`/`itemId`/`code`/`lat`/`bookingId` while reference uses `cartItems`/`menu_item_id`/`couponCode`/`latitude`/`orderId`. Resolved in favour of the reference.

## [2026-09-05] ingest | live captures (OAuth metadata, initialize handshake capture)
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

## [2026-09-05] ingest | signed-in live capture (tools/list, schemas, auth state) + 0.1.4 vs 0.2.0 benchmark
- raw/2026-09-05-live-tools-and-schemas.md → sources/live-captures-2026-09-05 (new section), concepts/oauth-on-swiggy-mcp (refresh token issued), concepts/rate-limits-and-sessions (no headers), entities/instamart-server (gating), entities/dineout-server (render_restaurants_dineout, tidOverride), entities/swiggy-mcp, entities/swiggy-cli (benchmark, download count).
- open-questions: 4 resolved, 2 added. CLI: doctor wording changed to "not enabled for this account yet".

## [2026-11-11] ingest | Swiggy Builders Club docs (llms-full.txt, 630 KB)
- Source page: sources/swiggy-builders-docs-2026-11 (not vendored; 629,716 bytes, llms.txt 30,097 bytes). `raw/README.md` was not touched in this pass and still lists only the September fetch.
- New: entities/scenes-server; synthesis/what-changed-sep-to-nov-2026.
- Updated: overview; entities/swiggy-mcp (four servers, 62 tools), food-server (Swiggy Money, ₹1000 cap demoted to unverified), instamart-server (16 tools, coupon and order-detail tools removed, `confirmDuplicate`, gift-pack beta), dineout-server (11 tools, coordinates-only search, cancel and saved locations removed, `render_restaurants_dineout` documented), payment-stage (Scenes, FREE, `swiggyMoney.available`), swiggy-money (GA 2026-09-30), builders-club (brand guidelines, read-tool-results), swiggy-cli (0.3.0), agent-skills (16), agent-plugins (four servers); concepts/oauth-on-swiggy-mcp (refresh works), rate-limits-and-sessions (numbers and headers withdrawn, stateless transport), error-taxonomy (result reading, no dedupe), cart-state, headless-payments, native-cli-feel.
- Contradictions recorded on the source page: changelog page still says three servers / 19 Instamart / 12 Dineout tools, COD-only Food and unshipped widgets; recipes still quote ₹1000 and ₹99; what-is page promises canonical error codes; brand guidelines omit Scenes. Resolved in favour of the reference.
- Product docs that had to change: `wiki/` (all pages except the generated catalog), every `skills/*/SKILL.md`, `AGENTS.md`, `SECURITY.md`, `CONTRIBUTING.md`; two new skills (`swiggy-scenes`, `swiggy-mcp-scenes`).

## [2026-11-11] query | "What changed on Swiggy MCP since 0.2.x (September 2026)?"
- Filed as synthesis/what-changed-sep-to-nov-2026; drove the 0.3.0 release scope.

## [2026-11-11] lint | after the November ingest
- open-questions: 6 resolved by the new docs (Swiggy Money surface, token endpoint encoding, refresh grant, `render_restaurants_dineout`, deprecation metadata, rate-limit headers), 7 added (no live Scenes capture, legacy tools, plaintext token storage, session id on a stateless transport, real `Retry-After` values, ₹1000 / ₹99 limits, Scenes attribution).
- 0 orphans: scenes-server, swiggy-builders-docs-2026-11 and what-changed-sep-to-nov-2026 are linked from index and from sibling pages.
- Not done: `SCHEMA.md` still names three servers in its Domain line (humans own that file); `raw/README.md` has no row for the November fetch (raw/ was out of scope).
