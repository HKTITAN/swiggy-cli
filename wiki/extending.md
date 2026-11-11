# Extending

New upstream tools work **immediately** through Layer B with no code change:

```bash
swiggy call <server> <new_tool_name> --input '{…documented camelCase params…}'
```

`swiggy doctor` tells you when the live `tools/list` has a tool the bundled catalog lacks.

## Adding a Layer A verb

1. **Verify upstream.** `swiggy docs reference/<server>/<tool>` (or `swiggy schema <server> <tool> --json`) — copy the parameter names exactly.
2. **Catalog.** Append the tool to `TOOL_CATALOG[<server>]` in `src/lib/aliases.ts` and add `<verb>: <tool>` to `ERGONOMIC_ALIASES`. Tests fail if a catalog tool has no alias or an alias points to an unknown tool.
3. **Destructive?** If it places an order, spends money or destroys state, add it to `DESTRUCTIVE_TOOLS` (gated by confirmation / `--yes`); mutations go in `WRITE_TOOLS`.
4. **Verb.** In `src/commands/<server>.ts`:

```ts
attachOutputOptions(
  food
    .command("my-verb")
    .description("…")
    .requiredOption("--thing-id <id>", "…")
    .option("--input <json>", "raw arguments JSON (merged over flags)")
    .action(async (o: { thingId: string; input?: string }) => {
      const opts = readGlobalOpts(food);
      await run(opts, async () => {
        const addressId = await ensureAddressId("food", opts, undefined, "food my-verb"); // if the tool needs it
        await callTool("food", "the_tool", await buildArgs({ addressId, thingId: o.thingId }, o.input), opts);
      });
    })
);
```

`run()` renders any thrown `CliError` in the caller's output mode; `buildArgs()` drops empty values and lets `--input` override flags; `num()`, `positiveInt()`, `oneOf()`, `requireFlag()` validate inputs with `USAGE` errors.

5. **Docs + skills.** Add a row to `wiki/commands.md` and mention the verb in the relevant skill if agents should use it. Never edit `wiki/tools-catalog.md` or `skills/swiggy-mcp/references/tools.md` by hand: `node scripts/gen-tools-reference.mjs` regenerates both from Swiggy's `llms-full.txt`, and `node scripts/gen-tools-reference.mjs --check` (also `npm run check:tools`) fails when the published tool list differs from `TOOL_CATALOG`.
6. **Tests.** Extend `test/helpers/mock-mcp.ts` with a canned response if the verb has logic worth pinning, then add a case to `test/cli.test.ts`.

## Custom human rendering

Pass a renderer to `callTool(server, tool, args, opts, (data, ctx) => …)`; keep the JSON shape unchanged. `src/commands/payments.ts` (`renderPaymentOptions`) is an example.

## Adding a server

Scenes was added in 0.3.0 this way: `ServerName`/`SERVER_NAMES` in `src/types/index.ts`, `DEFAULT_ENDPOINTS` + `SERVER_LABEL` + `SERVER_DOMAIN` in `src/lib/config.ts`, `TOOL_CATALOG`/`ERGONOMIC_ALIASES`/`PLACE_ORDER_TOOL`/`NON_IDEMPOTENT_TOOLS` in `src/lib/aliases.ts`, a `src/commands/<server>.ts`, registration in `src/program.ts`, the `SERVERS` list in `scripts/gen-tools-reference.mjs`, and `mcp.json`/`.mcp.json`. The client, auth, renderers, doctor and shell are server-agnostic.

## When Swiggy removes a tool

Move it from `TOOL_CATALOG` to `LEGACY_TOOLS` in `src/lib/aliases.ts`. Its command keeps working for accounts that still have the tool, `--help` marks it `[legacy: …]`, and `swiggy doctor` stops reporting it as drift.

## Adding an output mode

Renderers are pure functions of the envelope: add `src/lib/renderers/<mode>.ts`, a flag in `attachOutputOptions` and `src/program.ts`, and a branch in `renderResult`. JSON stays the source of truth.
