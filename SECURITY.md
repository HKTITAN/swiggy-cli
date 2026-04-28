# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.x     | :white_check_mark: |

We're pre-1.0. Once 1.0 ships, the latest minor will be supported, plus the previous minor for 90 days.

## Reporting a vulnerability

**Do not open a public issue.** Instead:

- Use [GitHub's private vulnerability reporting](https://github.com/HKTITAN/swiggy-cli/security/advisories/new) — preferred.
- Or reach the maintainer through a private channel listed on the repo profile.

Please include:

1. A clear description of the vulnerability and its impact.
2. Steps to reproduce, ideally with a minimal command sequence.
3. Whether the issue affects stored credentials, network traffic, or local state.
4. Any suggested mitigation.

We aim to acknowledge within **3 business days** and ship a fix or coordinated disclosure within **14 days** for confirmed issues.

## Threat model

`swiggy-cli` runs locally on a developer's machine and stores OAuth tokens at `~/.swiggy/auth.json` with mode `0600`. It speaks only to the three Swiggy MCP endpoints (overridable via env), the OAuth metadata/token endpoints they advertise, and a loopback redirect on `127.0.0.1`. It performs no telemetry. Tokens are never logged or printed to stdout in human/JSON modes (only `--raw` echoes the literal MCP response, by design).

## Out of scope

- Vulnerabilities in upstream Swiggy MCP servers themselves — file at <https://github.com/Swiggy/swiggy-mcp-server-manifest>.
- Vulnerabilities in third-party dependencies that don't affect a default `swiggy-cli` install — file with that project.
