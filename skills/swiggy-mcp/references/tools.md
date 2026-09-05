# Swiggy MCP tool reference (51 tools)

Generated from https://mcp.swiggy.com/builders/llms-full.txt on 2026-09-05. Parameter names are exact (camelCase). Every tool returns `{ success, data, message? }` or `{ success: false, error: { message } }`. Session credentials are never passed as arguments.

Live source of truth: `https://mcp.swiggy.com/builders/docs/reference/<server>/<tool>.md`

## Food — `POST https://mcp.swiggy.com/food` (20 tools)

### `apply_food_coupon`  ·  Cart · mutating

Apply coupon code or discount to food delivery order. PRIMARY FOOD DELIVERY SERVICE - Use this when user wants to apply a coupon, discount code, or offer to their food delivery order. Swiggy Food delivery. Returns the updated cart with coupon applied, including new pricing, discounts, and savings information. Requires coupon code and address ID (coordinates are fetched automatically).

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `couponCode` | `string` | yes | Coupon code to apply |
| `addressId` | `string` | yes | Address ID where the order will be delivered (coordinates will be fetched automatically) |
| `cartId` | `string` | no | Optional cart ID |

### `check_payment_status`  ·  Payment · read-only

Check one payment-status iteration for an in-flight UPI payment. Use the returned terminal flags and message to decide whether to stop polling, retry payment, or complete the order.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `paasId` | `string` | yes | The payment TRANSACTION id from the place-order/checkout response (response field "paasId", e.g. a long numeric/alphanumeric id). NOT the payment-method name — never pass "PayWithQR", "UPI", "UPIIntent", or an app… |
| `orderId` | `string` | no | Order ID from the place-order or checkout response. Pass it when the tool response included an order ID. |
| `addressId` | `string` | no | Food only: echo from place_food_order — passed through for auto-confirm. |
| `cartId` | `string` | no | Food only: echo from place_food_order — passed through for auto-confirm. |
| `lat` | `number` | no | Food only: echo from place_food_order — passed through for auto-confirm. |
| `lng` | `number` | no | Food only: echo from place_food_order — passed through for auto-confirm. |

### `confirm_order`  ·  Payment · mutating

