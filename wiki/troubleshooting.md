# Troubleshooting

## `swiggy doctor` is the first stop

```bash
swiggy doctor --json
```

Each check has `{ check, ok, detail }`. Failures print non-zero exit. Common ones below.

## `AUTH_REQUIRED` on every call

You haven't run the OAuth flow, or the stored token expired and refresh failed. Re-auth:

```bash
swiggy auth init --server food
swiggy auth status --json
```

If `auth.json` looks corrupted, just delete it: `rm ~/.swiggy/auth.json`.

## OAuth metadata discovery fails

The CLI hits `<server>/.well-known/oauth-authorization-server`. From a normal machine:

```bash
curl -i https://mcp.swiggy.com/food/.well-known/oauth-authorization-server
```

If this 404s or your network blocks it, set `SWIGGY_OAUTH_*` env vars to point at a pre-registered client and ask Swiggy support for the issuer URLs.

## Tool not found

The Layer A alias may be stale. Confirm against the live list:

```bash
swiggy tools food --json | jq -r '.data[].name'
```

If a tool was renamed, file a PR to update `src/lib/aliases.ts`. In the meantime:

```bash
swiggy call food <new-name> --input '{...}'
```

## CI hangs on a confirmation prompt

You hit a destructive tool without `--yes`. Either:

```bash
swiggy food checkout --no-interactive --yes
```

…or split your script: have a human approve checkout out-of-band.

## `npx swiggy` doesn't find the binary

The npm package is `swiggy-cli`, but the binary it installs is `swiggy`. With `npx` you have to specify both:

```bash
npx -p swiggy-cli swiggy --help
# or pin a version:
npx --package swiggy-cli@latest swiggy --help
```

After `npm i -g swiggy-cli` (no `-p` needed), you can just type `swiggy` directly.

## Streaming responses look truncated

The CLI consumes the first JSON-RPC response frame from an SSE stream and returns. For long-running tools that stream multiple frames, use `--raw` and parse the SSE yourself, or call the server directly during development.

## Mobile app conflicts

Per the upstream manifest, do not open the Swiggy mobile app while running these commands — the session can invalidate. If your tokens stop working unexpectedly, log out of the mobile app and re-auth: `swiggy auth init`.