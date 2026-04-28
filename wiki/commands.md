# Commands

Every command accepts the global flags: `--json`, `--plain`, `--raw`, `--quiet`, `--no-interactive`, `-y/--yes`, `--profile <name>`.

## Generic (Layer B — agent-preferred)


| Command                                   | What it does                                              |
| ----------------------------------------- | --------------------------------------------------------- |
| `swiggy servers`                          | list known servers + endpoints                            |
| `swiggy tools <server>`                   | live `tools/list` from the server                         |
| `swiggy schema <server> <tool>`           | JSON Schema for a tool's arguments                        |
| `swiggy call <server> <tool> --input <j>` | call any tool with JSON args (also `--input-file <path>`) |


## Food (Layer A)


| Command                                 | Maps to                  |
| --------------------------------------- | ------------------------ |
| `swiggy food search-restaurants`        | `search_restaurants`     |
| `swiggy food search-menu`               | `search_menu`            |
| `swiggy food menu --restaurant-id <id>` | `get_restaurant_menu`    |
| `swiggy food addresses`                 | `get_addresses`          |
| `swiggy food cart`                      | `get_food_cart`          |
| `swiggy food add-to-cart`               | `update_food_cart`       |
| `swiggy food clear-cart`                | `flush_food_cart` ⚠      |
| `swiggy food list-coupons`              | `fetch_food_coupons`     |
| `swiggy food apply-coupon <code>`       | `apply_food_coupon`      |
| `swiggy food checkout`                  | `place_food_order` ⚠     |
| `swiggy food orders`                    | `get_food_orders`        |
| `swiggy food order <id>`                | `get_food_order_details` |
| `swiggy food track <id>`                | `track_food_order`       |


## Instamart (Layer A)


| Command                                | Maps to             |
| -------------------------------------- | ------------------- |
| `swiggy instamart search`              | `search_products`   |
| `swiggy instamart go-to-items`         | `your_go_to_items`  |
| `swiggy instamart addresses`           | `get_addresses`     |
| `swiggy instamart create-address`      | `create_address`    |
| `swiggy instamart delete-address <id>` | `delete_address` ⚠  |
| `swiggy instamart cart`                | `get_cart`          |
| `swiggy instamart add-to-cart`         | `update_cart`       |
| `swiggy instamart clear-cart`          | `clear_cart` ⚠      |
| `swiggy instamart checkout`            | `checkout` ⚠        |
| `swiggy instamart orders`              | `get_orders`        |
| `swiggy instamart order <id>`          | `get_order_details` |
| `swiggy instamart track <id>`          | `track_order`       |


## Dineout (Layer A)


| Command                             | Maps to                      |
| ----------------------------------- | ---------------------------- |
| `swiggy dineout search`             | `search_restaurants_dineout` |
| `swiggy dineout details <id>`       | `get_restaurant_details`     |
| `swiggy dineout locations`          | `get_saved_locations`        |
| `swiggy dineout slots`              | `get_available_slots`        |
| `swiggy dineout cart`               | `create_cart`                |
| `swiggy dineout book`               | `book_table` ⚠               |
| `swiggy dineout status <bookingId>` | `get_booking_status`         |


## Management


| Command                                   | What it does                              |
| ----------------------------------------- | ----------------------------------------- |
| `swiggy auth init [--server <name>]`      | OAuth flow (browser); per server          |
| `swiggy auth status`                      | per-server token state + expiry           |
| `swiggy auth logout [--server <name>]`    | clear stored tokens                       |
| `swiggy config init`                      | write default config                      |
| `swiggy config show`                      | print config + paths                      |
| `swiggy config path`                      | print on-disk paths                       |
| `swiggy profile list`                     | list profiles                             |
| `swiggy profile use <name>`               | switch active profile                     |
| `swiggy profile create <name> [opts]`     | new profile                               |
| `swiggy profile delete <name>`            | remove profile (cannot delete `default`)  |
| `swiggy profile set <name> <key> <value>` | tweak a profile field                     |
| `swiggy doctor`                           | full self-check — exits non-zero on issue |


⚠ = destructive. Requires `--yes` in non-interactive mode (exit `7` otherwise).