Complete an order after payment succeeds. For UPI flows, the place-order tool first returns `PENDING_PAYMENT`; call this only after `check_payment_status` reports a successful terminal payment and only when the order has not already been auto-confirmed.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderId` | `string` | yes | Order ID returned by the place-order tool. |
| `transactionId` | `string` | no | Transaction ID returned by the place-order tool (IM/Dineout only). |
| `paasId` | `string` | no | Payment transaction ID returned by the place-order tool (IM/Dineout only). |
| `addressId` | `string` | yes for Food | Address ID — REQUIRED for Food. Echo from place_food_order response. |
| `cartId` | `string` | no | Cart ID — optional but recommended for Food. Echo from place_food_order response. |
| `lat` | `number` | yes for Food | Latitude — REQUIRED for Food. Echo from place_food_order response. |
| `lng` | `number` | yes for Food | Longitude — REQUIRED for Food. Echo from place_food_order response. |

### `create_address`  ·  Discover · mutating

Swiggy (Instamart/Food): Create a new delivery address for the authenticated user.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `fullAddress` | `string` | yes | Complete address as provided by the user |
| `addressLine` | `string` | yes | Main street/building/house number (REQUIRED) |
| `addressLine2` | `string` | yes | Apartment, floor, wing, or additional details (REQUIRED - extract from full address, use empty string "" if not found) |
| `locality` | `string` | no | Area, neighborhood, or locality name (optional) |
| `city` | `string` | yes | City name (REQUIRED) |
| `postalCode` | `string` | yes | Postal/ZIP code (REQUIRED) |
| `latitude` | `number` | no | Latitude coordinate of the address (optional - auto-resolved from address if omitted) |
| `longitude` | `number` | no | Longitude coordinate of the address (optional - auto-resolved from address if omitted) |
| `addressCategory` | `"HOME" \| "WORK" \| "OFFICE" \| "FRIENDS_AND_FAMILY" \| "OTHER"` | yes | Type of address: HOME, WORK, OFFICE, FRIENDS_AND_FAMILY, or OTHER (REQUIRED) |
| `addressTag` | `string` | no | Friendly name/label for the address (e.g., "My Home", "Office", "Mom's Place") (optional) |
| `userName` | `string` | yes | Account holder name (authenticated user) (REQUIRED) |
| `userPhone` | `string` | yes | Account holder phone number (authenticated user) (REQUIRED) |
| `receiverName` | `string` | no | Receiver name if delivering to someone else (optional) |
| `receiverPhone` | `string` | no | Receiver phone if delivering to someone else (optional) |

### `delete_address`  ·  Discover · mutating

Swiggy (Instamart/Food): Delete a saved delivery address for the authenticated user.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | yes | The ID of the address to delete (from get_addresses response) |

### `fetch_food_coupons`  ·  Cart · read-only

Get available coupons and offers for food delivery order. PRIMARY FOOD DELIVERY SERVICE - Use this to find discounts, coupons, or offers when ordering food for delivery. Swiggy Food delivery. IMPORTANT: Only recommend coupons that are valid for Cash on Delivery (COD) payment. Filter out any offers that require online/card payment only. Includes best coupons, more offers, and payment offers with their applicability…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `restaurantId` | `string` | yes | Restaurant ID for the cart |
| `addressId` | `string` | yes | Address ID where the order will be delivered (coordinates will be fetched automatically) |
| `couponCode` | `string` | no | Optional coupon code to check applicability of a specific coupon |

### `flush_food_cart`  ·  Cart · mutating

Clear or empty the food delivery cart. PRIMARY FOOD DELIVERY SERVICE - Use this to remove all items from the food delivery cart. Swiggy Food delivery. NOT for groceries.

Parameters: none.

### `get_addresses`  ·  Discover · read-only

Swiggy (Instamart/Food): Get saved delivery addresses for the authenticated Swiggy user, sorted by last order date (most recent first). This tool works for Swiggy Instamart and Food services. Addresses are returned WITHOUT coordinates (latitude/longitude) for privacy protection. Authentication is handled automatically.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `page` | `number` | no | Page number for pagination, 1-based (default: 1) |
| `pageSize` | `number` | no | Number of addresses per page (default: 10, max: 10) |

### `get_food_cart`  ·  Cart · read-only

Get current food delivery cart with all items. PRIMARY FOOD DELIVERY SERVICE - Use this to view cart contents when ordering food for delivery. Swiggy Food delivery. Response includes valid_addons field for each item which shows which addons are valid based on the selected variants. Use this to determine which addons can be added. NOT for groceries or restaurant reservations.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | yes | Address ID to get accurate delivery charges based on location. |
| `restaurantName` | `string` | no | Restaurant name from search_restaurants or search_menu results. Pass this so the cart view can display the restaurant name (the cart API does not always return it). |

### `get_food_delivery_status`  ·  Track · read-only

Get the latest delivery ETA and terminal delivery state for a Food order. Use this for structured status polling after an order is placed; use `track_food_order` when the user asks for a conversational tracking update.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderId` | `string` | yes | Order ID to fetch the delivery ETA for (required). |

### `get_food_order_details`  ·  Track · read-only

