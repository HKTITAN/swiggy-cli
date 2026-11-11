# Commands

Every command accepts the global flags: `--json`, `--plain`, `--raw`, `--quiet`, `--no-interactive`, `-y/--yes`, `--profile <name>`. Most Food/Instamart verbs take `--address-id <id>`; omit it when the profile has `defaultAddressId` (interactive runs offer a picker, and the picked address is carried to the following commands until a default is set). Dineout takes coordinates (`--lat/--lng`, or profile `defaultLat`/`defaultLng`, or the last ones seen). Scenes takes either. Most verbs accept `--input <json>` to merge any documented parameter over the flags.

⚠ = destructive (`DESTRUCTIVE_TOOLS`): confirmation prompt, or `--yes` in machine mode (exit 7 otherwise).

**Positional references.** Every listing numbers its rows and remembers them (`~/.swiggy/cache/recent.json`). Wherever a command takes a restaurant, item, product, address/location, slot, event, genre chip, show or order, you can pass the row number (`2` or `#2`) from the last listing instead of the id: `food menu 1`, `food add 3 --qty 2`, `instamart add 1`, `dineout slots 1`, `dineout book 2 --guests 2`, `scenes shows 1`, `scenes cart --show 2 --guests 2`, `food order 1`. The CLI also remembers follow-up context (the item's restaurant, the slot's `slotId/itemId/reservationTime`, the event's venue, the coordinates Swiggy resolved), so those flags become optional.

**Legacy commands.** Swiggy's published reference dropped five tools in November 2026 (Instamart `list_coupons`, `apply_coupon`, `get_order_details`; Dineout `cancel_booking`, `get_saved_locations`). Their commands still exist so old scripts keep working, and `--help` marks each `[legacy: not in Swiggy's published reference since Nov 2026; works only if your account still has it]`. They are marked † below. A signed-in `swiggy doctor` says which of them your account still has.

## Generic (Layer B — agent-preferred)

| Command | What it does |
| --- | --- |
| `swiggy servers` | the four services, endpoints, bundled tool counts (Food 20, Instamart 16, Dineout 11, Scenes 15) |
| `swiggy tools <server> [--offline]` | live `tools/list` (needs auth) with catalog-drift info; `--offline` prints the bundled catalog |
| `swiggy schema <server> <tool>` | live JSON Schema for a tool's arguments |
| `swiggy call <server> <tool> -i <json> \| --input-file <path>` | call any tool with JSON args |
| `swiggy docs [path] [--full]` | Swiggy docs as Markdown: index (`llms.txt`), a page (`reference/food/search_menu`), or everything |
| `swiggy mcp-config [--client …] [--servers …]` | client config for the four endpoints, for claude / claude-code / cursor / vscode / windsurf / codex / plugin / generic |
| `swiggy doctor [--offline]` | runtime, config, auth, OAuth metadata, live tools, catalog drift, docs reachability |
| `swiggy app` (alias `ui`) | full-screen session: ↑/↓ over the last listing's rows, Enter drills in, inline confirmations, live output; default when `swiggy` runs with no args in a terminal |
| `swiggy shell` (alias `repl`) | the same session as a line-oriented REPL (tab completion, history, one warm connection per service) |

`<server>` accepts `food`, `instamart` (or `im`), `dineout`, `scenes`.

## Food (`swiggy food …`)

| Command | Maps to | Flags |
| --- | --- | --- |
| `search [query]` (alias `search-restaurants`, `-q`) | `search_restaurants` | `--collection EATRIGHT\|BOLT\|STORE_99`, `--offset` |
| `search-menu [dish]` (alias `dishes`) | `search_menu` | `--restaurant-id <id\|#>`, `--veg`, `--offset` |
| `menu [restaurant\|#]` | `get_restaurant_menu` | `--restaurant-id` |
| `addresses` | `get_addresses` | `--page`, `--page-size` |
| `create-address …` | `create_address` | `--full-address --line1 [--line2] [--locality] --city --postal-code --category --name --phone [--tag] [--receiver-name --receiver-phone] [--lat --lng]` |
| `delete-address <id>` ⚠ | `delete_address` | |
| `cart` | `get_food_cart` | `--restaurant-name` |
| `add [item\|#] --qty <n>` (aliases `add-to-cart`, `update-cart`) | `update_food_cart` | `--item-id <menu_item_id>`, `--restaurant-id <id\|#>` (defaults to the item's / last menu's restaurant), `--items <json>` for variants/addons, `--restaurant-name`, `--cutlery/--no-cutlery` |
| `clear-cart` ⚠ | `flush_food_cart` | |
| `list-coupons --restaurant-id <id>` (alias `coupons`) | `fetch_food_coupons` | `--code` |
| `apply-coupon <code>` | `apply_food_coupon` | `--cart-id` |
| `checkout` ⚠ (alias `place-order`) | `place_food_order` | `--pay cash\|upi\|upi:<app>\|swiggypay`, `--wait`, `--interval-ms`, `--max-wait-ms`, `--note` |
| `orders [--active]` | `get_food_orders` | |
| `order <orderId>` | `get_food_order_details` | |
| `track [orderId]` | `track_food_order` | |
| `delivery-status <orderId>` | `get_food_delivery_status` | |
| `payment-options` | `get_payment_options` | `--address-id` |
| `payment-status --paas-id <id>` | `check_payment_status` | `--order-id --address-id --cart-id --lat --lng`, `--wait`, `--interval-ms`, `--max-wait-ms` |
| `confirm-order --order-id <id> --address-id <id> --lat <lat> --lng <lng>` | `confirm_order` | `--cart-id` |
| `report-error --tool <t> --message <m>` | `report_error` | `--flow`, `--context <json>`, `--notes` |

