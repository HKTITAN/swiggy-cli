# Output contract

The CLI guarantees a stable JSON shape under `--json` (or `--raw`).

## Success envelope

```json
{
  "ok": true,
  "server": "food",
  "tool": "search_restaurants",
  "data": <tool payload>,
  "meta": { "profile": "default" }
}
```

- `server` and `tool` may be omitted for management commands (e.g. `swiggy config show`).
- `data` is whatever the tool returned, post-extraction (text → parsed JSON when possible, structured content passthrough).
- `meta` may grow over time. Treat unknown keys as ignorable.

## Error envelope

```json
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "...", "details": {} } }
```

`error.details` is free-form and intended for debugging; do not pattern-match against it.

## Stable error codes


| Code                    | When it fires                                        |
| ----------------------- | ---------------------------------------------------- |
| `USAGE`                 | invalid flags / unknown server / bad JSON in --input |
| `AUTH_REQUIRED`         | no token, or server returned 401                     |
| `AUTH_FAILED`           | OAuth metadata, registration, or exchange failed     |
| `NOT_FOUND`             | tool not exposed by the server                       |
| `NETWORK`               | fetch threw / non-OK without JSON-RPC error          |
| `MCP_ERROR`             | server returned a JSON-RPC error or `isError: true`  |
| `CONFIRMATION_REQUIRED` | destructive op without `--yes` in non-interactive    |
| `CONFIG_ERROR`          | bad config file, missing profile                     |
| `UNKNOWN`               | catch-all                                            |


## Exit codes

See `src/lib/errors.ts` (`EXIT_CODE`):


| code                            | exit |
| ------------------------------- | ---- |
| success                         | 0    |
| `UNKNOWN`                       | 1    |
| `USAGE`                         | 2    |
| `AUTH_REQUIRED` / `AUTH_FAILED` | 3    |
| `NOT_FOUND`                     | 4    |
| `NETWORK`                       | 5    |
| `MCP_ERROR`                     | 6    |
| `CONFIRMATION_REQUIRED`         | 7    |
| `CONFIG_ERROR`                  | 8    |


## stdout vs stderr

- **stdout**: the success envelope (or the error envelope if `--json` is set). One JSON object per process. Always machine-parseable.
- **stderr**: human-readable error lines, spinner output, OAuth instructions. Suppressed by `--quiet`.

A line-based agent can simply read the last line of stdout and parse it as JSON.

## Plain mode

`--plain` emits TSV. For arrays of objects: a header row of column names, then one row per record. For scalars: `key\tvalue` lines. Tabs and newlines inside values are escaped to spaces.