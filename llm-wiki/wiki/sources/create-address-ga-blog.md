---
title: "Address, Created: create_address Goes GA on Swiggy MCP" (blog, 2026-08-24)
type: source
updated: 2026-09-05
sources: []
tags: [source, blog, addresses]
---
`https://mcp.swiggy.com/builders/blog/2026-08-24-create-address-ga.md`. `create_address` and `delete_address` are available to every authenticated user (no whitelist), on Food and Instamart; `latitude`/`longitude` became optional because the server geocodes the address.

## Claims
- The gate (`ADDRESS_MANAGEMENT_WHITELISTED_USERS`, `IM_CREATE_ADDRESS_ALLOWED_INTEGRATIONS`, `filterAddressMgmtGatedTools`) was removed; the "user is not whitelisted" error is gone.
- Parameters: `fullAddress`, `addressLine`, `addressLine2` ("" if none), `locality?`, `city`, `postalCode`, `addressCategory` ∈ HOME|WORK|OFFICE|FRIENDS_AND_FAMILY|OTHER, `addressTag?`, `userName`, `userPhone` (account holder), `receiverName?`, `receiverPhone?`, `latitude?`, `longitude?`. Response `{ addressId }` usable immediately.
- Agent guidance: ask the user only for full address, name, phone, category, optional tag; parse the rest; never ask for coordinates; geocoding failure is a business error (ask to correct, don't retry).
- `get_addresses` is recency-sorted, paginated, and strips coordinates.

## What it changed in the wiki
Address facts on [food-server](../entities/food-server.md) and [instamart-server](../entities/instamart-server.md); the `swiggy-address` skill and the CLI's `create-address` flags follow these rules.
