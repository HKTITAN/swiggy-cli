# Extending

The CLI is designed so that new upstream tools work **immediately** through Layer B with no code change:

```bash
swiggy call <server> <new_tool_name> --input '{...}'
```

To add a friendly Layer A verb on top:

1. **Verify the tool exists upstream.** `swiggy tools <server> --json | jq -r '.data[].name'`.
2. **Update the catalog.** Append the tool name to `TOOL_CATALOG[<server>]` in `src/lib/aliases.ts`.
3. **Add an alias.** Append `<verb>: <tool_name>` to `ERGONOMIC_ALIASES[<server>]`.
4. **(Optional) Mark destructive.** If the tool mutates server state in a hard-to-reverse way, add it to `DESTRUCTIVE_TOOLS`.
5. **Wire a subcommand.** In `src/commands/<server>.ts`, add a new `attachOutputOptions(food.command(...))` block that calls `callTool(server, tool, args, readGlobalOpts(parent))`. Use the existing patterns — `--input <json>` for free-form payloads, `--input-file <path>` for large ones.
6. **(Optional) Custom human renderer.** Pass a third argument to `callTool` to override the default table renderer for that command only. Keep the JSON shape unchanged.

## Adding a new server

The CLI is structured around three servers but the abstractions don't hard-code that. To add a fourth:

1. Extend `ServerName` and `SERVER_NAMES` in `src/types/index.ts`.
2. Add an entry to `DEFAULT_ENDPOINTS` in `src/lib/config.ts` and a `SWIGGY_<NAME>_URL` env override.
3. Add an entry in `TOOL_CATALOG` and (optionally) `ERGONOMIC_ALIASES`.
4. Add a new `src/commands/<server>.ts` file mirroring `food.ts`.
5. Register it in `src/cli.ts`.

`McpClient`, `auth.ts`, renderers, and the doctor command are all server-agnostic — they will pick up the new server with no further changes.

## Adding a new output mode

Renderers are pure functions of the envelope. Add `src/lib/renderers/<mode>.ts`, wire a new flag into `cli.ts`, and branch in `output.ts:renderResult`. Keep the JSON renderer as the source of truth.