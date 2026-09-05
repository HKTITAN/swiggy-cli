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
| Does the `refresh_token` grant work at `/auth/token`? (a refresh token IS issued) | Would remove the 5-day re-login | Let the token age past expiry and watch `swiggy auth status` / the refresh attempt |
| What is `render_restaurants_dineout` for outside widget hosts, and what does it return? | Possible richer Dineout view | `swiggy call dineout render_restaurants_dineout --input '{…}' --raw` after a search |
| Exact `_meta` shape for widgets (`hasWidgets`, widget registry) and whether `_meta.swiggy.deprecation` has started | `meta.deprecation` support is speculative | Capture a `--raw` response after sign-in |
| Does the server return 404 for an expired `Mcp-Session-Id` (MCP spec) or something else? | Session-reuse recovery path | Reuse a day-old session id and observe |

## Resolved this session
- Dynamic client registration exists (live metadata) — resolved 2026-09-05.
- `initialize` needs auth — resolved 2026-09-05 (handshake capture).
- Ephemeral loopback port accepted for DCR clients — resolved 2026-09-05 (real login on port 50445).
- Rate-limit headers: not emitted as of 2026-09-05 (live capture); 429 handling stays in place.
- `cancel_booking` absent for this account; Instamart coupon/order-detail tools absent too — rollout gating confirmed (live capture).
- Live input schemas match the reference for the cart/order tools checked; extras `tidOverride`, deprecated `cartAmount` (live capture).
