# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.2.x   | :white_check_mark: |
| 0.1.x   | :x: (sent incorrect parameters upstream; upgrade) |

We're pre-1.0. Once 1.0 ships, the latest minor will be supported, plus the previous minor for 90 days.

## Reporting a vulnerability

**Do not open a public issue.** Instead:

- Use [GitHub's private vulnerability reporting](https://github.com/HKTITAN/swiggy-cli/security/advisories/new) — preferred.
- Or email the maintainer: harshitkhemani@gmail.com.

Please include a clear description and impact, steps to reproduce (a minimal command sequence), whether stored credentials, network traffic or local state are affected, and any suggested mitigation. We aim to acknowledge within **3 business days** and ship a fix or coordinated disclosure within **14 days** for confirmed issues.

## Threat model

`swiggy-cli` runs locally and talks only to `mcp.swiggy.com` (the three MCP endpoints, the OAuth endpoints they advertise, and the public docs). It performs no telemetry.

Local state under `~/.swiggy/` (or `SWIGGY_HOME`):

| File | Contents | Mode |
| --- | --- | --- |
| `auth.json` | the OAuth access token (5-day lifetime), client id, endpoints | 0600 |
| `cache/sessions.json` | the `Mcp-Session-Id` per server (tied to the token; useless without it) | 0600 |
| `config.json` | profiles, default address id / coordinates, endpoint overrides | 0600 |
| `history` | `swiggy shell` command history (may contain ids you typed, never tokens) | 0600 |
| `cache/dineout-coords.json` | last coordinates returned by a Dineout search | default |

Tokens are never printed to stdout in human or JSON mode and never appear in argv or environment. `--raw` echoes the literal MCP response, which does not contain the token. The OAuth flow uses a loopback redirect (`127.0.0.1`/`localhost`, ephemeral port) with PKCE S256 and a CSRF `state`; the callback listener accepts one response and closes.

Destructive tools (orders, bookings, cancellations, cart flush, address delete) require interactive confirmation or an explicit `--yes`. Order placement is never retried automatically.

## Out of scope

- Vulnerabilities in the upstream Swiggy MCP servers — report to Swiggy (builders@swiggy.in).
- Vulnerabilities in third-party dependencies that don't affect a default `swiggy-cli` install — file with that project.
