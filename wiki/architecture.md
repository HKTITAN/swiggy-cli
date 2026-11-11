# Architecture

`swiggy` is a direct client for Swiggy's public API. That API is JSON-RPC 2.0 over HTTPS (the Model Context Protocol "Streamable HTTP" transport): one POST per call to `mcp.swiggy.com/{food,im,dineout,scenes}` with a Bearer token. The CLI speaks it with `fetch`. There is no SDK, no child process and no MCP client library in between; `src/lib/mcp.ts` is the whole client. Every command flows through the same pipeline:

```
arg parsing (commander, src/program.ts)
  └── command handler (src/commands/*)                 run(opts, …) → uniform error rendering
       ├── resolve inputs: addressId (profile default / picker), coordinates (flags / profile / last response)
       ├── invokeTool(server, tool, args)              (src/commands/common.ts)
       │    ├── confirm() for DESTRUCTIVE_TOOLS         (src/lib/confirm.ts)
       │    ├── McpClient.callTool()                    (src/lib/mcp.ts)
       │    │     ├── bearer token, refreshed ahead of expiry (src/lib/auth.ts)  ·  remembered handshake  ·  JSON or SSE
       │    │     └── 401 → refresh once, then AUTH_FAILED · 419/-32001 → AUTH_REQUIRED · 429 → RATE_LIMITED · rejected handshake → redo once
       │    ├── extractToolPayload() → unwrapSwiggyEnvelope()   structuredContent, else the { success, data, message } envelope in content
       │    ├── extractLocationContext()                 fields next to data (Scenes latitude/longitude)
       │    └── success:false / isError → MCP_ERROR · network failure on an order-placing tool → details.mayHavePlacedOrder
       ├── (payments) placeOrderWithPayment → waitForPayment    (src/commands/payments.ts, src/lib/payments.ts)
       └── renderResult(envelope)                      (src/lib/output.ts)
            ├── --json / --raw → renderers/json.ts
            ├── --plain        → renderers/plain.ts
            └── default        → renderers/human.ts   (tables, Markdown messages, colours via src/lib/ui.ts)
```

## Why two layers?

**Layer A (ergonomic)** is for humans. Verbs like `swiggy food search -q biryani` or `swiggy scenes discover` map to Swiggy's tools via `src/lib/aliases.ts` and send the parameter names Swiggy documents. `--input <json>` on most verbs merges extra documented parameters over the flags, so a verb never blocks access to a new upstream field.

**Layer B (generic)** is for agents and power users. `swiggy tools <server>` and `swiggy schema <server> <tool>` discover the live surface via `tools/list`; `swiggy call <server> <tool> --input '<json>'` reaches every tool, present or future, with no code change.

Both layers share `invokeTool`, the client and the renderers. Layer A is sugar plus input resolution.

## Key files

