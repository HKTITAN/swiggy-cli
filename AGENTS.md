# AGENTS.md

> Guidance for AI agents and automations using the `swiggy` CLI, and for coding agents working in this repository. Format follows the [agents.md](https://agents.md/) convention. The same rules are packaged as installable skills under [`skills/`](./skills) (`npx skills add HKTITAN/swiggy-cli`).

## External docs — Swiggy Builders Club

This project integrates the official Swiggy MCP servers. Before writing code that touches Swiggy tool names, parameters, errors, limits or auth, fetch the authoritative docs:

- Index: https://mcp.swiggy.com/builders/llms.txt
- Full text: https://mcp.swiggy.com/builders/llms-full.txt
- Per page: append `.md` to any https://mcp.swiggy.com/builders/docs/... URL (e.g. `/docs/reference/food/search_menu.md`)
- From the CLI: `swiggy docs reference/food/search_menu`

Do not invent tool names or parameters. The bundled catalog in `src/lib/aliases.ts` and `skills/swiggy-mcp/references/tools.md` was verified on 2026-09-05 (51 tools: Food 20, Instamart 19, Dineout 12); the live page wins if they differ. `swiggy doctor` reports catalog drift.

## Using the CLI from an agent

Always pass `--json --no-interactive`, and **never run bare `swiggy`**: with no arguments in a terminal it opens a full-screen app that waits for keypresses (set `SWIGGY_NO_SHELL=1` if a harness might do that). Then:

1. Read `ok`. On `false`, branch on `error.code` (stable), never on `error.message`.
2. Never add `--yes` on your own; exit 7 means ask the human first.
3. Never retry `checkout` / `book` after an error; run `orders --active` / `status` first.
4. Resolve `addressId` once (`swiggy <server> addresses --json`) or set `swiggy profile set default defaultAddressId <id>`.

```bash
swiggy food search -q biryani --json --no-interactive
swiggy call instamart search_products --input '{"addressId":"<id>","query":"milk"}' --json --no-interactive
```

### Envelope

```json
{ "ok": true, "server": "food", "tool": "search_restaurants", "data": <tool payload>,
  "meta": { "profile": "default", "message": "<Swiggy's human message>", "rateLimit": { "limit": 70, "remaining": 61, "reset": 1720000060 }, "payment": { … } } }
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "...", "hint": "...", "details": {} } }
```

`data` is Swiggy's own `data` (the `{success,data,message}` wrapper is removed; `--raw` keeps it). `meta` may gain keys; ignore unknown ones.

### `error.code` → exit code → action

| code | exit | action |
| --- | ---: | --- |
| `USAGE` | 2 | fix flags; `error.hint` says what is missing |
| `AUTH_REQUIRED` / `AUTH_FAILED` | 3 | stop; ask the human to run `swiggy auth init` (browser + OTP; agents cannot do it) |
| `NOT_FOUND` | 4 | tool not on server; `swiggy tools <server> --json` |
| `NETWORK` | 5 | retry once after 2 s; then stop |
| `MCP_ERROR` | 6 | Swiggy rejected the call (domain failure, `isError`, JSON-RPC error); surface `error.message`; never retry mutations |
| `CONFIRMATION_REQUIRED` | 7 | ask the human; re-run with `--yes` only after explicit consent |
| `CONFIG_ERROR` | 8 | broken config/profile |
| `RATE_LIMITED` | 9 | wait `error.details.retryAfterSeconds`; never tight-loop |
| `PAYMENT_FAILED` | 10 | read `meta.payment.outcome` / `error.hint`; see the `swiggy-pay` skill |
| `UNKNOWN` | 1 | report |

### Payments

`checkout --pay cash` places immediately. `checkout --pay upi` returns `meta.payment.pending: true` with `bridgeUrl` (give it to the user) and `meta.payment.next` (the exact `payment-status --wait` command). `--pay upi --wait` does the whole loop and exits 0 only when the order is `PLACED`. Never tell a user an order is placed while `pending` is true. Food confirms with `orderId+addressId+lat+lng`; Instamart/Dineout with `orderId+paasId` — the CLI handles both. `--pay swiggypay` is valid only when `payment-options` lists it.

### Discovery

```bash
swiggy servers --json
swiggy tools food --json          # live (auth); --offline for the bundled catalog
swiggy schema food update_food_cart --json
```

## Auth model

OAuth 2.1 + PKCE against `https://mcp.swiggy.com/auth` with dynamic client registration. One browser login yields one token valid on all three servers, for 5 days; there are no refresh tokens yet, so expiry means re-running `swiggy auth init`. HTTP 401/419 and JSON-RPC `-32001` map to exit 3. Detect before doing work:

```bash
swiggy auth status --json | jq -r '.data.servers[] | select(.authenticated|not) | .server'
```

Headless hosts: pre-provision `~/.swiggy/auth.json` from a workstation and point `SWIGGY_HOME` at it.

## Safety rails

- Gated tools: `place_food_order`, `checkout`, `book_table`, `cancel_booking`, `flush_food_cart`, `clear_cart`, `delete_address`.
- Orders cannot be cancelled via the API; tell the user to call 080-67466729.
- Read the cart before every mutation and before checkout; carts are server-side and the user may edit them in the app.
- Rate limits: 70 req/min per user per server (30 for writes). The CLI reuses one MCP session across invocations; do not spawn parallel `swiggy` processes against the same server.
- Poll `track`/`delivery-status` no faster than every 10 s.

## Networking

- Endpoints `https://mcp.swiggy.com/{food,im,dineout}`; override with `SWIGGY_<SERVER>_URL` or profile `endpoints`.
- Transport: MCP Streamable HTTP (JSON or SSE), protocol `2025-06-18`, `Authorization: Bearer` managed by the CLI, `User-Agent: swiggy-cli/<version>`.
- No telemetry. Outbound calls go only to `mcp.swiggy.com` (MCP, OAuth, docs).

## Working in this repository

- `npm ci && npm run lint && npm test && npm run validate:skills` must pass. `npm test` builds `dist/` first; `test/cli.test.ts` exercises the built binary against `test/helpers/mock-mcp.ts`.
- Adding a tool alias: `src/lib/aliases.ts` (catalog + alias + destructive set) → a verb in `src/commands/<server>.ts` using `buildArgs`/`compact` with the **documented camelCase names** → `wiki/commands.md` → skills that mention it. The test suite fails if a catalog tool has no alias.
- Skills follow the Agent Skills spec: `skills/<name>/SKILL.md`, `name` = directory, description says when to use, strict wording, the "why" next to every rule, under 500 lines. `scripts/validate-skills.mjs` enforces the mechanics.
- Plugin manifests: `plugin.json` + `mcp.json` (Agent Plugins 1.0.0), `.claude-plugin/` + `.mcp.json` (Claude Code). Keep versions in sync with `package.json`.

## Research memory: `llm-wiki/`

`llm-wiki/` is an LLM-maintained wiki (Karpathy's pattern) holding everything learned about Swiggy MCP, dated and sourced. Before changing behaviour that depends on upstream facts (parameters, limits, auth, payments), read `llm-wiki/index.md` and the relevant page; after fetching new Swiggy docs or announcements, follow `llm-wiki/SCHEMA.md` to ingest them (source page → entity/concept updates → index → log). Open gaps live in `llm-wiki/wiki/synthesis/open-questions.md`.

## Where the CLI keeps state

`~/.swiggy/` (or `SWIGGY_HOME`): `config.json`, `auth.json` (0600), `history`, `cache/sessions.json`, `cache/recent.json` (numbered rows from the last listings + follow-up context), `cache/dineout-coords.json`. Inspect with `swiggy config show --json`; do not write these files directly. Agents should pass explicit ids rather than row numbers unless they issued the listing themselves in the same session.
