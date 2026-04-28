# Architecture

`swiggy` is a thin, structured shell over the three Swiggy MCP servers. Every command flows through the same pipeline:

```
arg parsing (commander)
  └── command handler (src/commands/*)
       └── McpClient.callTool(name, args)            (src/lib/mcp.ts)
            ├── ensure auth        (src/lib/auth.ts)
            ├── JSON-RPC POST → Streamable HTTP MCP
            └── parse JSON or SSE frame
       └── extractToolPayload(result)
       └── renderResult(envelope, ctx)
            ├── --json   → renderers/json.ts
            ├── --plain  → renderers/plain.ts
            └── default  → renderers/human.ts
```

## Why two layers?

**Layer A (ergonomic)** is for humans typing in a terminal. Subcommands like `swiggy food search-restaurants --query biryani` map 1:1 to upstream tool names via the alias table in `src/lib/aliases.ts`. It exists so a person doesn't have to remember `search_restaurants` vs `search_restaurants_dineout`.

**Layer B (generic)** is for agents and power users. `swiggy tools <server>` and `swiggy schema <server> <tool>` discover the upstream surface at runtime via the standard MCP `tools/list` RPC, so the CLI never goes stale. `swiggy call <server> <tool> --input '<json>'` is the universal escape hatch — it works for every tool, present or future.

Both layers share the same `McpClient` and renderer pipeline. Layer A is just sugar.

## Key files


| File                                           | Responsibility                                                |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `src/cli.ts`                                   | commander setup, global flags, top-level error handling       |
| `src/commands/common.ts`                       | shared `attachOutputOptions`, `callTool`, confirmation gating |
| `src/commands/generic.ts`                      | Layer B (`servers`, `tools`, `schema`, `call`)                |
| `src/commands/{food,instamart,dineout}.ts`     | Layer A ergonomic verbs                                       |
| `src/commands/{auth,config,profile,doctor}.ts` | management commands                                           |
| `src/lib/mcp.ts`                               | Streamable-HTTP MCP client (JSON-RPC + SSE), session, auth    |
| `src/lib/auth.ts`                              | OAuth + PKCE flow, dynamic registration, token refresh        |
| `src/lib/config.ts` + `profiles.ts`            | on-disk config + profile management                           |
| `src/lib/aliases.ts`                           | verified upstream tool catalog + ergonomic alias table        |
| `src/lib/output.ts`                            | renderer orchestration, brand color, spinner gating           |
| `src/lib/renderers/{human,json,plain}.ts`      | three deterministic output renderers                          |
| `src/lib/errors.ts`                            | typed `CliError` classes + stable exit code map               |
| `src/lib/tty.ts`                               | machine-mode / color detection                                |


## Design tenets

1. **Structured first, rendered second.** Every command builds an envelope; renderers are pure functions of that envelope. This is what makes `--json` honest — the human and JSON paths cannot diverge.
2. **Discover, don't hardcode.** Tool schemas are pulled from the server, not vendored.
3. **Stable contracts.** Error codes, exit codes, and JSON shapes are documented and won't change without a major version.
4. **Zero magic for agents.** No interactive prompts, no colors, no spinners when machine mode is detected (`--json`, `--plain`, `--no-interactive`, or non-TTY).
5. **Least secret surface.** Tokens are stored at `~/.swiggy/auth.json` (mode `0600`). Never in env or argv.
6. **Brand restraint.** Swiggy orange (`#FC8019`) is used only for the program name, headings, and table headers — never for body data.

