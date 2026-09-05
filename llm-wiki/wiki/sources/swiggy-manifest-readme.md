---
title: Swiggy/swiggy-mcp-server-manifest README
type: source
updated: 2026-09-05
sources: []
tags: [source, github]
---
Raw: `raw/2026-09-05-swiggy-manifest-readme.md`. Swiggy's public GitHub manifest (last commit 2026-04-24). Authoritative for the OAuth redirect-URI allowlist and client install snippets; stale on capabilities ("COD only", "free bookings only").

## Claims
- Allowlisted redirect URIs incl. `http://localhost[/callback]` and `http://127.0.0.1[/callback]`; custom schemes for Claude, ChatGPT, VS Code, Postman.
- Client configs: Cursor/VS Code deep links; `{"type":"http","url":"https://mcp.swiggy.com/im"}` style JSON; Claude Desktop custom connector by URL.
- Sample prompts per workflow (late-night cravings, team lunch, Bolt, budget meals…).

## What it changed in the wiki
Redirect-URI facts on [oauth-on-swiggy-mcp](../concepts/oauth-on-swiggy-mcp.md); staleness noted against [upi-payments-blog](upi-payments-blog.md).