| File | Responsibility |
| --- | --- |
| `src/cli.ts` | entry: builds the program; no-args in a TTY → `app` |
| `src/program.ts` | commander program factory (used by the CLI, the shell and the app: one fresh program per command line) |
| `src/tui/app.ts` | the full-screen session: raw-mode keypresses, alternate screen, synchronized frames, output pane, row selection from `recent.ts`, prompts + status rendered in place |
| `src/commands/common.ts` | `attachOutputOptions`, `run`, `invokeTool`/`callTool`, `buildArgs`, address + coordinate resolution (`resolveCoords`, `rememberCoords`), error hints, the legacy-tool note |
| `src/commands/{food,instamart,dineout,scenes}.ts` | Layer A verbs with documented parameter names |
| `src/commands/address.ts` | `addresses` / `create-address` / `delete-address` shared by Food and Instamart |
| `src/commands/payments.ts` | `payment-options` / `payment-status --wait` / `confirm-order` / `report-error` per server, and `placeOrderWithPayment` |
| `src/commands/generic.ts` | Layer B (`servers`, `tools`, `schema`, `call`) plus `docs` and `mcp-config` |
| `src/commands/{auth,config,profile,doctor}.ts` | management commands |
| `src/commands/shell.ts` · `tui.ts` | `runLine` (run one command line in-process; exit override + output capture across the whole command tree), the line REPL, and the `app` command |
| `src/lib/prompter.ts` | the one interface for interactive questions (`select`, `confirm`); hosts install their own so stdin is never handed to a second reader |
| `src/lib/recent.ts` | numbered rows of the last listings + carried context (`restaurantId`, `addressId`, `eventId`, `venueId`, coordinates); `getLastList()` feeds the app's selection |
| `src/lib/mcp.ts` | the API client: JSON-RPC over `fetch`, remembered handshake, SSE, status mapping, 401 refresh-and-retry, result and envelope helpers |
| `src/lib/auth.ts` | OAuth 2.1 + PKCE, RFC 9728/8414 discovery, dynamic client registration, shared token, refresh ahead of expiry, browser open |
| `src/lib/payments.ts` | pure payment-flow logic: `--pay` parsing, pending detection, per-server args, status classification, `waitForPayment` |
| `src/lib/aliases.ts` | the 62-tool catalog, alias table, destructive/write/non-idempotent sets, `LEGACY_TOOLS`, `WIDGET_ONLY_TOOLS` |
| `src/lib/config.ts` · `profiles.ts` · `paths.ts` | on-disk config, profiles, endpoints, docs URLs, cache paths |
| `src/lib/output.ts` | renderer orchestration, banner, `note()` on stderr |
| `src/lib/renderers/{human,json,plain}.ts` | deterministic renderers; `pickList`/`chooseColumns` decide what becomes a table |
| `src/lib/ui.ts` · `term.ts` | palette + colour downgrade, status line (synchronized output, OSC 9;4), OSC 8 links, Markdown-to-ANSI, terminal detection |
| `src/lib/errors.ts` | typed `CliError` classes + stable exit-code map |
| `src/lib/tty.ts` · `lazy.ts` · `version.ts` | machine-mode detection, lazy loading of UI deps, version from `package.json` |
| `scripts/gen-tools-reference.mjs` | regenerates `wiki/tools-catalog.md` and `skills/swiggy-mcp/references/tools.md` from Swiggy's `llms-full.txt`; `--check` compares against `TOOL_CATALOG` |

## Design tenets

1. **Structured first, rendered second.** Every command builds an envelope; renderers are pure functions of it. The human and JSON paths cannot diverge.
2. **Documented names, discovered schemas.** Layer A uses the parameter names Swiggy publishes; Layer B pulls schemas live. `swiggy doctor` reports drift between the bundled catalog and `tools/list`. Commands for tools Swiggy removed from its reference stay, marked `[legacy: …]` in `--help`, and are never counted as drift.
3. **Stable contracts.** Error codes, exit codes and the envelope are documented and only change with a major version.
4. **Zero magic for agents.** No prompts, colours or spinners in machine mode (`--json`, `--plain`, `--raw`, `--no-interactive`, or a non-TTY stdout). stdout carries data only; everything else goes to stderr.
5. **Sessions own the terminal.** Anything that reads stdin inside `shell`/`app` goes through `prompter.ts`; anything that shows progress goes through the status sink in `ui.ts`. A library that opened its own readline ended sessions in 0.2.0, so this is a rule, not a preference.
6. **Small secret surface, stated honestly.** Tokens live in plaintext in `~/.swiggy/auth.json` (written with mode 0600, which Windows ignores), never in env or argv. No keychain yet. No telemetry.
7. **Handshake once, never retry an order.** One `initialize` per server is remembered across invocations (12 h, tied to the token); the payment poll honours Swiggy's cadence; the shell keeps everything warm in one process. Order placement is never retried, because Swiggy does not de-duplicate it.
8. **Brand restraint.** Swiggy orange is used for the program name, headings and table headers, never for body data. Attribution follows Swiggy's brand guidelines (<https://mcp.swiggy.com/builders/docs/operate/brand-guidelines/>): "Powered by Swiggy" for the service, no "official" or "certified" claims.
