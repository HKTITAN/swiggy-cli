# Contributing to swiggy-cli

Thanks for considering a contribution! This is a community CLI for the official [Swiggy MCP servers](https://mcp.swiggy.com/builders/); upstream behaviour changes belong with Swiggy (builders@swiggy.in / the [manifest repo](https://github.com/Swiggy/swiggy-mcp-server-manifest)), but anything about how this CLI wraps them belongs here.

## Quick start

```bash
git clone https://github.com/HKTITAN/swiggy-cli.git
cd swiggy-cli
npm ci
npm run dev -- --help          # run from source via tsx
npm run lint                   # tsc --noEmit
npm test                       # builds dist/ then runs vitest (unit + mock MCP server + built-binary tests)
npm run validate:skills        # Agent Skills + plugin manifest checks
node dist/cli.js doctor        # smoke-test the built binary
```

## Project layout

See [`wiki/architecture.md`](./wiki/architecture.md). One-line summary: `src/program.ts` builds the commander program, every verb lives under `src/commands/`, and every verb ends in `invokeTool()` → `McpClient.callTool()` (`src/lib/mcp.ts`).

## Adding an ergonomic command

The Swiggy MCP servers expose 51 tools today; any tool is reachable via `swiggy call <server> <tool>` immediately. To add a friendly verb:

1. Look the tool up: `swiggy docs reference/<server>/<tool>` — copy the parameter names exactly (camelCase upstream).
2. Add it to `TOOL_CATALOG` and `ERGONOMIC_ALIASES` in [`src/lib/aliases.ts`](./src/lib/aliases.ts); add to `DESTRUCTIVE_TOOLS` if it spends money or destroys state.
3. Add the verb in [`src/commands/<server>.ts`](./src/commands) using `run()`, `buildArgs()` and the validators from `common.ts` (see [`wiki/extending.md`](./wiki/extending.md) for a template).
4. Document it in [`wiki/commands.md`](./wiki/commands.md) and, if agents should use it, in the relevant skill under `skills/`.
5. Add a mock response in `test/helpers/mock-mcp.ts` and a case in `test/cli.test.ts` when the verb has logic worth pinning.

## Output contract

Every command produces a structured envelope before rendering. The JSON shape is documented in [`wiki/output-contract.md`](./wiki/output-contract.md) and **must not change** in a backwards-incompatible way without a major version. New optional keys under `meta` are fine.

## Skills and plugins

Skills follow the [Agent Skills spec](https://agentskills.io/specification) and the writing rules in [`wiki/skills.md`](./wiki/skills.md): strict wording, the "why" beside every rule, one job per skill, under 500 lines. Plugin manifests (`plugin.json`, `mcp.json`, `.claude-plugin/`, `.mcp.json`) must keep the same version as `package.json`. `npm run validate:skills` checks all of it.

## Coding style

- TypeScript strict mode, ESM, Node 20+.
- Runtime dependencies are `commander`, `cli-table3`, `prompts` — no new ones without discussion. UI-only deps are loaded lazily so machine-mode calls stay fast.
- Pure functions where possible: renderers, payment logic, envelope helpers and error classes are all pure and unit-tested.
- Comments explain *why*, never *what*.
- Nothing but the envelope goes to stdout; status lines, notes and links go to stderr.

## Tests

- `test/smoke.test.ts` — catalog integrity, error contract, version.
- `test/payments.test.ts` — `--pay` parsing, per-server confirm contract, status classification, poll loop with a virtual clock.
- `test/envelope.test.ts` — payload extraction, envelope unwrapping, SSE parsing, renderer helpers, terminal helpers.
- `test/mcp-client.test.ts` — `McpClient` against `test/helpers/mock-mcp.ts` (sessions, expiry recovery, SSE, 401/419/429/-32001).
- `test/cli.test.ts` — the built `dist/cli.js` end to end against the mock server.

Live Swiggy calls are not exercised in CI (they need a real account and place real orders). Do a manual pass with `swiggy doctor` and a read-only command before releasing.

## Commit style

Conventional commits:

```
feat(food): add `add-to-cart --items` for variants
fix(auth): treat HTTP 419 as a revoked session
docs(wiki): document the payment stage
```

## Releasing

Maintainers only — [`wiki/releasing.md`](./wiki/releasing.md). Tag-based; `release.yml` publishes to npm with provenance.

## Code of conduct

By participating, you agree to abide by [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## Reporting security issues

Please do not file public issues for security problems. See [`SECURITY.md`](./SECURITY.md).
