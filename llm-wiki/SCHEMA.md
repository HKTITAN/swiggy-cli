# SCHEMA — how this wiki is maintained

Agent: read this before touching anything under `llm-wiki/`. It is the contract that makes you a disciplined wiki maintainer rather than a chatbot. Humans may edit it; the LLM proposes changes to it when a convention stops working.

## Domain

Swiggy's MCP platform (Food, Instamart, Dineout servers; Builders Club; payments; auth; limits), the `swiggy-cli` that wraps it, and the agent-tooling standards it targets (Agent Skills, Agent Plugins, skills.sh) plus design references (Grok Build TUI). Time-sensitive: Swiggy ships changes monthly; every claim carries a date.

## Layers

1. `raw/` — immutable. Snapshots of docs, blog posts, tweets, live captures (OAuth metadata, HTTP handshake captures), notes taken while reading code. Name files `YYYY-MM-DD-<slug>.<ext>`. Large upstream files are *not* vendored; `raw/README.md` records the URL and the fetch command and the date/size seen. Never edit a raw file; add a new one.
2. `wiki/` — LLM-owned. Four folders:
   - `entities/` — one page per thing that has an identity (a server, a tool family, a product, a project, a spec).
   - `concepts/` — one page per mechanism (how auth works, how carts behave, how rate limits are counted).
   - `sources/` — one page per raw source: what it is, date, what it claims, what it changed in the wiki.
   - `synthesis/` — answers, comparisons, timelines, open questions. Queries get filed here.
3. `index.md` + `log.md` — navigation and history (below).

## Page format

```markdown
---
title: Payment stage
type: concept            # entity | concept | source | synthesis
updated: 2026-09-05
sources: [sources/upi-payments-blog, sources/swiggy-builders-docs]
tags: [payments, upi]
---
One-paragraph summary that answers "what is this and why does it matter" without reading further.

## Facts            (dated, sourced; each bullet ends with (source, date))
## How it works     (concepts) / ## Details (entities)
## Relationships    (links to related pages, and *why* they relate)
## Contradictions & uncertainty   (only when something is unresolved)
## Changelog        (what changed on this page and which ingest caused it)
```

Rules:
- **Every factual bullet cites a source page and a date.** Swiggy's docs contradict themselves (the coding-agents page still says "14 Food tools"); the wiki resolves by preferring the reference pages and the newest date, and records the conflict under *Contradictions*.
- **Prefer specifics over prose.** Parameter names, endpoints, limits, dates, version numbers.
- **Link generously** with relative links (`../entities/food-server.md`). A page with no inbound links is a lint failure.
- **Never delete facts; supersede them.** Move a stale claim to the page's Changelog with the date it stopped being true.
- **Planned ≠ shipped.** Mark roadmap items explicitly ("planned, not emitted as of 2026-09-05").

## Workflows

### Ingest `raw/<file>`
1. Read the source in full. List 3–8 key takeaways for the human.
2. Write/update `wiki/sources/<slug>.md` (what, when, claims, what it changed).
3. Update every affected entity/concept page: add facts, resolve or flag contradictions, refresh `updated:`.
4. Create pages for new things that deserve one (a new tool family, a new limit, a new product).
5. Add/adjust lines in `index.md`.
6. Append to `log.md`: `## [YYYY-MM-DD] ingest | <title>` + bullets of pages touched.
7. If the source changes product behaviour, say which `skills/` or `wiki/` product docs now need an update.

### Query
1. Read `index.md`; pick candidate pages; read them (never answer from memory alone).
2. Answer with citations `(page → source, date)`. Flag when the wiki is silent or stale.
3. Offer to file the answer under `wiki/synthesis/<slug>.md` with `type: synthesis`. If filed, update index + log (`## [date] query | <question>`).

### Lint
Check: contradictions between pages; facts older than the newest source that could supersede them; orphan pages; entities mentioned ≥3 times without a page; broken links; pages missing frontmatter; `planned` items that may have shipped (suggest a fetch). Write findings to `wiki/synthesis/lint-YYYY-MM-DD.md`, fix what is mechanical, and log `## [date] lint | n findings`.

## Sources of truth, in order

1. `https://mcp.swiggy.com/builders/docs/reference/<server>/<tool>.md` (regenerated from Swiggy's source on every change)
2. Live captures in `raw/` (metadata endpoints, HTTP handshake captures) — what the servers actually do
3. Swiggy blog posts and changelog (dated announcements)
4. Swiggy prose pages (recipes, start guides) — useful but drift; the coding-agents page is known-stale
5. Third-party posts and tweets — for dates and intent only

## Tooling

Small enough for `index.md` + `grep`. `grep "^## \[" log.md | tail -5` shows recent activity. If it outgrows this, add [qmd](https://github.com/tobi/qmd) or a similar local search; do not add embeddings infrastructure before that point.