## Instamart (`swiggy instamart …` / `swiggy im …`)

| Command | Maps to | Flags |
| --- | --- | --- |
| `search [query]` | `search_products` | `--offset` |
| `go-to-items` (aliases `usual`, `reorder`) | `your_go_to_items` | `--offset` |
| `addresses` / `create-address` / `delete-address <id>` ⚠ | address tools | as Food |
| `cart` | `get_cart` | |
| `add [product\|#] --qty <n>` (alias `add-to-cart`) — **merges** with the current cart | `get_cart` + `update_cart` | `--spin-id`, `--sku-id`, `--replace` |
| `set-cart` — **replaces the cart** (raw semantics) | `update_cart` | `--spin-id --sku-id --qty` or `--items <json>` |
| `clear-cart` ⚠ | `clear_cart` | |
| `list-coupons` (alias `coupons`) † | `list_coupons` (legacy) | |
| `apply-coupon <code>` † | `apply_coupon` (legacy) | |
| `checkout` ⚠ (alias `place-order`) | `checkout` | `--pay …`, `--wait`, `--interval-ms`, `--max-wait-ms` |
| `orders` | `get_orders` | `--count`, `--type`, `--active` |
| `order <orderId>` † | `get_order_details` (legacy) | |
| `track <orderId> --lat <lat> --lng <lng>` | `track_order` | |
| `delivery-status <orderId>` | `get_delivery_status` | |
| `payment-options` / `payment-status --paas-id <id> [--wait]` / `confirm-order --order-id <id> --paas-id <id>` / `report-error` | payment + support | |

## Dineout (`swiggy dineout …`)

| Command | Maps to | Flags |
| --- | --- | --- |
| `search [term]` | `search_restaurants_dineout` | `--lat --lng` (required unless the profile has `defaultLat`/`defaultLng` or a previous Dineout call left coordinates), `--sort <sortKey>`, `--entity-type`, `--limit`, `--offset`. `--address-id` is rejected with exit 2: Swiggy no longer accepts a saved address here. `filters` go through `--input` |
| `details <restaurant\|#>` (alias `info`) | `get_restaurant_details` | `--lat --lng` (default: last search / profile) |
| `locations` (alias `addresses`) † | `get_saved_locations` (legacy on Dineout; the tool now lives on Scenes: `swiggy scenes locations`) | |
| `slots [restaurant\|#] --date <YYYY-MM-DD>` (alias `availability`) | `get_available_slots` | `--restaurant-id`, `--lat --lng`; date defaults to today |
| `cart --slot <#> --guests <n>` | `create_cart` | `--restaurant-id`, `--type DEAL_TICKET_PURCHASE\|DINEOUT`, `--slot-id --item-id --reservation-time`, `--bill-amount --source` |
| `book [slot\|#] --guests <n>` ⚠ (alias `reserve`) | `book_table` (+ `create_cart` for paid deals) | `--slot-id --item-id --reservation-time --restaurant-id`, `--cart-key`, `--pay upi\|upi:<app>`, `--wait` |
| `status <booking\|#>` | `get_booking_status` | |
| `cancel <booking\|#>` ⚠ † | `cancel_booking` (legacy; Swiggy now says to cancel in the Swiggy app or call 080-67466729) | `--reason` |
| `payment-options` / `payment-status` / `confirm-order --order-id --paas-id` / `report-error` | payment + support | |

Dineout also has `render_restaurants_dineout`, which exists to draw restaurant cards in a chat client's widget. It has no command; reach it with `swiggy call dineout render_restaurants_dineout --input '<json>'`.

