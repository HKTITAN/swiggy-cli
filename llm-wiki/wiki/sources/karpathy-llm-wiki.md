---
title: Andrej Karpathy — "LLM Wiki" (gist)
type: source
updated: 2026-09-05
sources: []
tags: [source, pattern]
---
Raw: `raw/2026-09-05-karpathy-llm-wiki.md`. The pattern this directory instantiates: raw sources → LLM-maintained wiki → schema; ingest / query / lint; index + log.

## Claims
- Compile knowledge once and keep it current rather than re-deriving from chunks (contrast with RAG); the LLM does the bookkeeping; file good answers back as pages; lint for contradictions, staleness, orphans.

## What it changed in the wiki
Defined `SCHEMA.md`, `index.md`, `log.md` and the four `wiki/` folders.
