---
name: swiggy-mcp-docs
description: Look up the authoritative Swiggy Builders Club docs before writing or reviewing any code, config or prompt that touches Swiggy MCP (Food, Instamart, Dineout). Use when a coding agent needs a tool name, parameter, response field, error, rate limit, auth detail or client config for Swiggy MCP — fetch, verify, then answer; never guess.
license: MIT
compatibility: Needs outbound HTTPS to mcp.swiggy.com (WebFetch, curl, or the swiggy CLI).
metadata:
  author: HKTITAN
  version: "0.2.1"
  docs: https://mcp.swiggy.com/builders/docs/start/coding-agents/
---

# swiggy-mcp-docs

Swiggy tool schemas evolve (51 tools as of Sept 2026, up from 35 at launch; payments, address creation and cancellation were added in 2026). A parameter you remember from training data is stale by default. Fetch, then write.

## Where

| Need | Fetch |
| --- | --- |
| index of every page (one line each) | `https://mcp.swiggy.com/builders/llms.txt` |
| everything in one file (~400 KB; use when you need breadth) | `https://mcp.swiggy.com/builders/llms-full.txt` |
| one tool's params + response schema | `https://mcp.swiggy.com/builders/docs/reference/<food\|instamart\|dineout>/<tool>.md` |
| a server's tool list by stage | `https://mcp.swiggy.com/builders/docs/reference/<server>/index.md` |
| auth | `…/docs/start/authenticate.md` · delegated (platforms): `…/docs/start/enterprise/delegated-auth.md` |
| payments recipe | `…/docs/build/recipes/pay-with-upi.md` |
| errors · rate limits · versioning | `…/docs/reference/errors.md` · `…/docs/operate/rate-limits.md` · `…/docs/operate/versioning.md` |
| client configs (Claude, Cursor, VS Code, Windsurf, ChatGPT) | `…/docs/start/consumer/use-in-ai-client.md` |
| what shipped when | `…/docs/operate/changelog.md` and `…/blog/` |

Append `.md` to any docs/blog URL for clean Markdown. With swiggy-cli installed: `swiggy docs reference/food/search_menu` or `swiggy docs --full`. A local snapshot of every tool's parameters is in the `swiggy-mcp` skill (`references/tools.md`), dated 2026-09-05 — use it for speed, the live page for truth.

## Rules

1. **Before you write a tool name, parameter, error string, limit or endpoint, fetch the page that defines it.** Cite the URL in your answer or code comment.
2. **Prefer the per-page `.md` over `llms-full.txt`** when you know the area; it costs ~1/50th of the context.
3. **If the docs do not cover it, say so and ask.** Do not fill the gap from memory. The reference is regenerated from source on every upstream change and is the only trustworthy source.
4. **Distinguish shipped from planned.** The docs mark roadmap items (symbolic `error.code`, `_meta.swiggy.deprecation`, refresh tokens, widgets for Instamart/Dineout, URL version pinning) — never code against a planned field as if it exists.
5. **Parameter case is camelCase upstream** (`addressId`, `restaurantId`, `orderId`, `spinId`, `selectedAddressId`); a few response fields are snake_case (`menu_item_id`, `to_pay`). Copy exactly as the page shows.

## Wire it into a project

Add to `CLAUDE.md` / `AGENTS.md` / `.cursor/rules/swiggy.mdc` / `.windsurf/rules/swiggy.md`:

```md
When writing code against Swiggy MCP (Food, Instamart, Dineout), consult
https://mcp.swiggy.com/builders/llms.txt (index) and append `.md` to any
https://mcp.swiggy.com/builders/docs/... URL. Verify every tool name,
parameter, error code, rate limit and auth flow there before recommending it.
```

## Smoke test

Ask the agent: "Fetch https://mcp.swiggy.com/builders/llms.txt and count the tools under `/docs/reference/food/`." A correctly wired agent counts the entries (20 at the time of writing) instead of guessing.
