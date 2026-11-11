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

export type RecentKind = "restaurants" | "menuItems" | "products" | "addresses" | "locations" | "dineout" | "slots" | "orders" | "coupons" | "events" | "collections" | "shows";

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
  /** Scenes: the event last looked at, and the venue `get_event_details` returned for it. */
  eventId?: string;
  venueId?: string;
}

interface RecentFile {
  lists: Partial<Record<RecentKind, { entries: RecentEntry[]; savedAt: number; server: ServerName }>>;
  context: RecentContext;
  /** The kind of the most recent non-empty listing (what a bare row number refers to in the app). */
  last?: RecentKind;
}

const FILE = join(PATHS.cacheDir, "recent.json");

async function load(): Promise<RecentFile> {
  if (!existsSync(FILE)) return { lists: {}, context: {} };
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8")) as Partial<RecentFile>;
    return { lists: parsed.lists ?? {}, context: parsed.context ?? {}, last: parsed.last };
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
  if (entries.length) {
    f.lists[kind] = { entries: entries.slice(0, 200), savedAt: Date.now(), server };
    f.last = kind;
  }
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

/** The most recent listing with its kind and server (undefined when nothing has been listed yet). */
export async function getLastList(): Promise<{ kind: RecentKind; server: ServerName; entries: RecentEntry[]; savedAt: number } | undefined> {
  const f = await load();
  if (!f.last) return undefined;
  const l = f.lists[f.last];
  return l ? { kind: f.last, server: l.server, entries: l.entries, savedAt: l.savedAt } : undefined;
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
  /** Extra numbered lists from the same response (e.g. the genre chips next to an events listing). */
  more?: Array<{ kind: RecentKind; entries: RecentEntry[] }>;
}

/**
 * The slots a `get_available_slots` listing numbers: those of the requested date. Swiggy returns
 * seven days at once (several hundred slots), which is too many rows to pick from; other days are
 * one `--date` away. Falls back to every slot when none carries the requested date.
 */
export function slotsOfRequestedDate(data: Rec): Rec[] {
  const all = arr(data.slots);
  const day = str(data.date);
  const same = day ? all.filter((s) => str(s.dateStr) === day) : [];
  return same.length ? same : all;
}

/**
 * The dishes of a `get_restaurant_menu` payload, in display order. Live responses (2026-11-11)
 * group them as `categories[].items[]`; the older flat `items[]` is still read. Each dish keeps its
 * category title so the view can show it.
 */
export function menuItems(data: Rec): Rec[] {
  const flat = arr(data.items);
  if (flat.length) return flat;
  return arr(data.categories).flatMap((c) => arr(c.items).map((i) => ({ ...i, categories: [str(c.title) ?? ""] })));
}

export interface EventShowRow {
  showId: number | string;
  ticketId: string;
  title?: string;
  price?: number;
  when: string;
  showTime?: number;
  seats?: number;
}

/**
 * Flatten a `list_event_shows` payload into one row per (show, ticket type).
 *
 * Swiggy passes its event service's payload through as returned, so the field names differ from
 * the published schema. Observed live on 2026-11-11: shows carry `id` (not `showId`), tickets carry
 * `id` / `name` / a nested money object (not `ticketId` / `ticketTitle` / a number), `venueDetails`
 * is an array, and `eventInfo` uses `id` / `name`. Both spellings are read. `show_time_unix` and
 * `show_time_ist` are the two fields Swiggy adds itself and are used exactly as returned.
 */
export function eventShowRows(data: Rec, fallbackVenueId?: string): { rows: EventShowRow[]; venueId?: string; venueName?: string; eventId?: string; eventName?: string } {
  const listing = isRec(data.eventShowListing) ? data.eventShowListing : {};
  const venue = Array.isArray(listing.venueDetails) ? arr(listing.venueDetails) : isRec(listing.venueDetails) ? [listing.venueDetails] : [];
  const info = isRec(listing.eventInfo) ? listing.eventInfo : {};
  const venueId = venue.length === 1 ? (str(venue[0]!.venueId) ?? str(venue[0]!.id)) : venue.length === 0 ? fallbackVenueId : undefined;
  const rows: EventShowRow[] = [];
  for (const day of arr(listing.dateGroupedEventShow)) {
    const d = day.date;
    const dayText = isRec(d) ? [d.year, d.month, d.day].map((n) => String(n).padStart(2, "0")).join("-") : (str(d) ?? "");
    for (const show of arr(day.eventShow)) {
      const showIdRaw = show.showId ?? show.id;
      const ticketsOf = arr(show.tickets);
      if (showIdRaw === undefined || showIdRaw === null) continue;
      const asNum = Number(showIdRaw);
      const showId = Number.isFinite(asNum) ? asNum : String(showIdRaw); // create_event_cart takes a number
      const when = str(show.show_time_ist) ?? [dayText, isRec(show.timeRange) ? str(show.timeRange.startTime) : undefined].filter(Boolean).join(" ");
      for (const t of ticketsOf) {
        const ticketId = str(t.ticketId) ?? str(t.id);
        if (!ticketId) continue;
        rows.push({ showId, ticketId, title: str(t.ticketTitle) ?? str(t.name), price: ticketPrice(t.price), when, showTime: numOr(show.show_time_unix), seats: numOr(t.availableInventory) ?? numOr(show.availableSeats) ?? numOr(show.maxAvailableInventory) });
      }
    }
  }
  return { rows, venueId, venueName: venue.length === 1 ? str(venue[0]!.name) : undefined, eventId: str(info.eventId) ?? str(info.id), eventName: str(info.title) ?? str(info.name) };
}

/** A ticket price as rupees: a plain number, or the service's `{ discountedPrice: { units } }` money object. */
function ticketPrice(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (!isRec(v)) return undefined;
  const money = isRec(v.discountedPrice) ? v.discountedPrice : isRec(v.price) ? v.price : v;
  const units = Number(money.units);
  return Number.isFinite(units) ? units + (Number(money.nanos) || 0) / 1e9 : undefined;
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
        entries: menuItems(data).flatMap((i) => (str(i.id) ? [{ id: str(i.id)!, label: str(i.name) ?? str(i.id)!, extra: { restaurantId: str(rest.id), restaurantName: str(rest.name), price: i.price } }] : [])),
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
      for (const s of slotsOfRequestedDate(data)) {
        const deals = arr(s.deals);
        const when = [str(s.dateStr), str(s.displayTime)].filter(Boolean).join(" ");
        const reservationTime = numOr(s.reservationTime) ?? s.reservationTime; // live responses send it as a string; book_table wants a number
        if (deals.length === 0 && s.slotId !== undefined) entries.push({ id: `${s.slotId}`, label: when, extra: { slotId: s.slotId, reservationTime, restaurantId, isFree: s.isFree } });
        for (const d of deals) {
          entries.push({
            id: `${d.slotId ?? s.slotId}:${str(d.itemId) ?? ""}`,
            label: `${when}${str(d.title) ? ` · ${str(d.title)}` : ""}${d.isFree === false ? ` · ₹${d.bookingPrice ?? d.coverCharge ?? "?"}` : " · free"}`,
            extra: { slotId: d.slotId ?? s.slotId, itemId: str(d.itemId), reservationTime, restaurantId, isFree: d.isFree ?? s.isFree },
          });
        }
      }
      return { kind: "slots", entries, context: { restaurantId, latitude: numOr(data.latitude), longitude: numOr(data.longitude) } };
    }
    case "discover_events":
    case "get_events_collection":
      return {
        kind: "events",
        entries: arr(data.events).flatMap((e) => (str(e.eventId) ? [{ id: str(e.eventId)!, label: [str(e.eventName), str(e.venueName), str(e.date)].filter(Boolean).join(" · ") || str(e.eventId)! }] : [])),
        more: [{ kind: "collections", entries: arr(data.collectionChips).flatMap((c) => (str(c.collectionIdentifier) ? [{ id: str(c.collectionIdentifier)!, label: str(c.label) ?? str(c.collectionIdentifier)! }] : [])) }],
      };
    case "search_events":
      return { kind: "events", entries: arr(data.suggestions).flatMap((e) => (str(e.eventId) ? [{ id: str(e.eventId)!, label: [str(e.eventName), str(e.location)].filter(Boolean).join(" · ") || str(e.eventId)! }] : [])) };
    case "get_event_details":
      return { kind: "events", entries: [], context: { eventId: str(data.eventId), venueId: str(data.venueId) } };
    case "list_event_shows": {
      const listing = eventShowRows(data, str(extra?.venueId));
      // Rows from a listing that spans venues are not safe to book from, so they are not numbered.
      return {
        kind: "shows",
        entries: listing.venueId
          ? listing.rows.map((r) => ({
              id: `${r.showId}:${r.ticketId}`,
              label: `${r.when}${r.title ? ` · ${r.title}` : ""}${r.price !== undefined ? ` · ₹${r.price}` : ""}`,
              extra: { venueId: listing.venueId, showId: r.showId, ticketId: r.ticketId, showTime: r.showTime, price: r.price },
            }))
          : [],
        context: { eventId: listing.eventId ?? str(extra?.eventId), venueId: listing.venueId },
      };
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
