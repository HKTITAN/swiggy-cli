<div align="center">

# 🟧&nbsp; swiggy-cli

**Human- and agent-friendly CLI for the [Swiggy MCP](https://github.com/Swiggy/swiggy-mcp-server-manifest) servers — Food, Instamart, Dineout.**

[![npm](https://img.shields.io/npm/v/swiggy-cli?color=FC8019&label=npm&logo=npm)](https://www.npmjs.com/package/swiggy-cli)
[![CI](https://github.com/HKTITAN/swiggy-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/HKTITAN/swiggy-cli/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/swiggy-cli?color=FC8019)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-FC8019.svg)](./LICENSE)
[![skills.sh](https://img.shields.io/badge/skills.sh-installable-FC8019)](https://skills.sh)

```text
swiggy — order food, groceries, and tables from your terminal (or your agent's tool loop)
```

</div>

`swiggy-cli` is a small, opinionated command-line wrapper around the three Model Context Protocol servers Swiggy publishes at [Swiggy/swiggy-mcp-server-manifest](https://github.com/Swiggy/swiggy-mcp-server-manifest). It feels native in a developer's interactive terminal **and** inside an agent / shell pipeline, with a stable JSON envelope, deterministic exit codes, and a generic `call` escape hatch that works for any tool the upstream servers expose.

> **Powered by [Swiggy MCP](https://mcp.swiggy.com/builders/).**
> This is an **unofficial, community-built CLI**. It is **not the official Swiggy CLI** and is not affiliated with, endorsed by, or sponsored by Bundl Technologies Pvt. Ltd. or Swiggy. All trademarks belong to their respective owners.

**Useful links** · [Official MCP manifest](https://github.com/Swiggy/swiggy-mcp-server-manifest) · [Builder docs](https://mcp.swiggy.com/builders/docs/) · [Wiki](./wiki) · [AGENTS.md](./AGENTS.md) · [Skills](./skills) · [Changelog](./CHANGELOG.md)

---

## ✨ Highlights

- **Two-layer command surface** — ergonomic verbs (`swiggy food search-restaurants ...`) on top of a generic, future-proof MCP wrapper (`swiggy call <server> <tool>`).
- **Stable JSON envelope** under `--json` — one parseable line on stdout, no prose.
- **Deterministic exit codes** mapped to error codes (`AUTH_REQUIRED → 3`, `MCP_ERROR → 6`, …).
- **Safe by default** — destructive tools like `place_food_order` are gated behind confirmation; non-interactive mode fails closed.
- **Profiles** for switching between cities, defaults, output modes.
- **Agent-skills bundled** — install with `npx skills add HKTITAN/swiggy-cli`.

---

## 🚀 Quick start

```bash
# Install
npm install -g swiggy-cli

# Authenticate once per server (browser-based OAuth)
swiggy auth init --server food
swiggy auth init --server instamart
swiggy auth init --server dineout

# Use it
swiggy food search-restaurants --query "biryani" --city Delhi

# Use it from a script
swiggy food search-restaurants --query "biryani" --city Delhi --json | jq '.data[0]'
```

> Don't want to install? `npx -p swiggy-cli swiggy --help` runs it once without touching your global PATH.

---

## 📦 Installation

`swiggy-cli` requires **Node.js 20+**.

```bash
npm install -g swiggy-cli        # global (recommended)
pnpm add -g swiggy-cli           # pnpm
yarn global add swiggy-cli       # yarn classic
npx -p swiggy-cli swiggy <args>  # zero-install, one-off
```

### Package name vs. command name

The npm package is **`swiggy-cli`**, but the binaries it installs are:

| Binary   | Purpose                                       |
| -------- | --------------------------------------------- |
| `swiggy` | canonical command, used everywhere in the docs |
| `smn`    | short alias (Swiggy MCP)                       |

So after `npm i -g swiggy-cli` you just type `swiggy ...`. With `npx`, the package name differs from the binary, so use `npx -p swiggy-cli swiggy <args>`.

---

## 🤖 Install the agent-skills

`swiggy-cli` ships [skills.sh](https://skills.sh)-compatible skills under [`skills/`](./skills). They teach an agent (Claude, Cursor, Codex, etc.) **how and when** to drive the CLI — the right flags, the safety rails, the exit-code branching.

```bash
# Install all swiggy-cli skills into your agent
npx skills add HKTITAN/swiggy-cli

# Or pick one
npx skills add HKTITAN/swiggy-cli -s swiggy-checkout
```

| Skill                    | Use when…                                                |
| ------------------------ | -------------------------------------------------------- |
| `swiggy-cli`             | master skill — install this first                        |
| `swiggy-search`          | "find me X on Swiggy"                                    |
| `swiggy-cart`            | "what's in my cart" / "add X" / "clear cart"             |
| `swiggy-checkout`        | "place the order" — gated, requires explicit consent     |
| `swiggy-dineout-booking` | "book a table at X for Friday"                           |
| `swiggy-track`           | "where's my order" / "show recent orders"                |

See [`wiki/skills.md`](./wiki/skills.md) for authoring guidelines.

---

## 🔐 Auth & config

Configuration lives at `~/.swiggy/` (override with `SWIGGY_HOME`):

```
~/.swiggy/
├── config.json   profiles, defaults, output mode, endpoint overrides
└── auth.json     OAuth tokens (mode 0600)
```

```bash
swiggy config init                # write a default config
swiggy config show                # print current config + paths
swiggy auth init                  # OAuth all three servers (browser flow)
swiggy auth init --server food    # auth a single server
swiggy auth status                # token presence + expiry per server
swiggy auth logout --server food  # clear stored credentials
```

The OAuth flow is **Authorization Code + PKCE** against a loopback redirect (`http://127.0.0.1:<ephemeral>/callback` — both `127.0.0.1` and `localhost` are whitelisted server-side per the official [Swiggy MCP manifest](https://github.com/Swiggy/swiggy-mcp-server-manifest)).

Swiggy does **not** advertise dynamic client registration, so you need a pre-registered `client_id`:

```bash
# one-shot
swiggy auth init --server food --client-id <your-client-id>

# or persistently
export SWIGGY_OAUTH_CLIENT_ID=<your-client-id>
export SWIGGY_OAUTH_CLIENT_SECRET=<optional-for-confidential-clients>
swiggy auth init
```

If Swiggy ever exposes a CLI-specific public client_id at <https://mcp.swiggy.com/builders/>, point `--client-id` at it. If you hit `localhost` whitelisting issues instead of `127.0.0.1`, pass `--redirect-host localhost`.

### Profiles

```bash
swiggy profile list
swiggy profile create work --city Bengaluru --output json
swiggy profile use work
swiggy profile set work defaultCity Mumbai
```

Override per-invocation: `swiggy --profile work food cart`.

---

## 🧑‍💻 Human mode + 🤖 Agent mode

This CLI is built around one simple idea:

> Every command produces a structured envelope first; renderers turn it into either a pretty table or a strict JSON line.

### Human mode (default)

Pretty tables, brand-tinted headings, spinners, colors, interactive confirmation for destructive actions like `place_food_order`, `book_table`, or `clear_cart`.

```bash
$ swiggy food search-restaurants --query biryani --city Delhi
swiggy › food/search_restaurants
┌────────────────────┬──────────┬────────┐
│ name               │ rating   │ id     │
├────────────────────┼──────────┼────────┤
│ Paradise Biryani   │ 4.4      │ 12345  │
│ Behrouz Biryani    │ 4.2      │ 22113  │
└────────────────────┴──────────┴────────┘
```

### Agent mode

Pass any of:

| Flag                | Behavior                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| `--json`            | One JSON envelope on stdout. No prose, no color, no spinner.              |
| `--plain`           | TSV-friendly line output for piping to `awk`/`cut`.                       |
| `--raw`             | Emit the raw MCP `tools/call` result for debugging / replay.              |
| `--quiet`           | Suppress non-essential logs.                                              |
| `--no-interactive`  | Disable prompts, colors, spinners. Required for sandboxed agents.         |
| `-y`, `--yes`       | Auto-confirm destructive actions. Without it, non-interactive runs fail.  |

Stable JSON envelope:

```json
{
  "ok": true,
  "server": "food",
  "tool": "search_restaurants",
  "data": [ /* tool payload */ ],
  "meta": { "profile": "default" }
}
```

Errors:

```json
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "...", "details": {} } }
```

### Exit codes

| Code | Meaning                                        |
| ---: | :--------------------------------------------- |
|    0 | success                                        |
|    1 | unknown failure                                |
|    2 | usage error (bad flags, unknown server)        |
|    3 | auth required / auth failed                    |
|    4 | not found (e.g. unknown tool)                  |
|    5 | network failure                                |
|    6 | MCP server returned a tool error               |
|    7 | confirmation required (non-interactive + risky)|
|    8 | config error                                   |

---

## 📚 Examples

### Humans

```bash
swiggy food search-restaurants --query "pizza" --city Mumbai
swiggy food menu --restaurant-id 12345
swiggy food cart
swiggy food add-to-cart --restaurant-id 12345 --item-id 9 --quantity 2
swiggy food checkout --address-id home    # confirms before placing

swiggy instamart search --query "milk bread eggs"
swiggy instamart cart
swiggy instamart checkout --address-id home

swiggy dineout search --query italian --city Delhi
swiggy dineout slots --restaurant-id 4242 --date 2026-05-01 --guests 2
swiggy dineout book --input '{"slot_id":"19:30","guests":2,"restaurant_id":4242}'
```

### Agents / scripts

```bash
# Strict JSON, suitable for jq pipelines
swiggy food search-restaurants -q sushi --json | jq '.data | length'

# Plain TSV → awk
swiggy food search-restaurants -q sushi --plain | awk -F'\t' 'NR>1 {print $1}'

# Discover tools at runtime
swiggy tools food --json | jq -r '.data[].name'

# Read a tool's schema
swiggy schema food search_restaurants --json

# Fully generic call
swiggy call instamart search_products --input '{"query":"chocolate"}' --json

# CI-safe, no prompts, fail rather than ask
swiggy food checkout --no-interactive --yes --json
```

### Profiles

```bash
swiggy --profile work food search-restaurants -q salad
SWIGGY_PROFILE=work swiggy food cart    # equivalent
```

---

## 🏗️ Architecture

```
swiggy <human-friendly verb>          ergonomic Layer A commands
       └── compiles to ──────────►    swiggy call <server> <tool>     (Layer B, generic)
                                      └── McpClient (HTTP MCP, OAuth)
                                          └── https://mcp.swiggy.com/{food,im,dineout}
```

- **Layer A (ergonomic)** lives in `src/commands/{food,instamart,dineout}.ts`. Each subcommand maps 1:1 to an upstream MCP tool (see `src/lib/aliases.ts`). It exists for terminal ergonomics — agents are encouraged to use Layer B directly.
- **Layer B (generic)** is `swiggy servers | tools <s> | schema <s> <t> | call <s> <t>`. Tools are discovered at runtime via the MCP `tools/list` RPC; schemas are pulled live, not hard-coded. When Swiggy ships a new MCP tool, this CLI exposes it the same minute.
- The `McpClient` speaks Streamable-HTTP MCP (JSON or SSE), maintains a session id across calls, and refreshes OAuth tokens automatically when they're near expiry.

Tool catalog (verified 2026-04-28 against the official reference at <https://mcp.swiggy.com/builders/docs/reference/>):

| Server      | Tools (count) |
| ----------- | ------------- |
| `food`      | 14 — `search_restaurants`, `search_menu`, `get_restaurant_menu`, `get_addresses`, `get_food_cart`, `update_food_cart`, `flush_food_cart`, `apply_food_coupon`, `fetch_food_coupons`, `place_food_order`, `get_food_orders`, `get_food_order_details`, `track_food_order`, `report_error` |
| `instamart` | 13 — `search_products`, `your_go_to_items`, `get_addresses`, `create_address`, `delete_address`, `get_cart`, `update_cart`, `clear_cart`, `checkout`, `get_orders`, `get_order_details`, `track_order`, `report_error` |
| `dineout`   | 8 — `search_restaurants_dineout`, `get_restaurant_details`, `get_saved_locations`, `create_cart`, `get_available_slots`, `book_table`, `get_booking_status`, `report_error` |

---

## 🛡️ Safety

- Destructive tools (`place_food_order`, `checkout`, `book_table`, `flush_food_cart`, `clear_cart`, `delete_address`) require interactive confirmation, or `--yes` in non-interactive mode.
- COD orders **cannot be cancelled** by the MCP API — review carts before checkout.
- Per the upstream manifest: do not open the Swiggy mobile app while running these commands; sessions can conflict.
- Tokens are stored at `~/.swiggy/auth.json` with mode `0600`. No secrets in env or argv.

---

## 📦 Publishing

```bash
npm whoami
npm view swiggy-cli              # confirm the name is yours / available
npm run build
npm pack --dry-run              # verify only dist/, README, AGENTS, wiki ship
npm version 0.1.0 --no-git-tag-version
npm publish --access public
```

---

## 🩺 Troubleshooting

- **`AUTH_REQUIRED` on every call** — run `swiggy auth init --server <name>` and confirm `swiggy auth status` shows tokens.
- **OAuth metadata discovery fails** — verify `curl https://mcp.swiggy.com/food/.well-known/oauth-authorization-server` returns JSON.
- **Tool not found** — run `swiggy tools <server>` to see the live list. If a tool was renamed upstream, the ergonomic alias may lag; the generic `swiggy call <server> <new-name>` still works.
- **CI hangs on a confirmation prompt** — pass `--no-interactive --yes` (or `--no-interactive` to fail fast).
- **`npx swiggy` doesn't find the binary** — the npm package is `swiggy-cli`, not `swiggy`. Use `npx -p swiggy-cli swiggy <args>` (or `npx --package swiggy-cli@latest swiggy --help` to pin a version).

---

## 🗂️ Project layout

See [`wiki/architecture.md`](./wiki/architecture.md) and [`AGENTS.md`](./AGENTS.md).

```
swiggy-cli/
├── AGENTS.md
├── README.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── cli.ts
│   ├── types/index.ts
│   ├── lib/
│   │   ├── aliases.ts
│   │   ├── auth.ts
│   │   ├── config.ts
│   │   ├── confirm.ts
│   │   ├── errors.ts
│   │   ├── mcp.ts
│   │   ├── output.ts
│   │   ├── paths.ts
│   │   ├── profiles.ts
│   │   ├── tty.ts
│   │   └── renderers/{human,json,plain}.ts
│   └── commands/
│       ├── auth.ts
│       ├── common.ts
│       ├── config.ts
│       ├── dineout.ts
│       ├── doctor.ts
│       ├── food.ts
│       ├── generic.ts
│       ├── instamart.ts
│       └── profile.ts
├── test/smoke.test.ts
└── wiki/
    ├── architecture.md
    ├── commands.md
    ├── tools-catalog.md
    ├── output-contract.md
    ├── auth.md
    ├── extending.md
    └── troubleshooting.md
```

---

---

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Adding a new ergonomic command is roughly six lines in [`src/lib/aliases.ts`](./src/lib/aliases.ts) plus a subcommand block under [`src/commands/`](./src/commands).

## 📜 License

[MIT](./LICENSE). This project is community-maintained and is **not** affiliated with Bundl Technologies / Swiggy. The upstream MCP servers are operated by Swiggy under their own terms; see <https://mcp.swiggy.com/builders/docs/> and the [official manifest](https://github.com/Swiggy/swiggy-mcp-server-manifest).
