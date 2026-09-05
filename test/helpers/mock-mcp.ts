import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A tiny Streamable-HTTP MCP server that imitates the Swiggy servers closely enough to test the
 * client, envelope unwrapping, native views, session persistence, auth, rate limiting and SSE
 * without network. Fixtures follow the output schemas at
 * https://mcp.swiggy.com/builders/docs/reference/ (2026-09-05).
 */

export interface MockState {
  initializeCount: number;
  calls: Array<{ name: string; args: unknown; sessionId?: string }>;
  /** Next request with a session id returns 404 once (simulates session expiry). */
  expireSessionOnce: boolean;
  /** Emit X-RateLimit-* headers on responses. */
  rateLimitHeaders: boolean;
  token: string;
  sessions: Set<string>;
  /** Mutable Instamart cart so `add` merge logic can be tested. */
  imCart: Array<{ spinId: string; skuId?: string; quantity: number }>;
}

export const TOOLS = [
  { name: "get_addresses", description: "Get saved delivery addresses", inputSchema: { type: "object", properties: { page: { type: "number" } } } },
  { name: "search_restaurants", description: "Search restaurants", inputSchema: { type: "object", required: ["addressId", "query"], properties: { addressId: { type: "string" }, query: { type: "string" } } } },
  { name: "place_food_order", description: "Place order", inputSchema: { type: "object" } },
  { name: "check_payment_status", description: "Check payment", inputSchema: { type: "object" } },
  { name: "confirm_order", description: "Confirm", inputSchema: { type: "object" } },
  { name: "echo", description: "Echo args", inputSchema: { type: "object" } },
];

