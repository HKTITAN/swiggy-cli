---
title: Swiggy Money on MCP
type: entity
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/swiggy-money-tweet, sources/swiggy-builders-docs]
tags: [payments, wallet, swiggy-money]
---
Swiggy's prepaid wallet as a payment method for agents: the user selects Swiggy Money from the payment options and the balance is debited during order placement, with no UPI handoff. Announced on 2026-09-04 by @aannuujX; documented and generally available on **Food and Instamart** since the blog post of 2026-09-30. It does not apply to Dineout or Scenes.

## Facts
- Announcement: 2026-09-04 15:56, "Swiggy Money on all MCP — Instamart, Swiggy"; "small step in infra, big step in experience" (tweet).
- Demand signal: GitHub issue Swiggy/swiggy-mcp-server-manifest#49 (2026-05-03) asked for exactly this; still open (issue notes).
- Docs (2026-11-11): Food and Instamart `get_payment_options` pages have "Check availability", "Pay with Swiggy Money" and "If payment does not complete" sections; blog post `2026-09-30-swiggy-money` (reference; blog).
- Surface: `get_payment_options` → `swiggyMoney { available: true, id: "SwiggyPay", displayName: "Swiggy Money" }` and an `allMethods[]` entry `{ id: "SwiggyPay", groupName: "SWIGGYPAY" }`. Offer it only when `available` is true; availability does not guarantee the balance covers the total (reference, 2026-11-11).
- Call: `place_food_order` / `checkout` with `paymentMethod: "SwiggyPay"`; no `intentApp`, no `generateUPIQR`. A completed order needs no `check_payment_status` polling and no `confirm_order` (reference, 2026-11-11).
- Failure handling: confirmed debit failure → nothing placed or charged, user tops up in the Swiggy app; unknown outcome → do not claim nothing was charged, user checks orders and balance before any retry; order exists but unsettled → share details, do not retry (reference, 2026-11-11).
- Behaviour, confirmed by the docs on 2026-11-11: no `PENDING_PAYMENT` leg; surfaces via `get_payment_options` only when enabled for the user.

## How the CLI treats it
- `--pay swiggypay` sends `paymentMethod: "SwiggyPay"`; the skills instruct agents to use it only when `payment-options` lists it and never to invent it ([swiggy-cli](swiggy-cli.md), skills `swiggy-pay`, `swiggy-mcp-payments`).

## Relationships
- Part of the [payment-stage](payment-stage.md).

## Contradictions & uncertainty
- Resolved 2026-11-11: Food and Instamart accept `SwiggyPay`, Dineout and Scenes do not; the method id is `SwiggyPay` with `groupName` `SWIGGYPAY`; top-ups happen in the Swiggy app, not through a tool. Still unobserved live with a funded wallet ([open-questions](../synthesis/open-questions.md)).

## Changelog
- 2026-09-05 — created from the tweet and the checkout reference.
- 2026-11-11 — documented and GA. Superseded: "As of 2026-09-05 it is not documented on mcp.swiggy.com"; "`llms-full.txt` has zero occurrences of Swiggy Money/wallet"; "Expected behaviour (inference, not documented)".
