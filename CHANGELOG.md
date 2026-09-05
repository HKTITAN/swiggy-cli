# Changelog

All notable changes to `swiggy-cli` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Shell: a line entered while a command was still running was dropped (the same bug the app had in 0.2.2); it is now queued and runs next. This was the cause of the intermittent Node 20 CI failures in `test/shell.test.ts` (`exit` sent before the previous command finished, so the session never ended).

## [0.2.3] - 2026-09-05

### Changed
- README: the banner now sits under the install block; the banner image shows the `v0.2` series instead of a fixed version. No code changes.

## [0.2.2] - 2026-09-05

### Fixed
- App: a line entered while a command was still running was silently dropped; it is now queued (shown as `next: …` in the status line) and runs as soon as the current command finishes. Also removes a timing flake in the fake-terminal tests.

## [0.2.1] - 2026-09-05

### Added
- **`swiggy app`** (alias `ui`) — a full-screen session, now the default when `swiggy` runs with no arguments in a terminal. Alternate screen, synchronized (tear-free) frames, an output pane with the native views, ↑/↓ over the numbered rows of the last listing, Enter to do the obvious next thing (restaurant → menu, dish/product → add 1, Dineout restaurant → slots, slot → prepared `book` line, order → details, address → set default), inline y/n confirmations, live output while a command runs, tab completion (shared prefix, then candidates), history, `c`/`o`/`a` shortcuts, PgUp/PgDn scrolling.
- `src/lib/prompter.ts` — one interface for interactive prompts (address picker, confirmations). Plain runs use the `prompts` library; `shell` answers on its own readline; the app answers in its status line / pane.
- A status sink in `src/lib/ui.ts` so a host can render progress itself.
- `getLastList()` in `src/lib/recent.ts` (the last listing with its kind and server) and `last` in `recent.json`.
- End-to-end tests that drive the app and the shell through fake terminals against the mock MCP server (`test/app.test.ts`, `test/shell.test.ts`, `test/helpers/fake-tty.ts`).

### Fixed
- **`swiggy shell` ended after the first command** whenever that command asked a question (typically the address picker): the `prompts` library opened a second readline on stdin, reset raw mode and closed it, leaving nothing to keep the process alive. Sessions now own every prompt and never hand stdin to another reader.
- The startup banner printed once per command inside a session (`SWIGGY_SHELL_ACTIVE` is now set by the session).
- `food nonsense` / `food menu --help` inside a session exited the process: commander's exit override is now applied to every subcommand.
- Numbered rows were written to `recent.json` without being awaited, so a command run immediately after a listing (only possible inside a session) could miss them.

### Changed
- An address picked interactively is carried to the following commands (`recent.json` context) until a default is set or `--address-id` is passed — a session without a default address asks once, not per command.
- Tab completion in `shell` and the app fills the shared prefix when several commands match.

## [0.2.0] - 2026-09-05

