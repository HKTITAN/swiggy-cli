---
name: swiggy-search
description: Search restaurants, menu items, grocery products, or dineout venues on Swiggy via the swiggy-cli. Use when a user asks "find me X on Swiggy" or "what biryani places are open near me".
---

# swiggy-search

Discovery on Swiggy spans three servers. Pick by intent:

| User intent                              | Server      | Command                                      |
| ---------------------------------------- | ----------- | -------------------------------------------- |
| restaurants delivering food              | `food`      | `swiggy food search-restaurants -q <query>`  |
| a specific dish across restaurants       | `food`      | `swiggy food search-menu -q <query>`         |
| the menu of one known restaurant         | `food`      | `swiggy food menu --restaurant-id <id>`      |
| grocery / FMCG                           | `instamart` | `swiggy instamart search -q <query>`         |
| frequent grocery items                   | `instamart` | `swiggy instamart go-to-items`               |
| dine-in / reservations                   | `dineout`   | `swiggy dineout search -q <query> -c <city>` |
| details of a dineout restaurant          | `dineout`   | `swiggy dineout details <id>`                |

## Always

- Append `--json --no-interactive` so the result is machine-parseable.
- Filter and rank in your own prompt; do not assume the upstream sort order is meaningful.
- If `error.code === "AUTH_REQUIRED"` (exit 3), ask the human to run `swiggy auth init` and stop.

## Steps

1. Map the user's request to the right server (table above).
2. If you don't know the parameter names, run `swiggy schema <server> <tool> --json` first.
3. Run the search.
4. Parse `data` and present a concise top-N list with name, rating, and id.
5. Hand control back — do not auto-call `add-to-cart` or `book` from a search step.

## Example

```bash
swiggy food search-restaurants -q biryani -c Delhi --json --no-interactive
# → { "ok": true, "data": [ ... ], "meta": { "profile": "default" } }
```
