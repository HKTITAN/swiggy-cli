# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.3.x   | :white_check_mark: |
| 0.2.x   | :x: (no token refresh; Dineout search sends a parameter Swiggy no longer accepts; upgrade) |
| 0.1.x   | :x: (sent incorrect parameters upstream; upgrade) |

We're pre-1.0. Once 1.0 ships, the latest minor will be supported, plus the previous minor for 90 days.

## Reporting a vulnerability

**Do not open a public issue.** Instead:

- Use [GitHub's private vulnerability reporting](https://github.com/HKTITAN/swiggy-cli/security/advisories/new) — preferred.
- Or email the maintainer: harshitkhemani@gmail.com.

Please include a clear description and impact, steps to reproduce (a minimal command sequence), whether stored credentials, network traffic or local state are affected, and any suggested mitigation. We aim to acknowledge within **3 business days** and ship a fix or coordinated disclosure within **14 days** for confirmed issues.

## Threat model

`swiggy-cli` runs locally and talks only to `mcp.swiggy.com` (the four API endpoints `/food`, `/im`, `/dineout`, `/scenes`, the OAuth endpoints they advertise, and the public docs). It performs no telemetry.

Local state under `~/.swiggy/` (or `SWIGGY_HOME`):

| File | Contents | Mode |
| --- | --- | --- |
| `auth.json` | the OAuth access token and refresh token **in plaintext**, client id, endpoints | 0600 |
| `cache/sessions.json` | one handshake record per server: URL, timestamp, a 16-character SHA-256 fingerprint of the token (never the token), and the `Mcp-Session-Id` only if Swiggy issued one | 0600 |
| `config.json` | profiles, default address id / coordinates, endpoint overrides | 0600 |
| `history` | `swiggy shell` command history (may contain ids you typed, never tokens) | 0600 |
| `cache/dineout-coords.json`, `cache/scenes-coords.json` | last coordinates a Dineout / Scenes response resolved | default |
| `cache/scenes-cart.json` | the last ticket cart: `cartKey`, show and ticket ids, guest count, coordinates (used for 30 minutes) | 0600 |
| `cache/recent.json` | numbered rows of the last listings (ids and labels of restaurants, items, addresses, events, orders) | default |

**Token storage, plainly.** The CLI does not use the OS keychain. `auth.json` is a plaintext JSON file. It is created with mode 0600, which protects it from other local users on Linux and macOS; **Windows ignores that mode**, so there the file is protected only by the ACL of your user profile directory. Any process running as you can read it. The access token is valid for 5 days and the refresh token can extend the session by 30 days at a time, so a copied file stays useful until the session is revoked. If the file may have leaked: run `swiggy auth logout` (it deletes the local copy only; it does not revoke the session at Swiggy), log out in the Swiggy app to revoke the session, then run `swiggy auth init`. Do not commit, sync or back up `~/.swiggy/` to a shared location. Keychain-backed storage is not implemented.

Tokens are never printed to stdout in human or JSON mode and never appear in argv or environment. `--raw` echoes the literal tool result, which does not contain the token. The OAuth flow uses a loopback redirect (`127.0.0.1`/`localhost`, ephemeral port) with PKCE S256 and a CSRF `state`; the callback listener accepts one response and closes. Token refresh sends only `grant_type` and the refresh token to the token endpoint from Swiggy's own metadata.

Destructive tools (orders, table bookings, ticket bookings, cancellations, cart flush, address delete) require interactive confirmation or an explicit `--yes`. Order placement is never retried after a failure: Swiggy does not de-duplicate it, and a network error is reported with `details.mayHavePlacedOrder: true`. The only replays are the two cases where Swiggy rejected the request before running it (an HTTP 401 that a token refresh fixes, or a rejected handshake).

## Out of scope

- Vulnerabilities in Swiggy's own servers or API — report to Swiggy (builders@swiggy.in).
- Vulnerabilities in third-party dependencies that don't affect a default `swiggy-cli` install — file with that project.
