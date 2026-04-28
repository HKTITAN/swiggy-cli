# Auth

Swiggy MCP servers use OAuth 2.0 over HTTPS. Per the manifest at [https://github.com/Swiggy/swiggy-mcp-server-manifest](https://github.com/Swiggy/swiggy-mcp-server-manifest), whitelisted redirect URIs cover Claude/ChatGPT/VS Code; CLI tools use a loopback redirect.

## Flow

1. **Discovery.** `GET <server>/.well-known/oauth-authorization-server` (RFC 8414). Yields `authorization_endpoint` and `token_endpoint`.
2. **Client.** Swiggy MCP **does not support** RFC 7591 dynamic client registration. You must provide a pre-registered `client_id` via `--client-id` or `SWIGGY_OAUTH_CLIENT_ID`. The official manifest at [https://github.com/Swiggy/swiggy-mcp-server-manifest](https://github.com/Swiggy/swiggy-mcp-server-manifest) lists which clients (and redirect URIs) are whitelisted.
3. **Redirect URI.** The CLI binds an ephemeral loopback port and uses `http://127.0.0.1:<port>/callback` (or `http://localhost:<port>/callback` with `--redirect-host localhost`). Both bare hosts are whitelisted server-side; per RFC 8252 §7.3 any port on the loopback host matches.
4. **Authorization.** PKCE S256. The CLI prints the URL to stderr, opens it in the user's browser if possible, and listens on the loopback port.
5. **Code exchange.** Standard `authorization_code` grant.
6. **Storage.** Tokens go to `~/.swiggy/auth.json` with mode `0600`:
  ```json
   {
     "servers": {
       "food": {
         "accessToken": "...",
         "refreshToken": "...",
         "expiresAt": 1761234567000,
         "tokenEndpoint": "...",
         "clientId": "..."
       }
     }
   }
  ```
7. **Refresh.** When the access token is within 30 s of expiry, the CLI uses the refresh token automatically. On failure, callers see `AUTH_REQUIRED`.

Implementation: `src/lib/auth.ts` (`interactiveAuthLoginV2`, `getAccessToken`, `refreshAccessToken`).

## Getting a `client_id`

Until Swiggy publishes a CLI-specific public client, you have two paths:

- **Ask Swiggy.** File an issue at [https://github.com/Swiggy/swiggy-mcp-server-manifest](https://github.com/Swiggy/swiggy-mcp-server-manifest) requesting a client_id with loopback redirect URIs whitelisted (already on the server side, just needs a public client to bind to it).
- **Use a builder/dev client.** If you already have a client registered through Swiggy's builder portal ([https://mcp.swiggy.com/builders/](https://mcp.swiggy.com/builders/)), pass its id with `--client-id`.

```bash
swiggy auth init --server food --client-id <your-client-id>
# or persistently:
export SWIGGY_OAUTH_CLIENT_ID=<your-client-id>
swiggy auth init
```

## Why per-server tokens?

Each server is its own OAuth issuer. The CLI keeps tokens isolated under `state.servers[<name>]` so revoking one doesn't blast the others.

## Headless / CI

Pure CI use is not currently supported because the flow needs a browser. Two workarounds:

- **Pre-provision** an `auth.json` from a workstation, then bake it into the runner via `SWIGGY_HOME=/path/to/dir`.
- **Confidential client** issued by Swiggy support: set `SWIGGY_OAUTH_CLIENT_ID` and `SWIGGY_OAUTH_CLIENT_SECRET`, then run `swiggy auth init` once on a host with a browser.

## Verifying

```bash
swiggy auth status --json | jq .
swiggy doctor --json
```

