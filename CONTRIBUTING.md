# Contributing to swiggy-cli

Thanks for considering a contribution! This is a community CLI for the official [Swiggy MCP servers](https://github.com/Swiggy/swiggy-mcp-server-manifest); upstream behavior changes belong on their tracker, but anything about how this CLI wraps them belongs here.

## Quick start

```bash
git clone https://github.com/HKTITAN/swiggy-cli.git
cd swiggy-cli
npm ci
npm run dev -- --help     # tsx-powered watcher equivalent
npm test                  # vitest
npm run lint              # tsc --noEmit
npm run build             # tsup → dist/
node dist/cli.js --help   # smoke-test the built binary
```

## Project layout

See [`wiki/architecture.md`](./wiki/architecture.md). One-line summary: `src/cli.ts` is the commander entry, every command lives under `src/commands/`, and every command compiles down to a single `McpClient.callTool()` invocation defined in `src/lib/mcp.ts`.

## Adding an ergonomic command

The Swiggy MCP servers expose 35 tools today. Any new tool can be invoked through `swiggy call <server> <tool>` immediately. To add a friendly alias on top:

1. Append the tool name to `TOOL_CATALOG[<server>]` in [`src/lib/aliases.ts`](./src/lib/aliases.ts).
2. Append `<verb>: <tool_name>` to `ERGONOMIC_ALIASES[<server>]`.
3. Add a `attachOutputOptions(<server>.command(...))` block in [`src/commands/<server>.ts`](./src/commands).
4. If the tool mutates state in a hard-to-reverse way, add it to `DESTRUCTIVE_TOOLS`.
5. Add a row to [`wiki/commands.md`](./wiki/commands.md).
6. Update tests in [`test/smoke.test.ts`](./test/smoke.test.ts) — alias-integrity assertions catch typos.

Full guide: [`wiki/extending.md`](./wiki/extending.md).

## Output contract

Every command must produce a structured envelope before rendering. The JSON shape is documented in [`wiki/output-contract.md`](./wiki/output-contract.md) and **must not change** in a backwards-incompatible way without a major version bump. New optional fields under `meta` are fine.

## Coding style

- TypeScript strict mode, ESM, Node 20+.
- No new runtime dependencies without discussion.
- Prefer pure functions; the renderers, error classes, and config helpers are all pure.
- Comments only for non-obvious *why*, never *what*.

## Tests

- `vitest` smoke tests are in `test/smoke.test.ts`. They verify alias integrity, error contract, and renderer determinism.
- Network-touching code is not unit-tested in CI (it would require a live Swiggy account). Manual smoke against a real account is preferred.

## Commit style

Conventional commits are encouraged:

```
feat(food): add `add-to-cart --variation` flag
fix(auth): refresh token on 401 instead of failing
docs(wiki): expand troubleshooting for windows path
```

## Releasing

Maintainers only. See [`wiki/releasing.md`](./wiki/releasing.md) — tag-based, runs `release.yml` which publishes to npm with provenance.

## Code of conduct

By participating, you agree to abide by [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## Reporting security issues

Please do not file public issues for security problems. See [`SECURITY.md`](./SECURITY.md).
