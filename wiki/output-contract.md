# Output contract

The CLI guarantees a stable JSON shape under `--json` (and `--raw`).

## Success envelope

```json
{
  "ok": true,
  "server": "food",
  "tool": "search_restaurants",
  "data": { "restaurants": [ … ], "nextOffset": 10 },
  "meta": {
    "profile": "default",
    "message": "Found 10 restaurants…",
    "rateLimit": { "limit": 70, "remaining": 61, "reset": 1720000060 },
    "deprecation": { "tool": "old_name", "replaced_by": "new_name", "remove_after": "2026-10-01" },
    "payment": { "pending": true, "bridgeUrl": "https://…", "next": "swiggy food payment-status … --wait" }
  }
}
```

- `server` / `tool` are present for tool calls; management commands set `tool` to a dotted name (`auth.status`, `config.show`, `doctor`, `docs`, `mcp-config`).
- `data` is the tool's **own payload**: Swiggy's `{ success, data, message }` wrapper is unwrapped (0.2.0). Top-level fields Swiggy returns outside `data` (Dineout `latitude`/`longitude`) are merged into `data`. Non-envelope payloads (plain text, arrays) pass through unchanged.
- `meta` keys are all optional and may grow. Treat unknown keys as ignorable.
  - `message` — Swiggy's human-readable message (often Markdown, sometimes branded, e.g. "Swiggy order placed successfully").
  - `rateLimit` — parsed `X-RateLimit-*` headers from the last MCP response.
  - `deprecation` — `_meta.swiggy.deprecation` once Swiggy emits it (planned v1.1).
  - `payment` — only on `checkout`/`book`/`payment-status`: `{ pending, bridgeUrl?, next? }` or the full outcome `{ outcome, status, attempts, elapsedMs, confirmResult? }`.

`--raw` returns the untouched MCP `tools/call` result as `data` (content blocks, `structuredContent`, `_meta`).

## Error envelope

```json
{ "ok": false, "error": { "code": "MCP_ERROR", "message": "Invalid addressId: required", "hint": "Run: swiggy food addresses, then retry with --address-id <id>", "details": { … } } }
```

`hint` is human guidance (safe to show the user); `details` is free-form debugging data — do not pattern-match on it.

## Stable error codes

| Code | When it fires |
| --- | --- |
| `USAGE` | invalid flags / unknown server / bad JSON in `--input` / missing address in machine mode |
| `AUTH_REQUIRED` | no usable token, HTTP 401 without a token, HTTP 419, JSON-RPC `-32001` |
| `AUTH_FAILED` | OAuth discovery/registration/exchange failed, or the stored token was rejected (401 with a token) |
| `NOT_FOUND` | tool not exposed by the server; docs page missing |
| `NETWORK` | fetch threw / non-OK response without a JSON-RPC body |
| `MCP_ERROR` | JSON-RPC error, `isError: true`, or Swiggy `success: false` |
| `CONFIRMATION_REQUIRED` | destructive tool without `--yes` in machine mode, or the user declined the prompt |
| `CONFIG_ERROR` | unreadable config/auth file, missing profile |
| `RATE_LIMITED` | HTTP 429 (`details.retryAfterSeconds`) |
| `PAYMENT_FAILED` | `--wait` ended in failed / cancelled / cart_changed / refund_initiated / timeout |
| `UNKNOWN` | catch-all |

## Exit codes

See `src/lib/errors.ts` (`EXIT_CODE`):

| code | exit |
| --- | ---: |
| success | 0 |
| `UNKNOWN` | 1 |
| `USAGE` | 2 |
| `AUTH_REQUIRED` / `AUTH_FAILED` | 3 |
| `NOT_FOUND` | 4 |
| `NETWORK` | 5 |
| `MCP_ERROR` | 6 |
| `CONFIRMATION_REQUIRED` | 7 |
| `CONFIG_ERROR` | 8 |
| `RATE_LIMITED` | 9 |
| `PAYMENT_FAILED` | 10 |

`swiggy doctor` exits 1 when a hard check fails (soft/informational checks never fail it).

## stdout vs stderr

- **stdout**: the envelope (success or, with `--json`/`--raw`, error). Exactly one JSON object per process. In human mode: tables and text.
- **stderr**: status line, notes, payment links, OAuth instructions, human-mode errors. `--quiet` suppresses notes and the status line.

A line-based agent reads the last line of stdout and parses it as JSON.

## Plain mode

`--plain` emits TSV. The CLI picks the most useful array-of-objects in the payload (same heuristic as the human table: `restaurants`, `items`, `products`, `addresses`, `locations`, `orders`, `slots`, …), prints a header row of up to 8 prioritised columns, then one row per record. Objects become `key<TAB>value` lines; tabs/newlines inside values are replaced by spaces. Errors go to stderr as `error<TAB>CODE<TAB>message`.

## Stability

Envelope keys, error codes and exit codes only change with a major version. 0.2.0 changed `data` to the unwrapped payload; the previous shape is available via `--raw`.
