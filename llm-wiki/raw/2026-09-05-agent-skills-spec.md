# Notes: Agent Skills specification (agentskills.io/specification) + skills.sh CLI README, read 2026-09-05

- A skill is a directory with `SKILL.md` (required) and optional `scripts/`, `references/`, `assets/`.
- Frontmatter: `name` (required; 1–64 chars; lowercase a-z, 0-9, hyphens; no leading/trailing/double hyphen; **must match the directory name**), `description` (required; 1–1024 chars; what it does *and when to use it*, with trigger keywords), `license`, `compatibility` (≤500 chars, only if needed), `metadata` (string→string map), `allowed-tools` (experimental, space-separated).
- Progressive disclosure: metadata (~100 tokens) loaded for all skills at startup; body (<5000 tokens recommended, keep under 500 lines) when activated; references on demand, one level deep.
- Validation: `skills-ref validate ./my-skill`.
- skills.sh CLI (`npx skills add owner/repo`): sources = GitHub shorthand, full URL, tree path, GitLab, git URL, local path, direct SKILL.md/archive URL. Options `-a/--agent`, `-s/--skill` (`'*'` for all), `-l/--list`, `--copy`, `-y`, `--all`, `-g/--global`. Other commands: `use`, `list`, `find`, `remove`, `update`, `init`. Supports 77+ agents (Claude Code, Cursor, Codex, Copilot, Windsurf, Gemini, Cline, Amp, …).
