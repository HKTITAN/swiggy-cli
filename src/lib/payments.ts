import { PaymentFailedError, UsageError } from "./errors.js";
import type { ServerName } from "../types/index.js";

/**
 * Shared Payment stage for Swiggy MCP (Food, Instamart, Dineout).
 *
 * Source: https://mcp.swiggy.com/builders/docs/build/recipes/pay-with-upi/ (headless flow) and the
 * per-tool reference for get_payment_options / check_payment_status / confirm_order.
 *
 *   get_payment_options → place-order (paymentMethod + intentApp | generateUPIQR)
 *     → PENDING_PAYMENT { paasId, orderId, bridgeUrl, pollingIntervalInMs, maxTimeToPollForInMs }
 *     → check_payment_status (long-poll, ~19s server hold; never tight-loop)
 *     → confirm_order (Food: orderId+addressId+lat+lng; Instamart/Dineout: orderId+paasId)
 *
 * Cash/COD has no payment leg. "SwiggyPay" (Swiggy Money, announced for MCP on 2026-09-04) is a
 * payment-method GROUP the server may return from get_payment_options; the CLI passes any group
 * name through verbatim and never invents one.
 */

export type PayChoice =
  | { kind: "cash" }
  | { kind: "upi-qr" }
  | { kind: "upi-intent"; intentApp: string }
  | { kind: "method"; paymentMethod: string };

/**
 * Parse the `--pay` flag.
 *   cash | cod            → Cash on delivery (no payment leg)
 *   upi | qr              → UPI via a scan-or-tap link (bridgeUrl); works headless on any device
 *   upi:<intentApp>       → UPI app intent, id copied verbatim from get_payment_options
 *   swiggypay | <Group>   → any other payment-method group returned by get_payment_options
 */
export function parsePayFlag(raw: string | undefined): PayChoice | undefined {
  if (raw === undefined || raw === "") return undefined;
  const v = raw.trim();
  const lower = v.toLowerCase();
  if (lower === "cash" || lower === "cod") return { kind: "cash" };
  if (lower === "upi" || lower === "qr" || lower === "upi:qr") return { kind: "upi-qr" };
  if (lower.startsWith("upi:")) {
    const intentApp = v.slice(4).trim();
    if (!intentApp) throw new UsageError("--pay upi:<intentApp> needs the UPI app id from payment-options.");
    return { kind: "upi-intent", intentApp };
  }
  if (lower === "swiggypay" || lower === "swiggy-money" || lower === "swiggymoney") return { kind: "method", paymentMethod: "SwiggyPay" };
  return { kind: "method", paymentMethod: v };
}

/** Arguments to merge into the place-order tool call for a given choice. */
export function paymentArgs(choice: PayChoice | undefined): Record<string, unknown> {
  if (!choice) return {};
  switch (choice.kind) {
    case "cash":
      return { paymentMethod: "Cash" };
    case "upi-qr":
      return { paymentMethod: "UPI", generateUPIQR: true };
    case "upi-intent":
      return { paymentMethod: "UPI", intentApp: choice.intentApp };
    case "method":
      return { paymentMethod: choice.paymentMethod };
  }
}

