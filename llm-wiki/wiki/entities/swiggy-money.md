---
title: Swiggy Money on MCP
type: entity
updated: 2026-09-05
sources: [sources/swiggy-money-tweet, sources/swiggy-builders-docs]
tags: [payments, wallet, swiggy-money]
---
Swiggy's prepaid wallet made available to MCP agents: the user adds money once and an agent can complete orders without a payment step per order. Announced publicly on 2026-09-04 by @aannuujX ("discover · decide · order · pay"). As of 2026-09-05 it is **not documented** on mcp.swiggy.com; the only documentary hook is the `"SwiggyPay"` payment-method group in the Instamart `checkout` reference.

## Facts
- Announcement: 2026-09-04 15:56, "Swiggy Money on all MCP — Instamart, Swiggy"; "small step in infra, big step in experience" (tweet).
- Demand signal: GitHub issue Swiggy/swiggy-mcp-server-manifest#49 (2026-05-03) asked for exactly this; still open (issue notes).
- Docs: `llms-full.txt` snapshot 2026-09-05 has zero occurrences of "Swiggy Money"/"wallet"; Instamart `checkout` `paymentMethod` description: "Use one of: 'UPI', 'Cash'/'COD', 'SwiggyPay'" (reference).
- Expected behaviour (inference, not documented): behaves like Cash — no `PENDING_PAYMENT` leg — when the wallet balance covers the order; surfaces via `get_payment_options` only when enabled for the account/cart.

## How the CLI treats it
- `--pay swiggypay` sends `paymentMethod: "SwiggyPay"`; the skills instruct agents to use it only when `payment-options` lists it and never to invent it ([swiggy-cli](swiggy-cli.md), skills `swiggy-pay`, `swiggy-mcp-payments`).

## Relationships
- Part of the [payment-stage](payment-stage.md).

## Contradictions & uncertainty
- Whether Food and Dineout also accept `SwiggyPay`, what the method `id`/`groupName` looks like in `get_payment_options`, and whether a top-up flow exists via MCP — all unknown. Tracked in [open-questions](../synthesis/open-questions.md).

## Changelog
- 2026-09-05 — created from the tweet and the checkout reference.
