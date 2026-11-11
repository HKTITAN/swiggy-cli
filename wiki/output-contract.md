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
    "payment": { "pending": true, "bridgeUrl": "https://…", "next": "swiggy food payment-status … --wait" }
  }
}
```

- `server` / `tool` are present for tool calls; management commands set `tool` to a dotted name (`auth.status`, `config.show`, `doctor`, `docs`, `mcp-config`).
- `data` is the tool's **own payload**: `structuredContent` when Swiggy sends it, otherwise the `data` of the `{ success, data, message }` envelope in the first `content` block (Dineout and Scenes). Fields Swiggy returns next to `data` are merged into `data`: Dineout and Scenes `latitude`/`longitude`, and the Scenes `booking` object that `get_event_booking_status` returns instead of `data` (read `data.booking`). Non-envelope payloads (plain text, arrays) pass through unchanged.
- `meta` keys are all optional and may grow. Treat unknown keys as ignorable.
  - `message` — Swiggy's human-readable message (often Markdown, sometimes branded, e.g. "Swiggy order placed successfully").
  - `deprecation`: `_meta.swiggy.deprecation`, passed through if it ever appears. **Not emitted by Swiggy today**; deprecations are announced by email and in Swiggy's changelog.
  - `payment`: only on `checkout`/`book`/`payment-status`: `{ pending, bridgeUrl?, next? }` or the full outcome `{ outcome, status, attempts, elapsedMs, confirmResult? }`.

`meta.rateLimit` was removed in 0.3.0. It was built from `X-RateLimit-*` headers, which Swiggy does not send, so it never held real numbers.

`--raw` returns the untouched MCP `tools/call` result as `data` (content blocks, `structuredContent`, `_meta`).

## Error envelope

```json
{ "ok": false, "error": { "code": "MCP_ERROR", "message": "Invalid addressId: required", "hint": "Run: swiggy food addresses, then retry with --address-id <id>", "details": { … } } }
```

`hint` is human guidance (safe to show the user). `details` is free-form debugging data; do not pattern-match on it, with two documented exceptions:

- `details.retryAfterSeconds` on `RATE_LIMITED`.
- `details.mayHavePlacedOrder: true` on a `NETWORK` error from an order-placing command (`food checkout`, `instamart checkout`, `dineout book`, `scenes book`). The request may have reached Swiggy. Check the order list (or the Swiggy app for Dineout and Scenes) before running the command again; Swiggy does not de-duplicate orders.

## Stable error codes

| Code | When it fires |
| --- | --- |
| `USAGE` | invalid flags / unknown server / bad JSON in `--input` / missing address in machine mode |
| `AUTH_REQUIRED` | no usable token, HTTP 401 without a token, HTTP 419, JSON-RPC `-32001` |
| `AUTH_FAILED` | OAuth discovery/registration/exchange failed; the stored token expired and could not be refreshed; or a 401 persisted after the one automatic refresh; or HTTP 403 |
| `NOT_FOUND` | tool not exposed by the server; docs page missing |
| `NETWORK` | fetch threw / non-OK response without a JSON-RPC body. On an order-placing command, `details.mayHavePlacedOrder` is `true` |
| `MCP_ERROR` | JSON-RPC error, `isError: true`, or Swiggy `success: false` |
| `CONFIRMATION_REQUIRED` | destructive tool without `--yes` in machine mode, or the user declined the prompt |
| `CONFIG_ERROR` | unreadable config/auth file, missing profile |
| `RATE_LIMITED` | HTTP 429 (`details.retryAfterSeconds` from `Retry-After`). Swiggy publishes no limits and sends no quota headers |
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

`--plain` emits TSV. The CLI picks the most useful array-of-objects in the payload (same heuristic as the human table: `restaurants`, `items`, `products`, `addresses`, `locations`, `orders`, `slots`, `events`, …), prints a header row of up to 8 prioritised columns, then one row per record. Objects become `key<TAB>value` lines; tabs/newlines inside values are replaced by spaces. Errors go to stderr as `error<TAB>CODE<TAB>message`.

## Stability

Envelope keys, error codes and exit codes only change with a major version; `meta` keys are optional and can come and go. 0.2.0 changed `data` to the unwrapped payload (the previous shape is available via `--raw`). 0.3.0 removed `meta.rateLimit` and added `details.mayHavePlacedOrder`.
