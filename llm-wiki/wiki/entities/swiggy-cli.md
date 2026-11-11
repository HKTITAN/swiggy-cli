---
title: swiggy-cli
type: entity
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/swiggy-builders-docs, sources/grok-build-notes, sources/agent-skills-spec, sources/agent-plugins-spec]
tags: [project, cli]
---
Unofficial community CLI (npm `swiggy-cli`, binaries `swiggy`/`smn`) by Harshit Khemani (HKTITAN): a direct client for Swiggy's public API (Food, Instamart, Dineout, Scenes), for humans and agents. That API is JSON-RPC over HTTPS on the MCP Streamable HTTP transport; the CLI speaks it with `fetch` (`src/lib/mcp.ts`), with no SDK, no child process and no MCP client library in between. Node 20+, TypeScript, commander. First published 2026-04-28 (0.1.0–0.1.4 within two days); 0.2.0 on 2026-09-05 aligned it with the 51-tool surface; 0.3.0 on 2026-11-11 with the 62-tool, four-server surface.

## Facts
- Contracts: JSON envelope `{ok, server, tool, data, meta}` / `{ok:false, error:{code, message, hint, details}}`; exit codes 0–10 (2 usage, 3 auth, 4 not found, 5 network, 6 MCP error, 7 confirmation, 8 config, 9 rate limited, 10 payment failed) (repo `wiki/output-contract.md`, 0.2.0).
- 0.1.x defect: Layer A verbs sent guessed snake_case parameters (`restaurant_id`, `order_id`, `item_id`) that the servers ignore; only `call` with hand-written JSON worked end-to-end. Fixed in 0.2.0 by re-deriving every verb from the reference ([what-changed-apr-to-sep-2026](../synthesis/what-changed-apr-to-sep-2026.md)).
- 0.2.0 additions: payment stage + `--pay`/`--wait`; new verbs for address, coupons, delivery status, cancel; `docs`, `mcp-config`, `shell`; native views and numbered references ([native-cli-feel](../concepts/native-cli-feel.md)); persisted MCP session; shared-token auth with DCR; 14 skills; Agent Plugins + Claude Code plugin manifests; mock-server test suite (83 tests).
- Measured 0.1.4 → 0.2.0 on 2026-09-05 (same machine, Node 26, 10 runs, median): `servers --json` 166 ms → 109 ms; `--version` 187 ms → 134 ms; installed `node_modules` 4,473 KB → 955 KB; packages 26 → 12; runtime deps 6 → 3. npm downloads 2026-04-28 → 2026-09-05: 1,084 (0.1.x).
- Runtime deps after 0.2.0: `commander`, `cli-table3`, `prompts` (chalk, ora, zod removed).
- Distribution: npm with provenance via GitHub Actions on `v*` tags (`NPM_TOKEN` secret present, 2026-04-28).
- 0.3.0 (2026-11-11): `swiggy scenes` group (alias `events`); `dineout search` by coordinates only, `--sort`; legacy marking for commands whose tools left the reference (`LEGACY_TOOLS`); token refresh when under 24 h remain and once on a 401, across all server entries sharing the token; one remembered handshake per server in `sessions.json` (token fingerprint, 12 h TTL, session id only if issued); `meta.rateLimit` removed; `details.mayHavePlacedOrder` on a network failure of an order-placing command; `scripts/gen-tools-reference.mjs` (+ `--check`); `skills.sh.json`; 16 skills (repo, 2026-11-11; [what-changed-sep-to-nov-2026](../synthesis/what-changed-sep-to-nov-2026.md)).
- Token storage: `~/.swiggy/auth.json`, plaintext, mode 0600 (ignored on Windows); no keychain. Swiggy's own guidance prefers secure storage (start/authenticate, 2026-11-11), so this is a known gap ([open-questions](../synthesis/open-questions.md)).
- Positioning (2026-11-11): described as "a direct client for Swiggy's public API", not "a wrapper over the MCP servers"; MCP stays an implementation fact in `wiki/architecture.md` and `wiki/mcp-protocol-notes.md`.

## Relationships
- Client of [swiggy-mcp](swiggy-mcp.md) (incl. [scenes-server](scenes-server.md)); packages [agent-skills](agent-skills.md) and [agent-plugins](agent-plugins.md); borrows terminal techniques from [grok-build](grok-build.md).
- Possible future: [rust-port-assessment](../synthesis/rust-port-assessment.md).

## Changelog
- 2026-09-05 — created; 0.2.0 facts recorded.
- 2026-11-11 — 0.3.0 facts recorded. Superseded: "wrapping the three Swiggy MCP servers" (now: direct client for four); "14 skills".
