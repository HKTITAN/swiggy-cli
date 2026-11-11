# swiggy-cli wiki

The durable, deeply-linked knowledge base for the project, written for two audiences:

- **Humans** browsing on GitHub.
- **Agents** that load these Markdown files into context.

Each page is self-contained, named after one concept, and short enough to fit comfortably in a model's context window. Pages link to source files at canonical paths (`src/lib/...`) so a reader can jump from concept → implementation in one click.

## Index

1. [Architecture](./architecture.md) — how the layers fit together.
2. [Commands](./commands.md) — every command, its flags, and the upstream tool it maps to.
3. [Tools catalog](./tools-catalog.md) — the 62 tools Swiggy publishes (Food 20, Instamart 16, Dineout 11, Scenes 15) with required/optional parameters (generated from Swiggy's docs by `scripts/gen-tools-reference.mjs`, 2026-11-11).
4. [Output contract](./output-contract.md) — JSON envelope, `meta`, exit codes, error codes.
5. [Auth](./auth.md) — OAuth 2.1 + PKCE, dynamic registration, one shared token, refresh, where the token is stored.
6. [Payments](./payments.md) — the shared Payment stage: UPI, Cash, Swiggy Money, free and paid Scenes tickets, `--wait`, per-server confirm contract.
7. [MCP protocol notes](./mcp-protocol-notes.md) — the wire format: transport, headers, the remembered handshake, reading results, rate limits, manual replay.
8. [Skills](./skills.md) — the 16 agent skills, how to install them, how to write one.
9. [Plugins](./plugins.md) — Agent Plugins 1.0.0 and Claude Code plugin manifests.
10. [Extending](./extending.md) — adding commands, servers, output modes.
11. [Releasing](./releasing.md) — tag-based publish flow.
12. [Troubleshooting](./troubleshooting.md) — common failures and fixes.

## External references

- Swiggy Builders Club docs: <https://mcp.swiggy.com/builders/docs/> (`llms.txt` at <https://mcp.swiggy.com/builders/llms.txt>)
- Tool reference: <https://mcp.swiggy.com/builders/docs/reference/>
- Brand guidelines: <https://mcp.swiggy.com/builders/docs/operate/brand-guidelines/>
- Official MCP server manifest (client configs, redirect URIs): <https://github.com/Swiggy/swiggy-mcp-server-manifest>
- Model Context Protocol spec: <https://modelcontextprotocol.io>
- Agent Skills spec: <https://agentskills.io/specification> · skills.sh CLI: <https://skills.sh>
- Agent Plugins spec: <https://agent-plugins.org>

## Conventions

- Code paths are absolute from the repo root, e.g. `src/lib/mcp.ts`.
- "Server" always means one of Swiggy's four services as the API names them: `food`, `instamart` (`im`), `dineout`, `scenes`. Command docs for people say Food, Instamart, Dineout and Scenes.
- "Tool" always means one named operation of Swiggy's API (e.g. `search_restaurants`). Tool and parameter names are quoted exactly as Swiggy documents them.
- "Layer A" = ergonomic CLI verbs. "Layer B" = generic `servers / tools / schema / call`.
