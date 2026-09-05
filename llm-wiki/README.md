# llm-wiki — the swiggy-cli knowledge base

An [LLM-maintained wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) (Karpathy's pattern): raw sources go in, an agent compiles and *keeps current* a set of interlinked Markdown pages, and every question you ask can be filed back as a page. Humans curate sources and ask questions; the LLM does the bookkeeping.

```
llm-wiki/
├── SCHEMA.md      how the wiki is structured and the ingest / query / lint workflows (read this first, agent)
├── index.md       catalogue of every page, one line each — the entry point for queries
├── log.md         append-only timeline: ingests, queries, lint passes
├── raw/           immutable sources (snapshots, captures, notes). The LLM reads, never edits
└── wiki/          LLM-written pages
    ├── overview.md
    ├── entities/   things: servers, tools, products, projects, specs
    ├── concepts/   how things work: auth, rate limits, cart state, payments…
    ├── sources/    one summary page per raw source
    └── synthesis/  cross-source analyses, timelines, open questions
```

## Using it

- **Browse**: open `index.md`; every page links to its sources and related pages. Works as an Obsidian vault (graph view shows hubs and orphans) or on GitHub.
- **Ingest a source** (agent): drop the file in `raw/`, then say `ingest raw/<file>`. The agent follows `SCHEMA.md`: source page → entity/concept updates → index → log.
- **Ask** (agent): `query: <question>`. The agent reads `index.md`, drills into pages, answers with citations, and offers to file the answer under `wiki/synthesis/`.
- **Lint** (agent): `lint wiki`. Finds contradictions, stale claims, orphans, missing pages.

## Why it lives in this repo

Everything this CLI knows about Swiggy MCP — 51 tools, the payment stage, auth quirks, rate limits, what changed between April and September 2026 — was learned by reading Swiggy's docs, blog posts and announcements. The wiki keeps that knowledge compiled, dated and cross-referenced so the next update (human or agent) starts from what is already known instead of re-reading 400 KB of docs. The `skills/` and `wiki/` directories are the *product* documentation; `llm-wiki/` is the *research* memory behind them.
