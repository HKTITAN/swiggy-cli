# Commands

Every command accepts the global flags: `--json`, `--plain`, `--raw`, `--quiet`, `--no-interactive`, `-y/--yes`, `--profile <name>`. Most Food/Instamart verbs take `--address-id <id>`; omit it when the profile has `defaultAddressId` (interactive runs offer a picker, and the picked address is carried to the following commands until a default is set). Most verbs accept `--input <json>` to merge any documented parameter over the flags.

⚠ = destructive (`DESTRUCTIVE_TOOLS`): confirmation prompt, or `--yes` in machine mode (exit 7 otherwise).

**Positional references.** Every listing numbers its rows and remembers them (`~/.swiggy/cache/recent.json`). Wherever a command takes a restaurant, item, product, address/location, slot or order, you can pass the row number (`2` or `#2`) from the last listing instead of the id: `food menu 1`, `food add 3 --qty 2`, `instamart add 1`, `dineout slots 1`, `dineout book 2 --guests 2`, `food order 1`. The CLI also remembers follow-up context (the item's restaurant, the slot's `slotId/itemId/reservationTime`, Dineout coordinates), so those flags become optional.

## Generic (Layer B — agent-preferred)

| Command | What it does |
| --- | --- |
| `swiggy servers` | the three servers, endpoints, bundled tool counts |
| `swiggy tools <server> [--offline]` | live `tools/list` (needs auth) with catalog-drift info; `--offline` prints the bundled catalog |
| `swiggy schema <server> <tool>` | live JSON Schema for a tool's arguments |
| `swiggy call <server> <tool> -i <json> \| --input-file <path>` | call any tool with JSON args |
| `swiggy docs [path] [--full]` | Swiggy docs as Markdown: index (`llms.txt`), a page (`reference/food/search_menu`), or everything |
| `swiggy mcp-config [--client …] [--servers …]` | MCP client config for claude / claude-code / cursor / vscode / windsurf / codex / plugin / generic |
| `swiggy doctor [--offline]` | runtime, config, auth, OAuth metadata, live tools, catalog drift, docs reachability |
| `swiggy app` (alias `ui`) | full-screen session: ↑/↓ over the last listing's rows, Enter drills in, inline confirmations, live output; default when `swiggy` runs with no args in a terminal |
| `swiggy shell` (alias `repl`) | the same session as a line-oriented REPL (tab completion, history, one warm MCP session) |

`<server>` accepts `food`, `instamart` (or `im`), `dineout`.

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
| `list-coupons` (alias `coupons`) | `list_coupons` | |
| `apply-coupon <code>` | `apply_coupon` | |
| `checkout` ⚠ (alias `place-order`) | `checkout` | `--pay …`, `--wait`, `--interval-ms`, `--max-wait-ms` |
| `orders` | `get_orders` | `--count`, `--type`, `--active` |
| `order <orderId>` | `get_order_details` | |
| `track <orderId> --lat <lat> --lng <lng>` | `track_order` | |
| `delivery-status <orderId>` | `get_delivery_status` | |
| `payment-options` / `payment-status --paas-id <id> [--wait]` / `confirm-order --order-id <id> --paas-id <id>` / `report-error` | payment + support | |

## Dineout (`swiggy dineout …`)

| Command | Maps to | Flags |
| --- | --- | --- |
| `search [term]` | `search_restaurants_dineout` | `--address-id <id\|#>` or `--lat --lng`, `--entity-type`, `--limit`, `--offset` |
| `details <restaurant\|#>` (alias `info`) | `get_restaurant_details` | `--lat --lng` (default: last search / profile) |
| `locations` (alias `addresses`) | `get_saved_locations` | |
| `slots [restaurant\|#] --date <YYYY-MM-DD>` (alias `availability`) | `get_available_slots` | `--restaurant-id`, `--lat --lng`; date defaults to today |
| `cart --slot <#> --guests <n>` | `create_cart` | `--restaurant-id`, `--type DEAL_TICKET_PURCHASE\|DINEOUT`, `--slot-id --item-id --reservation-time`, `--bill-amount --source` |
| `book [slot\|#] --guests <n>` ⚠ (alias `reserve`) | `book_table` (+ `create_cart` for paid deals) | `--slot-id --item-id --reservation-time --restaurant-id`, `--cart-key`, `--pay upi\|upi:<app>`, `--wait` |
| `status <booking\|#>` | `get_booking_status` | |
| `cancel <booking\|#>` ⚠ | `cancel_booking` | `--reason` |
| `payment-options` / `payment-status` / `confirm-order --order-id --paas-id` / `report-error` | payment + support | |

## Management

| Command | What it does |
| --- | --- |
| `swiggy auth init [--server <s>] [--no-browser] [--port <n>] [--redirect-host 127.0.0.1\|localhost] [--client-id] [--timeout <s>]` (alias `login`) | browser OAuth; one token for all servers |
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
| `SWIGGY_FOOD_URL` / `SWIGGY_INSTAMART_URL` / `SWIGGY_DINEOUT_URL` | endpoint overrides |
| `SWIGGY_OAUTH_CLIENT_ID` / `SWIGGY_OAUTH_CLIENT_SECRET` | pre-registered OAuth client (optional; dynamic registration is the default) |
| `SWIGGY_NO_BROWSER` | never auto-open the browser |
| `SWIGGY_NO_BANNER` / `SWIGGY_NO_SHELL` | disable the banner / the no-args app |
| `SWIGGY_SHELL_ACTIVE` | set by `app`/`shell` for the commands they run (no banner); not meant to be set by hand |
| `NO_COLOR` / `FORCE_COLOR` | colour control |
| `CI=true` | forces machine mode |
