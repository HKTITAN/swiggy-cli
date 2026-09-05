---
name: swiggy-address
description: List, create, delete and default Swiggy delivery addresses with swiggy-cli. Use when a Food/Instamart command needs an addressId, when the user says "deliver to my office", "add a new address", or when the CLI exits 2 asking for --address-id.
license: MIT
compatibility: Requires swiggy-cli signed in.
metadata:
  author: HKTITAN
  version: "0.2.3"
---

# swiggy-address

Almost every Food and Instamart tool takes `addressId`. Resolve it once per session, then set it as the profile default so later commands stop asking.

## Resolve

```bash
swiggy food addresses --json --no-interactive        # data.addresses[] → id, addressLine, addressTag (HOME/WORK/…)
swiggy profile set default defaultAddressId <id>     # every later food/instamart command uses it
```

Food and Instamart share the same address book; one lookup serves both. Address ids are stable — cache the id, never the human-readable text.

Match the user's words to `addressTag`/`addressLine` ("home" → HOME). If two addresses could match, show both and ask; never pick silently. Coordinates are not returned here (Swiggy strips them); Dineout has its own `swiggy dineout locations`.

## Create (GA for every account since Aug 2026)

```bash
swiggy instamart create-address \
  --full-address "12B, Sobha Lotus, Sarjapur Road, Bengaluru 560103" \
  --line1 "12B, Sobha Lotus" --line2 "Sarjapur Road" --locality Sarjapur \
  --city Bengaluru --postal-code 560103 --category HOME --tag Home \
  --name "<account holder>" --phone "+91xxxxxxxxxx" --json --no-interactive
```

Rules that keep this a one-question step:

1. **Ask the user only for the full address, name, phone, category (HOME/WORK/OFFICE/FRIENDS_AND_FAMILY/OTHER) and an optional tag.** Parse `--line1`, `--line2`, `--city`, `--postal-code`, `--locality` yourself from the full address; never ask field by field.
2. **Do not ask for coordinates.** Omit `--lat/--lng`; Swiggy geocodes the address. Pass them only if the user volunteered them.
3. **`--name/--phone` are the account holder.** Use `--receiver-name/--receiver-phone` only when delivering to someone else.
4. If geocoding fails (`MCP_ERROR` about an unlocatable address), ask the user to correct the address; do not retry the same string.

The response `data.addressId` is usable immediately in search/cart/checkout without re-listing.

## Delete (destructive)

```bash
swiggy instamart delete-address <addressId> --yes --json --no-interactive
```

Only after the user named the address to delete in this conversation; confirm the `addressLine` back to them first.
