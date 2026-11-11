# AGENTS.md

> Guidance for AI agents and automations using the `swiggy` CLI, and for coding agents working in this repository. Format follows the [agents.md](https://agents.md/) convention. The same rules are packaged as installable skills under [`skills/`](./skills) (`npx skills add HKTITAN/swiggy-cli`).

## External docs — Swiggy Builders Club

This project is a direct client for Swiggy's public API: JSON-RPC over HTTPS (the Model Context Protocol transport) at `mcp.swiggy.com/{food,im,dineout,scenes}`, spoken with `fetch`, no SDK in between. Before writing code that touches Swiggy tool names, parameters, errors, limits or auth, fetch the authoritative docs:

- Index: https://mcp.swiggy.com/builders/llms.txt
- Full text: https://mcp.swiggy.com/builders/llms-full.txt
- Per page: append `.md` to any https://mcp.swiggy.com/builders/docs/... URL (e.g. `/docs/reference/food/search_menu.md`)
- From the CLI: `swiggy docs reference/food/search_menu`

Do not invent tool names or parameters. The bundled catalog in `src/lib/aliases.ts`, `wiki/tools-catalog.md` and `skills/swiggy-mcp/references/tools.md` match Swiggy's reference of 2026-11-11 (62 tools: Food 20, Instamart 16, Dineout 11, Scenes 15); the live page wins if they differ. The two Markdown references are generated: run `node scripts/gen-tools-reference.mjs` to refresh them and `node scripts/gen-tools-reference.mjs --check` to compare the published list with `TOOL_CATALOG`. `swiggy doctor` reports drift against your account's live `tools/list`.

## Using the CLI from an agent

Always pass `--json --no-interactive`, and **never run bare `swiggy`**: with no arguments in a terminal it opens a full-screen app that waits for keypresses (set `SWIGGY_NO_SHELL=1` if a harness might do that). Then:

1. Read `ok`. On `false`, branch on `error.code` (stable), never on `error.message`.
2. Never add `--yes` on your own; exit 7 means ask the human first.
3. Never retry `checkout` / `book` after an error; run `orders --active` / `status` first. Swiggy does not de-duplicate order placement. A network failure on an order-placing command returns `error.details.mayHavePlacedOrder: true`.
4. Resolve the location once. Food/Instamart: `addressId` (`swiggy <server> addresses --json`) or `swiggy profile set default defaultAddressId <id>`. Dineout: `--lat/--lng` or profile `defaultLat`/`defaultLng` (`--address-id` is rejected, exit 2). Scenes: `--address-id` from `swiggy scenes locations`, or `--lat/--lng`.

```bash
swiggy food search -q biryani --json --no-interactive
swiggy call instamart search_products --input '{"addressId":"<id>","query":"milk"}' --json --no-interactive
```

### Envelope

```json
{ "ok": true, "server": "food", "tool": "search_restaurants", "data": <tool payload>,
  "meta": { "profile": "default", "message": "<Swiggy's human message>", "payment": { … } } }
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "...", "hint": "...", "details": {} } }
```

`data` is Swiggy's own payload: `structuredContent`, or the `data` of the `{success,data,message}` envelope when Swiggy sends none (Dineout, Scenes), with fields next to `data` merged in (Scenes `latitude`/`longitude`, `booking`). `--raw` keeps the untouched result. `meta` may gain keys; ignore unknown ones. `meta.rateLimit` no longer exists (Swiggy sends no quota headers); `meta.deprecation` is passed through but Swiggy does not emit it today.

### `error.code` → exit code → action

| code | exit | action |
| --- | ---: | --- |
| `USAGE` | 2 | fix flags; `error.hint` says what is missing |
| `AUTH_REQUIRED` / `AUTH_FAILED` | 3 | stop; ask the human to run `swiggy auth init` (browser + OTP; agents cannot do it). The CLI has already tried to refresh the token |
| `NOT_FOUND` | 4 | tool not on server; `swiggy tools <server> --json` |
| `NETWORK` | 5 | reads: retry once after 2 s, then stop. With `details.mayHavePlacedOrder: true`: never retry; check orders (or ask the human to check the Swiggy app for Dineout/Scenes) |
| `MCP_ERROR` | 6 | Swiggy rejected the call (domain failure, `isError`, JSON-RPC error); surface `error.message`; never retry mutations |
| `CONFIRMATION_REQUIRED` | 7 | ask the human; re-run with `--yes` only after explicit consent |
| `CONFIG_ERROR` | 8 | broken config/profile |
| `RATE_LIMITED` | 9 | wait `error.details.retryAfterSeconds` (Swiggy's `Retry-After`); never tight-loop |
| `PAYMENT_FAILED` | 10 | read `meta.payment.outcome` / `error.hint`; see the `swiggy-pay` skill |
| `UNKNOWN` | 1 | report |

### Payments

`checkout --pay cash` places immediately. `checkout --pay upi` returns `meta.payment.pending: true` with `bridgeUrl` (give it to the user) and `meta.payment.next` (the exact `payment-status --wait` command). `--pay upi --wait` does the whole loop and exits 0 only when the order is `PLACED`. Never tell a user an order is placed while `pending` is true. Food confirms with `orderId+addressId+lat+lng`; Instamart, Dineout and Scenes with `orderId+paasId`; the CLI handles all four. `--pay swiggypay` (Swiggy Money, Food and Instamart only) is valid only when `payment-options` lists it, and completes inside the checkout call. Scenes: `scenes cart` reports `checkoutMode` `FREE | UPI | UNAVAILABLE`; a free cart books with plain `scenes book`, a paid one needs `--pay upi`, and `--pay cash` is rejected because Scenes never offers Cash.

### Discovery

```bash
swiggy servers --json
swiggy tools food --json          # live (auth); --offline for the bundled catalog
swiggy schema food update_food_cart --json
```

## Auth model

OAuth 2.1 + PKCE against `https://mcp.swiggy.com/auth` with dynamic client registration. One browser login covers Food, Instamart, Dineout and Scenes. The access token lasts 5 days; the CLI refreshes it (`POST /auth/token`, JSON body, `grant_type: refresh_token`, which returns a 30-day token and a rotated refresh token) when under 24 hours remain and once on an HTTP 401, and updates every server entry that shares the token. An already-expired token cannot be refreshed, so a machine that goes unused past expiry needs `swiggy auth init` again. HTTP 401 (after the one refresh), 403, 419 and JSON-RPC `-32001` map to exit 3. Detect before doing work:

```bash
swiggy auth status --json | jq -r '.data.servers[] | select(.authenticated|not) | .server'
```

Headless hosts: pre-provision `~/.swiggy/auth.json` from a workstation and point `SWIGGY_HOME` at it. That file holds the access and refresh tokens in plaintext; handle it as a credential.

## Safety rails

- Gated tools (confirmation, or `--yes` in machine mode): `place_food_order`, `checkout`, `book_table`, `place_event_order`, `cancel_booking`, `flush_food_cart`, `clear_cart`, `delete_address`.
- Order placement (`place_food_order`, `checkout`, `book_table`, `place_event_order`) is not de-duplicated by Swiggy and takes no idempotency key. The CLI never retries it; neither should you.
- Legacy commands (`instamart list-coupons`, `instamart apply-coupon`, `instamart order`, `dineout cancel`, `dineout locations`) call tools Swiggy removed from its reference in November 2026. They work only if the account still has the tool; do not build flows on them.
- Orders cannot be cancelled via the API; tell the user to call 080-67466729 (Dineout bookings: the Swiggy Dineout app, or the same number).
- Read the cart before every mutation and before checkout; carts are server-side and the user may edit them in the app.
- Rate limits: Swiggy publishes no numbers and sends no `X-RateLimit-*` headers; its gateway answers HTTP 429 with `Retry-After`. The CLI remembers one handshake per server across invocations instead of sending `initialize` per call; do not spawn parallel `swiggy` processes against the same server.
- Poll `track`/`delivery-status` no faster than every 10 s.

## Networking

- Endpoints `https://mcp.swiggy.com/{food,im,dineout,scenes}`; override with `SWIGGY_<SERVER>_URL` or profile `endpoints`.
- Transport: JSON-RPC 2.0 over HTTPS (MCP Streamable HTTP, JSON or SSE responses), protocol `2025-06-18`, `Authorization: Bearer` managed by the CLI, `User-Agent: swiggy-cli/<version>`. The client is `src/lib/mcp.ts`, built on `fetch`; there is no SDK and no child process.
- No telemetry. Outbound calls go only to `mcp.swiggy.com` (MCP, OAuth, docs).

## Working in this repository

- `npm ci && npm run lint && npm test && npm run validate:skills` must pass. `npm test` builds `dist/` first; `test/cli.test.ts` exercises the built binary against `test/helpers/mock-mcp.ts`.
- Adding a tool alias: `src/lib/aliases.ts` (catalog + alias + destructive / non-idempotent sets) → a verb in `src/commands/<server>.ts` using `buildArgs`/`compact` with the **documented camelCase names** → `wiki/commands.md` → skills that mention it. The test suite fails if a catalog tool has no alias. A tool Swiggy removes moves to `LEGACY_TOOLS`; a tool that only drives a chat widget goes in `WIDGET_ONLY_TOOLS`.
- Never hand-edit `wiki/tools-catalog.md` or `skills/swiggy-mcp/references/tools.md`; regenerate them with `node scripts/gen-tools-reference.mjs`.
- Skills follow the Agent Skills spec: `skills/<name>/SKILL.md`, `name` = directory, description says when to use, strict wording, the "why" next to every rule, under 500 lines. `scripts/validate-skills.mjs` enforces the mechanics. `skills.sh.json` groups them on skills.sh ("Start here", "Use the CLI", "Use Swiggy directly"); add a new skill to its group.
- Plugin manifests: `plugin.json` + `mcp.json` (Agent Plugins 1.0.0), `.claude-plugin/` + `.mcp.json` (Claude Code). Keep versions in sync with `package.json`.

## Research memory: `llm-wiki/`

`llm-wiki/` is an LLM-maintained wiki (Karpathy's pattern) holding everything learned about Swiggy MCP, dated and sourced. Before changing behaviour that depends on upstream facts (parameters, limits, auth, payments), read `llm-wiki/index.md` and the relevant page; after fetching new Swiggy docs or announcements, follow `llm-wiki/SCHEMA.md` to ingest them (source page → entity/concept updates → index → log). Open gaps live in `llm-wiki/wiki/synthesis/open-questions.md`.

## Where the CLI keeps state

`~/.swiggy/` (or `SWIGGY_HOME`): `config.json`, `auth.json` (access + refresh token in plaintext; mode 0600, which Windows ignores), `history`, `cache/sessions.json` (one remembered handshake per server: URL, time, a token fingerprint, and the session id only if Swiggy issued one; trusted for 12 hours), `cache/recent.json` (numbered rows from the last listings + follow-up context), `cache/dineout-coords.json` and `cache/scenes-coords.json` (last coordinates Swiggy resolved), `cache/scenes-cart.json` (the last ticket cart, used for 30 minutes). Inspect with `swiggy config show --json`; do not write these files directly. Agents should pass explicit ids rather than row numbers unless they issued the listing themselves in the same session.
