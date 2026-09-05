# swiggy-cli command reference (v0.2.0)

Global flags on every command: `--json` `--plain` `--raw` `--quiet` `--no-interactive` `-y/--yes` `--profile <name>`.
`⚠` = destructive: needs `--yes` in machine mode (exit 7 otherwise).
Most Food/Instamart commands take `--address-id <id>`; omit it when the profile has `defaultAddressId`.
Positional `<x|#>` arguments accept an id **or** a row number from the last listing in this shell session (`~/.swiggy/cache/recent.json`). Agents: pass ids.

## Generic

| Command | Maps to |
| --- | --- |
| `swiggy servers` | list servers + endpoints |
| `swiggy tools <server> [--offline]` | `tools/list` |
| `swiggy schema <server> <tool>` | JSON Schema for a tool |
| `swiggy call <server> <tool> --input <json> \| --input-file <path>` | any tool |
| `swiggy docs [path] [--full]` | Swiggy docs as Markdown (`llms.txt` index by default) |
| `swiggy mcp-config --client claude\|claude-code\|cursor\|vscode\|windsurf\|codex\|plugin\|generic` | MCP client config |
| `swiggy doctor [--offline]` | self-check incl. catalog drift |
| `swiggy shell` | interactive session (warm MCP session, tab completion, history) |

## Food (`swiggy food …`)

| Command | Tool | Key flags |
| --- | --- | --- |
| `search [query]` (alias `search-restaurants`) | `search_restaurants` | `--collection EATRIGHT\|BOLT\|STORE_99`, `--offset` |
| `search-menu [dish]` (alias `dishes`) | `search_menu` | `--restaurant-id <id\|#>`, `--veg`, `--offset` |
| `menu [restaurant\|#]` | `get_restaurant_menu` | `--restaurant-id` |
| `addresses` | `get_addresses` | `--page`, `--page-size` |
| `create-address …` | `create_address` | see `swiggy-address` |
| `delete-address <id>` ⚠ | `delete_address` | |
| `cart` | `get_food_cart` | `--restaurant-name` |
| `add [item\|#] --qty <n>` (aliases `add-to-cart`, `update-cart`) | `update_food_cart` | `--item-id <menu_item_id>`, `--restaurant-id <id\|#>` (defaults to the item's restaurant), `--items <json>` for variants/addons, `--cutlery/--no-cutlery` |
| `clear-cart` ⚠ | `flush_food_cart` | |
| `list-coupons --restaurant-id <id>` | `fetch_food_coupons` | `--code` |
| `apply-coupon <code>` | `apply_food_coupon` | `--cart-id` |
| `checkout` ⚠ | `place_food_order` | `--pay cash\|upi\|upi:<app>\|swiggypay`, `--wait`, `--note` |
| `orders [--active]` | `get_food_orders` | |
| `order <orderId>` | `get_food_order_details` | |
| `track [orderId]` | `track_food_order` | |
| `delivery-status <orderId>` | `get_food_delivery_status` | |
| `payment-options` | `get_payment_options` | |
| `payment-status --paas-id <id> [--wait]` | `check_payment_status` | Food: also `--order-id --address-id --lat --lng` |
| `confirm-order --order-id <id> --address-id <id> --lat <lat> --lng <lng>` | `confirm_order` | |
| `report-error --tool <t> --message <m>` | `report_error` | `--flow`, `--context <json>`, `--notes` |

## Instamart (`swiggy instamart …`, alias `im`)

| Command | Tool | Key flags |
| --- | --- | --- |
| `search -q <q>` | `search_products` | `--offset` |
| `go-to-items` (alias `reorder`) | `your_go_to_items` | `--offset` |
| `addresses` / `create-address` / `delete-address <id>` ⚠ | address tools | |
| `cart` | `get_cart` | |
| `add [product\|#] --qty <n>` (alias `add-to-cart`) | `get_cart` + `update_cart` — **merges** | `--spin-id`, `--sku-id`, `--replace` |
| `set-cart --spin-id <id> --sku-id <id> --qty <n>` | `update_cart` — **replaces the whole cart** | `--items <json>` |
| `clear-cart` ⚠ | `clear_cart` | |
| `list-coupons` | `list_coupons` | |
| `apply-coupon <code>` | `apply_coupon` | |
| `checkout` ⚠ | `checkout` | `--pay …`, `--wait` |
| `orders [--count --type --active]` | `get_orders` | |
| `order <orderId>` | `get_order_details` | |
| `track <orderId> --lat <lat> --lng <lng>` | `track_order` | |
| `delivery-status <orderId>` | `get_delivery_status` | |
| `payment-options` / `payment-status` / `confirm-order --order-id <id> --paas-id <id>` / `report-error` | payment + support | |

## Dineout (`swiggy dineout …`)

| Command | Tool | Key flags |
| --- | --- | --- |
| `search [term] (--address-id <id\|#> \| --lat --lng)` | `search_restaurants_dineout` | `--limit`, `--offset`, `--entity-type` |
| `details <restaurant\|#>` | `get_restaurant_details` | `--lat --lng` (defaults to last search) |
| `locations` | `get_saved_locations` | |
| `slots [restaurant\|#] --date YYYY-MM-DD` | `get_available_slots` | `--restaurant-id` |
| `cart --slot <#> --guests <n>` or `--restaurant-id --slot-id --item-id --reservation-time --guests` | `create_cart` | `--type DINEOUT --bill-amount` |
| `book [slot\|#] --guests <n>` ⚠ or `--restaurant-id --slot-id --item-id --reservation-time --guests` | `book_table` (+ `create_cart` for paid deals) | `--cart-key`, `--pay upi`, `--wait` |
| `status <booking\|#>` | `get_booking_status` | |
| `cancel <booking\|#>` ⚠ | `cancel_booking` | `--reason` |
| `payment-options` / `payment-status` / `confirm-order --order-id --paas-id` / `report-error` | payment + support | |

## Auth, config, profile

| Command | Purpose |
| --- | --- |
| `auth init [--no-browser] [--server <s>]` | browser OAuth (phone + OTP); one token for all servers |
| `auth status` / `auth whoami` / `auth logout` | token state |
| `config show` / `config path` / `config init` | config + paths (`~/.swiggy`, override `SWIGGY_HOME`) |
| `profile list` / `use` / `create` / `delete` | profiles |
| `profile set <name> defaultAddressId\|defaultLat\|defaultLng\|defaultCity\|output <value>` | defaults |
