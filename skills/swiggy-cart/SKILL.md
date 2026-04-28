---
name: swiggy-cart
description: Inspect or mutate the user's Swiggy food / Instamart cart through swiggy-cli. Use when the user says "add X to my cart", "what's in my cart", or "clear the cart".
---

# swiggy-cart

Cart commands are split per server because food and groceries are physically separate carts upstream.

## Read

```bash
swiggy food cart --json --no-interactive
swiggy instamart cart --json --no-interactive
```

`data` is the upstream cart object — items, totals, applied coupons. Always read before any mutation so you can tell the human what's about to change.

## Mutate

```bash
swiggy food add-to-cart --restaurant-id <id> --item-id <itemId> --quantity 2 --json
swiggy instamart add-to-cart --product-id <id> --quantity 1 --json

# Need a parameter the ergonomic flags don't cover? Use --input:
swiggy food add-to-cart --input '{"restaurant_id":"x","items":[...]}' --json
```

## Clear (destructive)

`flush_food_cart` and `clear_cart` are gated. Without `--yes` in non-interactive mode they exit `7`:

```bash
swiggy food clear-cart --yes --json --no-interactive       # only after explicit human approval
swiggy instamart clear-cart --yes --json --no-interactive
```

**Never auto-add `--yes`.** Ask the human first, then re-issue the command.

## Common pitfalls

- Adding items from two different restaurants in food. Swiggy enforces single-restaurant carts; the second add typically returns an `MCP_ERROR` asking to clear the cart. Surface that to the human.
- Stale carts. If the user opens the Swiggy mobile app while you operate the CLI, sessions can conflict. If reads start failing with `AUTH_REQUIRED`, ask them to close the app and re-auth.
