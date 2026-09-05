# Architecture

`swiggy` is a thin, structured shell over the three Swiggy MCP servers. Every command flows through the same pipeline:

```
arg parsing (commander, src/program.ts)
  └── command handler (src/commands/*)                 run(opts, …) → uniform error rendering
       ├── resolve inputs: addressId (profile default / picker), Dineout coordinates (flags / profile / last search)
       ├── invokeTool(server, tool, args)              (src/commands/common.ts)
       │    ├── confirm() for DESTRUCTIVE_TOOLS         (src/lib/confirm.ts)
       │    ├── McpClient.callTool()                    (src/lib/mcp.ts)
       │    │     ├── bearer token (src/lib/auth.ts)  ·  persisted Mcp-Session-Id  ·  JSON or SSE
       │    │     └── 401/419/-32001 → AUTH · 429 → RATE_LIMITED · 404 → re-init once
       │    ├── extractToolPayload() → unwrapSwiggyEnvelope()   { success, data, message } → data + meta.message
       │    └── success:false → MCP_ERROR
       ├── (payments) placeOrderWithPayment → waitForPayment    (src/commands/payments.ts, src/lib/payments.ts)
       └── renderResult(envelope)                      (src/lib/output.ts)
            ├── --json / --raw → renderers/json.ts
            ├── --plain        → renderers/plain.ts
            └── default        → renderers/human.ts   (tables, Markdown messages, colours via src/lib/ui.ts)
```

## Why two layers?

**Layer A (ergonomic)** is for humans. Verbs like `swiggy food search -q biryani` map 1:1 to upstream tools via `src/lib/aliases.ts` and send the parameter names Swiggy documents. `--input <json>` on most verbs merges extra documented parameters over the flags, so a verb never blocks access to a new upstream field.

**Layer B (generic)** is for agents and power users. `swiggy tools <server>` and `swiggy schema <server> <tool>` discover the live surface via MCP `tools/list`; `swiggy call <server> <tool> --input '<json>'` reaches every tool, present or future, with no code change.

Both layers share `invokeTool`, the client and the renderers. Layer A is sugar plus input resolution.

## Key files

| File | Responsibility |
| --- | --- |
| `src/cli.ts` | entry: builds the program; no-args in a TTY → `app` |
| `src/program.ts` | commander program factory (used by the CLI, the shell and the app: one fresh program per command line) |
| `src/tui/app.ts` | the full-screen session: raw-mode keypresses, alternate screen, synchronized frames, output pane, row selection from `recent.ts`, prompts + status rendered in place |
| `src/commands/common.ts` | `attachOutputOptions`, `run`, `invokeTool`/`callTool`, `buildArgs`, address + coordinate resolution, error hints |
| `src/commands/{food,instamart,dineout}.ts` | Layer A verbs with documented parameter names |
| `src/commands/address.ts` | `addresses` / `create-address` / `delete-address` shared by Food and Instamart |
| `src/commands/payments.ts` | `payment-options` / `payment-status --wait` / `confirm-order` / `report-error` per server, and `placeOrderWithPayment` |
| `src/commands/generic.ts` | Layer B (`servers`, `tools`, `schema`, `call`) plus `docs` and `mcp-config` |
| `src/commands/{auth,config,profile,doctor}.ts` | management commands |
| `src/commands/shell.ts` · `tui.ts` | `runLine` (run one command line in-process; exit override + output capture across the whole command tree), the line REPL, and the `app` command |
| `src/lib/prompter.ts` | the one interface for interactive questions (`select`, `confirm`); hosts install their own so stdin is never handed to a second reader |
| `src/lib/recent.ts` | numbered rows of the last listings + carried context (`restaurantId`, `addressId`, coordinates); `getLastList()` feeds the app's selection |
| `src/lib/mcp.ts` | Streamable-HTTP MCP client: sessions, SSE, status mapping, rate-limit headers, envelope helpers |
| `src/lib/auth.ts` | OAuth 2.1 + PKCE, RFC 9728/8414 discovery, dynamic client registration, shared token, browser open |
| `src/lib/payments.ts` | pure payment-flow logic: `--pay` parsing, pending detection, per-server args, status classification, `waitForPayment` |
| `src/lib/aliases.ts` | verified 51-tool catalog, alias table, destructive/write sets |
| `src/lib/config.ts` · `profiles.ts` · `paths.ts` | on-disk config, profiles, endpoints, docs URLs, cache paths |
| `src/lib/output.ts` | renderer orchestration, banner, `note()` on stderr |
| `src/lib/renderers/{human,json,plain}.ts` | deterministic renderers; `pickList`/`chooseColumns` decide what becomes a table |
| `src/lib/ui.ts` · `term.ts` | palette + colour downgrade, status line (synchronized output, OSC 9;4), OSC 8 links, Markdown-to-ANSI, terminal detection |
| `src/lib/errors.ts` | typed `CliError` classes + stable exit-code map |
| `src/lib/tty.ts` · `lazy.ts` · `version.ts` | machine-mode detection, lazy loading of UI deps, version from `package.json` |

## Design tenets

1. **Structured first, rendered second.** Every command builds an envelope; renderers are pure functions of it. The human and JSON paths cannot diverge.
2. **Documented names, discovered schemas.** Layer A uses the parameter names Swiggy publishes; Layer B pulls schemas live. `swiggy doctor` reports drift between the bundled catalog and `tools/list`.
3. **Stable contracts.** Error codes, exit codes and the envelope are documented and only change with a major version.
4. **Zero magic for agents.** No prompts, colours or spinners in machine mode (`--json`, `--plain`, `--raw`, `--no-interactive`, or a non-TTY stdout). stdout carries data only; everything else goes to stderr.
5. **Sessions own the terminal.** Anything that reads stdin inside `shell`/`app` goes through `prompter.ts`; anything that shows progress goes through the status sink in `ui.ts`. A library that opened its own readline ended sessions in 0.2.0, so this is a rule, not a preference.
6. **Least secret surface.** Tokens live in `~/.swiggy/auth.json` (0600), never in env or argv. No telemetry.
6. **Rate-limit hygiene.** One MCP session per server persisted across invocations; the payment poll honours Swiggy's cadence; the shell keeps everything warm in one process.
7. **Brand restraint.** Swiggy orange is used for the program name, headings and table headers — never for body data.
