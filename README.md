<div align="center">

<a href="https://github.com/HKTITAN/swiggy-cli"><img src="./assets/banner.png" alt="swiggy-cli 0.2.0 — order food, groceries and tables from your terminal, or your agent's tool loop. Powered by Swiggy." width="100%"></a>

<img src="./assets/swiggy-logo.svg" alt="Swiggy" width="64" height="64">

# swiggy-cli

**Human- and agent-friendly CLI for the official [Swiggy MCP](https://mcp.swiggy.com/builders/) servers — Food, Instamart, Dineout.**

**Powered by Swiggy.**

[![npm](https://img.shields.io/npm/v/swiggy-cli?color=FF5200&label=npm&logo=npm)](https://www.npmjs.com/package/swiggy-cli)
[![CI](https://github.com/HKTITAN/swiggy-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/HKTITAN/swiggy-cli/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/swiggy-cli?color=FF5200)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-FF5200.svg)](./LICENSE)
[![skills.sh](https://img.shields.io/badge/skills.sh-14%20skills-FF5200)](https://skills.sh)
[![Agent Plugins](https://img.shields.io/badge/agent--plugins-1.0.0-FF5200)](https://agent-plugins.org)

```text
swiggy — order food, groceries and tables from your terminal, or from your agent's tool loop
51 MCP tools · UPI / Swiggy Money payments · one login · stable JSON · 14 agent skills
```

</div>

`swiggy-cli` wraps the three Model Context Protocol servers Swiggy runs at `mcp.swiggy.com` (`/food`, `/im`, `/dineout`). It feels native in a developer's terminal **and** inside an agent pipeline: every command emits one stable JSON envelope, exit codes are deterministic, destructive tools are gated, and a generic `call` escape hatch reaches every tool the servers expose — today's 51 and whatever ships next.

> **Powered by [Swiggy MCP](https://mcp.swiggy.com/builders/).** This is an **independent, community-built CLI**, not an official Swiggy product. The Swiggy name and mark are trademarks of Swiggy Limited, shown unmodified per Swiggy's [brand guidelines](https://mcp.swiggy.com/builders/docs/operate/support/#co-branding) to identify the service this tool integrates with. Listings, prices and availability come from Swiggy and are shown as received.

**Links** · [Builder docs](https://mcp.swiggy.com/builders/docs/) · [Tool reference](https://mcp.swiggy.com/builders/docs/reference/) · [Wiki](./wiki) · [AGENTS.md](./AGENTS.md) · [Skills](./skills) · [Changelog](./CHANGELOG.md)

---

## What's new in 0.2.0 (September 2026)

Swiggy's MCP surface grew from 35 to **51 tools** since this CLI was last updated. 0.2.0 catches up with all of it:

- **Correct parameters everywhere.** Every ergonomic command now sends the documented camelCase names (`addressId`, `restaurantId`, `menu_item_id`, `spinId`, …). Earlier releases guessed snake_case names that the servers silently ignored.
- **Payments.** The shared Payment stage (`get_payment_options`, `check_payment_status`, `confirm_order`) on all three servers. `swiggy food checkout --pay upi --wait` places the order, prints a scan-or-tap payment link, polls on Swiggy's cadence and confirms — headless, no widget needed. `--pay cash`, `--pay upi:<app>` and `--pay swiggypay` (Swiggy Money, announced for MCP on 4 Sept 2026) are supported too.
- **New tools wired as verbs:** Food `create-address`/`delete-address`/`delivery-status`, Instamart `list-coupons`/`apply-coupon`/`delivery-status`, Dineout `cancel`, and `payment-options`/`payment-status`/`confirm-order`/`report-error` on every server.
- **One login.** Swiggy issues a single token valid on all three servers, supports dynamic client registration, and tokens last 5 days. `swiggy auth init` opens your browser once; no client id needed.
- **Rate-limit aware.** `X-RateLimit-*` headers land in `meta.rateLimit`; HTTP 429 maps to exit 9 with `Retry-After`; the MCP session id is persisted so consecutive commands reuse one session instead of re-initializing (Swiggy counts handshakes as auth events).
- **Smoother terminal.** Adaptive truecolor/256/16-color output, OSC 8 clickable links, a tear-free status line with elapsed time, native progress indicators on Ghostty/WezTerm/iTerm2/Windows Terminal, lazy-loaded UI so `--json` calls start faster, and `swiggy shell` — an interactive session with tab completion, history and a warm MCP session.
- **Native, not a wrapper.** Every response has its own view (restaurants, menus, carts with the bill, products with pack sizes, orders, tracking, slots, bookings, payment methods), rows are numbered, and the next command takes the number: `swiggy food menu 1`, `swiggy food add 3 --qty 2`, `swiggy instamart add 1`, `swiggy dineout book 2 --guests 2`. Progress reads "Searching restaurants", not `tools/call`. `instamart add` merges into the existing cart even though the upstream tool replaces it; `dineout book` on a paid deal creates the booking cart for you.
- **For agents:** 14 [skills.sh](https://skills.sh)-compatible skills (8 for this CLI, 6 for the official MCP servers), an [Agent Plugins](https://agent-plugins.org) manifest, a Claude Code plugin/marketplace, `swiggy docs` to fetch Swiggy's docs as Markdown, and `swiggy mcp-config` to print client configs.
- **An LLM-maintained wiki** ([`llm-wiki/`](./llm-wiki)) in Karpathy's format holds the compiled research behind this release — every Swiggy MCP fact, dated and sourced, with the contradictions in Swiggy's own docs resolved.

---

## Quick start

```bash
npm install -g swiggy-cli

swiggy auth init                                  # browser: phone + OTP. One login for food, instamart, dineout
swiggy food addresses                             # pick an addressId once…
swiggy profile set default defaultAddressId <id>  # …and never pass it again

swiggy food search biryani                        # numbered results…
swiggy food menu 1                                # …so the next command takes the number
swiggy food add 3 --qty 2                         # menu_item_id + restaurant filled in for you
swiggy food cart
swiggy food checkout --pay upi --wait             # scan-or-tap link → polls → confirms

swiggy instamart search milk
swiggy instamart add 1 --qty 2                    # merges into your current cart
swiggy instamart checkout --pay cash

swiggy dineout search italian --address-id 1      # 1 = first saved location
swiggy dineout slots 1 --date 2026-09-06
swiggy dineout book 2 --guests 2                  # free deal books directly; paid: add --pay upi --wait
```

Raw ids work everywhere a number does. `swiggy` with no arguments opens an interactive session with tab completion.

Agents and scripts add `--json --no-interactive`:

```bash
swiggy food search -q sushi --json --no-interactive | jq '.data.restaurants[0]'
```

Prefer not to install? `npx -p swiggy-cli swiggy --help`.

<details>
<summary><b>Install options</b></summary>

`swiggy-cli` requires **Node.js 20+**.

```bash
npm install -g swiggy-cli        # global (recommended)
pnpm add -g swiggy-cli
yarn global add swiggy-cli
npx -p swiggy-cli swiggy <args>  # zero-install
```

The npm package is `swiggy-cli`; it installs two binaries: `swiggy` (canonical) and `smn` (short alias).

</details>

---

## For AI agents

### Skills (skills.sh / Agent Skills spec)

Fourteen focused skills live under [`skills/`](./skills). Each is a single `SKILL.md` written to be strict and to explain *why* — the agent walks the same decision tree every time.

```bash
npx skills add HKTITAN/swiggy-cli            # pick skills + agents interactively
npx skills add HKTITAN/swiggy-cli --all      # everything, every agent
npx skills add HKTITAN/swiggy-cli -s swiggy-mcp -s swiggy-mcp-payments -a claude-code
```

| Skill | Teaches an agent to… |
| --- | --- |
| `swiggy-cli` | drive this CLI: machine mode, envelope, exit codes, auth detection |
| `swiggy-search` · `swiggy-cart` · `swiggy-checkout` · `swiggy-pay` · `swiggy-dineout-booking` · `swiggy-track` · `swiggy-address` | one task each, via the CLI |
| `swiggy-mcp` | use the **official MCP servers directly**: auth, envelope, errors, rate limits, safety rules (+ a 51-tool parameter reference) |
| `swiggy-mcp-food` · `swiggy-mcp-instamart` · `swiggy-mcp-dineout` | the end-to-end journey on each server with exact parameters |
| `swiggy-mcp-payments` | the UPI / Cash / Swiggy Money flow, widget and headless, per-server confirm contract |
| `swiggy-mcp-docs` | look up Swiggy's docs (`llms.txt`, per-page `.md`) before writing Swiggy code |

### Plugins

- **Agent Plugins 1.0.0** ([agent-plugins.org](https://agent-plugins.org)): the repo root is a valid plugin — [`plugin.json`](./plugin.json), [`mcp.json`](./mcp.json) (the three Streamable HTTP servers), `skills/`.
- **Claude Code**: `claude plugin marketplace add HKTITAN/swiggy-cli` then `claude plugin install swiggy@swiggy-cli` — installs the skills and pre-wires the three MCP servers ([`.claude-plugin/`](./.claude-plugin), [`.mcp.json`](./.mcp.json)).
- Any other client: `swiggy mcp-config --client cursor|vscode|windsurf|claude|codex|plugin` prints the config to paste.

### Docs on demand

```bash
swiggy docs                                   # llms.txt index
swiggy docs reference/instamart/update_cart   # one page as Markdown
swiggy docs --full                            # everything (~400 KB)
```

See [AGENTS.md](./AGENTS.md) for the full agent contract.

---

## Human mode · Agent mode

Every command builds a structured envelope first; renderers turn it into a table or a JSON line, so the two modes cannot disagree.

**Human mode** (default in a terminal): tables with sensible columns, Swiggy's own `message` rendered as Markdown, a status line with elapsed time, clickable links, interactive address picker, confirmation prompts for destructive actions. `swiggy` with no arguments opens `swiggy shell`.

**Agent mode** flags:

| Flag | Behaviour |
| --- | --- |
| `--json` | one JSON envelope on stdout; no prose, colour or spinner |
| `--plain` | TSV: header row + rows (same column choice as the table) |
| `--raw` | the untouched MCP `tools/call` result |
| `--quiet` | no non-essential stderr |
| `--no-interactive` | never prompt; fail closed (also implied when stdout is not a TTY) |
| `-y, --yes` | consent for destructive tools |

Envelope:

```json
{ "ok": true, "server": "food", "tool": "search_restaurants",
  "data": { "restaurants": [ … ], "nextOffset": 10 },
  "meta": { "profile": "default", "message": "…", "rateLimit": { "limit": 70, "remaining": 61, "reset": 1720000060 } } }
```

`data` is the tool's own payload — Swiggy's `{ success, data, message }` wrapper is unwrapped, `message` goes to `meta.message`, and a `success: false` becomes an error envelope:

```json
{ "ok": false, "error": { "code": "MCP_ERROR", "message": "Invalid addressId: required", "hint": "Run: swiggy food addresses, then retry with --address-id <id>" } }
```

### Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | success |
| 1 | unknown failure |
| 2 | usage error |
| 3 | auth required / failed → `swiggy auth init` |
| 4 | not found (tool / docs page) |
| 5 | network failure |
| 6 | Swiggy tool error (`success:false`, `isError`, JSON-RPC error) |
| 7 | confirmation required (destructive tool without `--yes` in machine mode) |
| 8 | config error |
| 9 | rate limited (HTTP 429; `error.details.retryAfterSeconds`) |
| 10 | payment failed / cancelled / timed out during `--wait` |

---

## Payments

```
get_payment_options → place order (Cash | UPI app | UPI QR | SwiggyPay) → PENDING_PAYMENT
     → check_payment_status (Swiggy's cadence) → confirm_order → PLACED → track
```

```bash
swiggy instamart payment-options                       # what this cart can pay with
swiggy instamart checkout --pay cash                   # COD: placed immediately
swiggy instamart checkout --pay upi --wait             # link → poll → confirm, one command
swiggy instamart checkout --pay upi                    # two-step: returns paasId/orderId/bridgeUrl + meta.payment.next
swiggy instamart payment-status --paas-id <p> --order-id <o> --wait
swiggy food checkout --pay upi:gpay://upi/ --wait      # a specific UPI app from payment-options
swiggy food checkout --pay swiggypay                   # Swiggy Money, when the server offers it
```

The CLI honours `pollingIntervalInMs`/`maxTimeToPollForInMs` from Swiggy, never tight-loops the long-poll, applies the right `confirm_order` contract per server (Food: `orderId+addressId+lat+lng`; Instamart/Dineout: `orderId+paasId`), and never announces success on a pending order. Details: [`wiki/payments.md`](./wiki/payments.md).

---

## Auth & config

```
~/.swiggy/                      (override with SWIGGY_HOME)
├── config.json                 profiles, defaults, endpoint overrides
├── auth.json                   OAuth token (mode 0600)
├── history                     swiggy shell history
└── cache/sessions.json         Mcp-Session-Id per server (reused across invocations)
```

```bash
swiggy auth init                 # browser OAuth 2.1 + PKCE; dynamic client registration; one token for all servers
swiggy auth init --no-browser    # print the URL instead (SSH sessions)
swiggy auth status               # per-server token state + expiry (tokens last 5 days; re-run init when expired)
swiggy auth logout
swiggy doctor                    # runtime, config, auth, OAuth metadata, live tool list, catalog drift, docs reachability
```

Profiles hold defaults so commands stay short: `defaultAddressId` (Food/Instamart), `defaultLat`/`defaultLng` (Dineout), `output`, and per-server `endpoints` overrides (or `SWIGGY_FOOD_URL` / `SWIGGY_INSTAMART_URL` / `SWIGGY_DINEOUT_URL`).

---

## Commands

`swiggy --help` is complete; the short version:

| Area | Commands |
| --- | --- |
| Generic | `servers` · `tools <server> [--offline]` · `schema <server> <tool>` · `call <server> <tool> --input <json>` · `docs [path]` · `mcp-config` · `doctor` · `shell` |
| Food | `search` · `search-menu` · `menu` · `addresses` · `create-address` · `delete-address` · `cart` · `add-to-cart` · `clear-cart` · `list-coupons` · `apply-coupon` · `checkout` · `orders` · `order` · `track` · `delivery-status` · `payment-options` · `payment-status` · `confirm-order` · `report-error` |
| Instamart (`im`) | `search` · `go-to-items` · `addresses` · `create-address` · `delete-address` · `cart` · `set-cart` · `clear-cart` · `list-coupons` · `apply-coupon` · `checkout` · `orders` · `order` · `track` · `delivery-status` · payment/support as above |
| Dineout | `search` · `details` · `locations` · `slots` · `cart` · `book` · `status` · `cancel` · payment/support as above |
| Auth/config | `auth init|status|whoami|logout` · `config show|path|init` · `profile list|use|create|delete|set` |

Full mapping with flags: [`wiki/commands.md`](./wiki/commands.md). Upstream catalog with parameters: [`wiki/tools-catalog.md`](./wiki/tools-catalog.md).

---

## Architecture

```
swiggy <verb>  ──►  Layer A (ergonomic, documented params)  ──►  Layer B  swiggy call <server> <tool>
                                                                    └── McpClient · Streamable HTTP · JSON or SSE
                                                                        ├── persisted Mcp-Session-Id, 404 → re-init once
                                                                        ├── 401/419 → AUTH, 429 → RATE_LIMITED, -32001 → AUTH
                                                                        └── https://mcp.swiggy.com/{food,im,dineout}
```

- `src/commands/*` — verbs; `payments.ts` and `address.ts` are shared across servers.
- `src/lib/mcp.ts` — client; `auth.ts` — OAuth (RFC 9728/8414 discovery, DCR, PKCE); `payments.ts` — pure payment-flow logic; `aliases.ts` — the verified 51-tool catalog.
- `src/lib/term.ts` + `ui.ts` — terminal capability detection and the status line (techniques borrowed from Grok Build's TUI).
- Tests: unit (`aliases`, `payments`, `envelope`), client vs a mock MCP server, and black-box tests of the built binary. `npm test` builds first.

More: [`wiki/architecture.md`](./wiki/architecture.md).

---

## Safety

- Destructive tools — `place_food_order`, `checkout`, `book_table`, `cancel_booking`, `flush_food_cart`, `clear_cart`, `delete_address` — ask for confirmation, or need `--yes` in machine mode.
- Order placement is never retried automatically; check `orders`/`status` first (Swiggy's own guidance).
- Food/Instamart orders cannot be cancelled via the API — Swiggy customer care: 080-67466729.
- Tokens live at `~/.swiggy/auth.json` (mode 0600). Nothing is printed to stdout in human/JSON mode; `--raw` echoes the literal MCP response by design. No telemetry; the CLI talks only to `mcp.swiggy.com`.

---

## Contributing & releasing

```bash
npm ci && npm run lint && npm test && npm run validate:skills
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [`wiki/releasing.md`](./wiki/releasing.md) (tag `vX.Y.Z` → GitHub Actions publishes to npm with provenance).

## Troubleshooting

`swiggy doctor` first. Common cases in [`wiki/troubleshooting.md`](./wiki/troubleshooting.md): `AUTH_REQUIRED` after 5 days (re-run `auth init`), `Missing address id` in machine mode (pass `--address-id` or set `defaultAddressId`), Dineout "missing coordinates" (search with `--address-id` first), `npx swiggy` not found (`npx -p swiggy-cli swiggy`).

## License

[MIT](./LICENSE) for this CLI's code. Powered by Swiggy: the upstream MCP servers, listings and content are operated and owned by Swiggy Limited under their own terms — see <https://mcp.swiggy.com/builders/docs/>. This is an independent, community-built tool, not an official Swiggy product.
