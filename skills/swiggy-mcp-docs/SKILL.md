---
name: swiggy-mcp-docs
description: Look up the authoritative Swiggy Builders Club docs before writing or reviewing any code, config or prompt that touches Swiggy's servers (Food, Instamart, Dineout, Scenes). Use when a coding agent needs a tool name, parameter, response field, error, rate limit, auth detail or client config for Swiggy — fetch, verify, then answer; never guess.
license: MIT
compatibility: Needs outbound HTTPS to mcp.swiggy.com (WebFetch, curl, or the swiggy CLI).
metadata:
  author: HKTITAN
  version: "0.3.0"
  docs: https://mcp.swiggy.com/builders/docs/start/coding-agents/
---

# swiggy-mcp-docs

Swiggy's tool surface changes every few weeks: 35 tools at launch, 51 in September 2026, 62 across four servers in November 2026 (Scenes added; five Instamart and Dineout tools removed; Dineout search changed its required parameters). A parameter you remember from training data is stale by default. Fetch, then write.

## Where

| Need | Fetch |
| --- | --- |
| index of every page (one line each) | `https://mcp.swiggy.com/builders/llms.txt` |
| everything in one file (~630 KB; use when you need breadth) | `https://mcp.swiggy.com/builders/llms-full.txt` |
| one tool's params + response schema | `https://mcp.swiggy.com/builders/docs/reference/<food\|instamart\|dineout\|scenes>/<tool>.md` |
| a server's tool list by stage | `https://mcp.swiggy.com/builders/docs/reference/<server>/index.md` |
| auth | `…/docs/start/authenticate.md` · delegated (platforms): `…/docs/start/enterprise/delegated-auth.md` |
| payments recipe | `…/docs/build/recipes/pay-with-upi.md` |
| how to read a tool result (`structuredContent` vs `content`) | `…/docs/build/read-tool-results.md` |
| retries, order placement, go-live checklist | `…/docs/build/ship-to-production.md` |
| brand and attribution rules | `…/docs/operate/brand-guidelines.md` |
| errors · rate limits · versioning | `…/docs/reference/errors.md` · `…/docs/operate/rate-limits.md` · `…/docs/operate/versioning.md` |
| client configs (Claude, Cursor, VS Code, Windsurf, ChatGPT) | `…/docs/start/consumer/use-in-ai-client.md` |
| what shipped when | `…/docs/operate/changelog.md` and `…/blog/` |

Append `.md` to any docs/blog URL for clean Markdown. With swiggy-cli installed: `swiggy docs reference/food/search_menu` or `swiggy docs --full`. A local snapshot of every tool's parameters is in the `swiggy-mcp` skill (`references/tools.md`), generated on 2026-11-11: use it for speed, the live page for truth.

## Rules

1. **Before you write a tool name, parameter, error string, limit or endpoint, fetch the page that defines it.** Cite the URL in your answer or code comment.
2. **Prefer the per-page `.md` over `llms-full.txt`** when you know the area; it costs ~1/50th of the context.
3. **If the docs do not cover it, say so and ask.** Do not fill the gap from memory. The reference is regenerated from source on every upstream change and is the only trustworthy source.
4. **Code only against what the reference shows.** As of November 2026 these do NOT exist, whatever older posts or prompts say: a symbolic `error.code`, a `_meta.swiggy.deprecation` field, `X-RateLimit-*` headers or published rate numbers, an idempotency key on order placement, URL version pinning. These DO exist: refresh tokens (`grant_type=refresh_token`, JSON body), widgets on all four servers (served over `resources/read`), Swiggy Money on Food and Instamart.
5. **Parameter case is camelCase upstream** (`addressId`, `restaurantId`, `orderId`, `spinId`, `selectedAddressId`); a few response fields are snake_case (`menu_item_id`, `to_pay`). Copy exactly as the page shows.

## Wire it into a project

Add to `CLAUDE.md` / `AGENTS.md` / `.cursor/rules/swiggy.mdc` / `.windsurf/rules/swiggy.md`:

```md
When writing code against Swiggy's servers (Food, Instamart, Dineout, Scenes), consult
https://mcp.swiggy.com/builders/llms.txt (index) and append `.md` to any
https://mcp.swiggy.com/builders/docs/... URL. Verify every tool name,
parameter, error code, rate limit and auth flow there before recommending it.
```

## Smoke test

Ask the agent: "Fetch https://mcp.swiggy.com/builders/llms.txt and count the tools under `/docs/reference/food/`." A correctly wired agent counts the entries (20 at the time of writing) instead of guessing.
