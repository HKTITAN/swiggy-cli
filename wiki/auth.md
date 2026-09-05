# Auth

Swiggy MCP uses **OAuth 2.1 with PKCE (S256)** for every external caller. Verified against <https://mcp.swiggy.com/builders/docs/start/authenticate/> and the live metadata on 2026-09-05.

## Facts that shape the CLI

| Fact | Consequence in swiggy-cli |
| --- | --- |
| Authorization server is `https://mcp.swiggy.com/auth`; metadata at `/.well-known/oauth-authorization-server`; resource metadata (RFC 9728) at `/.well-known/oauth-protected-resource` | `discoverOAuthMetadata()` tries RFC 9728 → `authorization_servers` → RFC 8414 (path-inserted and origin forms), then legacy `<server>/.well-known/…` |
| **Dynamic Client Registration is supported** (`POST /auth/register`) | no `--client-id` needed; the CLI registers `swiggy-cli` with its loopback redirect URI each login. `--client-id` / `SWIGGY_OAUTH_CLIENT_ID` still override |
| Loopback redirect URIs `http://127.0.0.1` and `http://localhost` (any port) are allowlisted | ephemeral port, `--redirect-host localhost` if 127.0.0.1 is blocked |
| Scopes `mcp:tools mcp:resources mcp:prompts` (server-level, not read/write split) | requested uniformly |
| **One token works on all three servers** | `swiggy auth init` runs the browser flow once and stores the same entry for food/instamart/dineout; a server without an entry borrows a valid token from another |
| Access token lifetime **5 days**; user session 30 days idle; **refresh tokens are not issued in v1.0** even though the metadata advertises the grant | expiry → `AUTH_REQUIRED` with a hint to re-run `auth init`; `evaluateAuthHealth` shows hours left |
| 401 → re-auth; 419 → session revoked; 403 → scope; JSON-RPC `-32001` → unauthenticated | all map to exit 3 and drop the cached session |
| Token endpoint documented with a JSON body; standard OAuth uses form encoding | form first, JSON fallback on 400/415 |

## Flow

1. `swiggy auth init` binds `http://127.0.0.1:<port>/callback`, registers a client, opens the browser (`--no-browser` prints the URL; `SWIGGY_NO_BROWSER=1` too).
2. The user signs in with phone + OTP on Swiggy's consent page.
3. The callback delivers `code` + `state`; the CLI exchanges it with the PKCE verifier (5-minute timeout, `--timeout <s>`).
4. The token is stored under every target server in `~/.swiggy/auth.json` (mode 0600):

```json
{ "servers": { "food": { "accessToken": "…", "tokenType": "Bearer", "scope": "mcp:tools mcp:resources mcp:prompts",
  "obtainedAt": 1757040000000, "expiresAt": 1757472000000, "clientId": "…", "redirectUri": "http://127.0.0.1:51234/callback",
  "authorizationEndpoint": "https://mcp.swiggy.com/auth/authorize", "tokenEndpoint": "https://mcp.swiggy.com/auth/token", "issuer": "https://mcp.swiggy.com/auth" } } }
```

Implementation: `src/lib/auth.ts` (`discoverOAuthMetadata`, `interactiveAuthLogin`, `getAccessToken`, `evaluateAuthHealth`).

## Checking

```bash
swiggy auth status --json     # per-server: authenticated, reason, expiresAt
swiggy auth whoami            # subject / issuer / issued / expires from the JWT claims
swiggy doctor                 # + OAuth metadata reachability and dynamic-registration support
```

## Headless / CI

The flow needs a browser. Options:

- **Pre-provision**: run `swiggy auth init` on a workstation, copy `auth.json`, point `SWIGGY_HOME` at that directory on the runner. Tokens expire after 5 days.
- **`--no-browser`** over SSH: open the printed URL on any device; the callback must still reach the machine running the CLI (use `--port` with SSH port forwarding).
- **Platforms serving many end users** should use Swiggy's delegated auth (<https://mcp.swiggy.com/builders/docs/start/enterprise/delegated-auth/>), not this CLI's flow.

## Privacy

Tokens are never printed in human or JSON mode. `--raw` echoes the MCP response, which does not contain the token. `swiggy auth logout` deletes the entry; the Swiggy session itself can be revoked from the Swiggy app.
