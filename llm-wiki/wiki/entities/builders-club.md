---
title: Swiggy Builders Club
type: entity
updated: 2026-09-05
sources: [sources/builders-club-launch-blog, sources/swiggy-builders-docs]
tags: [program, docs]
---
Swiggy's ecosystem program around its MCP servers — the docs site (mcp.swiggy.com/builders), the access/onboarding process, support channels, SLAs, rate-limit contract, versioning policy and roadmap. Announced 2026-04-17; docs versioned "v1.0 – 2026-04".

## Facts
- Docs are served three ways: HTML, per-page Markdown (append `.md`), and `llms.txt` / `llms-full.txt` for agents (start/coding-agents, 2026-09-05).
- Access: build locally on `http://localhost` first, record a demo video, apply at /access with redirect URIs and servers; staging then production; "whitelist onboarding, invite-based today" (operate/access, what-is).
- Support: builders@swiggy.in; response SLA by severity; co-branding for standout projects; status page `status.swiggy.com/mcp` planned (operate/support, sla).
- SLA: uptime and latency targets published (operate/sla). Maintenance windows announced by email.
- Rate limits: see [rate-limits-and-sessions](../concepts/rate-limits-and-sessions.md).
- Versioning: SemVer, 6-month deprecation, `_meta.swiggy.deprecation` planned, URL pinning planned (operate/versioning).
- Roadmap (changelog page): v1.1 refresh tokens, status page, rate-limit headers, symbolic error codes, deprecation metadata, hosted Food widget iframe, DCR; v1.2 Instamart + Dineout widgets; v2 URL version pinning, online payment on Food. Several of these have shipped (DCR live; Food UPI live; 429 documented) without the changelog being updated.
- Enterprise track: delegated OAuth on-behalf-of flow for platforms (start/enterprise/delegated-auth).

## Relationships
- Platform: [swiggy-mcp](swiggy-mcp.md). Coding-agent guidance mirrored in skill `swiggy-mcp-docs` ([agent-skills](agent-skills.md)).

## Contradictions & uncertainty
- The changelog page is behind the reference (see [what-changed-apr-to-sep-2026](../synthesis/what-changed-apr-to-sep-2026.md)).

## Changelog
- 2026-09-05 — created.
