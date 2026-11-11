---
title: Swiggy Builders Club
type: entity
updated: 2026-11-11
sources: [sources/swiggy-builders-docs-2026-11, sources/builders-club-launch-blog, sources/swiggy-builders-docs]
tags: [program, docs]
---
Swiggy's ecosystem program around its MCP servers — the docs site (mcp.swiggy.com/builders), the access/onboarding process, support channels, SLAs, rate-limit contract, versioning policy and roadmap. Announced 2026-04-17; docs versioned "v1.0 – 2026-04".

## Facts
- Docs are served three ways: HTML, per-page Markdown (append `.md`), and `llms.txt` / `llms-full.txt` for agents (start/coding-agents, 2026-09-05).
- Access: build locally on `http://localhost` first, record a demo video, apply at /access with redirect URIs and servers; staging then production; "whitelist onboarding, invite-based today" (operate/access, what-is).
- Support: builders@swiggy.in; response SLA by severity; co-branding for standout projects; status page `status.swiggy.com/mcp` planned (operate/support, sla).
- SLA: uptime and latency targets published (operate/sla). Maintenance windows announced by email.
- Rate limits: see [rate-limits-and-sessions](../concepts/rate-limits-and-sessions.md).
- Versioning: SemVer, 6-month deprecation window announced by email, a blog post and the changelog; no `_meta.swiggy.deprecation` field exists (operate/versioning, 2026-11-11).
- Brand guidelines: `/docs/operate/brand-guidelines/`. Pair the service's square logo with "Powered by Swiggy" (Food), "Powered by Instamart" or "Powered by Dineout"; text-only channels still carry the full attribution; avoid "official app", "certified" or endorsement claims; never merge the services into one generic attribution. No line for Scenes (operate/brand-guidelines, 2026-11-11).
- New Build page "Read tool results" defines how clients read `structuredContent` vs `content` (build/read-tool-results, 2026-11-11).
- Roadmap: the changelog page no longer lists a v1.1 / v1.2 / v2 roadmap; only "signed client manifests" is tracked, without a date. Refresh tokens and DCR shipped; rate-limit headers, symbolic error codes and deprecation metadata are now documented as not existing; a status page is still "shipping in v1.1" per operate/sla (operate/changelog, operate/sla, 2026-11-11).
- Enterprise track: delegated OAuth on-behalf-of flow for platforms (start/enterprise/delegated-auth).

## Relationships
- Platform: [swiggy-mcp](swiggy-mcp.md). Coding-agent guidance mirrored in skill `swiggy-mcp-docs` ([agent-skills](agent-skills.md)).

## Contradictions & uncertainty
- The changelog page is behind the reference (see [what-changed-apr-to-sep-2026](../synthesis/what-changed-apr-to-sep-2026.md)).

## Changelog
- 2026-09-05 — created.
- 2026-11-11 — November snapshot. Superseded: "`_meta.swiggy.deprecation` planned, URL pinning planned"; "Roadmap: v1.1 refresh tokens, status page, rate-limit headers, symbolic error codes, deprecation metadata, hosted Food widget iframe, DCR; v1.2 Instamart + Dineout widgets; v2 URL version pinning, online payment on Food".
