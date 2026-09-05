---
title: What changed on Swiggy MCP, April → September 2026
type: synthesis
updated: 2026-09-05
sources: [sources/builders-club-launch-blog, sources/upi-payments-blog, sources/create-address-ga-blog, sources/swiggy-money-tweet, sources/swiggy-builders-docs, sources/live-captures-2026-09-05]
tags: [timeline, changelog]
---
Between swiggy-cli 0.1.4 (2026-04-30, built against a 35-tool catalog) and 0.2.0 (2026-09-05), Swiggy's MCP surface grew by 16 tools, gained payments, general-availability address management, cancellation, structured delivery status, and a wallet for agents. None of it was reflected in the CLI, and the CLI's own parameter names were wrong from the start.

## Timeline
| Date | Change | Source |
| --- | --- | --- |
| 2026-01 → 04 | Manifest repo: client configs, redirect URIs; "COD only", "free bookings only" | [swiggy-manifest-readme](../sources/swiggy-manifest-readme.md) |
| 2026-04-17 | Builders Club announced: "3 servers, 18+ tools", invite-based access | [builders-club-launch-blog](../sources/builders-club-launch-blog.md) |
| 2026-04-28 | swiggy-cli 0.1.0 published against a 35-tool catalog with guessed snake_case params | [swiggy-cli](../entities/swiggy-cli.md) |
| 2026-07-10 | UPI payments: `get_payment_options`, `check_payment_status`, `confirm_order` on all servers; `PENDING_PAYMENT` state; Dineout paid deals | [upi-payments-blog](../sources/upi-payments-blog.md) |
| 2026-08-24 | `create_address` / `delete_address` GA for everyone, on Food too; lat/lng optional | [create-address-ga-blog](../sources/create-address-ga-blog.md) |
| by 2026-09-05 | Reference lists 51 tools incl. `get_food_delivery_status`, `get_delivery_status`, `list_coupons`, `apply_coupon`, `cancel_booking` (rolling out); rate limiting documented as enforced with 429; DCR live | [swiggy-builders-docs](../sources/swiggy-builders-docs.md), [live-captures-2026-09-05](../sources/live-captures-2026-09-05.md) |
| 2026-09-04 | Swiggy Money on MCP announced | [swiggy-money-tweet](../sources/swiggy-money-tweet.md) |

## Impact on the CLI (what 0.2.0 had to do)
1. Re-derive every Layer A verb from the reference (camelCase names; `cartItems[].menu_item_id`; `selectedAddressId` + `items[].spinId`; Dineout `latitude`/`longitude`, `slotId`/`itemId`/`reservationTime`/`guestCount`).
2. Add the payment stage and a headless UPI loop; support `SwiggyPay`.
3. Add verbs for the new tools; change `instamart add-to-cart` to reflect replace semantics.
4. Replace the auth story: DCR, one shared token, 5-day expiry, no refresh, 419.
5. Handle 429 and persist sessions.
6. Ship skills/plugins so agents get the corrected knowledge.

## Still open
See [open-questions](open-questions.md).
