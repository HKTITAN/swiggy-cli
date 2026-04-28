# AGENTS.md

> Guidance for AI agents and automations using the `swiggy` CLI.
> Format follows the [agents.md](https://agents.md/) convention.

## Mission

`swiggy` is a deterministic wrapper over Swiggy's three MCP servers (Food, Instamart, Dineout). It is intended to be used the same way an agent would use any other tool: pass arguments, read structured JSON, react to a stable error envelope and exit code. **Do not parse human prose** — always run the CLI in machine mode.

## Run modes

Always pass these flags when scripting:

- `--json` — receive the canonical envelope on stdout, nothing else.
- `--no-interactive` — never prompt; fail fast.
- `--yes` — explicitly acknowledge destructive actions.
- `--quiet` — suppress non-essential logs.

Example:

```bash
swiggy food search-restaurants --query "biryani" --city Delhi --json --no-interactive
```

## Output contract

Success:

```json
{
  "ok": true,
  "server": "food",
  "tool": "search_restaurants",
  "data": <tool payload>,
  "meta": { "profile": "default" }
}
```

Failure:

```json
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "...", "details": {} } }
```

The shape is stable. New optional fields may be added under `meta`; do not assume `meta` is empty.

## Error codes → exit codes


| `error.code`                    | exit |
| ------------------------------- | ---- |
| (success)                       | 0    |
| `UNKNOWN`                       | 1    |
| `USAGE`                         | 2    |
| `AUTH_REQUIRED` / `AUTH_FAILED` | 3    |
| `NOT_FOUND`                     | 4    |
| `NETWORK`                       | 5    |
| `MCP_ERROR`                     | 6    |
| `CONFIRMATION_REQUIRED`         | 7    |
| `CONFIG_ERROR`                  | 8    |


Branch on `error.code`, not on the message string.

## Preferred command surface

For agents, prefer **Layer B (generic)** — it's stable across upstream tool renames:

```bash
swiggy servers --json
swiggy tools food --json
swiggy schema food search_restaurants --json
swiggy call food search_restaurants --input '{"query":"pizza"}' --json
```

Use **Layer A (ergonomic)** only when you are confident in the alias mapping (see `src/lib/aliases.ts`).

## Discovery flow

1. `swiggy servers --json` → list the three servers and current endpoints.
2. `swiggy tools <server> --json` → live `tools/list`.
3. `swiggy schema <server> <tool> --json` → live JSON Schema for arguments.
4. Build arguments validated against that schema, then `swiggy call <server> <tool> --input '<json>'`.

Never hard-code parameter names; always read them from the schema.

## Auth

Auth is interactive (browser-based OAuth + PKCE). An agent **cannot** run `swiggy auth init` headlessly. Detection pattern:

```bash
swiggy auth status --json | jq -r '.data[] | select(.authenticated|not) | .server'
```

If any server is unauthenticated, ask the human operator to run `swiggy auth init --server <name>` and resume.

For headless environments, the operator may pre-provision tokens by setting:

- `SWIGGY_OAUTH_CLIENT_ID`, `SWIGGY_OAUTH_CLIENT_SECRET`
- `SWIGGY_HOME` pointing at a directory with a pre-populated `auth.json`

## Safety rails

- These tools place real orders. `place_food_order`, `checkout`, `book_table`, `flush_food_cart`, `clear_cart`, and `delete_address` are gated. Without `--yes` in non-interactive mode they exit `7` (`CONFIRMATION_REQUIRED`).
- COD orders are not reversible via the MCP API. Always confirm cart state with `swiggy food cart --json` (or `instamart cart`) before checkout.
- The upstream manifest warns against using the Swiggy mobile app concurrently — it can invalidate the agent's session.

## Idempotency & retries

- Read tools (`search_*`, `get_*`, `track_*`) are safe to retry.
- Mutation tools (`update_*_cart`, `apply_food_coupon`) are **not** idempotent unless the upstream tool documents it. Treat retries as additive.
- `place_food_order`, `book_table`, `checkout` should never be retried automatically on `MCP_ERROR` — escalate to the human.

## Networking

- Endpoints: `https://mcp.swiggy.com/{food,im,dineout}` (overridable via `SWIGGY_<SERVER>_URL`).
- Transport: Streamable HTTP MCP (JSON or SSE).
- Auth header: `Authorization: Bearer <token>` (managed by the CLI).

## Extending

To add a new ergonomic verb when Swiggy ships a new tool, edit `src/lib/aliases.ts` and add a subcommand under `src/commands/<server>.ts`. The generic `call` path requires no code change.

## Where the CLI keeps state

- `~/.swiggy/config.json` — profiles, defaults, endpoint overrides.
- `~/.swiggy/auth.json` — OAuth tokens, mode `0600`.
- Override base path with `SWIGGY_HOME`.

Both files are JSON; agents may inspect them but should not write directly. Use `swiggy config show --json` and `swiggy auth status --json`.

## Telemetry

None. The CLI makes no outbound calls beyond the three configured Swiggy MCP endpoints and the OAuth metadata / token endpoints they advertise.