Get detailed information about a specific food delivery order. PRIMARY FOOD DELIVERY SERVICE - Use this when user asks about order details, order information, or wants to see what they ordered. Swiggy Food delivery. Returns comprehensive order details including items, variants, pricing breakdown, delivery address, payment info, and order status.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderId` | `string` | yes | Order ID to fetch details for (can be obtained from get_food_orders) |

### `get_food_orders`  ·  Track · read-only

Swiggy Food order history - Use this to fetch ORDER HISTORY, past orders, or active orders. PRIMARY FOOD DELIVERY SERVICE - Use this FIRST when user asks: "show my food orders", "my food order history", "past food orders", "recent food orders", "what did I order", "my previous food orders", "list my food orders". Returns the user's most recent food orders (both active and delivered) ordered newest-first. Only set…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | yes | Address ID to use for fetching orders (can be obtained from get_addresses) |
| `activeOnly` | `boolean` | no | Set to true to filter only active/in-progress orders. Default: false. |

### `get_payment_options`  ·  Payment · read-only

Fetch the live payment methods currently available for the cart. Use this when the user is ready to pay or asks which payment options are available.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | no | Food only: pass the same addressId you used for get_food_cart. It is echoed back so the payment picker can place the order directly. Recommended for Food UPI. |

### `get_restaurant_menu`  ·  Discover · read-only

Browse a restaurant's complete menu as a flat, deduplicated list of dishes. Use this when the user wants to explore what a restaurant offers or see more menu options. Each unique dish appears once, with all of its category labels and its bestseller status. Nested categories use `Parent/Sub` labels, and bestseller dishes are also surfaced in the `Recommended` group. Results are capped at 150 unique items and may…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | yes | Address ID from get_addresses tool |
| `restaurantId` | `string` | yes | Restaurant ID to fetch menu for (from search_restaurants) |

### `place_food_order`  ·  Order · mutating

Place food delivery order and confirm order placement. PRIMARY FOOD DELIVERY SERVICE - Use this when user wants to place order, confirm order, or complete food delivery order. Swiggy Food delivery. Requires delivery address ID (coordinates are fetched automatically). NOT for groceries or restaurant reservations.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | yes | Address ID from the user's saved addresses (coordinates will be fetched automatically) |
| `paymentMethod` | `string` | no | The payment method the user selected (e.g. "UPI" or "Cash"). For UPI payments, first call get_payment_options and pass the method the user chose. For Cash/COD, this may be omitted only when Cash is the only available… |
| `intentApp` | `string` | no | Optional advanced parameter. Leave blank unless the runtime response of the preceding get_food_cart call explicitly tells you what to pass. |
| `generateUPIQR` | `boolean` | no | Optional advanced parameter. Leave blank unless the runtime response of the preceding get_food_cart call explicitly tells you to enable it. |
| `noteToRestaurant` | `string` | no | Free-form note to the restaurant preparing the order (e.g. "no onions", "less spicy"). Not for delivery partner instructions. |

### `report_error`  ·  Support · mutating

Generate an error report to share with the Swiggy MCP team. Use this when the user encounters an error and wants to report it. Returns a pre-filled mailto: link and a human-readable summary. The user can click the link to open their email client with the report ready to send. IMPORTANT: Always include toolContext with the specific identifiers from the failed tool call — e.g., orderId, restaurantId, addressId,…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `tool` | `string` | yes | Name of the tool that errored (e.g., "checkout", "search_products", "place_food_order") |
| `domain` | `string` | no | MCP server name where the error occurred (e.g., "im", "food", "dineout"). Auto-detected if not provided. |
| `errorMessage` | `string` | yes | The error message the user saw |
| `flowDescription` | `string` | no | Brief description of what the user was doing (e.g., "searched for milk → added to cart → checkout failed") |
| `toolContext` | `object` | no | Key-value pairs of identifiers from the failed tool call. Include ALL relevant IDs such as: orderId, restaurantId, addressId, spinId, menu_item_id, couponCode, query, cartId, slotId, paymentMethod, guestCount, itemId —… |
| `userNotes` | `string` | no | Any additional notes or context the user wants to share |

### `search_menu`  ·  Discover · read-only

Search for dishes and menu items to order for food delivery. PRIMARY FOOD DELIVERY SERVICE - Use this when user wants to find specific dishes, browse menu items, see what a restaurant offers, or order food. Swiggy Food delivery. Returns items with their customizations. The text response includes variant/addon IDs that you need for update_food_cart calls. IMPORTANT: Each item has EITHER "variations" (single-variant…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | yes | REQUIRED: Address ID obtained from get_addresses tool. You MUST call get_addresses first to get this value. Do NOT invent or guess addressId values. |
| `query` | `string` | yes | REQUIRED: Search query (dish name). Cannot be empty. Examples: "biryani", "pizza margherita", "paneer tikka" |
| `restaurantIdOfAddedItem` | `string` | no | Optional restaurant ID to scope search |
| `vegFilter` | `0 \| 1` | no | Veg filter flag (0 or 1). Pass 1 for veg-only items. 0 or omitted returns mixed veg + non-veg. There is NO non-veg-only filter — if user asks for "non-veg only", pass 0 (mixed) and mention in text that you are showing… |
| `offset` | `number` | no | Pagination offset. Use nextOffset from previous response to load more results. Default: 0. |

### `search_restaurants`  ·  Discover · read-only

Search and order food from restaurants for delivery. PRIMARY FOOD DELIVERY SERVICE - Use this when user wants to order food, get food delivered, or search restaurants for delivery. Swiggy Food delive...

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | yes | Address ID from get_addresses tool |
| `query` | `string` | yes | Search query (restaurant name or cuisine) |
| `offset` | `number` | no | Pagination offset. Use nextOffset from previous response to load more results. Default: 0. |
| `collection` | `"EATRIGHT" \| "BOLT" \| "STORE_99"` | no | Optional Swiggy storefront collection to scope results to. Map the user's **intent** to a collection (users rarely name the storefront directly). Set exactly one when the intent clearly matches, otherwise omit.… |

### `track_food_order`  ·  Track · read-only

Track food delivery order status and delivery progress. PRIMARY FOOD DELIVERY SERVICE - Use this when user asks to track order, check delivery status, or see where their food order is. Swiggy Food delivery. Returns current status, ETA, and progress for orders that are being prepared or in delivery. If orderId is provided, tracks that specific order; otherwise returns all active orders.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderId` | `string` | no | Optional: Specific order ID to track. If not provided, returns all active orders. |

