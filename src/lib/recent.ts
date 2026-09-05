import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { PATHS } from "./paths.js";
import { UsageError } from "./errors.js";
import type { ServerName } from "../types/index.js";

/**
 * "Recent results" — what makes the CLI feel native instead of an id-passing wrapper.
 *
 * After any listing command (search, menu, products, addresses, slots, orders) the CLI remembers the
 * rows it showed, numbered. The next command can refer to a row by number (`2` or `#2`) instead of
 * pasting an id: `swiggy food menu 1`, `swiggy food add 3 --qty 2`, `swiggy dineout book 4 --guests 2`.
 * Raw ids still work everywhere; a reference that is not a small integer is passed through unchanged.
 *
 * Stored per SWIGGY_HOME in cache/recent.json. Entries also carry the context a follow-up needs
 * (restaurantId for a menu item, slot fields for a deal), so the user never re-types it.
 */

export type RecentKind = "restaurants" | "menuItems" | "products" | "addresses" | "locations" | "dineout" | "slots" | "orders" | "coupons";

export interface RecentEntry {
  id: string;
  label: string;
  extra?: Record<string, unknown>;
}

export interface RecentContext {
  restaurantId?: string;
  restaurantName?: string;
  addressId?: string;
  latitude?: number;
  longitude?: number;
}

interface RecentFile {
  lists: Partial<Record<RecentKind, { entries: RecentEntry[]; savedAt: number; server: ServerName }>>;
  context: RecentContext;
}

const FILE = join(PATHS.cacheDir, "recent.json");

async function load(): Promise<RecentFile> {
  if (!existsSync(FILE)) return { lists: {}, context: {} };
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8")) as Partial<RecentFile>;
    return { lists: parsed.lists ?? {}, context: parsed.context ?? {} };
  } catch {
    return { lists: {}, context: {} };
  }
}

async function save(f: RecentFile): Promise<void> {
  try {
    await mkdir(dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(f, null, 2), { mode: 0o600 });
  } catch {
    /* best-effort */
  }
}

export async function remember(kind: RecentKind, server: ServerName, entries: RecentEntry[], context: RecentContext = {}): Promise<void> {
  if (entries.length === 0 && Object.keys(context).length === 0) return;
  const f = await load();
  if (entries.length) f.lists[kind] = { entries: entries.slice(0, 200), savedAt: Date.now(), server };
  f.context = { ...f.context, ...compactCtx(context) };
  await save(f);
}

function compactCtx(c: RecentContext): RecentContext {
  return Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined && v !== "")) as RecentContext;
}

export async function getContext(): Promise<RecentContext> {
  return (await load()).context;
}

export async function getRecent(kind: RecentKind): Promise<RecentEntry[]> {
  return (await load()).lists[kind]?.entries ?? [];
}

/** Parse "#3" / "3" into a 1-based index; anything else is not a reference. */
export function parseRef(ref: string | undefined): number | undefined {
  if (ref === undefined) return undefined;
  const m = /^#?(\d{1,3})$/.exec(ref.trim());
  return m ? Number(m[1]) : undefined;
}

/**
 * Resolve a positional argument to an id: a small integer refers to the numbered row of the last
 * `kind` listing; anything else is treated as a literal id.
 */
export async function resolveRef(kind: RecentKind, ref: string, what: string): Promise<{ id: string; entry?: RecentEntry }> {
  const n = parseRef(ref);
  if (n === undefined) return { id: ref };
  const entries = await getRecent(kind);
  if (entries.length === 0) {
    throw new UsageError(`No recent ${what} to pick #${n} from.`, `Run a listing first (it numbers the rows), or pass the id itself.`);
  }
  const entry = entries[n - 1];
  if (!entry) throw new UsageError(`#${n} is out of range — the last ${what} listing had ${entries.length} row(s).`);
  return { id: entry.id, entry };
}

/* ---------- extractors: documented response shapes → numbered entries ---------- */

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : typeof v === "number" ? String(v) : undefined);
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);

export interface Extracted {
  kind: RecentKind;
  entries: RecentEntry[];
  context?: RecentContext;
}

