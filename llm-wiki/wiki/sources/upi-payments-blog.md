---
title: "Pay in Chat: UPI Payments Come to Swiggy MCP" (blog, 2026-07-10)
type: source
updated: 2026-09-05
sources: []
tags: [source, blog, payments]
---
`https://mcp.swiggy.com/builders/blog/2026-07-10-mcp-payments-upi.md`. Announces the shared Payment stage — `get_payment_options`, `check_payment_status`, `confirm_order` — on Food, Instamart and Dineout, with UPI app intent (GPay, PhonePe, Paytm) and scan-QR, and the `PENDING_PAYMENT` → `PLACED` state machine.

## Claims
- One `get_payment_options` call returns both device surfaces merged into a picker widget that auto-detects the device; Cash is the fallback.
- Orders are created in `PENDING_PAYMENT` and become `PLACED` only after payment; `check_payment_status` is a ~19 s long-poll; the widget polls and auto-finalizes; agents should not poll in widget hosts and must cap their own loops otherwise.
- `confirm_order` is idempotent; Instamart/Dineout reconcile via `paasId`, Food via an address-based contract without `paasId`.
- NPCI: no UPI Collect, no saved VPAs, never ask for a VPA.
- Before this release "MCP orders settled on Cash".

## What it changed in the wiki
Created [payment-stage](../entities/payment-stage.md) and [headless-payments](../concepts/headless-payments.md); superseded the swiggy-cli 0.1.x claim "COD only".