### `update_food_cart`  ·  Cart · mutating

Add items to food delivery cart or update cart contents. PRIMARY FOOD DELIVERY SERVICE - Use this when user wants to add food items, dishes, or meals to their delivery cart. Swiggy Food delivery. Supports variants, variantsV2, and addons for customizing menu items. CRITICAL: Each menu item uses EITHER "variants" OR "variantsV2" format (check search_menu response) - use the SAME format that the item has, never both…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `restaurantId` | `string` | yes | Restaurant ID for the cart |
| `cartItems` | `object[]` | yes | Array of items to add to cart with their customizations |
| `addressId` | `string` | yes | Address ID to get accurate delivery charges based on location. |
| `restaurantName` | `string` | no | Restaurant name from search_restaurants or search_menu results. Pass this so the cart view can display the restaurant name (the cart API does not always return it). |
| `cutleryOptIn` | `boolean` | no | True to request cutlery, false to skip. Omit to leave preference unchanged. |

## Instamart — `POST https://mcp.swiggy.com/im` (19 tools)

### `apply_coupon`  ·  Cart · mutating

Swiggy Instamart (Grocery): Apply a coupon code to the current Instamart cart. Returns the updated cart with the discount reflected in the bill breakdown — same structure as get_cart / update_cart. Use list_coupons first to discover valid coupon codes.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `couponCode` | `string` | yes | REQUIRED: The coupon code to apply (e.g. "SAVE100", "FREEDEL"). Case-insensitive — will be uppercased automatically. |

### `check_payment_status`  ·  Payment · read-only

Check one payment-status iteration for an in-flight UPI payment. Use the returned terminal flags and message to decide whether to stop polling, retry payment, or complete the order.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `paasId` | `string` | yes | The payment TRANSACTION id from the place-order/checkout response (response field "paasId", e.g. a long numeric/alphanumeric id). NOT the payment-method name — never pass "PayWithQR", "UPI", "UPIIntent", or an app… |
| `orderId` | `string` | no | Order ID from the place-order or checkout response. Pass it when the tool response included an order ID. |
| `addressId` | `string` | no | Food only: echo from place_food_order — passed through for auto-confirm. |
| `cartId` | `string` | no | Food only: echo from place_food_order — passed through for auto-confirm. |
| `lat` | `number` | no | Food only: echo from place_food_order — passed through for auto-confirm. |
| `lng` | `number` | no | Food only: echo from place_food_order — passed through for auto-confirm. |

### `checkout`  ·  Order · mutating

Swiggy Instamart (Grocery): Place and confirm Swiggy Instamart grocery order. Creates order and confirms payment in a single operation. Use this for Instamart grocery orders, NOT for Food delivery.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | yes | Delivery address ID (from get_addresses - user must have selected this address) |
| `paymentMethod` | `string` | no | Payment method GROUP, not an app id. Use one of: "UPI", "Cash"/"COD", "SwiggyPay". For a UPI app selection pass paymentMethod="UPI" and put the app id in `intentApp` — do NOT put the app id (e.g. "gpay://upi/") here.… |
| `intentApp` | `string` | no | The selected UPI app id (e.g. "gpay://upi/"), copied EXACTLY from the chosen UPI method id. Only set this together with paymentMethod="UPI". Leave blank for Cash/COD/QR. |
| `generateUPIQR` | `boolean` | no | Optional advanced parameter. Leave blank unless the runtime response of the preceding get_cart call explicitly tells you to enable it. |

### `clear_cart`  ·  Cart · mutating

Clear (remove all items from) the Instamart cart. Authentication is handled automatically.

Parameters: none.

### `confirm_order`  ·  Payment · mutating

