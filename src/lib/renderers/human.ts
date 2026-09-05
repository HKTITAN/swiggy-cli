import type { CliEnvelope } from "../../types/index.js";
import { shouldUseColor } from "../tty.js";
import { loadTable } from "../lazy.js";
import { PALETTE, paint, renderMarkdown } from "../ui.js";

interface HumanCtx {
  json?: boolean;
  plain?: boolean;
  quiet?: boolean;
  noInteractive?: boolean;
  interactive?: boolean;
  server?: string;
  tool?: string;
}

/** Keys that usually hold "the list" inside a Swiggy payload, in priority order. */
export const LIST_KEYS = [
  "restaurants",
  "items",
  "products",
  "similarProducts",
  "addresses",
  "locations",
  "orders",
  "slots",
  "coupons",
  "allMethods",
  "tools",
  "checks",
  "servers",
  "results",
  "data",
];

/** Preferred column order for tables; anything else follows in payload order. */
const COLUMN_PRIORITY = [
  "index",
  "id",
  "name",
  "displayName",
  "itemName",
  "title",
  "orderId",
  "restaurantId",
  "spinId",
  "menu_item_id",
  "addressLine",
  "address",
  "displayTime",
  "status",
  "rating",
  "avgRating",
  "costForTwo",
  "price",
  "quantity",
  "total",
  "cuisine",
  "locality",
  "area",
  "brand",
  "inStock",
  "isFree",
];

const MAX_COLUMNS = 8;
const MAX_CELL = 48;

/** Pull out the most useful array-of-objects from a payload, if any. */
export function pickList(data: unknown): { key?: string; rows: Record<string, unknown>[] } | undefined {
  if (Array.isArray(data)) return isObjectList(data) ? { rows: data as Record<string, unknown>[] } : undefined;
  if (!data || typeof data !== "object") return undefined;
  const rec = data as Record<string, unknown>;
  for (const k of LIST_KEYS) {
    const v = rec[k];
    if (Array.isArray(v) && isObjectList(v)) return { key: k, rows: v as Record<string, unknown>[] };
    if (k === "data" && v && typeof v === "object" && !Array.isArray(v)) {
      const nested = pickList(v);
      if (nested) return { key: nested.key ? `data.${nested.key}` : "data", rows: nested.rows };
    }
  }
  for (const [k, v] of Object.entries(rec)) {
    if (Array.isArray(v) && v.length > 0 && isObjectList(v)) return { key: k, rows: v as Record<string, unknown>[] };
  }
  return undefined;
}

function isObjectList(v: unknown[]): boolean {
  return v.length > 0 && v.every((x) => x && typeof x === "object" && !Array.isArray(x));
}

export function chooseColumns(rows: Record<string, unknown>[]): string[] {
  const all = new Set<string>();
  for (const r of rows) Object.keys(r).forEach((k) => all.add(k));
  const scalarish = Array.from(all).filter((k) => rows.some((r) => isScalar(r[k]) || isShortObject(r[k])));
  const prioritized = COLUMN_PRIORITY.filter((k) => scalarish.includes(k));
  const rest = scalarish.filter((k) => !prioritized.includes(k));
  return [...prioritized, ...rest].slice(0, MAX_COLUMNS);
}

function isScalar(v: unknown): boolean {
  return v === null || v === undefined || ["string", "number", "boolean"].includes(typeof v);
}

function isShortObject(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  return JSON.stringify(v).length <= MAX_CELL;
}

/** Generic human renderer: table for lists, key/value block for objects, string for scalars. */
export function renderHuman<T>(envelope: CliEnvelope<T>, ctx: HumanCtx): void {
  if (!envelope.ok) return; // errors handled by renderError
  const data = envelope.data as unknown;
  const colored = shouldUseColor(ctx);
  const out: string[] = [];

  if (envelope.tool && envelope.server) out.push(paint(PALETTE.orange, `${envelope.server} › ${envelope.tool}`, ctx, true));
  if (envelope.meta?.message && typeof envelope.meta.message === "string") out.push(renderMarkdown(envelope.meta.message.trim(), ctx));

  const list = pickList(data);
  if (list) {
    const headers = chooseColumns(list.rows);
    const t = table({ head: headers.map((h) => paint(PALETTE.orange, h, ctx)) });
    for (const row of list.rows) t.push(headers.map((h) => fmt(row[h])));
    if (list.key) out.push(paint(PALETTE.muted, `${list.key} (${list.rows.length})`, ctx));
    out.push(t.toString());
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const rest = Object.entries(data as Record<string, unknown>).filter(
        ([k, v]) => k !== list.key?.split(".")[0] && (isScalar(v) || isShortObject(v))
      );
      if (rest.length) out.push(kv(rest, colored));
    }
    process.stdout.write(out.join("\n") + "\n");
    return;
  }

  if (typeof data === "object" && data !== null) {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length) out.push(kv(entries, colored));
    process.stdout.write(out.join("\n") + "\n");
    return;
  }

  out.push(typeof data === "string" ? renderMarkdown(data, ctx) : String(data));
  process.stdout.write(out.join("\n") + "\n");
}

function table(opts: { head?: string[]; colWidths?: number[] }) {
  const Table = loadTable();
  return new Table({ ...opts, style: { head: [], border: [] }, wordWrap: true });
}

function kv(entries: Array<[string, unknown]>, colored: boolean): string {
  const t = table({ colWidths: [28, 90] });
  for (const [k, v] of entries) t.push([colored ? `\u001b[1m${k}\u001b[22m` : k, fmt(v, 88)]);
  return t.toString();
}

function fmt(v: unknown, max = MAX_CELL): string {
  if (v === null || v === undefined) return "—";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