## Scenes (`swiggy scenes …` / `swiggy events …`)

Events and ticket booking. The path is fixed by Swiggy: `discover` (or `search` / `collection`) → `shows <#>` → `cart --show <#> --guests <n>` → `book` → `status`.

| Command | Maps to | Flags |
| --- | --- | --- |
| `locations` | `get_saved_locations` | |
| `discover` (alias `browse`) | `discover_events` | `--address-id <id\|#>` or `--lat --lng` (one is required; falls back to the profile or the last Scenes coordinates) |
| `search <name>` | `search_events` | ONE artist or show title, at most 4 results; `--address-id` or `--lat --lng` |
| `collection <chip\|#>` (alias `genre`) | `get_events_collection` | chip # from the last `discover`, or its `collectionIdentifier`; `--address-id` or `--lat --lng` |
| `details <event\|#>` (alias `info`) | `get_event_details` | `--lat --lng`; the only source of the `venueId` a booking needs |
| `venue <event\|#>` | `get_event_venue_info` | `--venue-id`, `--lat --lng`; not part of booking |
| `shows [event\|#]` (alias `schedule`) | `list_event_shows` (+ `get_event_details` when the venue is not known yet) | `--venue-id`, `--all-venues` (browse only), `--from <iso>`, `--to <iso>` (window ≤ 5 days), `--lat --lng` |
| `cart --show <#> --guests <n>` | `create_event_cart` | or `--venue-id --show-id --ticket-id --show-time` with `--guests` (1–20), `--lat --lng`. Prints `checkoutMode`: `FREE`, `UPI` or `UNAVAILABLE` |
| `show-cart` | `get_event_cart` | `--cart-key` (defaults to the last cart); not needed in the normal flow |
| `book` ⚠ (alias `checkout`) | `place_event_order` | `--cart-key` (defaults to the last cart, kept 30 minutes), `--pay upi\|upi:<app>`, `--wait`, `--interval-ms`, `--max-wait-ms`. A free cart books with no `--pay`; a paid cart needs `--pay upi`; `--pay cash` is rejected (exit 2) |
| `status <orderId>` | `get_event_booking_status` | |
| `payment-options [--cart-key]` / `payment-status --paas-id <id> [--order-id] [--wait]` / `confirm-order --order-id <id> --paas-id <id>` / `report-error` | payment + support | |

What the CLI remembers for you: the coordinates Swiggy resolved for the last discovery call (`~/.swiggy/cache/scenes-coords.json`), the event and venue of the last `details`, and the last ticket cart with its selection (`~/.swiggy/cache/scenes-cart.json`, 30 minutes).

## Management

| Command | What it does |
| --- | --- |
| `swiggy auth init [--server <s>] [--no-browser] [--port <n>] [--redirect-host 127.0.0.1\|localhost] [--client-id] [--timeout <s>]` (alias `login`) | browser sign-in; one login for Food, Instamart, Dineout and Scenes. The token refreshes itself afterwards (see [auth.md](./auth.md)) |
| `swiggy auth status` / `auth whoami [--server]` / `auth logout [--server]` | token state |
| `swiggy whoami` | alias for `auth whoami` |
| `swiggy config init` / `config show` / `config path` | config file + paths |
| `swiggy profile list` / `use <name>` / `create <name> [--city --address-id --output]` / `delete <name>` | profiles |
| `swiggy profile set <name> <key> <value>` | keys: `defaultAddressId`, `defaultLat`, `defaultLng`, `defaultCity`, `defaultServer`, `output` |

## Environment variables

| Variable | Effect |
| --- | --- |
| `SWIGGY_HOME` | state directory (default `~/.swiggy`) |
| `SWIGGY_PROFILE` | active profile |
| `SWIGGY_FOOD_URL` / `SWIGGY_INSTAMART_URL` / `SWIGGY_DINEOUT_URL` / `SWIGGY_SCENES_URL` | endpoint overrides |
| `SWIGGY_OAUTH_CLIENT_ID` / `SWIGGY_OAUTH_CLIENT_SECRET` | pre-registered OAuth client (optional; dynamic registration is the default) |
| `SWIGGY_NO_BROWSER` | never auto-open the browser |
| `SWIGGY_NO_BANNER` / `SWIGGY_NO_SHELL` | disable the banner / the no-args app |
| `SWIGGY_SHELL_ACTIVE` | set by `app`/`shell` for the commands they run (no banner); not meant to be set by hand |
| `NO_COLOR` / `FORCE_COLOR` | colour control |
| `CI=true` | forces machine mode |
