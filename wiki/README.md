# swiggy-cli wiki

This wiki is the durable, deeply-linked knowledge base for the project. It is written for two audiences:

- **Humans** browsing on GitHub.
- **Agents** that load these markdown files into context.

Each page is self-contained, named after a single concept, and short enough to fit comfortably in a model's context window. Pages link out to source files at canonical paths (`src/lib/...`) so a reader can jump from concept → implementation in one click.

## Index

1. [Architecture](./architecture.md) — how the layers fit together.
2. [Commands](./commands.md) — every command, what it does, what it maps to.
3. [Tools catalog](./tools-catalog.md) — verbatim list of upstream MCP tools.
4. [Output contract](./output-contract.md) — JSON envelope, exit codes, error codes.
5. [Auth](./auth.md) — OAuth flow, token storage, refresh.
6. [MCP protocol notes](./mcp-protocol-notes.md) — transport, headers, manual replay.
7. [Skills](./skills.md) — agent-skills shipped from this repo and how to install them.
8. [Extending](./extending.md) — adding new commands or supporting new servers.
9. [Releasing](./releasing.md) — tag-based publish flow.
10. [Troubleshooting](./troubleshooting.md) — common failures and fixes.

## External references

- Official Swiggy MCP server manifest: <https://github.com/Swiggy/swiggy-mcp-server-manifest>
- Official Swiggy MCP builder docs: <https://mcp.swiggy.com/builders/docs/>
- Model Context Protocol spec: <https://modelcontextprotocol.io>
- skills.sh format: <https://skills.sh/docs>

## Conventions

- Code paths are absolute from the repo root, e.g. `src/lib/mcp.ts`.
- "Server" always refers to one of the three Swiggy MCP servers: `food`, `instamart`, `dineout`.
- "Tool" always refers to a single MCP tool (e.g. `search_restaurants`).
- "Layer A" = ergonomic CLI verbs. "Layer B" = generic `servers/tools/schema/call`.