Complete an order after payment succeeds. For UPI flows, the place-order tool first returns `PENDING_PAYMENT`; call this only after `check_payment_status` reports a successful terminal payment and only when the order has not already been auto-confirmed.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderId` | `string` | yes | Order ID returned by the place-order tool. |
| `transactionId` | `string` | no | Transaction ID returned by the place-order tool (IM/Dineout only). |
| `paasId` | `string` | yes for IM/Dineout | Payment transaction ID returned by the place-order tool (IM/Dineout only). |
| `addressId` | `string` | no | Food only; not used by Instamart confirmation. |
| `cartId` | `string` | no | Food only; not used by Instamart confirmation. |
| `lat` | `number` | no | Food only; not used by Instamart confirmation. |
| `lng` | `number` | no | Food only; not used by Instamart confirmation. |

### `create_address`  ·  Discover · mutating

Swiggy (Instamart/Food): Create a new delivery address for the authenticated user.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `fullAddress` | `string` | yes | Complete address as provided by the user |
| `addressLine` | `string` | yes | Main street/building/house number (REQUIRED) |
| `addressLine2` | `string` | yes | Apartment, floor, wing, or additional details (REQUIRED - extract from full address, use empty string "" if not found) |
| `locality` | `string` | no | Area, neighborhood, or locality name (optional) |
| `city` | `string` | yes | City name (REQUIRED) |
| `postalCode` | `string` | yes | Postal/ZIP code (REQUIRED) |
| `latitude` | `number` | no | Latitude coordinate of the address (optional — the server will geocode from the address if omitted) |
| `longitude` | `number` | no | Longitude coordinate of the address (optional — the server will geocode from the address if omitted) |
| `addressCategory` | `"HOME" \| "WORK" \| "OFFICE" \| "FRIENDS_AND_FAMILY" \| "OTHER"` | yes | Type of address: HOME, WORK, OFFICE, FRIENDS_AND_FAMILY, or OTHER (REQUIRED) |
| `addressTag` | `string` | no | Friendly name/label for the address (e.g., "My Home", "Office", "Mom's Place") (optional) |
| `userName` | `string` | yes | Account holder name (authenticated user) (REQUIRED) |
| `userPhone` | `string` | yes | Account holder phone number (authenticated user) (REQUIRED) |
| `receiverName` | `string` | no | Receiver name if delivering to someone else (optional) |
| `receiverPhone` | `string` | no | Receiver phone if delivering to someone else (optional) |

### `delete_address`  ·  Discover · mutating

Swiggy (Instamart/Food): Delete a saved delivery address for the authenticated user.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | yes | The ID of the address to delete (from get_addresses response) |

### `get_addresses`  ·  Discover · read-only

Swiggy (Instamart/Food): Get saved delivery addresses for the authenticated Swiggy user, sorted by last order date (most recent first). This tool works for Swiggy Instamart and Food services. Addresses are returned WITHOUT coordinates (latitude/longitude) for privacy protection. Authentication is handled automatically.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `page` | `number` | no | Page number for pagination, 1-based (default: 1) |
| `pageSize` | `number` | no | Number of addresses per page (default: 10, max: 10) |

### `get_cart`  ·  Cart · read-only

Swiggy Instamart (Grocery): Get current Swiggy Instamart grocery cart with all items and bill breakdown. Use this for Instamart grocery orders, NOT for Food delivery. Authentication is handled automatically.

Parameters: none.

### `get_delivery_status`  ·  Track · read-only

## Usage notes

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderId` | `string` | yes | Order ID to fetch the delivery ETA for (required). |
| `addressId` | `string` | yes | Delivery address ID for the order (required; coords resolved automatically). |

### `get_order_details`  ·  Track · read-only