Catches up with everything Swiggy shipped on MCP between April and September 2026 (verified against <https://mcp.swiggy.com/builders/docs/> on 2026-09-05) and makes the CLI pleasant for humans and reliable for agents.

### Added
- **Payments** (Swiggy MCP July 2026): the shared Payment stage on every server — `payment-options`, `payment-status [--wait]`, `confirm-order` — and `--pay cash|upi|upi:<app>|swiggypay [--wait]` on `food checkout`, `instamart checkout` and `dineout book`. `--wait` shares the scan-or-tap `bridgeUrl`, polls `check_payment_status` on Swiggy's cadence (never tight-loops the long-poll), applies the per-server `confirm_order` contract and exits 10 (`PAYMENT_FAILED`) on failed / cancelled / cart-changed / refund / timeout. Swiggy Money (announced for MCP 2026-09-04) is passed through as the `SwiggyPay` method group when the server offers it.
- New verbs for tools added upstream: Food `create-address`, `delete-address`, `delivery-status`; Instamart `list-coupons`, `apply-coupon`, `delivery-status`; Dineout `cancel`; `report-error` on every server.
- **Native views and numbered references.** Every Swiggy response has its own renderer built from the documented output schemas (restaurants, menu, dishes, food cart with bill, products with variations, Instamart cart, orders, order detail, tracking, dineout results/details/slots, booking, payment options, placed order, delivery status, coupons). Listings number their rows and remember them (`~/.swiggy/cache/recent.json`), so the next command accepts `2`/`#2` instead of an id: `food menu 1`, `food add 3 --qty 2`, `instamart add 1`, `dineout slots 1`, `dineout book 2 --guests 2`, `food order 1`. Follow-up context (item → restaurant, slot → `slotId/itemId/reservationTime`, Dineout coordinates) is carried automatically. Progress lines use plain language ("Searching restaurants") instead of tool names.
- `food add` (alias of `add-to-cart`), `instamart add` (reads the cart and **merges** — upstream `update_cart` replaces), `dineout book <#> --guests <n>` (creates the booking cart itself for paid deals), positional queries (`food search biryani`), and aliases `dishes`, `coupons`, `coupon`, `clear`, `eta`, `usual`, `info`, `availability`, `reserve`, `place-order`, `order-now`.
- `llm-wiki/` — an LLM-maintained research wiki (Karpathy's pattern): schema, index, log, raw sources and 30 pages recording every dated fact about Swiggy MCP, the contradictions inside Swiggy's docs, and open questions.
- `swiggy docs [path] [--full]` — fetch Swiggy Builders Club docs as Markdown (`llms.txt`, per-page `.md`).
- `swiggy mcp-config --client claude|claude-code|cursor|vscode|windsurf|codex|plugin|generic`.
- `swiggy shell` — interactive session with tab completion, persisted history and one warm MCP session (also the default when `swiggy` runs with no arguments in a terminal).
- `swiggy tools <server> --offline` (bundled catalog) and catalog-drift reporting in `swiggy doctor`.
- Profile fields `defaultAddressId`, `defaultLat`, `defaultLng`; the CLI also remembers the coordinates Dineout returns so `slots`/`cart`/`book` work without flags.
- `meta.rateLimit` (from `X-RateLimit-*`), `meta.message` (Swiggy's human message), `meta.deprecation` (`_meta.swiggy.deprecation`, when Swiggy starts emitting it) and `meta.payment` in the JSON envelope. New error codes `RATE_LIMITED` (exit 9) and `PAYMENT_FAILED` (exit 10).
- Terminal polish borrowed from Grok Build's TUI: adaptive truecolor/256/16 palette with truecolor upgrade under tmux/SSH, OSC 8 hyperlinks, DEC 2026 synchronized-output status line with elapsed time, OSC 9;4 progress on Ghostty/WezTerm/iTerm2 3.6+/Windows Terminal, Markdown rendering of Swiggy messages, SIGINT cleanup.
- 14 Agent-Skills-spec skills under `skills/` (8 for the CLI, 6 for the official MCP servers incl. a generated 51-tool parameter reference), an Agent Plugins 1.0.0 manifest (`plugin.json`, `mcp.json`), a Claude Code plugin + marketplace (`.claude-plugin/`, `.mcp.json`), and `scripts/validate-skills.mjs`.
- Test suite: unit tests for the catalog, payments and envelope logic; `McpClient` against a mock Streamable-HTTP server (sessions, expiry recovery, SSE, 401/419/429/-32001); black-box tests of the built binary. CI runs on Node 20/22/24.

### Changed
- **Every ergonomic command now sends the parameter names Swiggy documents** (camelCase `addressId`, `restaurantId`, `orderId`, `cartItems[].menu_item_id`, `selectedAddressId` + `items[].spinId/skuId`, Dineout `latitude`/`longitude`, `slotId`/`itemId`/`reservationTime`/`guestCount`, …). 0.1.x sent guessed snake_case names that the servers ignored, so most Layer A verbs never worked end-to-end.
- Tool catalog: 35 → **51 tools** (Food 20, Instamart 19, Dineout 12).
- Auth: RFC 9728 protected-resource + RFC 8414 discovery, **dynamic client registration** (no `--client-id` needed), scope `mcp:tools mcp:resources mcp:prompts`, browser auto-open (`--no-browser` to disable), callback timeout, JSON fallback on token exchange. One login now stores one token for all three servers instead of running three flows; a missing per-server entry borrows a valid token from another server. Expiry skew 60 s; hints explain that tokens last 5 days and refresh tokens are not issued yet.
- MCP client: persists `Mcp-Session-Id` per server across invocations and re-initializes once on HTTP 404 (session expiry); maps HTTP 419 and JSON-RPC `-32001` to `AUTH_REQUIRED`, HTTP 429 to `RATE_LIMITED` with `Retry-After`; sends `User-Agent`; SSE frames are matched by request id.
- JSON envelope: `data` is now the tool's own payload — the Swiggy `{success,data,message}` wrapper is unwrapped and `success:false` becomes `MCP_ERROR` (exit 6) with `reportLink` hints. Use `--raw` for the previous shape. Error envelopes now carry `hint`.
- Human renderer: picks the most useful list in a payload, prioritises id/name columns, truncates long cells, prints scalar fields below the table; `--plain` uses the same column choice.
- Usage errors thrown inside subcommands are rendered in the requested output mode (previously `--json` was ignored for them).
- `instamart add-to-cart` is now `set-cart` (alias kept) because upstream `update_cart` **replaces** the cart; `food add-to-cart` takes `--item-id <menu_item_id>` and `--items <json>` for variants/addons; `instamart track` requires `--lat/--lng` (upstream requirement); `dineout slots` takes `--date` only (guest count belongs to `book`).
- `swiggy auth init` shows the sign-in URL as a clickable link and reports the token expiry.
- `doctor` no longer fails when you are simply not signed in; it also checks docs reachability and terminal capabilities.
- Dependencies: dropped `chalk`, `ora`, `zod`; upgraded `commander` 15, `vitest` 5, `tsx`, `@types/node`. Version is read from `package.json` (the CLI reported 0.1.3 while the package was 0.1.4).
- `files` now ships `skills/`, plugin manifests and `assets/` in the npm package.

### Fixed
- `--json` on subcommands not being honoured for usage errors.
- Version mismatch between `--version` and `package.json`.
- Spinner output leaking into stdout in some terminals (all status output is on stderr with synchronized writes).
- `notifications/initialized` no longer leaves a dangling response body.

### Removed
- `zod` (unused), `chalk`, `ora`.

## [0.1.4] - 2026-04-30

- Hardened live end-to-end UX; version bump. (See git history for 0.1.0 – 0.1.4.)

## [0.1.0] - 2026-04-28

- Initial public scaffold targeting 35 tools across the three official Swiggy MCP servers; Layer A verbs, Layer B generic commands, JSON envelope, exit codes, OAuth + PKCE, profiles, doctor, wiki, AGENTS.md, skills, CI + tag release.

[0.2.0]: https://github.com/HKTITAN/swiggy-cli/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/HKTITAN/swiggy-cli/compare/v0.1.0...v0.1.4
[0.1.0]: https://github.com/HKTITAN/swiggy-cli/releases/tag/v0.1.0
