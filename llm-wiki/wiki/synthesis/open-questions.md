---
title: Open questions
type: synthesis
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/swiggy-builders-docs, sources/swiggy-money-tweet, sources/live-captures-2026-09-05]
tags: [gaps, todo]
---
Things the sources do not settle, each with the action that would settle it. Lint pass 2026-11-11 (previous: 2026-09-05).

| Question | Why it matters | How to answer |
| --- | --- | --- |
| What do real Scenes responses look like (is `structuredContent` present, where do `latitude`/`longitude` sit, real `checkoutMode` values)? | The Scenes views, the coordinate memory and `data.booking` are built from the reference and mock-server tests only | Sign in, run `swiggy scenes discover --lat … --lng … --raw`, a `shows`, a `cart` and a free booking; file the capture under `raw/` |
| Do any accounts still have the tools removed from the reference (`list_coupons`, `apply_coupon`, `get_order_details`, `cancel_booking`, Dineout `get_saved_locations`)? | Decides when the legacy commands can be deleted | Signed-in `swiggy doctor` reports "still enabled for you"; collect a few results |
| Does any server still return `Mcp-Session-Id` on `initialize`, now that the transport is documented as stateless? | The handshake record handles both cases, but only the "no id" path is documented | `--raw` capture of an `initialize` per server |
| How large are the gateway caps, and what `Retry-After` values come back? | Exit 9 guidance is "wait `Retry-After`"; no number is known | Record the next real 429 |
| Are the ₹1000 Food cap and ₹99 Instamart minimum still enforced? | They appear in recipe prose but in no reference page; the CLI no longer states them | Build a cart on either side of each value and read the server's `error.message` |
| Should tokens move to the OS keychain? | `auth.json` is plaintext (0600, ignored on Windows) while Swiggy's guidance says secure storage | Design decision for the CLI; needs a per-platform storage choice (Windows, macOS, Linux) |
| What attribution line applies to Scenes? | Brand guidelines list Swiggy, Instamart and Dineout only | Ask builders@swiggy.in |
| How does Swiggy Money behave live (insufficient balance message, `swiggyMoney` shape on a funded account)? | Documented since 2026-09-30 but never observed by this project | `swiggy food payment-options --json` on an account with a balance; place one small order |
| Full output schemas of `your_go_to_items` | View falls back to a generic table | `swiggy docs reference/instamart/your_go_to_items` |

## Resolved 2026-11-11 (November docs snapshot)
- How Swiggy Money appears in `get_payment_options` and on which servers: `swiggyMoney { available, id: "SwiggyPay" }`, `groupName: "SWIGGYPAY"`, Food and Instamart only ([swiggy-money](../entities/swiggy-money.md)).
- Token endpoint encoding: the docs specify a JSON body for both the code exchange and the refresh; the CLI now sends JSON first and retries form-encoded only on HTTP 415.
- Does the `refresh_token` grant work: yes, documented (30-day token, rotating refresh token, expired tokens cannot be refreshed); the CLI implements it ([oauth-on-swiggy-mcp](../concepts/oauth-on-swiggy-mcp.md)).
- What `render_restaurants_dineout` is: a documented Dineout tool that draws restaurant cards for widget hosts ([dineout-server](../entities/dineout-server.md)).
- Whether `_meta.swiggy.deprecation` has started: the docs say the field does not exist; deprecations go out by email and changelog.
- Rate-limit headers: documented as not existing; the published per-minute numbers were withdrawn ([rate-limits-and-sessions](../concepts/rate-limits-and-sessions.md)).
- "Does the server return 404 for an expired `Mcp-Session-Id`": moot as asked, since the transport is documented as stateless; the CLI treats 404, 400 and "not initialized" errors on a remembered handshake the same way. The remaining part is the session-id question in the table above.
- The `list_coupons` output schema question is void: the tool left the reference.

## Resolved 2026-09-05
- Dynamic client registration exists (live metadata).
- `initialize` needs auth (handshake capture).
- Ephemeral loopback port accepted for DCR clients (real login on port 50445).
- Rate-limit headers: not emitted as of 2026-09-05 (live capture); 429 handling stays in place.
- `cancel_booking` absent for this account; Instamart coupon/order-detail tools absent too — rollout gating confirmed (live capture). All five were removed from the reference by 2026-11-11.
- Live input schemas match the reference for the cart/order tools checked; extras `tidOverride`, deprecated `cartAmount` (live capture).
