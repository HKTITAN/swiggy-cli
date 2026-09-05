---
title: Agent Skills (spec) and skills.sh
type: entity
updated: 2026-09-05
sources: [sources/agent-skills-spec, sources/how-to-write-good-skills]
tags: [skills, agents]
---
The Agent Skills specification (agentskills.io) defines a skill as a directory with a `SKILL.md` (YAML frontmatter + Markdown instructions) and optional `scripts/`, `references/`, `assets/`. skills.sh (Vercel Labs) is the CLI and directory that installs skills from any git repo into 77+ agents. This repo ships 14 skills in that format.

## Facts
- Frontmatter: `name` (= directory name; lowercase/digits/hyphens, ≤64), `description` (≤1024, must say when to use), optional `license`, `compatibility`, `metadata`, `allowed-tools` (spec, 2026-09-05).
- Loading is progressive: metadata always, body on activation (<5000 tokens / 500 lines recommended), references on demand (spec).
- Install: `npx skills add HKTITAN/swiggy-cli [-s name] [-a agent] [-g] [--all]`; `npx skills use owner/repo@skill | claude` for one-off use (skills.sh README).
- Writing discipline adopted: strict wording, the why beside each rule, one job per skill, decision trees, nothing the model already knows ([how-to-write-good-skills](../sources/how-to-write-good-skills.md)).

## The 14 skills here
CLI family: `swiggy-cli` (master + `references/commands.md`), `swiggy-search`, `swiggy-cart`, `swiggy-checkout`, `swiggy-pay`, `swiggy-dineout-booking`, `swiggy-track`, `swiggy-address`.
MCP family: `swiggy-mcp` (master + `references/tools.md`, all 51 tools generated from the docs), `swiggy-mcp-food`, `swiggy-mcp-instamart`, `swiggy-mcp-dineout`, `swiggy-mcp-payments`, `swiggy-mcp-docs`.
Validated by `scripts/validate-skills.mjs` (name/dir match, description length + trigger phrase, ≤500 lines, no soft wording, links resolve).

## Relationships
- Packaged for clients by [agent-plugins](agent-plugins.md). Product: [swiggy-cli](swiggy-cli.md).

## Changelog
- 2026-09-05 — created.
