import type { Command } from "commander";
import type { EnvelopeMeta, ServerName } from "../types/index.js";
import { attachOutputOptions, buildArgs, invokeTool, num, readGlobalOpts, renderOutcome, requireFlag, run, type ExecOpts, type ToolOutcome } from "./common.js";
import { SERVER_DOMAIN } from "../lib/config.js";
import { PLACE_ORDER_TOOL } from "../lib/aliases.js";
import { dim, note, ok, renderResult, startSpinner, warn } from "../lib/output.js";
import { link } from "../lib/ui.js";
import { fmtDuration } from "../lib/term.js";
import {
  confirmArgs,
  parsePayFlag,
  paymentArgs,
  paymentOutcomeError,
  paymentStatusArgs,
  toPendingPayment,
  waitForPayment,
  type PayChoice,
  type PendingPayment,
} from "../lib/payments.js";
import { UsageError } from "../lib/errors.js";

/**
 * Shared Payment stage commands, attached to every server:
 *   payment-options · payment-status [--wait] · confirm-order · report-error
 * plus `placeOrderWithPayment`, the orchestration used by food checkout / instamart checkout /
 * dineout book when `--pay` is given.
 */

export interface PayFlags {
  pay?: string;
  wait?: boolean;
  intervalMs?: string;
  maxWaitMs?: string;
}

export function attachPayFlags(cmd: Command): Command {
  return cmd
    .option("--pay <method>", "cash | upi (scan-or-tap link) | upi:<intentApp> | swiggypay | <method group from payment-options>")
    .option("--wait", "for UPI: poll payment status on Swiggy's cadence and confirm the order (blocks until terminal or cap)")
    .option("--interval-ms <ms>", "override the poll interval Swiggy returns (min 1000)")
    .option("--max-wait-ms <ms>", "override the poll cap Swiggy returns");
}

/** Describe what the CLI is about to do so the confirmation prompt is unambiguous. */
export function describeOrder(server: ServerName, choice: PayChoice | undefined): string {
  const method =
    !choice ? "the server's default payment method"
    : choice.kind === "cash" ? "Cash on Delivery"
    : choice.kind === "upi-qr" ? "UPI (scan-or-tap link)"
    : choice.kind === "upi-intent" ? `UPI app ${choice.intentApp}`
    : choice.paymentMethod;
  const what = server === "dineout" ? "Book this table" : server === "instamart" ? "Place this Instamart order" : "Place this food order";
  return `${what} and pay with ${method}`;
}

/**
 * Place an order (food/instamart/dineout) and, for UPI, optionally drive the headless payment flow:
 * share bridgeUrl → poll check_payment_status → confirm_order.
 */
export async function placeOrderWithPayment(
  server: ServerName,
  baseArgs: Record<string, unknown>,
  flags: PayFlags,
  opts: ExecOpts,
  fallback: { addressId?: string } = {}
): Promise<void> {
  const tool = PLACE_ORDER_TOOL[server];
  const choice = parsePayFlag(flags.pay);
  const args = { ...baseArgs, ...paymentArgs(choice) };
  await run(
    opts,
    async () => {
      const placed = await invokeTool(server, tool, args, opts, describeOrder(server, choice));
      const pending = toPendingPayment(placed.data, fallback);
      if (!pending) {
        await renderOutcome(server, tool, placed, opts, undefined, { payment: { pending: false } });
        return;
      }
      const payUrl = pending.bridgeUrl ?? pending.upiIntentUrl;
      if (!flags.wait) {
        const next = `swiggy ${server} payment-status --paas-id ${pending.paasId} --order-id ${pending.orderId}${
          server === "food" ? ` --address-id ${pending.addressId ?? "<id>"} --lat ${pending.lat ?? "<lat>"} --lng ${pending.lng ?? "<lng>"}` : ""
        } --wait`;
        if (payUrl) {
          note("", opts);
          note(`${warn("Payment pending.", opts)} Pay here — scan on desktop, tap on mobile:`, opts);
          note(`  ${link(payUrl, undefined, opts)}`, opts);
          note(dim(`then: ${next}`, opts), opts);
        }
        await renderOutcome(server, tool, placed, opts, undefined, { payment: { pending: true, bridgeUrl: payUrl, next } });
        return;
      }
      const outcome = await drivePayment(server, pending, opts, flags, payUrl);
      const meta: EnvelopeMeta = { payment: { pending: false, ...outcome } };
      if (outcome.outcome !== "confirmed") {
        await renderOutcome(server, tool, placed, opts, undefined, meta);
        throw paymentOutcomeError(outcome, server);
      }
      await renderOutcome(server, tool, { ...placed, data: mergeConfirmed(placed.data, outcome) }, opts, undefined, meta);
    },
    { server, tool }
  );
}

function mergeConfirmed(data: unknown, outcome: Awaited<ReturnType<typeof drivePayment>>): unknown {
  if (!data || typeof data !== "object") return data;
  return { ...(data as Record<string, unknown>), status: "PLACED", normalizedStatus: "success", paymentStatus: outcome.status?.status, confirmed: true };
}