export interface PendingPayment {
  orderId: string;
  paasId: string;
  transactionId?: string;
  bridgeUrl?: string;
  upiIntentUrl?: string;
  isQrFlow?: boolean;
  pollingIntervalInMs: number;
  maxTimeToPollForInMs: number;
  status: string;
  // Food confirmation context (echoed back into check_payment_status / confirm_order)
  addressId?: string;
  cartId?: string | null;
  lat?: number;
  lng?: number;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/** True when a place-order response says the order is waiting for payment. */
export function isPendingPayment(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return d.status === "PENDING_PAYMENT" || d.normalizedStatus === "pending" || (typeof d.paasId === "string" && Boolean(d.bridgeUrl));
}

/** Extract the pending-payment context from a place-order response. */
export function toPendingPayment(data: unknown, fallback: { addressId?: string } = {}): PendingPayment | undefined {
  if (!isPendingPayment(data)) return undefined;
  const d = data as Record<string, unknown>;
  const orderId = typeof d.orderId === "string" ? d.orderId : undefined;
  const paasId = typeof d.paasId === "string" ? d.paasId : undefined;
  if (!orderId || !paasId) return undefined;
  return {
    orderId,
    paasId,
    transactionId: typeof d.transactionId === "string" ? d.transactionId : undefined,
    bridgeUrl: typeof d.bridgeUrl === "string" ? d.bridgeUrl : undefined,
    upiIntentUrl: typeof d.upiIntentUrl === "string" ? d.upiIntentUrl : undefined,
    isQrFlow: typeof d.isQrFlow === "boolean" ? d.isQrFlow : undefined,
    pollingIntervalInMs: num(d.pollingIntervalInMs) ?? 20_000,
    maxTimeToPollForInMs: num(d.maxTimeToPollForInMs) ?? 5 * 60_000,
    status: String(d.status ?? "PENDING_PAYMENT"),
    addressId: typeof d.addressId === "string" ? d.addressId : fallback.addressId,
    cartId: typeof d.cartId === "string" ? d.cartId : undefined,
    lat: num(d.lat),
    lng: num(d.lng),
  };
}

/** Arguments for `check_payment_status`. Food must echo addressId/lat/lng or the order stays pending. */
export function paymentStatusArgs(server: ServerName, p: PendingPayment): Record<string, unknown> {
  const args: Record<string, unknown> = { paasId: p.paasId, orderId: p.orderId };
  if (server === "food") {
    if (p.addressId) args.addressId = p.addressId;
    if (p.cartId) args.cartId = p.cartId;
    if (p.lat !== undefined) args.lat = p.lat;
    if (p.lng !== undefined) args.lng = p.lng;
  }
  return args;
}

/** Arguments for `confirm_order` — the contract differs per server. */
export function confirmArgs(server: ServerName, p: PendingPayment): Record<string, unknown> {
  if (server === "food") {
    const args: Record<string, unknown> = { orderId: p.orderId };
    if (p.addressId) args.addressId = p.addressId;
    if (p.cartId) args.cartId = p.cartId;
    if (p.lat !== undefined) args.lat = p.lat;
    if (p.lng !== undefined) args.lng = p.lng;
    return args;
  }
  const args: Record<string, unknown> = { orderId: p.orderId, paasId: p.paasId };
  if (p.transactionId) args.transactionId = p.transactionId;
  return args;
}

export type PaymentStatusClass = "success" | "failed" | "cancelled" | "cart_changed" | "refund_initiated" | "pending";

export interface PaymentStatus {
  status: string;
  class: PaymentStatusClass;
  terminal: boolean;
  confirmed?: boolean;
  raw: unknown;
}

/** Classify a `check_payment_status` payload using its terminal flags and status string. */
export function classifyPaymentStatus(data: unknown): PaymentStatus {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const status = String(d.status ?? d.orderStatus ?? "pending");
  const s = status.toLowerCase().replace(/[\s-]+/g, "_");
  let cls: PaymentStatusClass = "pending";
  if (d.isTerminalSuccess === true || s === "success" || s === "paid" || s === "placed" || s === "confirmed") cls = "success";
  else if (s.includes("refund")) cls = "refund_initiated";
  else if (s === "cancelled" || s === "canceled") cls = "cancelled";
  else if (s === "cart_changed") cls = "cart_changed";
  else if (d.isTerminalFailure === true || s === "failed" || s === "failure") cls = "failed";
  const terminal = d.terminal === true || cls !== "pending";
  return { status, class: cls, terminal, confirmed: typeof d.confirmed === "boolean" ? d.confirmed : undefined, raw: data };
}

export interface WaitOptions {
  /** Called before each poll and after each status. */
  onTick?: (info: { attempt: number; elapsedMs: number; status?: PaymentStatus }) => void;
  /** Override the server-provided cap (ms). */
  maxWaitMs?: number;
  /** Override the server-provided interval (ms). */
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface PaymentOutcome {
  outcome: "confirmed" | "failed" | "cancelled" | "cart_changed" | "refund_initiated" | "timeout";
  status?: PaymentStatus;
  confirmResult?: unknown;
  attempts: number;
  elapsedMs: number;
}

/**
 * Drive the headless poll loop: call `check` on the server-provided cadence until a terminal status
 * or the cap, then `confirm` on success (if not already confirmed) or once at the cap while pending.
 * Never tight-loops — `check_payment_status` is a long-poll and hammering it stresses the payment cache.
 */
export async function waitForPayment(
  pending: PendingPayment,
  check: () => Promise<unknown>,
  confirm: () => Promise<unknown>,
  opts: WaitOptions = {}
): Promise<PaymentOutcome> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? (() => Date.now());
  // Server-provided cadence is floored at 1s (check_payment_status is a ~19s long-poll and
  // hammering it stresses the payment cache); an explicit override may go as low as 50ms.
  const interval = opts.intervalMs !== undefined ? Math.max(50, opts.intervalMs) : Math.max(1000, pending.pollingIntervalInMs);
  const cap = Math.max(interval, opts.maxWaitMs ?? pending.maxTimeToPollForInMs);
  const start = now();
  let attempt = 0;
  let last: PaymentStatus | undefined;

  while (true) {
    attempt += 1;
    opts.onTick?.({ attempt, elapsedMs: now() - start });
    last = classifyPaymentStatus(await check());
    opts.onTick?.({ attempt, elapsedMs: now() - start, status: last });
    if (last.terminal) break;
    if (now() - start + interval > cap) break;
    await sleep(interval);
  }

  const elapsedMs = now() - start;
  if (last.class === "success") {
    const confirmResult = last.confirmed ? undefined : await confirm();
    return { outcome: "confirmed", status: last, confirmResult, attempts: attempt, elapsedMs };
  }
  if (last.class === "pending") {
    // Cap reached: finalize once. The backend marks it failed if payment is still non-terminal;
    // a late success reconciles server-side.
    const confirmResult = await confirm();
    return { outcome: "timeout", status: last, confirmResult, attempts: attempt, elapsedMs };
  }
  return { outcome: last.class, status: last, attempts: attempt, elapsedMs };
}

/** Turn a non-success outcome into the CLI's PAYMENT_FAILED error (exit 10). */
export function paymentOutcomeError(outcome: PaymentOutcome, server: ServerName): PaymentFailedError {
  const hints: Record<PaymentOutcome["outcome"], string> = {
    confirmed: "",
    failed: `Payment failed. Re-run: swiggy ${server} payment-options, then place the order again (fresh transaction on the same cart).`,
    cancelled: "The order was cancelled. If money was debited a refund is on its way; do not retry automatically.",
    cart_changed: "Cart price or stock changed, so the order was NOT placed. Review the cart, then place again.",
    refund_initiated: "A refund is already underway. Do not retry.",
    timeout: "Timed out while payment was still pending; confirm_order was called once to finalize. A late payment success reconciles server-side — check the order status before retrying.",
  };
  return new PaymentFailedError(`Payment ${outcome.outcome.replace("_", " ")} (status: ${outcome.status?.status ?? "unknown"}).`, outcome, hints[outcome.outcome]);
}
