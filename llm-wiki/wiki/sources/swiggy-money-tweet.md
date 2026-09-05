---
title: "introducing @Swiggy Money on MCP" (tweet, 2026-09-04) + manifest issue #49
type: source
updated: 2026-09-05
sources: []
tags: [source, tweet, payments]
---
Raw: `raw/2026-09-04-swiggy-money-on-mcp-tweet.md`, `raw/2026-09-05-swiggy-money-github-issue-49.md`. A Swiggy-affiliated account announces wallet payments for agents on all MCP servers: add money once, agents order and pay without a per-order payment step. Issue #49 (May 2026) shows the demand.

## Claims
- Available "on all MCP — Instamart, Swiggy"; framed as infra for frictionless agentic commerce (discover → decide → order → pay).
- No tool names, parameters or docs; the docs snapshot of 2026-09-05 does not mention it, but Instamart `checkout` accepts `paymentMethod: "SwiggyPay"`.

## What it changed in the wiki
Created [swiggy-money](../entities/swiggy-money.md); `SwiggyPay` handling added to [payment-stage](../entities/payment-stage.md); CLI flag `--pay swiggypay` and skill rules ("only when listed") derived from it.
