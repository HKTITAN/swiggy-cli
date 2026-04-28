---
name: swiggy-cli
description: How to drive the swiggy-cli (a wrapper over the official Swiggy MCP servers) from inside an agent. Always run in machine mode, branch on stable error codes, and prefer the generic Layer B commands.
---

# swiggy-cli (master skill)

`swiggy-cli` is an unofficial community CLI over the three Swiggy MCP servers — Food, Instamart, Dineout. It exposes every upstream tool through one stable JSON envelope and consistent exit codes, making it safe to call from any agent loop.

## When to use

Use this skill whenever the user asks an agent to:
- search restaurants, dishes, or grocery products on Swiggy
- inspect or mutate a Swiggy cart
- place a Swiggy food / Instamart order (after explicit human approval)
- look up dineout restaurants, slots, or bookings

If the user simply asks a factual question about Swiggy (e.g. "what cuisines do they have"), do **not** invoke the CLI — it requires a real authenticated account.

## Hard rules

1. **Always run in machine mode.** Pass `--json --no-interactive` on every invocation.
2. **Branch on `error.code`, never on `error.message`.** Codes are stable; messages aren't.
3. **Never auto-retry destructive tools.** `place_food_order`, `book_table`, `checkout`, `flush_food_cart`, `clear_cart`, `delete_address` exit with code `7` (`CONFIRMATION_REQUIRED`) without `--yes`. Escalate to the human, do not silently add `--yes`.
4. **Discover tool parameters at runtime** with `swiggy schema <server> <tool> --json`. Do not hard-code argument names.
5. **Prefer Layer B.** `swiggy call <server> <tool> --input '<json>'` is stable across upstream renames; the ergonomic Layer A verbs are sugar.

## Discovery loop

```bash
swiggy servers --json                                   # what servers exist
swiggy tools food --json                                # what tools the food server exposes
swiggy schema food search_restaurants --json            # JSON Schema for one tool
swiggy call food search_restaurants --input '{"query":"biryani"}' --json
```

## Output envelope

Success:
```json
{ "ok": true, "server": "food", "tool": "search_restaurants", "data": <payload>, "meta": {} }
```
Failure:
```json
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "...", "details": {} } }
```

## Exit code → action map

| code | error.code              | action                                  |
| ---: | ----------------------- | --------------------------------------- |
| 0    | —                       | success                                 |
| 2    | `USAGE`                 | fix arguments and retry                 |
| 3    | `AUTH_REQUIRED`         | ask the human to run `swiggy auth init` |
| 4    | `NOT_FOUND`             | tool not exposed; re-list with `tools`  |
| 5    | `NETWORK`               | retry once with backoff; then escalate  |
| 6    | `MCP_ERROR`             | inspect `details`; do not auto-retry mutations |
| 7    | `CONFIRMATION_REQUIRED` | ask the human; never auto-add `--yes`   |

## Subskills

- [`swiggy-search`](../swiggy-search/SKILL.md) — search across food / instamart / dineout
- [`swiggy-cart`](../swiggy-cart/SKILL.md) — read and mutate the food / instamart cart
- [`swiggy-checkout`](../swiggy-checkout/SKILL.md) — place an order, with safety rails
- [`swiggy-dineout-booking`](../swiggy-dineout-booking/SKILL.md) — discover slots and book a table
- [`swiggy-track`](../swiggy-track/SKILL.md) — list / inspect / track orders

## References

- Source: <https://github.com/HKTITAN/swiggy-cli>
- Official MCP manifest: <https://github.com/Swiggy/swiggy-mcp-server-manifest>
- Official builder docs: <https://mcp.swiggy.com/builders/docs/>
