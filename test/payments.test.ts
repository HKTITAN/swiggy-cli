import { describe, it, expect } from "vitest";
import {
  classifyPaymentStatus,
  confirmArgs,
  isPendingPayment,
  parsePayFlag,
  paymentArgs,
  paymentOutcomeError,
  paymentStatusArgs,
  toPendingPayment,
  waitForPayment,
  type PendingPayment,
} from "../src/lib/payments.js";

describe("--pay flag", () => {
  it("maps cash/cod, upi, upi:<app>, swiggypay and arbitrary groups", () => {
    expect(paymentArgs(parsePayFlag("cash"))).toEqual({ paymentMethod: "Cash" });
    expect(paymentArgs(parsePayFlag("COD"))).toEqual({ paymentMethod: "Cash" });
    expect(paymentArgs(parsePayFlag("upi"))).toEqual({ paymentMethod: "UPI", generateUPIQR: true });
    expect(paymentArgs(parsePayFlag("upi:gpay://upi/"))).toEqual({ paymentMethod: "UPI", intentApp: "gpay://upi/" });
    expect(paymentArgs(parsePayFlag("swiggypay"))).toEqual({ paymentMethod: "SwiggyPay" });
    expect(paymentArgs(parsePayFlag("swiggy-money"))).toEqual({ paymentMethod: "SwiggyPay" });
    expect(paymentArgs(parsePayFlag("SomeNewGroup"))).toEqual({ paymentMethod: "SomeNewGroup" });
    expect(paymentArgs(undefined)).toEqual({});
  });

  it("rejects an empty intent app", () => {
    expect(() => parsePayFlag("upi:")).toThrow(/intentApp/);
  });
});

const pendingFood: PendingPayment = {
  orderId: "ord_1",
  paasId: "paas_1",
  transactionId: "txn_1",
  bridgeUrl: "https://pay/1",
  pollingIntervalInMs: 5,
  maxTimeToPollForInMs: 50,
  status: "PENDING_PAYMENT",
  addressId: "addr_1",
  cartId: "cart_1",
  lat: 12.9,
  lng: 77.6,
};

describe("pending payment detection", () => {
  it("recognises PENDING_PAYMENT responses and extracts context", () => {
    const data = { orderId: "o", paasId: "p", status: "PENDING_PAYMENT", pollingIntervalInMs: "1000", maxTimeToPollForInMs: 9000, bridgeUrl: "https://b", lat: 1, lng: 2, addressId: "a" };
    expect(isPendingPayment(data)).toBe(true);
    const p = toPendingPayment(data)!;
    expect(p.pollingIntervalInMs).toBe(1000);
    expect(p.maxTimeToPollForInMs).toBe(9000);
    expect(p.lat).toBe(1);
    expect(p.addressId).toBe("a");
  });

  it("treats COD placement as not pending", () => {
    expect(isPendingPayment({ orderId: "o", status: "CONFIRMED", normalizedStatus: "success" })).toBe(false);
    expect(toPendingPayment({ orderId: "o", status: "CONFIRMED" })).toBeUndefined();
  });
});

describe("per-server confirm contract", () => {
  it("Food: orderId + addressId + lat + lng (+cartId), never paasId", () => {
    const a = confirmArgs("food", pendingFood);
    expect(a).toEqual({ orderId: "ord_1", addressId: "addr_1", cartId: "cart_1", lat: 12.9, lng: 77.6 });
    expect(a).not.toHaveProperty("paasId");
  });
  it("Instamart/Dineout: orderId + paasId (+transactionId)", () => {
    expect(confirmArgs("instamart", pendingFood)).toEqual({ orderId: "ord_1", paasId: "paas_1", transactionId: "txn_1" });
    expect(confirmArgs("dineout", pendingFood)).toEqual({ orderId: "ord_1", paasId: "paas_1", transactionId: "txn_1" });
  });
  it("check_payment_status echoes Food context only for Food", () => {
    expect(paymentStatusArgs("food", pendingFood)).toMatchObject({ paasId: "paas_1", orderId: "ord_1", addressId: "addr_1", lat: 12.9, lng: 77.6 });
    expect(paymentStatusArgs("instamart", pendingFood)).toEqual({ paasId: "paas_1", orderId: "ord_1" });
  });
});

describe("status classification", () => {
  it("uses terminal flags and status strings", () => {
    expect(classifyPaymentStatus({ status: "pending", terminal: false }).class).toBe("pending");
    expect(classifyPaymentStatus({ status: "success", terminal: true, isTerminalSuccess: true }).class).toBe("success");
    expect(classifyPaymentStatus({ status: "paid" }).class).toBe("success");
    expect(classifyPaymentStatus({ status: "FAILED", isTerminalFailure: true }).class).toBe("failed");
    expect(classifyPaymentStatus({ status: "refund-initiated" }).class).toBe("refund_initiated");
    expect(classifyPaymentStatus({ status: "cart_changed" }).class).toBe("cart_changed");
    expect(classifyPaymentStatus({ status: "cancelled" }).class).toBe("cancelled");
    expect(classifyPaymentStatus({ status: "pending" }).terminal).toBe(false);
    expect(classifyPaymentStatus({ status: "success" }).terminal).toBe(true);
  });
});

describe("waitForPayment", () => {
  // Deterministic clock: sleeping advances virtual time so the cap logic is exercised without real waits.
  const clock = () => {
    let t = 0;
    return { sleep: async (ms: number) => void (t += ms), now: () => t, intervalMs: 100, maxWaitMs: 10_000 };
  };

  it("polls on the cadence, confirms on success when not already confirmed", async () => {
    let n = 0;
    const confirms: number[] = [];
    const out = await waitForPayment(
      pendingFood,
      async () => (++n < 3 ? { status: "pending", terminal: false } : { status: "success", terminal: true, isTerminalSuccess: true, confirmed: false }),
      async () => (confirms.push(1), { status: "PLACED" }),
      clock()
    );
    expect(out.outcome).toBe("confirmed");
    expect(out.attempts).toBe(3);
    expect(confirms.length).toBe(1);
  });

  it("does not call confirm when the server already confirmed", async () => {
    let confirmed = 0;
    const out = await waitForPayment(pendingFood, async () => ({ status: "success", terminal: true, confirmed: true }), async () => (confirmed++, {}), clock());
    expect(out.outcome).toBe("confirmed");
    expect(confirmed).toBe(0);
  });

  it("never confirms after a terminal failure", async () => {
    let confirmed = 0;
    const out = await waitForPayment(pendingFood, async () => ({ status: "failed", terminal: true, isTerminalFailure: true }), async () => (confirmed++, {}), clock());
    expect(out.outcome).toBe("failed");
    expect(confirmed).toBe(0);
    const err = paymentOutcomeError(out, "food");
    expect(err.code).toBe("PAYMENT_FAILED");
    expect(err.hint).toMatch(/payment-options/);
  });

  it("confirms exactly once at the cap while still pending, honouring the server-provided window", async () => {
    let t = 0;
    let checks = 0;
    let confirmed = 0;
    const out = await waitForPayment(
      { ...pendingFood, pollingIntervalInMs: 1000, maxTimeToPollForInMs: 3500 },
      async () => (checks++, { status: "pending", terminal: false }),
      async () => (confirmed++, {}),
      { sleep: async (ms) => void (t += ms), now: () => t }
    );
    expect(out.outcome).toBe("timeout");
    expect(confirmed).toBe(1);
    expect(checks).toBe(4); // t=0, 1000, 2000, 3000; a 5th at 4000 would exceed the 3500ms cap
  });
});
