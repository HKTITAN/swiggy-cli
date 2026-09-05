# raw/ — immutable sources

Add, never edit. Name `YYYY-MM-DD-<slug>.<ext>`. Large upstream documents are recorded here by URL rather than vendored; re-fetch to re-ingest.

| File / URL | What | Seen | Size |
| --- | --- | --- | --- |
| `https://mcp.swiggy.com/builders/llms-full.txt` (not vendored) | every Swiggy Builders Club docs page concatenated: start, build recipes, operate, reference for 51 tools, 3 blog posts | 2026-09-05 | 418,885 bytes |
| `https://mcp.swiggy.com/builders/llms.txt` (not vendored) | one-line index of the above | 2026-09-05 | 12,845 bytes |
| `2026-09-05-swiggy-oauth-metadata.json` | live capture of `/.well-known/oauth-authorization-server` and the Food protected-resource metadata | 2026-09-05 | — |
| `2026-09-05-swiggy-mcp-initialize-capture.md` | live capture: unauthenticated `initialize` against `/food` (401 + WWW-Authenticate), CloudFront headers | 2026-09-05 | — |
| `2026-09-05-live-tools-and-schemas.md` | signed-in capture: per-server `tools/list`, live input schemas (incl. undocumented `render_restaurants_dineout`, `tidOverride`, deprecated `cartAmount`), auth state (refresh token issued), absent rate-limit headers | 2026-09-05 | — |
| `2026-09-04-swiggy-money-on-mcp-tweet.md` | @aannuujX announcing "Swiggy Money on MCP" (transcribed) | 2026-09-04 | — |
| `2026-09-05-swiggy-manifest-readme.md` | notes on github.com/Swiggy/swiggy-mcp-server-manifest README (redirect URI allowlist, client configs) | 2026-09-05 | — |
| `2026-09-05-swiggy-money-github-issue-49.md` | notes on Swiggy/swiggy-mcp-server-manifest#49 (request for Swiggy Money payments) | 2026-09-05 | — |
| `2026-09-05-grok-build-tui-notes.md` | observations from reading xai-org/grok-build (Rust TUI): colour detection, OSC 9;4, hyperlinks, status-line throttling | 2026-09-05 | — |
| `2026-09-05-agent-skills-spec.md` | notes on agentskills.io/specification and the skills.sh CLI README | 2026-09-05 | — |
| `2026-09-05-agent-plugins-spec.md` | notes on agent-plugins.org (manifest, mcp.json, skills layout, extensions) + schema excerpts | 2026-09-05 | — |
| `2026-09-05-how-to-write-good-skills.md` | notes on aiforui.dev "How to write good skills" (Emil Kowalski) | 2026-09-05 | — |
| `2026-09-05-karpathy-llm-wiki.md` | the LLM-wiki pattern gist (summary) | 2026-09-05 | — |

Fetch commands:

```bash
curl -sL https://mcp.swiggy.com/builders/llms-full.txt -o raw/$(date +%F)-swiggy-llms-full.txt
curl -s https://mcp.swiggy.com/.well-known/oauth-authorization-server
```