/** Derive numbered entries (and follow-up context) from a tool's unwrapped `data`. */
export function extractRecent(server: ServerName, tool: string, data: unknown, extra?: Rec): Extracted | undefined {
  if (!isRec(data)) return undefined;
  switch (tool) {
    case "search_restaurants":
      return { kind: "restaurants", entries: arr(data.restaurants).flatMap((r) => (str(r.id) ? [{ id: str(r.id)!, label: str(r.name) ?? str(r.id)!, extra: { areaName: r.areaName } }] : [])) };
    case "get_restaurant_menu": {
      const rest = isRec(data.restaurant) ? data.restaurant : {};
      return {
        kind: "menuItems",
        entries: arr(data.items).flatMap((i) => (str(i.id) ? [{ id: str(i.id)!, label: str(i.name) ?? str(i.id)!, extra: { restaurantId: str(rest.id), restaurantName: str(rest.name), price: i.price } }] : [])),
        context: { restaurantId: str(rest.id), restaurantName: str(rest.name) },
      };
    }
    case "search_menu":
      return {
        kind: "menuItems",
        entries: arr(data.items).flatMap((i) => (str(i.menu_item_id) ? [{ id: str(i.menu_item_id)!, label: str(i.name) ?? str(i.menu_item_id)!, extra: { restaurantId: str(i.restaurant_id), restaurantName: str(i.restaurant_name), price: i.price } }] : [])),
      };
    case "search_products":
    case "your_go_to_items": {
      const products = arr(data.products).length ? arr(data.products) : arr(data.items);
      const entries: RecentEntry[] = [];
      for (const p of products) {
        const variations = arr(p.variations);
        if (variations.length === 0 && str(p.spinId)) entries.push({ id: str(p.spinId)!, label: str(p.displayName ?? p.itemName ?? p.name) ?? str(p.spinId)!, extra: { skuId: str(p.skuId) } });
        for (const v of variations) {
          if (!str(v.spinId)) continue;
          const name = str(p.displayName) ?? str(v.displayName) ?? str(v.spinId)!;
          entries.push({ id: str(v.spinId)!, label: `${name}${str(v.quantityDescription) ? ` · ${str(v.quantityDescription)}` : ""}`, extra: { skuId: str(v.skuId), productId: str(p.productId) } });
        }
      }
      return { kind: "products", entries };
    }
    case "get_addresses":
      return { kind: "addresses", entries: arr(data.addresses).flatMap((a) => (str(a.id) ? [{ id: str(a.id)!, label: [str(a.addressTag), str(a.addressLine)].filter(Boolean).join(" · ") || str(a.id)! }] : [])) };
    case "get_saved_locations":
      return { kind: "locations", entries: arr(data.locations).flatMap((a) => (str(a.id) ? [{ id: str(a.id)!, label: [str(a.addressTag), str(a.addressLine)].filter(Boolean).join(" · ") || str(a.id)! }] : [])) };
    case "search_restaurants_dineout":
      return {
        kind: "dineout",
        entries: arr(data.restaurants).flatMap((r) => (str(r.id) ? [{ id: str(r.id)!, label: str(r.name) ?? str(r.id)! }] : [])),
        context: { latitude: numOr(data.latitude), longitude: numOr(data.longitude) },
      };
    case "get_restaurant_details": {
      const inner = isRec(data.data) ? data.data : data;
      const rest = isRec(inner.restaurant) ? inner.restaurant : {};
      return { kind: "dineout", entries: [], context: { restaurantId: str(rest.restaurantId ?? rest.id ?? inner.restaurantId), restaurantName: str(rest.name), latitude: numOr(extra?.latitude ?? data.latitude), longitude: numOr(extra?.longitude ?? data.longitude) } };
    }
    case "get_available_slots": {
      const entries: RecentEntry[] = [];
      const restaurantId = str(data.restaurantId);
      for (const s of arr(data.slots)) {
        const deals = arr(s.deals);
        const when = [str(s.dateStr), str(s.displayTime)].filter(Boolean).join(" ");
        if (deals.length === 0 && s.slotId !== undefined) entries.push({ id: `${s.slotId}`, label: when, extra: { slotId: s.slotId, reservationTime: s.reservationTime, restaurantId, isFree: s.isFree } });
        for (const d of deals) {
          entries.push({
            id: `${d.slotId ?? s.slotId}:${str(d.itemId) ?? ""}`,
            label: `${when}${str(d.title) ? ` · ${str(d.title)}` : ""}${d.isFree === false ? ` · ₹${d.bookingPrice ?? d.coverCharge ?? "?"}` : " · free"}`,
            extra: { slotId: d.slotId ?? s.slotId, itemId: str(d.itemId), reservationTime: s.reservationTime, restaurantId, isFree: d.isFree ?? s.isFree },
          });
        }
      }
      return { kind: "slots", entries, context: { restaurantId, latitude: numOr(data.latitude), longitude: numOr(data.longitude) } };
    }
    case "get_food_orders":
      return { kind: "orders", entries: arr(data.orders).flatMap((o) => (str(o.orderId) ? [{ id: str(o.orderId)!, label: `${str(o.restaurantName) ?? ""} · ${str(o.orderStatus) ?? ""}`.trim() }] : [])) };
    case "get_orders":
    case "track_food_order":
      return { kind: "orders", entries: arr(data.orders).flatMap((o) => (str(o.orderId) ? [{ id: str(o.orderId)!, label: `${str(o.storeName ?? o.title) ?? ""} · ${str(o.status ?? o.orderStatus) ?? ""}`.trim() }] : [])) };
    case "get_food_cart": {
      const inner = isRec(data.data) ? data.data : data;
      const rest = isRec(inner.restaurant) ? inner.restaurant : {};
      return { kind: "menuItems", entries: [], context: { restaurantId: str(rest.id), restaurantName: str(rest.name), addressId: str(data.addressId) } };
    }
    default:
      return undefined;
  }
}

function numOr(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n !== 0 ? n : undefined;
}
