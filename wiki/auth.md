# Auth

Swiggy uses **OAuth 2.1 with PKCE (S256)** for every external caller. Verified against <https://mcp.swiggy.com/builders/docs/start/authenticate/> and the live metadata on 2026-11-11.

## Facts that shape the CLI

| Fact | Consequence in swiggy-cli |
| --- | --- |
| Authorization server is `https://mcp.swiggy.com/auth`; metadata at `/.well-known/oauth-authorization-server`; resource metadata (RFC 9728) at `/.well-known/oauth-protected-resource` | `discoverOAuthMetadata()` tries RFC 9728 → `authorization_servers` → RFC 8414 (path-inserted and origin forms), then legacy `<server>/.well-known/…` |
| **Dynamic Client Registration is supported** (`POST /auth/register`) | no `--client-id` needed; the CLI registers `swiggy-cli` with its loopback redirect URI each login. `--client-id` / `SWIGGY_OAUTH_CLIENT_ID` still override |
| Loopback redirect URIs `http://127.0.0.1` and `http://localhost` (any port) are allowlisted | ephemeral port, `--redirect-host localhost` if 127.0.0.1 is blocked |
| Scopes `mcp:tools mcp:resources mcp:prompts` (server-level, not read/write split) | requested uniformly |
| **One login covers Food, Instamart, Dineout and Scenes** | `swiggy auth init` runs the browser flow once and stores the same entry for all four; a server without an entry borrows a valid token from another |
| Access token lifetime **5 days**; user session 30 days idle | `swiggy auth status` shows hours left and whether a refresh token is stored |
| **Refresh tokens work.** `POST /auth/token` with the JSON body `{ "grant_type": "refresh_token", "refresh_token": "…" }` returns a token valid for 30 days and a new (rotated) refresh token | the CLI refreshes when a token has under 24 hours left, and once more on an HTTP 401. The rotated pair is written to every server entry that shared the old token |
| **An already-expired token cannot be refreshed** | if nothing ran the CLI in the last day of a token's life, the refresh fails and the CLI exits 3 (`AUTH_FAILED`) with a hint to run `swiggy auth init` |
| 401 → refresh, then re-auth; 419 → session revoked; 403 → scope; JSON-RPC `-32001` → unauthenticated | 401 with a token: one refresh and one replay, then `AUTH_FAILED`. 419 and `-32001`: `AUTH_REQUIRED`. All exit 3 and drop the remembered handshake |
| Token endpoint takes a JSON body (code exchange and refresh) | JSON first; one form-encoded retry if the server answers 415 |

## Flow

1. `swiggy auth init` binds `http://127.0.0.1:<port>/callback`, registers a client, opens the browser (`--no-browser` prints the URL; `SWIGGY_NO_BROWSER=1` too).
2. The user signs in with phone + OTP on Swiggy's consent page.
3. The callback delivers `code` + `state`; the CLI exchanges it with the PKCE verifier (5-minute timeout, `--timeout <s>`).
4. The token and its refresh token are stored under every target server in `~/.swiggy/auth.json`:

```json
{ "servers": { "food": { "accessToken": "…", "refreshToken": "…", "tokenType": "Bearer", "scope": "mcp:tools mcp:resources mcp:prompts",
  "obtainedAt": 1762819200000, "expiresAt": 1763251200000, "clientId": "…", "redirectUri": "http://127.0.0.1:51234/callback",
  "authorizationEndpoint": "https://mcp.swiggy.com/auth/authorize", "tokenEndpoint": "https://mcp.swiggy.com/auth/token", "issuer": "https://mcp.swiggy.com/auth" } } }
```

Implementation: `src/lib/auth.ts` (`discoverOAuthMetadata`, `interactiveAuthLogin`, `getAccessToken`, `forceRefresh`, `evaluateAuthHealth`). Refresh behaviour is pinned by `test/auth-refresh.test.ts`.

## Refresh, in detail

- **Ahead of expiry.** `getAccessToken()` refreshes when the stored token expires within 24 hours. A CLI is not a long-running process, so Swiggy's own "refresh when 60 seconds remain" advice would almost never fire.
- **On a 401.** A 401 means the call did not run. The client refreshes once, redoes the handshake and replays the call once (safe even for order placement). If the refresh fails, or the replay is rejected again, the CLI exits 3 with `AUTH_FAILED`.
- **Shared entries.** Food, Instamart, Dineout and Scenes store the same token; a refresh updates all entries that held the old one, so the next command on another service does not present a rotated-out refresh token.
- **No refresh token in `auth.json`** (an older or hand-edited file) → expiry means `swiggy auth init`.

## Where the token lives

`~/.swiggy/auth.json` (or `$SWIGGY_HOME/auth.json`) holds the access token and the refresh token **in plaintext**. The file is written with mode 0600; on Windows that mode is ignored and the file gets the default ACL of your user profile. The CLI does not use the OS keychain. Anyone who can read the file can act as you on Swiggy until the session is revoked, so do not sync, commit or share that directory. `swiggy auth logout` deletes the entries; the Swiggy session itself can be revoked from the Swiggy app.

## Checking

```bash
swiggy auth status --json     # per-server: authenticated, reason, expiresAt, hasRefresh
swiggy auth whoami            # subject / issuer / issued / expires from the JWT claims
swiggy doctor                 # + OAuth metadata reachability and dynamic-registration support
```

## Headless / CI

The first login needs a browser. Options:

- **Pre-provision**: run `swiggy auth init` on a workstation, copy `auth.json`, point `SWIGGY_HOME` at that directory on the runner. The token refreshes itself as long as the runner uses the CLI at least once in the last 24 hours before each expiry (5 days after login, 30 days after each refresh). Treat the copied file as a credential.
- **`--no-browser`** over SSH: open the printed URL on any device; the callback must still reach the machine running the CLI (use `--port` with SSH port forwarding).
- **Platforms serving many end users** should use Swiggy's delegated auth (<https://mcp.swiggy.com/builders/docs/start/enterprise/delegated-auth/>), not this CLI's flow.

## Privacy

Tokens are never printed in human or JSON mode and never appear in argv or environment. `--raw` echoes the tool result, which does not contain the token. The handshake cache (`cache/sessions.json`) stores a 16-character SHA-256 fingerprint of the token, never the token.
