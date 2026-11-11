---
name: swiggy-cli
description: Drive the swiggy CLI, a direct client for Swiggy's public API (Food, Instamart, Dineout, Scenes), from an agent. Use when the user wants to search, order, pay for, book or track anything on Swiggy through the terminal, including table bookings and event tickets. Covers machine-mode flags, the JSON envelope, exit codes, auth detection and when NOT to use the CLI.
license: MIT
compatibility: Requires the swiggy-cli binary (npm i -g swiggy-cli), Node 20+, and a signed-in Swiggy account (swiggy auth init, browser + OTP).
metadata:
  author: HKTITAN
  version: "0.3.0"
  source: https://github.com/HKTITAN/swiggy-cli
---

# swiggy-cli

`swiggy` talks to Swiggy's public API directly (Food, Instamart, Dineout and Scenes) and puts one stable JSON contract in front of it. This skill is the entry point; the task skills (`swiggy-search`, `swiggy-cart`, `swiggy-checkout`, `swiggy-pay`, `swiggy-dineout-booking`, `swiggy-scenes`, `swiggy-track`, `swiggy-address`) assume everything here.

## Always

1. **Run every command with `--json --no-interactive`.** stdout is then exactly one JSON object and the CLI never blocks on a prompt. Human mode prints tables and spinners you would have to parse.
2. **Read `ok`, then branch on `error.code`, never on `error.message`.** Codes are a stable contract; messages change upstream.
3. **Never add `--yes` on your own.** `--yes` is the user's consent to a destructive tool (orders, bookings, cart flush, address delete). Exit code 7 means "ask the human, then re-run with `--yes`".
4. **Never retry an order-placing command after an error.** `food checkout`, `instamart checkout`, `dineout book` and `scenes book` are not de-duplicated by Swiggy; a retry can place a second order. Check `orders`/`status` first. A network failure on one of them returns `error.details.mayHavePlacedOrder: true`: treat the order as possibly placed until you have checked.
5. **Never run bare `swiggy`, `swiggy app` or `swiggy shell`.** They open interactive sessions that wait for keypresses and never return. If a harness might run `swiggy` with no arguments, set `SWIGGY_NO_SHELL=1`.
6. **Resolve the location before you search.** Food/Instamart: `addressId` from `swiggy <server> addresses --json`, or set it once with `swiggy profile set default defaultAddressId <id>`. Dineout: `--lat/--lng` for the city or area (a saved address id is rejected). Scenes: `--address-id` from `swiggy scenes locations`, or `--lat/--lng`. In machine mode the CLI refuses to guess a location (exit 2).

## Envelope

```json
{ "ok": true, "server": "food", "tool": "search_restaurants", "data": { ...tool payload... },
  "meta": { "profile": "default", "message": "…", "payment": {…} } }
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "…", "hint": "…", "details": {} } }
```

`data` is the Swiggy tool's own payload (the `{success,data,message}` wrapper is already removed; fields Swiggy returns next to `data`, such as Scenes `latitude`/`longitude` and `booking`, are merged in). Swiggy's human `message` is in `meta.message`. There is no rate-limit figure in `meta`: Swiggy does not send one. `--raw` returns the untouched tool result.

## Exit code → what to do

| exit | `error.code` | do |
| ---: | --- | --- |
| 0 | — | success |
| 2 | `USAGE` | fix flags; read `error.hint` |
| 3 | `AUTH_REQUIRED` / `AUTH_FAILED` | stop; tell the user to run `swiggy auth init` (browser + OTP; one login covers all four services). The CLI already refreshes tokens on its own, so exit 3 means the refresh was not possible |
| 4 | `NOT_FOUND` | tool not on server; `swiggy tools <server> --json` |
| 5 | `NETWORK` | reads: retry once after 2s, then stop. Order-placing commands (`details.mayHavePlacedOrder`): never retry; check orders first |
| 6 | `MCP_ERROR` | Swiggy rejected the call; surface `error.message` verbatim; do not retry mutations |
| 7 | `CONFIRMATION_REQUIRED` | ask the human; re-run with `--yes` only after explicit consent |
| 8 | `CONFIG_ERROR` | config/profile broken; show `error.hint` |
| 9 | `RATE_LIMITED` | stop for `error.details.retryAfterSeconds`; never tight-loop. Swiggy publishes no limits, so this is the only signal |
| 10 | `PAYMENT_FAILED` | see `swiggy-pay` |

## Servers and discovery

```bash
swiggy servers --json                       # food · instamart (alias im) · dineout · scenes, 62 tools total
swiggy tools food --json                    # live tools/list (needs auth); --offline for the bundled catalog
swiggy schema food search_menu --json       # live JSON Schema for one tool
swiggy call food search_menu --input '{"addressId":"<id>","query":"dosa"}' --json   # any tool, any args
swiggy docs reference/food/search_menu      # official docs page as Markdown
```

Prefer the ergonomic verbs (`swiggy food search -q …`) when one exists: they already use the documented camelCase parameter names. Use `call` for anything else; pass parameters exactly as `swiggy schema` reports them. Commands whose `--help` says `[legacy: …]` call tools Swiggy removed from its reference in November 2026 (Instamart coupons and order details, Dineout cancel and locations); do not build a flow on them.

## Do not use the CLI when

- The question is general knowledge ("does Swiggy deliver in Pune?"). It needs a real account and makes live calls.
- The user has not consented to spending money and the task would place an order.

## Auth check pattern

```bash
swiggy auth status --json | jq -r '.data.servers[] | select(.authenticated|not) | .server'
```

Non-empty output → stop and ask the user to run `swiggy auth init`. The flow is browser-based; an agent cannot complete it.

Full command list: [references/commands.md](references/commands.md).
