# Plugins

The repository root is packaged as a plugin in two formats so any compatible client can load the skills and the three Swiggy MCP servers together.

## Agent Plugins 1.0.0 (vendor-neutral)

Spec: <https://agent-plugins.org> (Technical Steering Committee: Amazon, Cursor, Microsoft, OpenAI, Vercel).

```
swiggy-cli/
├── plugin.json        ← $schema https://agent-plugins.org/schemas/1.0.0/plugin.schema.json, name "swiggy-cli"
├── mcp.json           ← $schema …/mcp.schema.json; swiggy-food / swiggy-instamart / swiggy-dineout as streamable-http
└── skills/<name>/SKILL.md   ← 14 Agent Skills (immediate children only, per spec)
```

- `plugin.json` uses only the portable top-level fields (`$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`) plus `extensions["com.anthropic.claude-code"]` pointing at the Claude Code manifests.
- `mcp.json` declares remote servers only; authentication stays client-managed (OAuth 2.1 + PKCE with dynamic registration, handled by the client when it first connects).
- Validate with `npm run validate:skills`, or against the canonical schemas: `https://agent-plugins.org/schemas/1.0.0/{plugin,mcp}.schema.json`.

A conformant client points at the repo (or a clone) as the plugin root and discovers everything from those fixed locations. `swiggy mcp-config --client plugin` prints the same `mcp.json`.

## Claude Code plugin + marketplace

```
.claude-plugin/plugin.json        ← name "swiggy", skills: ./skills, mcpServers: ./.mcp.json
.claude-plugin/marketplace.json   ← marketplace "swiggy-cli" listing the "swiggy" plugin with source "./"
.mcp.json                         ← Claude Code MCP config (type: http)
```

Install:

```bash
claude plugin marketplace add HKTITAN/swiggy-cli
claude plugin install swiggy@swiggy-cli
```

This registers the 14 skills (`/swiggy-mcp`, `/swiggy-checkout`, …) and the three MCP servers; Claude Code runs the OAuth flow on first use. Without the plugin, `swiggy mcp-config --client claude-code` prints an `.mcp.json` to drop into any project.

## Other clients

`swiggy mcp-config --client <cursor|vscode|windsurf|claude|codex|generic>` prints the config for each client, matching Swiggy's own instructions at <https://mcp.swiggy.com/builders/docs/start/consumer/use-in-ai-client/>. Skills install into those clients with `npx skills add HKTITAN/swiggy-cli -a <agent>`.

## Keeping versions in sync

`package.json`, `plugin.json`, `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` carry the same version; bump all four on release (see [releasing.md](./releasing.md)).
