---
title: Agent Plugins 1.0.0 specification
type: source
updated: 2026-09-05
sources: []
tags: [source, spec, plugins]
---
Raw: `raw/2026-09-05-agent-plugins-spec.md`. The vendor-neutral plugin package format (plugin.json + skills/ + mcp.json + reverse-domain extensions) with canonical JSON Schemas.

## Claims
- Closed `plugin.json` schema; name regex; `extensions` for client data. `mcp.json` with `stdio` / `streamable-http` / `sse`; no OAuth fields; https required; headers are literal, no secrets. Failure isolation per component.

## What it changed in the wiki
Created [agent-plugins](../entities/agent-plugins.md); repo root made a valid plugin.