export const FIXTURES = {
  addresses: { addresses: [{ id: "addr_1", addressLine: "12B Sobha Lotus, Sarjapur Road", phoneNumber: "+91xxxxxx1234", addressTag: "Home", addressCategory: "HOME" }, { id: "addr_2", addressLine: "Office Park, Bellandur", phoneNumber: "+91xxxxxx1234", addressTag: "Work", addressCategory: "WORK" }], pagination: { page: 1, pageSize: 10, total: 2, totalPages: 1, hasMore: false } },
  restaurants: {
    restaurants: [
      { id: "r1", name: "Paradise Biryani", cuisines: ["Biryani", "Hyderabadi"], avgRating: 4.4, totalRatings: "10K+", costForTwo: "₹400 for two", areaName: "Koramangala", distanceKm: 1.2, deliveryTimeRange: "25-30 mins", availabilityStatus: "OPEN", offer: "50% off up to ₹100" },
      { id: "r2", name: "Behrouz Biryani", cuisines: ["Biryani", "Mughlai"], avgRating: 4.2, costForTwo: "₹500 for two", areaName: "HSR", deliveryTimeMinutes: 35, availabilityStatus: "CLOSED", nextOpenTime: "11:00 AM" },
    ],
    dishes: [{ id: "d1", name: "Chicken Dum Biryani", price: 349, isVeg: false, restaurantId: "r1", restaurantName: "Paradise Biryani", restaurantRating: 4.4 }],
    query: "biryani",
    totalRestaurants: 2,
    nextOffset: 10,
    hasMore: false,
  },
  menu: { restaurant: { id: "r1", name: "Paradise Biryani", cuisines: ["Biryani"], avgRatingString: "4.4", costForTwoMessage: "₹400 for two", slaString: "25-30 mins", isOpen: true, address: "80 Feet Rd, Koramangala" }, items: [{ id: "m1", name: "Chicken Dum Biryani", price: 349, inStock: 1, isVeg: false, isBestseller: true, hasVariants: true, categories: ["Biryani"] }, { id: "m2", name: "Paneer Biryani", price: 299, inStock: 1, isVeg: true, categories: ["Biryani"] }, { id: "m3", name: "Gulab Jamun", price: 99, inStock: 0, isVeg: true, categories: ["Desserts"] }], categoryLabels: ["Biryani", "Desserts"], totalItems: 3, totalCategories: 2 },
  menuSearch: { items: [{ name: "Paneer Tikka", price: 249, isVeg: true, menu_item_id: "mi9", inStock: 1, restaurant_id: "r7", restaurant_name: "Punjab Grill", rating: "4.3", hasAddons: true }], query: "paneer tikka", totalItems: 1, hasMore: false },
  foodCart: { data: { cart_id: "cart_1", restaurant: { id: "r1", name: "Paradise Biryani", area: "Koramangala" }, items: [{ menu_item_id: "m1", name: "Chicken Dum Biryani", quantity: 2, is_veg: false, subtotal: 349, total: 698, final_price: 349, in_stock: true }], item_count: 1, pricing: { item_total: 698, delivery_charge: 0, delivery_charge_strikeoff: 40, taxes_and_charges: 52, to_pay: 750 }, offers: { coupon_applied: "TRYNEW", coupon_discount: 0, free_delivery_applied: true } }, addressId: "addr_1", availablePaymentMethods: ["Cash", "UPI"] },
  products: { nextOffset: "20", products: [{ displayName: "Amul Taaza Toned Milk", brand: "Amul", inStock: true, isAvail: true, productId: "p1", parentProductId: "pp1", variations: [{ spinId: "spin_1", skuId: "sku_1", quantityDescription: "500 ml", displayName: "Amul Taaza 500ml", brandName: "Amul", price: { mrp: 28, offerPrice: 27 }, isInStockAndAvailable: true, sla: { value: "10", unit: "mins" } }, { spinId: "spin_2", skuId: "sku_2", quantityDescription: "1 L", displayName: "Amul Taaza 1L", brandName: "Amul", price: { mrp: 56, offerPrice: 54 }, isInStockAndAvailable: false }] }] },
  imOrders: { orders: [{ orderId: "im_1", status: "Delivered", createdAt: "2026-09-01 19:02", updatedAt: "2026-09-01 19:20", itemCount: 3, totalAmount: 412, orderType: "INSTAMART", isActive: false, currentStatus: "DELIVERED", historyStatus: "Delivered", storeName: "Instamart Koramangala", items: [{ name: "Milk", quantity: 2 }, { name: "Bread", quantity: 1 }] }] },
  foodOrders: { orders: [{ orderId: "fo_1", restaurantId: "r1", restaurantName: "Paradise Biryani", restaurantAreaName: "Koramangala", orderTotal: "750", orderStatus: "Delivered", orderType: "regular", orderedItems: "2 x Chicken Dum Biryani", orderedTime: "2026-09-02 20:15", isActiveOrder: false, actions: [] }] },
  slots: { slots: [{ isFree: true, slotId: 101, displayTime: "7:00 PM", reservationTime: 1757178000, slotGroupName: "Dinner", availableInventory: 4, dateStr: "2026-09-06", deals: [{ itemId: "dr1-t1", ticketId: "t1", slotId: 101, title: "Flat 20% off", isFree: true, availableInventory: 4 }] }, { isFree: false, slotId: 102, displayTime: "8:00 PM", reservationTime: 1757181600, slotGroupName: "Dinner", availableInventory: 2, dateStr: "2026-09-06", price: 500, deals: [{ itemId: "dr1-t2", ticketId: "t2", slotId: 102, title: "Prebook 30% off", isFree: false, bookingPrice: 500, discountPercentage: 30 }] }], restaurantId: "dr1", date: "2026-09-06", restaurantName: "Toit", guestCount: 2, latitude: 12.9784, longitude: 77.6408 },
  dineoutSearch: { restaurants: [{ id: "dr1", name: "Toit", cuisine: ["Brewery", "Continental"], locality: "Indiranagar", area: "Indiranagar", rating: { value: "4.5", count: 12000 }, costForTwo: "₹1,800", distance: "2.1 km", availableDeals: [{ dealTitle: "Flat 20% off", ticketId: 1 }] }], latitude: 12.9784, longitude: 77.6408, total: 1, offset: 0 },
};

function text(obj: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(obj) }] };
}

function envelope(data: unknown, message?: string) {
  return text({ success: true, data, ...(message ? { message } : {}) });
}