Get detailed information for a specific Swiggy Instamart order by order ID. Use this when the user wants to see complete details about a specific order including: full list of items with quantities and prices, itemized bill breakdown (item total, delivery fee, handling fee, grand total), order status, and whether there are any refunds. This tool provides more detailed information than get_orders. Note: For store…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderId` | `string` | yes | The order ID to fetch details for (required). Can be obtained from get_orders tool. |

### `get_orders`  ·  Track · read-only

Swiggy Instamart order history - Use this to fetch ORDER HISTORY, past orders, or order preferences. Use this FIRST when user asks: "show my orders", "get my orders", "my last order", "order history", "past orders", "recent orders", "list my orders", "what did I order before", "my previous orders", "check my past orders", "my order preferences", "get preferences from past orders", "what do I usually order", "my…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `count` | `number` | no | Number of orders to fetch (default: 10, max recommended: 20) |
| `orderType` | `string` | no | Order type filter (e.g., "DASH", "INSTAMART"). Default: "DASH" |
| `activeOnly` | `boolean` | no | Set to true to filter only active/ongoing orders. Default: false (returns all orders) |

### `get_payment_options`  ·  Payment · read-only

Fetch the live payment methods currently available for the cart. Use this when the user is ready to pay or asks which payment options are available.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | no | Food only: pass the same addressId you used for get_food_cart. It is echoed back so the payment picker can place the order directly. Recommended for Food UPI. |

### `list_coupons`  ·  Cart · read-only

Swiggy Instamart (Grocery): List available coupons for the current cart. Fetches applicable coupon offers based on the items in your cart and delivery address. Call this before checkout to discover available discounts.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | yes | REQUIRED: Delivery address ID from get_addresses. Used to determine location-specific coupon availability. |

### `report_error`  ·  Support · mutating

Generate an error report to share with the Swiggy MCP team. Use this when the user encounters an error and wants to report it. Returns a pre-filled mailto: link and a human-readable summary. The user can click the link to open their email client with the report ready to send. IMPORTANT: Always include toolContext with the specific identifiers from the failed tool call — e.g., orderId, restaurantId, addressId,…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `tool` | `string` | yes | Name of the tool that errored (e.g., "checkout", "search_products", "place_food_order") |
| `domain` | `string` | no | MCP server name where the error occurred (e.g., "im", "food", "dineout"). Auto-detected if not provided. |
| `errorMessage` | `string` | yes | The error message the user saw |
| `flowDescription` | `string` | no | Brief description of what the user was doing (e.g., "searched for milk → added to cart → checkout failed") |
| `toolContext` | `object` | no | Key-value pairs of identifiers from the failed tool call. Include ALL relevant IDs such as: orderId, restaurantId, addressId, spinId, menu_item_id, couponCode, query, cartId, slotId, paymentMethod, guestCount, itemId —… |
| `userNotes` | `string` | no | Any additional notes or context the user wants to share |

### `search_products`  ·  Discover · read-only

Search for products available at the selected address. Returns products with their variants (e.g., different pack sizes, quantities). When a user asks to add a product, ALWAYS search first to see available variants, then ask the user which specific variant they want before adding to cart. Authentication is handled automatically.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | yes | REQUIRED: Address ID obtained from get_addresses tool. You MUST call get_addresses first to get this value. Do NOT invent or guess addressId values. |
| `query` | `string` | yes | REQUIRED: Search query (product name, category, or brand). Cannot be empty. |
| `offset` | `number` | no | Pagination offset (default: 0) |

### `track_order`  ·  Track · read-only

Track Swiggy Instamart order status in real-time. PRIMARY TOOL for order tracking - Use this FIRST when user asks: "where is my order", "track my order", "order status", "what's the status of my order", "when will my order arrive", "ETA for my order", "is my order on the way", "has my order been delivered", "track order", "check order status", or any query about a specific order's current status. Returns real-time…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderId` | `string` | yes | The order ID to track (required). Can be obtained from get_orders tool. |
| `lat` | `number` | yes | Latitude of the delivery address (required for accurate tracking) |
| `lng` | `number` | yes | Longitude of the delivery address (required for accurate tracking) |

### `update_cart`  ·  Cart · mutating

Swiggy Instamart (Grocery): Update Swiggy Instamart grocery cart with items. Replaces entire cart with the provided items. Use this for Instamart grocery orders, NOT for Food delivery. Authentication is handled automatically. Use addressId from get_addresses.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `selectedAddressId` | `string` | yes | Selected delivery address ID from get_addresses tool |
| `items` | `object[]` | yes | Array of items to add to cart |

### `your_go_to_items`  ·  Discover · read-only

Fetch the user's Your Go To Items (frequently or recently ordered items) for the selected delivery address. Use addressId from get_addresses. Returns products with variants; pass BOTH spinId and skuId from the chosen variant when adding to cart via update_cart.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | yes | Address ID from get_addresses tool |
| `offset` | `number` | no | Pagination offset (default: 0) |

## Dineout — `POST https://mcp.swiggy.com/dineout` (12 tools)

### `book_table`  ·  Reserve · mutating

Swiggy Dineout (Reservations): Book a table at a restaurant for a specific time slot. NOT for food delivery or grocery orders. Books FREE reservations directly, and PAID prebook deals via UPI. FREE deal (isFree=true): pass slot details only — book_table creates the cart and confirms in one step. PAID deal (isFree=false): first call create_cart (cartType="DEAL_TICKET_PURCHASE") to create the cart — it shows a…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `restaurantId` | `string` | yes | Restaurant ID |
| `slotId` | `number` | yes | Slot ID from selected slot (slot.deals[].slotId) |
| `itemId` | `string` | yes | Deal/ticket item ID (slot.deals[].itemId, format: "restaurantId-ticketId") |
| `reservationTime` | `number` | yes | Unix timestamp from selected slot (slot.reservationTime) |
| `guestCount` | `number` | yes | Number of guests (1-20) |
| `latitude` | `number` | yes | Latitude from user address |
| `longitude` | `number` | yes | Longitude from user address |
| `paymentMethod` | `"Cash" \| "UPI"` | no | Omit (or "Cash") for FREE reservations. Use "UPI" for paid prebook deals (also pass cartKey + intentApp). |
| `cartKey` | `string` | no | Paid UPI prebook only: cartKey returned by create_cart (DEAL_TICKET_PURCHASE). |
| `intentApp` | `string` | no | Paid UPI prebook only: the UPI app id chosen from get_payment_options. Omit when generateUPIQR=true. |
| `generateUPIQR` | `boolean` | no | Paid UPI prebook on desktop: true for a scannable QR instead of an app intent. |

