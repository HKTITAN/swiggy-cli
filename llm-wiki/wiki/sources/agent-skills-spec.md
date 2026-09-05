---
title: Agent Skills specification + skills.sh README
type: source
updated: 2026-09-05
sources: []
tags: [source, spec, skills]
---
Raw: `raw/2026-09-05-agent-skills-spec.md`. The format every skill in `skills/` follows and the CLI users install them with.

## Claims
- `SKILL.md` frontmatter rules (name = directory, ≤64 chars; description ≤1024 and states when to use; optional license/compatibility/metadata/allowed-tools); progressive disclosure; keep body < 500 lines; references one level deep; `skills-ref validate`.
- `npx skills add <source>` with `-s`, `-a`, `-g`, `--all`, `--list`; `skills use` for one-off prompts.

## What it changed in the wiki
Created [agent-skills](../entities/agent-skills.md); the repo's `scripts/validate-skills.mjs` implements the mechanical checks.