async function drivePayment(server: ServerName, pending: PendingPayment, opts: ExecOpts, flags: PayFlags, payUrl?: string) {
  if (payUrl) {
    note("", opts);
    note(`${warn("Complete the payment now.", opts)} Scan on desktop, tap on mobile:`, opts);
    note(`  ${link(payUrl, undefined, opts)}`, opts);
    note(dim(`waiting up to ${fmtDuration(num(flags.maxWaitMs, "--max-wait-ms") ?? pending.maxTimeToPollForInMs)} · Ctrl+C stops polling (the order stays pending upstream)`, opts), opts);
    note("", opts);
  }
  const sp = startSpinner("waiting for payment", opts);
  const outcome = await waitForPayment(
    pending,
    async () => (await invokeToolQuiet(server, "check_payment_status", paymentStatusArgs(server, pending), opts)).data,
    async () => (await invokeToolQuiet(server, "confirm_order", confirmArgs(server, pending), opts)).data,
    {
      intervalMs: num(flags.intervalMs, "--interval-ms"),
      maxWaitMs: num(flags.maxWaitMs, "--max-wait-ms"),
      onTick: ({ attempt, status }) => sp.update(status ? `payment ${status.status} · check #${attempt}` : `checking payment · #${attempt}`),
    }
  );
  if (outcome.outcome === "confirmed") sp.succeed(ok("payment confirmed", opts));
  else sp.fail(`payment ${outcome.outcome.replace("_", " ")}`);
  return outcome;
}

/** invokeTool without the per-call spinner (the poll loop owns the status line). */
async function invokeToolQuiet(server: ServerName, tool: string, args: unknown, opts: ExecOpts): Promise<ToolOutcome> {
  return invokeTool(server, tool, args, { ...opts, quiet: true });
}

export function attachPaymentCommands(server: ServerName, parent: Command): void {
  attachOutputOptions(
    parent
      .command("payment-options")
      .description("Live payment methods for the current cart (UPI apps, scan-QR, Cash, SwiggyPay when offered)")
      .option("--address-id <id>", "Food only: the addressId used for the cart (recommended for UPI)")
      .action(async (o: { addressId?: string }) => {
        const opts = readGlobalOpts(parent);
        await run(opts, async () => {
          const out = await invokeTool(server, "get_payment_options", server === "food" ? compactArgs({ addressId: o.addressId }) : {}, opts);
          await renderOutcome(server, "get_payment_options", out, opts, (data, ctx) => renderPaymentOptions(server, data, ctx));
        });
      })
  );

  attachOutputOptions(
    parent
      .command("payment-status")
      .description("Check an in-flight UPI payment once, or --wait to poll on Swiggy's cadence and confirm the order")
      .requiredOption("--paas-id <id>", "payment transaction id (paasId) from the place-order response")
      .option("--order-id <id>", "orderId from the place-order response")
      .option("--address-id <id>", "Food only: echo from place_food_order (required for auto-confirm)")
      .option("--cart-id <id>", "Food only: echo from place_food_order")
      .option("--lat <lat>", "Food only: echo from place_food_order")
      .option("--lng <lng>", "Food only: echo from place_food_order")
      .option("--wait", "poll until terminal (or cap), then confirm on success")
      .option("--interval-ms <ms>", "poll interval (default 20000)")
      .option("--max-wait-ms <ms>", "poll cap (default 300000)")
      .action(async (o: { paasId: string; orderId?: string; addressId?: string; cartId?: string; lat?: string; lng?: string; wait?: boolean; intervalMs?: string; maxWaitMs?: string }) => {
        const opts = readGlobalOpts(parent);
        await run(
          opts,
          async () => {
            const pending: PendingPayment = {
              paasId: o.paasId,
              orderId: o.orderId ?? "",
              addressId: o.addressId,
              cartId: o.cartId,
              lat: num(o.lat, "--lat"),
              lng: num(o.lng, "--lng"),
              pollingIntervalInMs: num(o.intervalMs, "--interval-ms") ?? 20_000,
              maxTimeToPollForInMs: num(o.maxWaitMs, "--max-wait-ms") ?? 300_000,
              status: "PENDING_PAYMENT",
            };
            if (server === "food" && o.wait && (!o.addressId || pending.lat === undefined || pending.lng === undefined)) {
              throw new UsageError("Food payment-status --wait needs --address-id, --lat and --lng (echo them from the place_food_order response).");
            }
            if (!o.wait) {
              const out = await invokeTool(server, "check_payment_status", paymentStatusArgs(server, pending), opts);
              await renderOutcome(server, "check_payment_status", out, opts);
              return;
            }
            const outcome = await drivePayment(server, pending, opts, { wait: true, intervalMs: o.intervalMs, maxWaitMs: o.maxWaitMs });
            const ctx = { ...opts, server, tool: "check_payment_status", meta: { payment: outcome } };
            if (outcome.outcome !== "confirmed") {
              renderResult(outcome.status?.raw ?? null, ctx);
              throw paymentOutcomeError(outcome, server);
            }
            renderResult({ ...(outcome.status?.raw as object), confirmed: true, confirmResult: outcome.confirmResult }, ctx);
          },
          { server, tool: "check_payment_status" }
        );
      })
  );

  attachOutputOptions(
    parent
      .command("confirm-order")
      .description("Finalize a PENDING_PAYMENT order after payment succeeded (idempotent)")
      .requiredOption("--order-id <id>", "orderId from the place-order response")
      .option("--paas-id <id>", "Instamart/Dineout: paasId from the place-order response")
      .option("--transaction-id <id>", "Instamart/Dineout: transactionId from the place-order response")
      .option("--address-id <id>", "Food: addressId echoed from place_food_order (required)")
      .option("--cart-id <id>", "Food: cartId echoed from place_food_order")
      .option("--lat <lat>", "Food: lat echoed from place_food_order (required)")
      .option("--lng <lng>", "Food: lng echoed from place_food_order (required)")
      .option("--input <json>", "raw arguments JSON (merged over flags)")
      .action(async (o: { orderId: string; paasId?: string; transactionId?: string; addressId?: string; cartId?: string; lat?: string; lng?: string; input?: string }) => {
        const opts = readGlobalOpts(parent);
        await run(opts, async () => {
          const args = await buildArgs(
            server === "food"
              ? { orderId: o.orderId, addressId: o.addressId, cartId: o.cartId, lat: num(o.lat, "--lat"), lng: num(o.lng, "--lng") }
              : { orderId: o.orderId, paasId: o.paasId, transactionId: o.transactionId },
            o.input
          );
          if (server === "food" && !o.input) {
            requireFlag(o.addressId, "--address-id", "Food confirm_order needs orderId + addressId + lat + lng");
            requireFlag(o.lat, "--lat");
            requireFlag(o.lng, "--lng");
          }
          if (server !== "food" && !o.input) requireFlag(o.paasId, "--paas-id", "Instamart/Dineout confirm_order needs orderId + paasId");
          const out = await invokeTool(server, "confirm_order", args, opts);
          await renderOutcome(server, "confirm_order", out, opts);
        });
      })
  );

  attachOutputOptions(
    parent
      .command("report-error")
      .description("Send a diagnostic report to the Swiggy MCP team (returns a shareable link)")
      .requiredOption("--tool <name>", "tool that errored, e.g. checkout")
      .requiredOption("--message <text>", "the error message you saw")
      .option("--flow <text>", "what you were doing, e.g. 'searched milk → add to cart → checkout failed'")
      .option("--context <json>", "identifiers from the failed call as JSON (orderId, addressId, ...)")
      .option("--notes <text>", "anything else")
      .action(async (o: { tool: string; message: string; flow?: string; context?: string; notes?: string }) => {
        const opts = readGlobalOpts(parent);
        await run(opts, async () => {
          const args = await buildArgs(
            { tool: o.tool, domain: SERVER_DOMAIN[server], errorMessage: o.message, flowDescription: o.flow, userNotes: o.notes },
            undefined
          );
          if (o.context) args.toolContext = await buildArgs({}, o.context);
          const out = await invokeTool(server, "report_error", args, opts);
          await renderOutcome(server, "report_error", out, opts);
        });
      })
  );
}

