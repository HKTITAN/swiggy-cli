---
title: Agent Plugins (1.0.0) and the Claude Code plugin format
type: entity
updated: 2026-09-05
sources: [sources/agent-plugins-spec]
tags: [plugins, agents]
---
Two packaging formats this repo satisfies at once: the vendor-neutral Agent Plugins 1.0.0 (agent-plugins.org; TSC from Amazon, Cursor, Microsoft, OpenAI, Vercel) and Anthropic's Claude Code plugin/marketplace layout.

## Facts
- Agent Plugins: root `plugin.json` (`$schema` + `name` required; closed schema; client data under `extensions.<reverse.domain>`), `skills/<name>/SKILL.md` (immediate children only), root `mcp.json` (`stdio` | `streamable-http` | `sse`; no OAuth fields — auth is client-managed; https required off-loopback; headers must not contain secrets) (spec, 2026-09-05).
- Failure isolation: invalid skill skipped; invalid `mcp.json` disables only MCP (spec).
- Claude Code: `.claude-plugin/plugin.json` (name, version, description, author, skills path, mcpServers path…), `.claude-plugin/marketplace.json` (owner, `plugins[]` with `source: "./"`), `.mcp.json` with `{type:"http", url}` entries; install via `claude plugin marketplace add HKTITAN/swiggy-cli` then `claude plugin install swiggy@swiggy-cli` (repo `wiki/plugins.md`).

## In this repo
`plugin.json` (name `swiggy-cli`, extension `com.anthropic.claude-code` pointing at the Claude manifests), `mcp.json` (three `streamable-http` servers), `.claude-plugin/plugin.json` + `marketplace.json`, `.mcp.json`. `swiggy mcp-config --client plugin` regenerates `mcp.json`.

## Relationships
- Contents: [agent-skills](agent-skills.md). Servers declared: [swiggy-mcp](swiggy-mcp.md).

## Changelog
- 2026-09-05 — created.
