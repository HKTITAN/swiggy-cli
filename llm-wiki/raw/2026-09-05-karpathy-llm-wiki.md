# Notes: Andrej Karpathy, "LLM Wiki" gist (442a6bf555914893e9891c11519de94f), read 2026-09-05

- Contrast with RAG: instead of re-deriving answers from raw chunks each time, the LLM **incrementally builds and maintains a persistent, interlinked Markdown wiki** between the user and the sources. Knowledge is compiled once and kept current.
- Three layers: **raw sources** (immutable), **the wiki** (LLM-owned pages: summaries, entities, concepts, comparisons, overview, synthesis), **the schema** (CLAUDE.md/AGENTS.md-style doc describing structure, conventions, workflows).
- Operations: **ingest** (read source → discuss → source summary page → update index → update entity/concept pages → append log; one source can touch 10–15 pages), **query** (read index → drill into pages → cite; good answers get filed back as pages), **lint** (contradictions, stale claims, orphans, missing pages, gaps).
- `index.md` = content catalogue (page, one-line summary, metadata) updated on every ingest; `log.md` = append-only chronology with grep-able prefixes `## [YYYY-MM-DD] ingest | Title`.
- Optional tooling: local search (qmd) once the index stops scaling; Obsidian as the IDE (graph view, Dataview over frontmatter, Web Clipper for sources, Marp for decks).
- Why it works: the tedious part is bookkeeping; LLMs don't get bored and can touch many files per pass. Human curates and asks; LLM maintains. Memex lineage.
- Intentionally abstract: instantiate the structure to fit the domain.
