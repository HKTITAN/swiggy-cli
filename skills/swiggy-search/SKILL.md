---
name: swiggy-search
description: Find restaurants, dishes, grocery products, dine-in venues or events on Swiggy with swiggy-cli. Use when the user says "find", "search", "what's available", "show me options", "is X on Swiggy", "what's on tonight" — before any cart, order or booking step.
license: MIT
compatibility: Requires swiggy-cli signed in (swiggy auth init) and, for Food/Instamart, a saved Swiggy address.
metadata:
  author: HKTITAN
  version: "0.3.0"
---

# swiggy-search

Discovery is read-only and safe to repeat. Pick the service from intent; never search all four "just in case". Swiggy rate-limits per user without publishing the numbers, and every extra call is latency the user waits through.

## Route by intent

| The user wants | Command |
| --- | --- |
| restaurants that deliver (name or cuisine) | `swiggy food search -q "<one term>"` |
| a specific dish across restaurants | `swiggy food search-menu -q "<dish>"` (`--veg` for veg-only; there is no non-veg-only filter) |
| everything one restaurant sells | `swiggy food menu --restaurant-id <id>` |
| groceries / household / FMCG | `swiggy instamart search -q "<product>"` |
| "my usual" groceries | `swiggy instamart go-to-items` — one call replaces 3–5 searches |
| a place to eat out / book a table | `swiggy dineout search -q "<one term>" --lat <lat> --lng <lng>` |
| events, shows, gigs, "what's on" | `swiggy scenes discover --lat <lat> --lng <lng>` (or `--address-id <id>`); a named artist: `swiggy scenes search "<name>"`. Details in `swiggy-scenes` |

Always append `--json --no-interactive`.

## Rules

1. **Send one term, not the user's sentence.** Swiggy's search resolves what the term means; "best rooftop places in Koramangala" becomes `-q rooftop` plus the location. Sentences return noise.
2. **Food/Instamart need `--address-id`** (or a profile default). Results depend on serviceability at that address, so a search without it is meaningless upstream and the CLI refuses it in machine mode.
3. **Dineout needs coordinates:** `--lat --lng` for the city or area the user named (Bangalore 12.9716,77.5946 · Koramangala 12.9352,77.6245 · Mumbai 19.0760,72.8777 · Delhi 28.6139,77.2090). A saved address id is rejected (exit 2); Swiggy removed that option in November 2026. "Near me" with no place named → ask which city or area. Do not guess coordinates for a city you do not know.
4. **Map intent to a Food collection only when it is unambiguous:** healthy/high-protein → `--collection EATRIGHT`, "fastest possible" → `BOLT`, "under ₹100" → `STORE_99`. Otherwise omit.
5. **Paginate with the response's `nextOffset`** (`--offset <n>`); never invent offsets.
6. **Present, then stop.** Show name, rating, id (Food/Dineout) or displayName, price, `spinId` (Instamart variations). Do not auto-continue into cart or booking; those need the user's choice.

## Reading results

- Food `search`: `data.restaurants[]` → `id`, `name`, `availabilityStatus`. Only recommend `OPEN` restaurants.
- Food `search-menu`: `data.items[]` → `menu_item_id` (needed for the cart), `restaurant_id`, `price`, `hasVariants`, `hasAddons`.
- Instamart `search`: `data.products[]` → each has `variations[]` with `spinId`, `skuId`, `price.offerPrice`, `isInStockAndAvailable`. Carts take variation ids, never `productId`.
- Dineout `search`: `data.restaurants[]` → `id`, `name`, `cuisine`, `costForTwo`, `availableDeals`; `data.latitude/longitude` are remembered by the CLI for the next `details`/`slots`/`book`.
- Scenes `discover`: `data.events[]` → `eventId`, `eventName`, `venueName`, `date`, `price`; `data.collectionChips[]` → genre ids for `swiggy scenes collection <id>`.

## Example

```bash
swiggy food search-menu -q "paneer tikka" --veg --json --no-interactive \
  | jq '.data.items[:5] | map({name, price, id: .menu_item_id, restaurant: .restaurant_name})'
```