function compactArgs(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") out[k] = v;
  return out;
}

/** Human view of get_payment_options: a flat list agents and people can pick from. */
function renderPaymentOptions(server: ServerName, data: unknown, ctx: ExecOpts): void {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const all = Array.isArray(d.allMethods) ? (d.allMethods as Array<Record<string, unknown>>) : [];
  const lines: string[] = [];
  const placeCmd = server === "food" ? "food checkout" : server === "instamart" ? "instamart checkout" : "dineout book";
  if (d.paymentAmount) lines.push(`amount: ${String(d.paymentAmount)}`);
  if (all.length === 0 && !d.cod) lines.push("No payment methods returned for this cart.");
  for (const m of all) {
    const id = String(m.id ?? "");
    const name = String(m.displayName ?? m.groupName ?? id);
    const kind = m.kind === "qr" ? "scan-QR" : m.kind === "intent" ? "UPI app" : String(m.groupName ?? "");
    const flag = m.kind === "qr" ? "--pay upi" : m.kind === "intent" ? `--pay upi:${id}` : /cash|cod/i.test(id) ? "--pay cash" : `--pay ${String(m.groupName ?? id)}`;
    lines.push(`• ${name}${kind ? dim(`  ${kind}`, ctx) : ""}${m.enabled === false ? dim("  (disabled)", ctx) : ""}  ${dim(`→ swiggy ${placeCmd} ${flag}`, ctx)}`);
  }
  const cod = d.cod as Record<string, unknown> | undefined;
  if (cod && cod.available && !all.some((m) => /cash|cod/i.test(String(m.id ?? "")))) {
    lines.push(`• ${String(cod.displayName ?? "Cash on Delivery")}  ${dim(`→ swiggy ${placeCmd} --pay cash`, ctx)}`);
  }
  process.stdout.write(lines.join("\n") + "\n");
}