export async function startMockMcp(overrides: Partial<MockState> = {}): Promise<{ url: string; state: MockState; server: Server; close: () => Promise<void> }> {
  const state: MockState = {
    initializeCount: 0,
    calls: [],
    expireSessionOnce: false,
    rateLimitHeaders: true,
    token: "test-token",
    sessions: new Set(),
    imCart: [],
    ...overrides,
  };
  let paymentPolls = 0;

  const imCartPayload = () => ({
    selectedAddress: "addr_1",
    selectedAddressDetails: { id: "addr_1", address: "12B Sobha Lotus", area: "Sarjapur", name: "Home", mobile: "x", annotation: "Home" },
    cartTotalAmount: `₹${state.imCart.reduce((t, i) => t + i.quantity * 27, 0)}`,
    items: state.imCart.map((i) => ({ spinId: i.spinId, skuId: i.skuId ?? "sku_x", productId: "p1", itemName: i.spinId === "spin_1" ? "Amul Taaza 500ml" : "Item " + i.spinId, quantity: i.quantity, isInStockAndAvailable: true, mrp: 28, discountedFinalPrice: 27 })),
    billBreakdown: { lineItems: [{ label: "Item total", value: `₹${state.imCart.reduce((t, i) => t + i.quantity * 27, 0)}` }, { label: "Delivery", value: "₹0" }], toPay: { label: "To pay", value: `₹${state.imCart.reduce((t, i) => t + i.quantity * 27, 0)}` } },
    cartId: "imcart_1",
    availablePaymentMethods: ["Cash", "UPI", "SwiggyPay"],
  });

  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const auth = req.headers.authorization;
      if (state.rateLimitHeaders) {
        res.setHeader("x-ratelimit-limit", "70");
        res.setHeader("x-ratelimit-remaining", "69");
        res.setHeader("x-ratelimit-reset", "1720000060");
      }
      if (auth !== `Bearer ${state.token}`) {
        res.statusCode = 401;
        res.setHeader("www-authenticate", 'Bearer realm="mcp", resource_metadata="http://x/.well-known/oauth-protected-resource"');
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: "invalid_token", error_description: "Authentication required" }));
        return;
      }
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let msg: { id?: string; method: string; params?: { name?: string; arguments?: Record<string, unknown> } };
      try {
        msg = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        res.end("bad json");
        return;
      }
      const reply = (result: unknown, status = 200) => {
        res.statusCode = status;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
      };
      const rpcError = (code: number, message: string) => {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code, message } }));
      };

      if (msg.method === "initialize") {
        state.initializeCount += 1;
        const sid = `sess-${state.initializeCount}`;
        state.sessions.add(sid);
        res.setHeader("mcp-session-id", sid);
        reply({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "mock-swiggy", version: "1.0.0" } });
        return;
      }
      if (msg.method === "notifications/initialized") {
        res.statusCode = 202;
        res.end();
        return;
      }
      if (!sessionId || !state.sessions.has(sessionId) || state.expireSessionOnce) {
        state.expireSessionOnce = false;
        if (sessionId) state.sessions.delete(sessionId);
        res.statusCode = 404;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: "session not found" }));
        return;
      }
      if (msg.method === "tools/list") {
        reply({ tools: TOOLS });
        return;
      }
      if (msg.method === "tools/call") {
        const name = msg.params?.name ?? "";
        const args = msg.params?.arguments ?? {};
        state.calls.push({ name, args, sessionId });
        switch (name) {
          case "echo":
            reply(envelope({ args }, "echoed **ok**"));
            return;
          case "get_addresses":
          case "get_saved_locations":
            reply(envelope(name === "get_addresses" ? FIXTURES.addresses : { locations: FIXTURES.addresses.addresses.map((a, i) => ({ index: i + 1, ...a })) }));
            return;
          case "search_restaurants":
            reply(envelope(FIXTURES.restaurants, "Found 2 restaurants for biryani"));
            return;
          case "get_restaurant_menu":
            reply(envelope(FIXTURES.menu));
            return;
          case "search_menu":
            reply(envelope(FIXTURES.menuSearch));
            return;
          case "get_food_cart":
          case "update_food_cart":
            reply(envelope(FIXTURES.foodCart));
            return;
          case "get_food_orders":
            reply(envelope(FIXTURES.foodOrders));
            return;
          case "search_products":
          case "your_go_to_items":
            reply(envelope(FIXTURES.products));
            return;
          case "get_cart":
            reply(envelope(imCartPayload()));
            return;
          case "update_cart": {
            const items = Array.isArray(args.items) ? (args.items as Array<{ spinId: string; skuId?: string; quantity: number }>) : [];
            state.imCart = items.map((i) => ({ spinId: String(i.spinId), skuId: i.skuId, quantity: Number(i.quantity) }));
            reply(envelope(imCartPayload(), "Cart updated"));
            return;
          }
          case "get_orders":
            reply(envelope(FIXTURES.imOrders));
            return;
          case "search_restaurants_dineout":
            reply(envelope(FIXTURES.dineoutSearch));
            return;
          case "get_available_slots":
            reply(envelope(FIXTURES.slots));
            return;
          case "create_cart":
            reply(envelope({ cart: { cartKey: "ck_1", cartType: "DEAL_TICKET_PURCHASE", restaurantId: String(args.restaurantId), bill: { billToPay: 500 } }, cartKey: "ck_1", availablePaymentMethods: ["UPI"], paymentOptions: null }));
            return;
          case "book_table":
            if (args.paymentMethod === "UPI") {
              reply(envelope({ orderId: "bk_2", paasId: "paas_b", transactionId: "txn_b", upiIntentUrl: "upi://x", bridgeUrl: "https://pay.example/bridge/b", isQrFlow: true, pollingIntervalInMs: 10, maxTimeToPollForInMs: 200, paymentMethod: "UPI", status: "PENDING_PAYMENT", isDineout: true, restaurantName: "Toit", guestCount: args.guestCount }));
            } else {
              reply(envelope({ orderId: "bk_1", isDineout: true, restaurantId: String(args.restaurantId), restaurantName: "Toit", restaurantLocation: "Indiranagar", reservationDate: "2026-09-06", reservationTime: "7:00 PM", guestCount: args.guestCount, status: "CONFIRMED" }, "Table booked"));
            }
            return;
          case "get_booking_status":
            reply(envelope({ orderId: String(args.orderId), restaurantId: "dr1", restaurantName: "Toit", reservationDate: "2026-09-06", reservationTime: "7:00 PM", guestCount: 2, dealTitle: "Flat 20% off", status: "CONFIRMED", canCancel: true }));
            return;
          case "fail":
            reply(text({ success: false, error: { message: "Invalid addressId: required", reportLink: "https://mcp.swiggy.com/report/abc" } }));
            return;
          case "iserror":
            reply({ isError: true, content: [{ type: "text", text: "boom" }] });
            return;
          case "rate":
            res.statusCode = 429;
            res.setHeader("retry-after", "7");
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ success: false, error: { message: "Too many requests" } }));
            return;
          case "auth":
            rpcError(-32001, "Unauthenticated");
            return;
          case "sse": {
            res.statusCode = 200;
            res.setHeader("content-type", "text/event-stream");
            res.write(`event: message\ndata: {"jsonrpc":"2.0","id":"other","result":{"nope":true}}\n\n`);
            res.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: envelope({ via: "sse" }) })}\n\n`);
            res.end();
            return;
          }
          case "place_food_order":
            if (args.paymentMethod === "UPI") {
              reply(
                envelope(
                  {
                    orderId: "ord_1",
                    paasId: "paas_1",
                    transactionId: "txn_1",
                    upiIntentUrl: "upi://pay?x=1",
                    bridgeUrl: "https://pay.example/bridge/1",
                    isQrFlow: true,
                    pollingIntervalInMs: 10,
                    maxTimeToPollForInMs: 200,
                    paymentMethod: "UPI",
                    status: "PENDING_PAYMENT",
                    normalizedStatus: "pending",
                    totalAmount: 750,
                    addressId: args.addressId,
                    cartId: "cart_1",
                    lat: 12.9,
                    lng: 77.6,
                  },
                  "Complete payment"
                )
              );
            } else {
              reply(envelope({ orderId: "ord_cod", status: "CONFIRMED", normalizedStatus: "success", items: [{ item_id: "m1", name: "Chicken Dum Biryani", quantity: 2, total: 698 }], restaurantName: "Paradise Biryani", restaurantAddress: "Koramangala", totalAmount: 750, estimatedDelivery: "30 mins", deliveryAddress: "12B Sobha Lotus" }, "Swiggy order placed successfully"));
            }
            return;
          case "checkout":
            reply(envelope({ orderId: "im_ord_1", status: "CONFIRMED", paymentMethod: String(args.paymentMethod ?? "Cash"), cartTotal: 81, addressId: args.addressId, deliveryAddress: "12B Sobha Lotus", deliveryLabel: "Home" }, "Instamart order placed successfully"));
            return;
          case "check_payment_status":
            paymentPolls += 1;
            if (paymentPolls < 3) reply(envelope({ paasId: "paas_1", status: "pending", terminal: false, isTerminalSuccess: false, isTerminalFailure: false }));
            else reply(envelope({ paasId: "paas_1", status: "success", terminal: true, isTerminalSuccess: true, isTerminalFailure: false, confirmed: false, orderId: "ord_1" }));
            return;
          case "confirm_order":
            reply(envelope({ orderId: String(args.orderId), orderStatus: "PLACED", result: "success" }, "Swiggy order placed successfully"));
            return;
          case "flush_food_cart":
            reply(envelope({ statusCode: 0, statusMessage: "cart cleared" }));
            return;
          case "get_payment_options":
            reply(envelope({ platforms: { mobile: { groupName: "UPI", methods: [{ id: "gpay://upi/", displayName: "Google Pay", kind: "intent", enabled: true }] }, desktop: { groupName: "UPI", methods: [{ id: "PayWithQR", displayName: "Scan QR", kind: "qr" }] } }, cod: { available: true, id: "Cash", displayName: "Cash on Delivery" }, allMethods: [{ id: "gpay://upi/", displayName: "Google Pay", kind: "intent", groupName: "UPI" }, { id: "PayWithQR", displayName: "Scan QR", kind: "qr", groupName: "UPI" }, { id: "Cash", displayName: "Cash on Delivery", groupName: "Cash" }], paymentAmount: "₹750", addressId: args.addressId, placeOrderToolName: "place_food_order" }));
            return;
          default:
            rpcError(-32602, `Unknown tool: ${name}`);
            return;
        }
      }
      rpcError(-32601, `Method not found: ${msg.method}`);
    });
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/food`,
    state,
    server,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
