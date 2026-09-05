# Notes: Agent Plugins 1.0.0 (agent-plugins.org), read 2026-09-05

- Vendor-neutral package format; TSC core maintainers from Amazon, Cursor, Microsoft, OpenAI, Vercel. Spec repo: github.com/agentplugins/agent-plugins-spec.
- Layout: `plugin.json` (required, root), `skills/<name>/SKILL.md` (Agent Skills spec; immediate children only), `mcp.json` (root), `<reverse.domain.namespace>/` directories for client extensions.
- `plugin.json` schema (`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`): required `$schema` (const) and `name` (1–64, `^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$`); optional `version`, `description`, `author{name,email,url}`, `homepage`, `repository`, `license`, `keywords[]`, `extensions{namespace: object}`; `additionalProperties: false` (unknown top-level field = reported and ignored; other violations fatal).
- `mcp.json` schema: `$schema` const + `mcpServers` map; server types `stdio` (`command` one token, `args`, `env`, `cwd` plugin-relative / `${PLUGIN_ROOT}` / `${PLUGIN_DATA}`), `streamable-http` (`url` https unless loopback, literal `headers`, no secrets), `sse` (deprecated). No portable OAuth fields; auth is client-managed.
- Failure isolation: an invalid skill is skipped; invalid `mcp.json` disables MCP for the plugin only.
- Example repo: github.com/agentplugins/agent-plugins-example.
