# Troubleshooting

## `swiggy doctor` is the first stop

```bash
swiggy doctor --json          # add --offline to skip network checks
```

Each check is `{ check, ok, detail, soft? }`. Hard failures exit 1; `soft` rows (not signed in, catalog drift, terminal info) are informational. `doctor` also reports whether Swiggy's live `tools/list` matches the bundled catalog — if it says "new upstream: …", the tool is still usable via `swiggy call`; open an issue so an ergonomic verb can be added.

## `AUTH_REQUIRED` / exit 3

- Never signed in, or the 5-day access token expired (Swiggy does not issue refresh tokens yet):

```bash
swiggy auth init
swiggy auth status --json
```

- `AUTH_FAILED` "rejected by …" with a token → the session was revoked (logging out of the Swiggy app, security event). Re-run `auth init`.
- HTTP 419 → session revoked; same fix.
- Corrupted `auth.json` → delete it and re-run `auth init`.

## "Missing address id" (exit 2) in `--json` mode

Food/Instamart tools need `addressId` and the CLI refuses to guess in machine mode. Either pass `--address-id <id>` (from `swiggy food addresses --json`) or set it once:

```bash
swiggy profile set default defaultAddressId <id>
```

## Dineout "Missing coordinates"

Dineout `details`/`slots`/`cart`/`book` need `latitude`/`longitude`. Saved locations do not carry them; a search does:

```bash
swiggy dineout search -q italian --address-id <locationId>     # the response's coordinates are remembered
swiggy dineout slots --restaurant-id <id> --date 2026-09-06     # reuses them
```

Or pass `--lat/--lng`, or set `defaultLat`/`defaultLng` on the profile.

## Payment stuck on pending

- `--wait` timed out (exit 10, `outcome: timeout`) → `confirm_order` was called once; check `swiggy <server> orders --active` — a late success reconciles server-side. Do not place again until you know.
- Food `payment-status --wait` needs `--address-id --lat --lng` echoed from the checkout response; without them Swiggy cannot reconcile the order. The pending checkout envelope's `meta.payment.next` has the exact command.
- `outcome: cart_changed` → the order was not placed; review the cart and place again.

## `RATE_LIMITED` / exit 9

You exceeded 70 req/min (30/min for writes) on one server, or re-initialized too often. Wait `error.details.retryAfterSeconds`. Use `swiggy` (the app) or `swiggy shell` for bursts of commands, and do not run several `swiggy` processes in parallel against one server.

## The session ended after one command (0.2.0)

Fixed in 0.2.1. The address picker came from a library that opened its own readline on stdin and closed it afterwards, which ended the session. Upgrade: `npm install -g swiggy-cli@latest`.

## The app looks wrong or does not start

- It needs a real terminal (raw mode + alternate screen). Inside CI, pipes, or some IDE consoles it refuses to start (exit 2): use `swiggy shell` or plain commands.
- Garbled frames usually mean the terminal ignores synchronized output; resize the window once, or use `swiggy shell`.
- Keys typed while a command is running go to the command line; the status line shows the spinner. Ctrl+C always quits.

## Tool not found (exit 4)

```bash
swiggy tools food --json | jq -r '.data[].name'
swiggy call food <name> --input '{…}'
```

`cancel_booking` is rolling out gradually and may be absent from your account's `tools/list`.

## OAuth metadata discovery fails

```bash
curl -s https://mcp.swiggy.com/.well-known/oauth-authorization-server
```

If this is not JSON, your network is intercepting TLS or blocking the host. The CLI tries RFC 9728 and RFC 8414 locations; `--client-id` is only needed if dynamic registration is unavailable.

## CI hangs on a confirmation prompt

You hit a destructive tool without `--yes` while stdin was a TTY. Pass `--no-interactive --yes` (or `--no-interactive` alone to fail fast with exit 7).

## `npx swiggy` doesn't find the binary

The package is `swiggy-cli`; the binary is `swiggy`:

```bash
npx -p swiggy-cli swiggy --help
```

## Colours / links look wrong

`NO_COLOR=1` disables colour, `FORCE_COLOR=1|2|3` forces a level. The CLI upgrades to truecolor under tmux/SSH when it recognises the terminal (`TERM_PROGRAM`, iTerm/Kitty/WezTerm/Ghostty/Windows Terminal env vars). OSC 8 links render as plain URLs on terminals without support.

## Mobile app conflicts

Using the Swiggy app while the CLI runs can invalidate the session (401/419). Re-run `swiggy auth init`.