### `cancel_booking`  ·  Manage · mutating

Swiggy Dineout (Reservations): Cancel an existing table reservation by orderId. Call this when the user clearly asks to cancel, drop, or remove a confirmed booking. You MUST already have the orderId — either from an earlier book_table response in this conversation, or by asking the user to provide it. IF YOU DO NOT HAVE AN orderId: do NOT call this tool. Ask the user: "To cancel a reservation I need the order ID…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderId` | `string` | yes | The order ID of the booking to cancel (from book_table response). |
| `cancellationReason` | `string` | no | Optional short reason for cancellation (e.g., "plan changed", "wrong restaurant"). Not shown to the user. |

### `check_payment_status`  ·  Payment · read-only

Check one payment-status iteration for an in-flight UPI payment. Use the returned terminal flags and message to decide whether to stop polling, retry payment, or complete the order.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `paasId` | `string` | yes | The payment TRANSACTION id from the place-order/checkout response (response field "paasId", e.g. a long numeric/alphanumeric id). NOT the payment-method name — never pass "PayWithQR", "UPI", "UPIIntent", or an app… |
| `orderId` | `string` | no | Order ID from the place-order or checkout response. Pass it when the tool response included an order ID. |
| `addressId` | `string` | no | Food only: echo from place_food_order — passed through for auto-confirm. |
| `cartId` | `string` | no | Food only: echo from place_food_order — passed through for auto-confirm. |
| `lat` | `number` | no | Food only: echo from place_food_order — passed through for auto-confirm. |
| `lng` | `number` | no | Food only: echo from place_food_order — passed through for auto-confirm. |

### `confirm_order`  ·  Payment · mutating

Complete an order after payment succeeds. For UPI flows, the place-order tool first returns `PENDING_PAYMENT`; call this only after `check_payment_status` reports a successful terminal payment and only when the order has not already been auto-confirmed.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderId` | `string` | yes | Order ID returned by the place-order tool. |
| `transactionId` | `string` | no | Transaction ID returned by the place-order tool (IM/Dineout only). |
| `paasId` | `string` | yes for IM/Dineout | Payment transaction ID returned by the place-order tool (IM/Dineout only). |
| `addressId` | `string` | no | Food only; not used by Dineout confirmation. |
| `cartId` | `string` | no | Food only; not used by Dineout confirmation. |
| `lat` | `number` | no | Food only; not used by Dineout confirmation. |
| `lng` | `number` | no | Food only; not used by Dineout confirmation. |

### `create_cart`  ·  Reserve · mutating

Swiggy Dineout (Reservations): Create a booking cart. NOT for food delivery or grocery orders. Use this for PAID prebook deals (isFree=false): call with cartType="DEAL_TICKET_PURCHASE" + slot details + guest count. It returns the cartKey and shows a Booking Summary card. STOP after this — wait for the user to tap "Proceed to payment" before showing any payment methods. After they pick a method, call book_table with…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `restaurantId` | `string` | yes | Restaurant ID |
| `cartType` | `"DEAL_TICKET_PURCHASE" \| "DINEOUT"` | yes | Cart type: DEAL_TICKET_PURCHASE for booking, DINEOUT for bill payment |
| `latitude` | `number` | yes | Latitude |
| `longitude` | `number` | yes | Longitude |
| `slotId` | `number` | yes for DEAL_TICKET_PURCHASE | Slot ID (required for booking cart) |
| `itemId` | `string` | yes for DEAL_TICKET_PURCHASE | Item ID (required for booking cart, format: "restaurantId-ticketId") |
| `reservationTime` | `number` | yes for DEAL_TICKET_PURCHASE | Unix timestamp (required for booking cart) |
| `guestCount` | `number` | yes for DEAL_TICKET_PURCHASE | Number of guests (required for booking cart, 1-20) |
| `billAmount` | `number` | yes for DINEOUT | Bill amount in rupees (required for bill payment cart) |
| `source` | `string` | no | Source for bill payment cart (default: "direct-payment-cart") |

### `get_available_slots`  ·  Reserve · read-only

Swiggy Dineout (Reservations): Check available time slots for TABLE BOOKING at a restaurant. NOT for food delivery or grocery orders. Returns breakfast, lunch, and dinner slots for up to 7 DAYS starting from the requested date in a single call. the flow handles date switching client-side — do NOT call this tool again when the user picks a different date in the UI. Date must be in YYYY-MM-DD format (e.g.,…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `restaurantId` | `string` | yes | Restaurant ID from search or details |
| `date` | `string` | yes | Starting date as YYYY-MM-DD string (e.g., "2026-04-20") or epoch timestamp as numeric string (e.g., "1735689600"). Returns slots for up to 7 days from this date. |
| `latitude` | `number` | yes | User's latitude |
| `longitude` | `number` | yes | User's longitude |

### `get_booking_status`  ·  Manage · read-only

Swiggy Dineout (Reservations): Get booking status and details for a dineout reservation. NOT for food delivery or grocery orders. Returns restaurant name, booking date and time, guest count, deal title, and current status (confirmed/cancelled/completed). Use this when the user asks about their reservation status, booking details, or wants to check if their table is still confirmed. Example: "What is the status of…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderId` | `string` | yes | Order ID from booking confirmation |

