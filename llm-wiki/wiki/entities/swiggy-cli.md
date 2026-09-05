---
title: swiggy-cli
type: entity
updated: 2026-09-05
sources: [sources/swiggy-builders-docs, sources/grok-build-notes, sources/agent-skills-spec, sources/agent-plugins-spec]
tags: [project, cli]
---
Unofficial community CLI (npm `swiggy-cli`, binaries `swiggy`/`smn`) by Harshit Khemani (HKTITAN) wrapping the three Swiggy MCP servers for humans and agents. Node 20+, TypeScript, commander. First published 2026-04-28 (0.1.0–0.1.4 within two days); 0.2.0 on 2026-09-05 is the first release aligned with the 51-tool surface.

## Facts
- Contracts: JSON envelope `{ok, server, tool, data, meta}` / `{ok:false, error:{code, message, hint, details}}`; exit codes 0–10 (2 usage, 3 auth, 4 not found, 5 network, 6 MCP error, 7 confirmation, 8 config, 9 rate limited, 10 payment failed) (repo `wiki/output-contract.md`, 0.2.0).
- 0.1.x defect: Layer A verbs sent guessed snake_case parameters (`restaurant_id`, `order_id`, `item_id`) that the servers ignore; only `call` with hand-written JSON worked end-to-end. Fixed in 0.2.0 by re-deriving every verb from the reference ([what-changed-apr-to-sep-2026](../synthesis/what-changed-apr-to-sep-2026.md)).
- 0.2.0 additions: payment stage + `--pay`/`--wait`; new verbs for address, coupons, delivery status, cancel; `docs`, `mcp-config`, `shell`; native views and numbered references ([native-cli-feel](../concepts/native-cli-feel.md)); persisted MCP session; shared-token auth with DCR; 14 skills; Agent Plugins + Claude Code plugin manifests; mock-server test suite (83 tests).
- Runtime deps after 0.2.0: `commander`, `cli-table3`, `prompts` (chalk, ora, zod removed).
- Distribution: npm with provenance via GitHub Actions on `v*` tags (`NPM_TOKEN` secret present, 2026-04-28).

## Relationships
- Wraps [swiggy-mcp](swiggy-mcp.md); packages [agent-skills](agent-skills.md) and [agent-plugins](agent-plugins.md); borrows terminal techniques from [grok-build](grok-build.md).
- Possible future: [rust-port-assessment](../synthesis/rust-port-assessment.md).

## Changelog
- 2026-09-05 — created; 0.2.0 facts recorded.
