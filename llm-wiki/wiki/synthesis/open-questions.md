---
title: Open questions
type: synthesis
updated: 2026-09-05
sources: [sources/swiggy-builders-docs, sources/swiggy-money-tweet, sources/live-captures-2026-09-05]
tags: [gaps, todo]
---
Things the sources do not settle, each with the action that would settle it. Lint pass 2026-09-05.

| Question | Why it matters | How to answer |
| --- | --- | --- |
| How does Swiggy Money appear in `get_payment_options` (method `id`, `groupName`), and on which servers? | `--pay swiggypay` passes `"SwiggyPay"` on faith from the Instamart checkout docs | Sign in, run `swiggy instamart payment-options --json` and `swiggy food payment-options --json`; ingest the capture |
| Does `/auth/token` accept `application/x-www-form-urlencoded`, or only JSON? | The CLI tries form first, JSON on 400/415 | Complete one `swiggy auth init` and record which attempt succeeded (add a debug log) |
| Full output schemas of `your_go_to_items` and `list_coupons` | Views fall back to generic tables | `swiggy docs reference/instamart/your_go_to_items`, `…/list_coupons` |
| Exact `_meta` shape for widgets (`hasWidgets`, widget registry) and whether `_meta.swiggy.deprecation` has started | `meta.deprecation` support is speculative | Capture a `--raw` response after sign-in |
| Does the server return 404 for an expired `Mcp-Session-Id` (MCP spec) or something else? | Session-reuse recovery path | Reuse a day-old session id and observe |
| Is rate limiting enforced today (429) or only documented? | Retry advice | Observe `X-RateLimit-*` headers on a real call (`meta.rateLimit`) |
| Does `cancel_booking` appear in `tools/list` for this account? | Dineout `cancel` verb | `swiggy tools dineout --json` |
| Do the live `tools/list` inputSchemas match the reference exactly (e.g. `restaurantName`, `cutleryOptIn`)? | Drift detection | `swiggy doctor` (reports drift) and `swiggy schema food update_food_cart --json` |
| Redirect-URI allowlist: is a non-standard loopback port truly accepted for DCR clients? | `auth init` uses an ephemeral port | First real login |

## Resolved this session
- Dynamic client registration exists (live metadata) — resolved 2026-09-05.
- `initialize` needs auth — resolved 2026-09-05 (probe).
