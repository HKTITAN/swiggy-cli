---
name: swiggy-checkout
description: Place a Swiggy food or Instamart order via swiggy-cli, with the right safety rails. Use only when the human has explicitly asked to checkout — not as a continuation of "add to cart".
---

# swiggy-checkout

Checkout places **real, COD-only orders** that **cannot be cancelled** through the MCP API. Treat every invocation as irreversible.

## Mandatory pre-flight

1. Read the cart. Show the human the items, quantities, and total:
   ```bash
   swiggy food cart --json --no-interactive
   ```
2. Confirm the delivery address with the user. List options:
   ```bash
   swiggy food addresses --json --no-interactive
   ```
3. Repeat back the order summary in plain English and ask for explicit "yes, place the order" confirmation. Do **not** infer consent from a generic "go ahead".

## Run

```bash
swiggy food checkout --address-id <id> --yes --json --no-interactive
# Instamart equivalent:
swiggy instamart checkout --address-id <id> --yes --json --no-interactive
```

`--yes` is required because the underlying tools (`place_food_order`, `checkout`) are flagged destructive. Without it the CLI exits `7` (`CONFIRMATION_REQUIRED`).

## After

- On `ok: true`, save the returned order id and `swiggy food track <id> --json` (or `swiggy instamart track <id> --json`) to follow status.
- On `MCP_ERROR` (exit 6), do **not** retry. Surface the upstream error to the human.

## Forbidden

- Calling checkout right after `add-to-cart` without a human-confirmation turn.
- Calling checkout in a loop or with backoff.
- Substituting another address than the one the human selected, even if the named one is missing.
