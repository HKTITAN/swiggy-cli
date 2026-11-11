# Troubleshooting

## `swiggy doctor` is the first stop

```bash
swiggy doctor --json          # add --offline to skip network checks
```

Each check is `{ check, ok, detail, soft? }`. Hard failures exit 1; `soft` rows (not signed in, catalog drift, terminal info) are informational. `doctor` also reports whether Swiggy's live `tools/list` matches the bundled catalog — if it says "new upstream: …", the tool is still usable via `swiggy call`; open an issue so an ergonomic verb can be added.

## `AUTH_REQUIRED` / `AUTH_FAILED` / exit 3

The CLI refreshes the token on its own: when it has under 24 hours left, and once on an HTTP 401. Exit 3 means that was not enough.

- `AUTH_REQUIRED`: never signed in, the session was revoked (HTTP 419 or JSON-RPC `-32001`), or the stored token expired and `auth.json` holds no refresh token for it (an older or hand-edited file).
- `AUTH_FAILED` "have expired and could not be refreshed": Swiggy cannot refresh a token that has already expired. This happens when the CLI was not used in the last day before expiry (5 days after login, 30 days after each refresh).
- `AUTH_FAILED` "rejected by …": the token was refused even after a refresh (logged out of the Swiggy app, security event), or HTTP 403 (scope).
- Corrupted `auth.json`: delete it.

The fix is the same in every case:

```bash
swiggy auth init
swiggy auth status --json     # authenticated, expiresAt, hasRefresh per server
```

## "Missing address id" (exit 2) in `--json` mode

Food/Instamart tools need `addressId` and the CLI refuses to guess in machine mode. Either pass `--address-id <id>` (from `swiggy food addresses --json`) or set it once:

```bash
swiggy profile set default defaultAddressId <id>
```

## Dineout "needs a location" / "takes coordinates, not a saved address id" (exit 2)

Since November 2026 Swiggy's Dineout search requires `latitude` and `longitude` and no longer accepts a saved `addressId`. `swiggy dineout search --address-id …` exits 2. Give coordinates for the city or area instead:

```bash
swiggy dineout search italian --lat 12.9716 --lng 77.5946      # remembered for the following details / slots / book
swiggy profile set default defaultLat 12.9716                  # or set them once
swiggy profile set default defaultLng 77.5946
```

Order of precedence: `--lat/--lng` flags, then profile `defaultLat`/`defaultLng`, then the last coordinates a Dineout response carried (`~/.swiggy/cache/dineout-coords.json`).

## A command is marked `[legacy: …]` or fails with "not in Swiggy's published reference"

`instamart list-coupons`, `instamart apply-coupon`, `instamart order <id>`, `dineout cancel` and `dineout locations` call tools Swiggy removed from its published reference in November 2026. They work only if your account still has the tool. `swiggy doctor` (signed in) lists the ones that are "still enabled for you". For saved locations use `swiggy scenes locations`; to cancel a Dineout booking use the Swiggy app or call 080-67466729.

## Scenes: "needs a location", "No ticket cart", "These tickets are paid"

- `scenes discover` needs `--address-id <id|#>` (from `swiggy scenes locations`) or `--lat/--lng`. After one successful discovery the coordinates Swiggy resolved are reused.
- `scenes book` uses the cart from the last `scenes cart`, kept for 30 minutes. After that, create it again.
- A paid cart needs `--pay upi --wait`. `--pay cash` is refused: Scenes has no Cash option. A free cart needs no `--pay` at all.
- `checkoutMode: UNAVAILABLE` means this show and ticket cannot be booked right now; pick another from `swiggy scenes shows <event>`.

## Payment stuck on pending

- `--wait` timed out (exit 10, `outcome: timeout`) → `confirm_order` was called once; check `swiggy <server> orders --active` — a late success reconciles server-side. Do not place again until you know.
- Food `payment-status --wait` needs `--address-id --lat --lng` echoed from the checkout response; without them Swiggy cannot reconcile the order. The pending checkout envelope's `meta.payment.next` has the exact command.
- `outcome: cart_changed` → the order was not placed; review the cart and place again.

## Network error on `checkout` or `book` (exit 5, `details.mayHavePlacedOrder: true`)

The request may have reached Swiggy before the connection dropped, and Swiggy does not de-duplicate orders. Do not run the command again yet. Check `swiggy food orders` or `swiggy instamart orders` (a multi-store Instamart checkout places one order per store and can partly succeed). For Dineout and Scenes, check your bookings in the Swiggy app: their status commands need the order id from the response that was lost. Place the order again only if it is not there.

## `RATE_LIMITED` / exit 9

Swiggy's gateway returned HTTP 429. Swiggy does not publish its limits and sends no quota headers, so the only number available is `error.details.retryAfterSeconds` (from `Retry-After`): wait that long, then retry once. Use `swiggy` (the app) or `swiggy shell` for bursts of commands, and do not run several `swiggy` processes in parallel against one service.

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

Tools Swiggy removed from its reference in November 2026 (`cancel_booking`, Dineout `get_saved_locations`, Instamart `list_coupons` / `apply_coupon` / `get_order_details`) may be absent from your account's `tools/list`.

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

Sessions can be revoked before the token expires (logging out in the Swiggy app, a security event). The CLI then gets a 401 or 419; if its one automatic refresh does not help, re-run `swiggy auth init`.