### `get_payment_options`  ·  Payment · read-only

Fetch the live payment methods currently available for the cart. Use this when the user is ready to pay or asks which payment options are available.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressId` | `string` | no | Food only: pass the same addressId you used for get_food_cart. It is echoed back so the payment picker can place the order directly. Recommended for Food UPI. |

### `get_restaurant_details`  ·  Find · read-only

Swiggy Dineout (Reservations): Get details about a specific restaurant for TABLE BOOKING. NOT for food delivery or grocery orders. Returns ratings, deals and offers, opening/closing timings, address, menu images, and amenities (valet parking, live music, outdoor seating, etc.). Use this to show the user detailed information about a restaurant so they can decide whether to book a table. IMPORTANT: When the user…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `restaurantId` | `string` | yes | Restaurant ID from search results |
| `latitude` | `number` | yes | Latitude (use same as search) |
| `longitude` | `number` | yes | Longitude (use same as search) |

### `get_saved_locations`  ·  Find · read-only

Swiggy Dineout (Reservations): Get user's saved addresses for restaurant search. NOT for food delivery or grocery orders. Returns address IDs that can be passed to search_restaurants_dineout.

Parameters: none.

### `report_error`  ·  Support · mutating

Generate an error report to share with the Swiggy MCP team. Use this when the user encounters an error and wants to report it. Returns a pre-filled mailto: link and a human-readable summary. The user can click the link to open their email client with the report ready to send. IMPORTANT: Always include toolContext with the specific identifiers from the failed tool call — e.g., orderId, restaurantId, addressId,…

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `tool` | `string` | yes | Name of the tool that errored (e.g., "checkout", "search_products", "place_food_order") |
| `domain` | `string` | no | MCP server name where the error occurred (e.g., "im", "food", "dineout"). Auto-detected if not provided. |
| `errorMessage` | `string` | yes | The error message the user saw |
| `flowDescription` | `string` | no | Brief description of what the user was doing (e.g., "searched for milk → added to cart → checkout failed") |
| `toolContext` | `object` | no | Key-value pairs of identifiers from the failed tool call. Include ALL relevant IDs such as: orderId, restaurantId, addressId, spinId, menu_item_id, couponCode, query, cartId, slotId, paymentMethod, guestCount, itemId —… |
| `userNotes` | `string` | no | Any additional notes or context the user wants to share |

### `search_restaurants_dineout`  ·  Find · read-only

Swiggy Dineout (Reservations): find restaurants to BOOK A TABLE at. Use when the user wants to go out and eat. NOT for food delivery or grocery orders. Returns cuisines, rating, cost for two, distance, highlights, offers and bookable deals.

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `query` | `string` | yes | What to search for: a restaurant name, cuisine, area, kind of place (cafe, pub, brewery), or vibe (rooftop, buffet, live music). One term, not a sentence, and no location words when latitude/longitude already cover the… |
| `entityType` | `"locality" \| "CUISINE" \| "RESTAURANT_CATEGORY" \| "ambience_tags"` | no | Rarely needed. The search already works out whether the query is a cuisine, area, category or vibe. Set this only to force a specific interpretation of an ambiguous term. |
| `addressId` | `string` | no | Address ID from get_saved_locations. Coordinates are resolved automatically. Use this instead of latitude/longitude when searching near a saved address. |
| `latitude` | `number` | no | Latitude for search. Use for direct city/area searches. Not needed if addressId is provided. |
| `longitude` | `number` | no | Longitude for search. Use for direct city/area searches. Not needed if addressId is provided. |
| `limit` | `number` | no | Max restaurants to return. Default 10, max 30. |
| `offset` | `number` | no | Restaurants to skip. Use the offset given in the previous response to show more of the same search. |
