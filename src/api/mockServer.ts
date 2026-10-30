// Mock backend. It stands in for the real server: it owns the data, enforces admin roles, computes
// delivery quotes and prices orders. Everything is saved in this browser's localStorage.
// Replace src/api/client.ts's transport with real fetch() calls and this file goes away.
import type {
  AuditEntry, Branch, BranchHoliday, BranchProduct, CreateOrderRequest, CreatedOrderPricing, DeliveryQuote,
  DeliverySettings, Product, PublicProduct, QuoteRequest,
} from "./types";
import { COUPONS } from "@/data/catalog";
import { drivingDistanceKm } from "@/lib/googleMaps";
import {
  OpsError, addDays, createOrderJob, ensureDailyJobs, istDate, jobForPartner, partnerFromToken, partnerLogin, partnerSummary,
  planCalendar, publicPartner, subscriptionAction, upsertPartner,
  type Job, type OpsDb, type ServerOrder, type Subscription,
} from "./opsServer";
import { AuthError, handleAuth, isValidMobile, normaliseMobile, sessionCustomer, upsertCustomerForOrder, type AuthDb, type StoredAddress as AccountAddress } from "./authServer";
import { EVENT_RATE_PER_LITRE, SERVICE_OPTIONS, type ServiceOption } from "@/data/events";

export interface EventRequest {
  id: string; ref: string; created_at: string;
  name: string; phone: string; event_type: string; event_date: string; event_time: string;
  service: ServiceOption; litres: number; venue: string; notes: string;
  base_amount: number; // paise, litres × rate, computed here
  status: "NEW" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  advance_paid?: number; // paise, recorded by admin when confirming
  balance_collected?: number; // paise, collected by the delivery partner on the event date
  branch_id?: string;
}

export const SUPER_ADMINS = ["8825687662", "9942421611"];
const KEY = "ssp-db-v1";
const STATE_KEY = "ssp-state-v1"; // the shop's own storage, where customer addresses live

interface Db extends AuthDb, OpsDb {
  branches: Branch[];
  holidays: BranchHoliday[];
  products: Product[];
  branchProducts: BranchProduct[];
  settings: DeliverySettings;
  audit: AuditEntry[];
  /** order count per branch, so a branch with sales is hidden rather than deleted */
  sales: Record<string, number>;
  quoteCache: Record<string, { lat: number; lng: number; blat: number; blng: number; km: number; method: DeliveryQuote["method"] }>;
  logs: { at: string; msg: string }[];
  migrations?: string[];
  eventRequests?: EventRequest[];
}

/* ---------------- time (IST) ---------------- */
export function nowIST() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) % 24 * 60 + Number(get("minute")), weekday };
}
const stamp = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

/* ---------------- seed ---------------- */
const SEED_BY = "seed";
/** Daily plan discount by length: 7 days 5%, 15 days 10%, 30 days 15%. */
export const PLAN_DISCOUNTS: Record<string, number> = { "7": 5, "15": 10, "30": 15 };
export const planPct = (s: Pick<DeliverySettings, "plan_discounts" | "plan_discount_percent">, days?: number) =>
  days ? s.plan_discounts?.[String(days)] ?? s.plan_discount_percent : s.plan_discount_percent;
/** Delivery charges by road distance, as set by the shop (paise). */
const DELIVERY_SLABS = [
  { upto_km: 3, fee: 0 }, { upto_km: 5, fee: 1500 }, { upto_km: 8, fee: 2500 }, { upto_km: 10, fee: 4000 }, { upto_km: 12, fee: 5000 },
];
/** Contact numbers for every branch (comma separated; each one shows as its own call link). */
export const BRANCH_PHONES = "8825687662, 9942421611";
function seedBranch(i: number, code: string, en: string, ta: string, type: Branch["type"], days: Branch["open_days"], extra: Partial<Branch> = {}): Branch {
  return {
    id: `br-${code.toLowerCase()}`, code, name_en: en, name_ta: ta, type, address_en: "", address_ta: "", district: "",
    latitude: null, longitude: null, google_maps_url: "", phone: BRANCH_PHONES, open_days: days, open_time: "", close_time: "",
    is_active: true, show_on_website: true, is_dispatch: false, delivery_radius_km: null, photo_url: "", sort_order: i,
    deleted: false, created_at: stamp(), updated_at: stamp(), updated_by: SEED_BY, ...extra,
  };
}
function seed(): Db {
  const branches: Branch[] = [
    seedBranch(1, "MAIN", "Main Branch – Periyar Bus Stand", "மெயின் கிளை – பெரியார் பேருந்து நிலையம்", "SHOP", "DAILY", {
      address_en: "Netaji Road, opposite Dindigul Biriyani Kadai, near Periyar Bus Stand, Madurai",
      district: "Madurai", open_time: "06:30", close_time: "20:30", is_dispatch: true,
      // Pin placed at the Periyar Bus Stand landmark so distance quotes work; confirm the exact shop pin in admin.
      latitude: 9.9174, longitude: 78.1136,
    }),
    seedBranch(2, "TPK", "Theppakulam", "தெப்பக்குளம்", "MARKET", "DAILY"),
    seedBranch(3, "KKN", "KK Nagar", "கே.கே. நகர்", "MARKET", "DAILY"),
    seedBranch(4, "AMN", "Ammaya Nayakanur", "அம்மையநாயக்கனூர்", "MARKET", [3]),
    seedBranch(5, "NMP", "Nagamalai Puthukottai", "நாகமலை புதுக்கோட்டை", "MARKET", [4]),
    seedBranch(6, "SMP", "Sempatti", "செம்பட்டி", "MARKET", [5]),
    seedBranch(7, "NLK", "Nilakottai", "நிலக்கோட்டை", "MARKET", [6]),
  ];
  const product = (i: number, code: string, size: string, sizeTa: string, ml: number, price: number): Product => ({
    id: `pr-${code.toLowerCase()}`, code, name_en: "Paruthipaal", name_ta: "பருத்திப்பால்", size_label_en: size, size_label_ta: sizeTa,
    volume_ml: ml, description_en: "Hot paruthipaal, cooked fresh in a copper pot and sealed hot.", description_ta: "",
    image_url: "/media/closeup.webp", base_price: price, is_active: true, sell_online: true, sell_in_pos: true,
    plan_eligible: true, max_qty_per_order: 10, sort_order: i, created_at: stamp(), updated_at: stamp(), updated_by: SEED_BY,
  });
  return {
    branches,
    holidays: [],
    // Shop prices: 500 ML ₹75, 1 L ₹150.
    products: [product(1, "PP500", "500 ML", "500 மி.லி", 500, 7500), product(2, "PP1000", "1 L", "1 லி", 1000, 15000)],
    branchProducts: [],
    settings: {
      free_radius_km: 3,
      slabs: DELIVERY_SLABS,
      max_radius_km: 12, distance_method: "ROAD", free_above_amount: null, district_restriction: "Madurai",
      discount_above_amount: 20000, discount_percent: 50, support_phone: "8825687662", demo_distance_fallback: true,
      plan_free_delivery: true, plan_discount_percent: 15, plan_discounts: { ...PLAN_DISCOUNTS }, updated_at: stamp(), updated_by: SEED_BY,
    },
    audit: [], sales: {}, quoteCache: {}, logs: [],
  };
}

/* ---------------- storage ---------------- */
let db: Db | null = null;
function load(): Db {
  if (db) return db;
  try { const raw = localStorage.getItem(KEY); db = raw ? (JSON.parse(raw) as Db) : seed(); } catch { db = seed(); }
  migrate(db);
  return db;
}
/** One-time updates for data saved before a change. Each runs once per browser. */
function migrate(d: Db) {
  const done = (d.migrations ??= []);
  if (!done.includes("branch-phones")) {
    // fill the contact numbers into branches that had none; numbers entered in admin are kept
    d.branches.forEach((b) => { if (!b.phone.trim()) b.phone = BRANCH_PHONES; });
    done.push("branch-phones");
  }
  if (!done.includes("delivery-rules-v2")) {
    // the shop's delivery rules: new slabs, 12 km limit, 50% off delivery above ₹200
    Object.assign(d.settings, {
      slabs: DELIVERY_SLABS, free_radius_km: 3, max_radius_km: 12, free_above_amount: null,
      discount_above_amount: 20000, discount_percent: 50, support_phone: "8825687662", distance_method: "ROAD",
      updated_at: stamp(), updated_by: "shop rules",
    });
    d.quoteCache = {};
    done.push("delivery-rules-v2");
  }
  if (!done.includes("plan-discounts-tiered")) {
    d.settings.plan_discounts = { ...PLAN_DISCOUNTS };
    d.settings.plan_discount_percent = 15;
    done.push("plan-discounts-tiered");
  }
  if (!done.includes("prices-75-150")) {
    // the shop's prices: 500 ML ₹75, 1 L ₹150
    const set = (code: string, price: number) => {
      const p = d.products.find((x) => x.code === code);
      if (p) Object.assign(p, { base_price: price, updated_at: stamp(), updated_by: "shop prices" });
    };
    set("PP500", 7500); set("PP1000", 15000);
    done.push("prices-75-150");
  }
  if (!done.includes("demo-distance-fallback")) {
    d.settings.demo_distance_fallback = true;
    done.push("demo-distance-fallback");
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
  }
}

function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full or blocked: keep in memory */ }
  // cache-bust for every open screen (this tab and others)
  window.dispatchEvent(new Event("ssp-db-changed"));
}
window.addEventListener("storage", (e) => { if (e.key === KEY) { db = null; window.dispatchEvent(new Event("ssp-db-changed")); } });

function audit(by: string, entity: string, entity_id: string, action: string, old: unknown, next: unknown) {
  load().audit.unshift({ id: uid("au"), at: stamp(), by, entity, entity_id, action, old, new: next });
  db!.audit = db!.audit.slice(0, 500);
}

/* ---------------- errors ---------------- */
export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>, public code?: string) { super(message); }
}

/* ---------------- pricing helpers ---------------- */
const isSoldOutToday = (bp?: BranchProduct) => !!bp && bp.sold_out_date === nowIST().date;
const dispatchBranch = () => load().branches.find((b) => b.is_dispatch && b.is_active && !b.deleted && b.latitude != null && b.longitude != null);

function publicProduct(p: Product): PublicProduct {
  const d = dispatchBranch();
  const bp = d && load().branchProducts.find((x) => x.branch_id === d.id && x.product_id === p.id);
  const price = bp?.price_override ?? p.base_price;
  const pct = load().settings.plan_discount_percent;
  return {
    ...p, price,
    plan_price: p.plan_eligible ? Math.round((price * (100 - pct)) / 100) : null,
    available: bp ? bp.is_available : true,
    sold_out_today: isSoldOutToday(bp),
  };
}

/* ---------------- delivery ---------------- */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

type StoredAddress = Partial<AccountAddress> & { id: string; district?: string; lat?: number | null; lng?: number | null };
function readAddress(id: string): StoredAddress | undefined {
  try { return (JSON.parse(localStorage.getItem(STATE_KEY) || "{}").addresses as StoredAddress[] | undefined)?.find((a) => a.id === id); } catch { return undefined; }
}

export async function quote(req: QuoteRequest): Promise<DeliveryQuote> {
  const s = load().settings;
  let { lat, lng, district } = req;
  if (req.addressId) {
    const a = readAddress(req.addressId);
    if (!a) throw new ApiError(404, "Address not found");
    lat = a.lat ?? undefined; lng = a.lng ?? undefined; district = a.district;
  }
  if (district !== undefined && district.trim().toLowerCase() !== s.district_restriction.toLowerCase()) {
    return { deliverable: false, reason: "OUTSIDE_DISTRICT", fee: 0, message: `We deliver within ${s.district_restriction} district only.` };
  }
  if (lat == null || lng == null) return { deliverable: false, reason: "NO_LOCATION", fee: 0, message: "Set the map location for this address to see the delivery fee." };

  // nearest active dispatch branch
  const candidates = load().branches.filter((b) => b.is_dispatch && b.is_active && !b.deleted && b.latitude != null && b.longitude != null);
  if (!candidates.length) return { deliverable: false, reason: "NO_DISPATCH_BRANCH", fee: 0, message: "Online delivery is paused right now." };
  const nearest = candidates
    .map((b) => ({ b, straight: haversineKm(lat!, lng!, b.latitude!, b.longitude!) }))
    .sort((x, y) => x.straight - y.straight)[0].b;

  // road distance, cached per address + branch until the pin or branch moves
  const cacheKey = `${req.addressId ?? `${lat},${lng}`}:${nearest.id}`;
  const c = load().quoteCache[cacheKey];
  let km: number | null, method: DeliveryQuote["method"];
  if (c && c.lat === lat && c.lng === lng && c.blat === nearest.latitude && c.blng === nearest.longitude) { km = c.km; method = c.method; }
  else {
    km = await drivingDistanceKm({ lat: nearest.latitude!, lng: nearest.longitude! }, { lat, lng });
    method = "ROAD";
    if (km == null && s.demo_distance_fallback) {
      load().logs.unshift({ at: stamp(), msg: `Google road distance unavailable; demo estimate used for ${cacheKey}` });
      km = simulatedRoadKm(lat, lng, nearest.latitude!, nearest.longitude!);
      method = "ROAD_SIMULATED";
    }
    if (km != null) {
      load().quoteCache[cacheKey] = { lat, lng, blat: nearest.latitude!, blng: nearest.longitude!, km, method };
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ }
    }
  }
  if (km == null) {
    // never guess the charge from a straight line: ask the customer to call
    load().logs.unshift({ at: stamp(), msg: `Road distance lookup failed for ${cacheKey}` });
    return { deliverable: false, reason: "DISTANCE_UNAVAILABLE", fee: 0, message: `We couldn't work out the road distance for this address. Please call ${s.support_phone} to place this order.` };
  }
  km = Math.round(km * 100) / 100;
  const branch = { id: nearest.id, code: nearest.code, name_en: nearest.name_en };
  const from = nearest.name_en.split("–").pop()!.trim();
  const maxKm = nearest.delivery_radius_km ?? s.max_radius_km;
  if (km > maxKm) {
    return { deliverable: false, reason: "TOO_FAR", fee: 0, branch, distanceKm: km, method, message: `We don't deliver this far yet (${km.toFixed(1)} km by road; limit ${maxKm} km) — pick up at ${from}.` };
  }
  const baseFee = feeForKm(s, km);
  let fee = baseFee;
  let freeReason: DeliveryQuote["freeReason"];
  const subtotal = req.subtotal ?? 0;
  // plan orders are always delivered free
  if (req.hasPlan) { fee = 0; freeReason = "PLAN"; }
  else if (km <= s.free_radius_km) { fee = 0; freeReason = "WITHIN_FREE_RADIUS"; }
  else if (s.free_above_amount != null && subtotal >= s.free_above_amount) { fee = 0; freeReason = "ABOVE_AMOUNT"; }
  else if (s.discount_above_amount != null && subtotal > s.discount_above_amount) fee = discounted(baseFee, s.discount_percent);
  const saving = baseFee - fee;
  const kmText = `${km.toFixed(1)} km by road from ${from}`;
  const feeText = fee === 0 ? "Free delivery" : saving > 0 ? `Delivery ₹${fee / 100} (₹${baseFee / 100} − ${s.discount_percent}% off)` : `Delivery ₹${fee / 100}`;
  return { deliverable: true, fee, baseFee, saving, freeReason, branch, distanceKm: km, method, message: `${kmText} · ${feeText}` };
}

/** Percent off a charge, rounded up to the nearest rupee (e.g. 50% of ₹25 → ₹13). */
export function discounted(feePaise: number, percent: number) {
  return Math.ceil((feePaise * (100 - percent)) / 100 / 100) * 100;
}

/**
 * Demo-only estimate of a road route (straight line × 1.3), used when the Google lookup fails and the
 * admin "demo fallback" switch is on. Quotes using it are labelled ROAD_SIMULATED.
 */
function simulatedRoadKm(aLat: number, aLng: number, bLat: number, bLng: number): number | null {
  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return null;
  return haversineKm(aLat, aLng, bLat, bLng) * 1.3;
}

export function feeForKm(s: Pick<DeliverySettings, "slabs" | "free_radius_km">, km: number) {
  if (km <= s.free_radius_km) return 0;
  const slab = s.slabs.find((x) => km <= x.upto_km);
  return slab ? slab.fee : s.slabs[s.slabs.length - 1]?.fee ?? 0;
}

/* ---------------- validation ---------------- */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
function validateBranch(b: Branch) {
  const f: Record<string, string> = {};
  if (!b.code.trim()) f.code = "Code is required";
  else if (load().branches.some((x) => x.id !== b.id && x.code.toUpperCase() === b.code.trim().toUpperCase())) f.code = "This code is already used";
  if (!b.name_en.trim()) f.name_en = "English name is required";
  if (!b.name_ta.trim()) f.name_ta = "Tamil name is required";
  if ((b.open_time && !TIME.test(b.open_time)) || (b.close_time && !TIME.test(b.close_time))) f.hours = "Use HH:MM";
  else if (!!b.open_time !== !!b.close_time) f.hours = "Fill both opening and closing time, or neither";
  else if (b.open_time && b.open_time >= b.close_time) f.hours = "Opening time must be before closing time";
  if (b.is_dispatch && (b.latitude == null || b.longitude == null)) f.location = "A dispatch branch needs a map location";
  if (b.open_days !== "DAILY" && b.open_days.length === 0) f.open_days = "Pick at least one day";
  if (Object.keys(f).length) throw new ApiError(422, "Please fix the highlighted fields", f);
}
function validateProduct(p: Product) {
  const f: Record<string, string> = {};
  if (!p.code.trim()) f.code = "Code is required";
  else if (load().products.some((x) => x.id !== p.id && x.code.toUpperCase() === p.code.trim().toUpperCase())) f.code = "This code is already used";
  if (!p.name_en.trim()) f.name_en = "English name is required";
  if (!p.name_ta.trim()) f.name_ta = "Tamil name is required";
  if (!p.size_label_en.trim()) f.size_label_en = "Size is required";
  if (!(p.base_price > 0)) f.base_price = "Price must be above ₹0";
  if (!(p.max_qty_per_order >= 1)) f.max_qty_per_order = "At least 1";
  if (Object.keys(f).length) throw new ApiError(422, "Please fix the highlighted fields", f);
}
function validateSettings(s: DeliverySettings) {
  const f: Record<string, string> = {};
  if (!(s.free_radius_km >= 0)) f.free_radius_km = "Must be 0 or more";
  if (!(s.max_radius_km > 0)) f.max_radius_km = "Must be above 0";
  if (!s.slabs.length) f.slabs = "Add at least one slab";
  s.slabs.forEach((x, i) => {
    if (!(x.upto_km > 0) || !(x.fee >= 0)) f.slabs = "Each slab needs a distance above 0 and a fee of ₹0 or more";
    else if (i > 0 && x.upto_km <= s.slabs[i - 1].upto_km) f.slabs = "Distances must go up row by row";
  });
  if (!f.slabs && s.slabs.length && s.slabs[s.slabs.length - 1].upto_km < s.max_radius_km) f.slabs = `The last slab must reach the max radius (${s.max_radius_km} km), so there are no gaps`;
  if (!(s.plan_discount_percent >= 0 && s.plan_discount_percent <= 100)) f.plan_discount_percent = "0 to 100";
  if (s.free_above_amount != null && !(s.free_above_amount > 0)) f.free_above_amount = "Leave empty or enter an amount above ₹0";
  if (s.discount_above_amount != null && !(s.discount_above_amount > 0)) f.discount_above_amount = "Leave empty or enter an amount above ₹0";
  if (!(s.discount_percent >= 0 && s.discount_percent <= 100)) f.discount_percent = "0 to 100";
  if (!/^\d{10}$/.test(String(s.support_phone ?? "").replace(/\D/g, ""))) f.support_phone = "10-digit number";
  if (Object.keys(f).length) throw new ApiError(422, "Please fix the highlighted fields", f);
}

/* ---------------- orders (server-side pricing) ---------------- */
async function priceOrder(req: CreateOrderRequest): Promise<CreatedOrderPricing> {
  const s = load().settings;
  const items = req.lines.map((l) => {
    const p = load().products.find((x) => x.id === l.productId && x.is_active && x.sell_online);
    if (!p) throw new ApiError(409, "A product in your cart is no longer available");
    const pp = publicProduct(p);
    if (!pp.available || pp.sold_out_today) throw new ApiError(409, `${p.name_en} ${p.size_label_en} is sold out today`);
    if (!(l.qty >= 1) || l.qty > p.max_qty_per_order) throw new ApiError(422, `You can order up to ${p.max_qty_per_order} of ${p.name_en} ${p.size_label_en}`);
    if (l.plan && !p.plan_eligible) throw new ApiError(422, `${p.name_en} ${p.size_label_en} is not part of the daily plan`);
    const days = l.plan ? Number(l.planDays) : 1;
    if (l.plan && !(String(days) in (s.plan_discounts ?? {}))) throw new ApiError(422, "Choose a 7, 15 or 30-day plan");
    return { productId: p.id, productName: p.name_en, sizeLabel: p.size_label_en, unitPrice: pp.price, qty: l.qty, lineTotal: pp.price * l.qty * days, plan: l.plan, planDays: l.plan ? days : undefined, planDiscountPct: l.plan ? planPct(s, days) : undefined };
  });
  const subtotal = items.reduce((n, i) => n + i.lineTotal, 0);
  const coupon = req.couponCode ? COUPONS[req.couponCode.toUpperCase()] : undefined;
  const couponDiscount = !coupon ? 0 : coupon.type === "percent" ? Math.round((subtotal * coupon.value) / 100) : Math.min(coupon.value * 100, subtotal);
  const planDiscount = items.filter((i) => i.plan).reduce((n, i) => n + Math.round((i.lineTotal * (i.planDiscountPct ?? 0)) / 100), 0);
  const q = await quote({ addressId: req.addressId, subtotal, hasPlan: items.some((i) => i.plan) });
  if (!q.deliverable) throw new ApiError(422, q.message);
  const total = Math.max(0, subtotal - couponDiscount - planDiscount + q.fee);
  return {
    items, subtotal, couponDiscount, planDiscount, deliveryFee: q.fee, total,
    delivery: { branch_id: q.branch!.id, distance_km: q.distanceKm!, method: q.method!, freeReason: q.freeReason },
    order_ref: "SSP-" + Math.floor(100000 + Math.random() * 900000), account: { created: false },
  };
}

/* ---------------- router ---------------- */
const hits: number[] = [];
function rateLimit() {
  const t = Date.now();
  while (hits.length && t - hits[0] > 60_000) hits.shift();
  if (hits.length >= 120) throw new ApiError(429, "Too many admin requests. Wait a minute and try again.");
  hits.push(t);
}
function requireAdmin(token?: string) {
  const phone = token?.replace(/^admin:/, "");
  if (!phone || !SUPER_ADMINS.includes(phone)) throw new ApiError(403, "Admins only");
  rateLimit();
  return phone;
}
const visibleBranches = () => load().branches.filter((b) => !b.deleted).sort((a, b) => a.sort_order - b.sort_order);

export function handle(method: string, path: string, body: unknown, token?: string, customerToken?: string, partnerToken?: string): unknown {
  // Re-read the stored data on every call, as a server would read its database: another tab (an admin,
  // or a second delivery partner) may have changed it, e.g. picked the same order a moment ago.
  db = null;
  const [, , scope, resource, id] = path.split("/"); // "", "api", scope, resource, id
  const ops = opsRoute(method, scope, resource, id, body, token, customerToken, partnerToken);
  if (ops !== NOT_OPS) return ops;
  const route = `${method} /${scope}/${resource}${id ? "/:id" : ""}`;
  // customer auth lives in authServer.ts; /auth/admin (staff sign-in) stays below
  if ((scope === "auth" && resource !== "admin") || scope === "me" || (scope === "admin" && (resource === "customers" || resource === "reset-links"))) {
    const ctx = { db: load(), commit, audit, requireAdmin };
    return handleAuth(ctx, method, `/${scope}/${resource}${id ? "/:id" : ""}`, id, body, token, customerToken).then((r) => {
      if (r === undefined) throw new ApiError(404, `No route for ${method} ${path}`);
      return r;
    }, (e) => { throw e instanceof AuthError ? new ApiError(e.status, e.message, e.fields, e.code) : e; });
  }
  const d = load();

  switch (route) {
    /* public */
    case "GET /public/branches":
      return visibleBranches().filter((b) => b.is_active && b.show_on_website).map((b) => ({ ...b, holidays: d.holidays.filter((h) => h.branch_id === b.id) }));
    case "GET /public/products":
      return d.products.filter((p) => p.is_active && p.sell_online).sort((a, b) => a.sort_order - b.sort_order).map(publicProduct);
    case "GET /public/delivery-settings": {
      const { free_radius_km, max_radius_km, district_restriction, plan_free_delivery, plan_discount_percent, plan_discounts, free_above_amount, slabs, discount_above_amount, discount_percent, support_phone } = d.settings;
      return { free_radius_km, max_radius_km, district_restriction, plan_free_delivery, plan_discount_percent, plan_discounts, free_above_amount, slabs, discount_above_amount, discount_percent, support_phone };
    }
    case "POST /delivery/quote":
      return quote(body as QuoteRequest);
    case "POST /orders/create": {
      const req = body as CreateOrderRequest;
      // a signed-in customer's orders go to their own account; a guest's go to the mobile number they entered
      const signedIn = sessionCustomer(d, customerToken);
      const mobile = signedIn?.mobile ?? normaliseMobile(req.customer?.phone);
      if (!isValidMobile(mobile)) throw new ApiError(422, "Enter a valid 10-digit mobile number.", { phone: "Enter a valid 10-digit mobile number." });
      if (req.payment === "cod" && req.lines?.some((l) => l.plan)) throw new ApiError(422, "Daily plans are paid online by UPI. Cash on delivery isn't available for plans.");
      return priceOrder(req).then((pricing) => {
        d.sales[pricing.delivery.branch_id] = (d.sales[pricing.delivery.branch_id] ?? 0) + 1;
        const a = readAddress(req.addressId);
        const address = a ? ({ ...a, name: a.name ?? req.customer.name, phone: a.phone ?? mobile } as AccountAddress) : undefined;
        pricing.account = upsertCustomerForOrder(d, mobile, signedIn?.name || String(req.customer?.name ?? "").trim(), address, pricing.order_ref);
        recordOrder(d, req, pricing, mobile, signedIn?.name || String(req.customer?.name ?? "").trim(), signedIn?.email ?? "", address ?? null);
        commit();
        return pricing;
      });
    }
    case "POST /events/request": {
      const b = body as Partial<EventRequest>;
      const f: Record<string, string> = {};
      const litres = Number(b.litres);
      if (!String(b.name ?? "").trim()) f.name = "Name is required";
      if (!/^[6-9]\d{9}$/.test(String(b.phone ?? "").replace(/\D/g, "").slice(-10))) f.phone = "Enter a 10-digit mobile number";
      if (!b.event_date || b.event_date <= nowIST().date) f.event_date = "Pick a date from tomorrow onwards";
      if (!b.event_time) f.event_time = "Pick a time";
      if (!SERVICE_OPTIONS.some((s) => s.id === b.service)) f.service = "Choose a service option";
      if (!(litres >= 1 && litres <= 2000)) f.litres = "Between 1 and 2000 litres";
      if (b.service !== "PICKUP" && !String(b.venue ?? "").trim()) f.venue = "Venue address is needed for delivery or a live counter";
      if (Object.keys(f).length) throw new ApiError(422, "Please fix the highlighted fields", f);
      const req: EventRequest = {
        id: uid("ev"), ref: "EV-" + Math.floor(100000 + Math.random() * 900000), created_at: stamp(),
        name: String(b.name).trim(), phone: String(b.phone).trim(), event_type: String(b.event_type ?? "Other"),
        event_date: b.event_date!, event_time: b.event_time!, service: b.service!, litres: Math.round(litres * 10) / 10,
        venue: String(b.venue ?? "").trim(), notes: String(b.notes ?? "").trim(),
        base_amount: Math.round(litres * EVENT_RATE_PER_LITRE), status: "NEW",
      };
      (d.eventRequests ??= []).unshift(req);
      commit();
      return req;
    }
    case "GET /admin/event-requests": requireAdmin(token);
      return d.eventRequests ?? [];
    case "PUT /admin/event-requests/:id": {
      const by = requireAdmin(token);
      const r = (d.eventRequests ?? []).find((x) => x.id === id);
      if (!r) throw new ApiError(404, "Request not found");
      const { status, advance_paid } = body as { status: EventRequest["status"]; advance_paid?: number };
      audit(by, "event_request", r.ref, "status", { status: r.status, advance_paid: r.advance_paid ?? 0 }, { status, advance_paid: advance_paid ?? r.advance_paid ?? 0 });
      r.status = status;
      if (advance_paid != null) r.advance_paid = Math.max(0, Math.min(r.base_amount, Math.round(advance_paid)));
      r.branch_id ??= "br-main";
      commit();
      return r;
    }
    case "POST /auth/admin": {
      const phone = String((body as { phone?: string })?.phone ?? "").replace(/\D/g, "").slice(-10);
      if (!SUPER_ADMINS.includes(phone)) throw new ApiError(403, "This number is not an admin");
      return { token: `admin:${phone}`, phone };
    }

    /* admin: branches */
    case "GET /admin/branches": requireAdmin(token);
      return visibleBranches().map((b) => ({ ...b, has_sales: (d.sales[b.id] ?? 0) > 0, holidays: d.holidays.filter((h) => h.branch_id === b.id) }));
    case "POST /admin/branches":
    case "PUT /admin/branches/:id": {
      const by = requireAdmin(token);
      const input = body as Branch & { holidays?: BranchHoliday[] };
      const existing = id ? d.branches.find((b) => b.id === id) : undefined;
      if (id && !existing) throw new ApiError(404, "Branch not found");
      const next: Branch = {
        ...(existing ?? { id: uid("br"), created_at: stamp(), sort_order: d.branches.length + 1, deleted: false }),
        ...stripBranch(input), code: input.code.trim().toUpperCase(), updated_at: stamp(), updated_by: by,
      } as Branch;
      validateBranch(next);
      const changes = existing ? diff(existing, next) : null;
      if (existing) Object.assign(existing, next); else d.branches.push(next);
      if (input.holidays) {
        d.holidays = d.holidays.filter((h) => h.branch_id !== next.id).concat(input.holidays.map((h) => ({ ...h, id: h.id || uid("hol"), branch_id: next.id })));
      }
      audit(by, "branch", next.id, existing ? "update" : "create", changes, next.code);
      commit();
      return next;
    }
    case "DELETE /admin/branches/:id": {
      const by = requireAdmin(token);
      const b = d.branches.find((x) => x.id === id);
      if (!b) throw new ApiError(404, "Branch not found");
      if ((d.sales[b.id] ?? 0) > 0) {
        Object.assign(b, { deleted: true, is_active: false, show_on_website: false, is_dispatch: false, updated_at: stamp(), updated_by: by });
        audit(by, "branch", b.id, "soft-delete (has sales)", null, b.code);
      } else {
        d.branches = d.branches.filter((x) => x.id !== id);
        d.holidays = d.holidays.filter((h) => h.branch_id !== id);
        d.branchProducts = d.branchProducts.filter((x) => x.branch_id !== id);
        audit(by, "branch", b.id, "delete", b.code, null);
      }
      commit();
      return { ok: true };
    }
    case "PUT /admin/branch-order": {
      const by = requireAdmin(token);
      (body as string[]).forEach((bid, i) => { const b = d.branches.find((x) => x.id === bid); if (b) b.sort_order = i + 1; });
      audit(by, "branch", "*", "reorder", null, body);
      commit();
      return { ok: true };
    }

    /* admin: products */
    case "GET /admin/products": requireAdmin(token);
      return [...d.products].sort((a, b) => a.sort_order - b.sort_order).map(publicProduct);
    case "POST /admin/products":
    case "PUT /admin/products/:id": {
      const by = requireAdmin(token);
      const input = body as Product;
      const existing = id ? d.products.find((p) => p.id === id) : undefined;
      if (id && !existing) throw new ApiError(404, "Product not found");
      const next: Product = {
        ...(existing ?? { id: uid("pr"), created_at: stamp() }),
        ...stripProduct(input), code: input.code.trim().toUpperCase(), updated_at: stamp(), updated_by: by,
      } as Product;
      validateProduct(next);
      const changes = existing ? diff(existing, next) : null;
      if (existing) Object.assign(existing, next); else d.products.push(next);
      audit(by, "product", next.id, existing ? "update" : "create", changes, next.code);
      commit();
      return next;
    }

    /* admin: per-branch product settings */
    case "GET /admin/branch-products": requireAdmin(token);
      return d.branchProducts.map((bp) => ({ ...bp, sold_out_today: isSoldOutToday(bp) }));
    case "PUT /admin/branch-products": {
      const by = requireAdmin(token);
      const input = body as { branch_id: string; product_id: string; price_override: number | null; is_available: boolean; sold_out_today: boolean };
      if (input.price_override != null && !(input.price_override > 0)) throw new ApiError(422, "Price override must be above ₹0, or empty", { price_override: "Above ₹0, or empty" });
      let bp = d.branchProducts.find((x) => x.branch_id === input.branch_id && x.product_id === input.product_id);
      const old = bp ? { ...bp } : null;
      if (!bp) { bp = { branch_id: input.branch_id, product_id: input.product_id, price_override: null, is_available: true, sold_out_date: null }; d.branchProducts.push(bp); }
      bp.price_override = input.price_override;
      bp.is_available = input.is_available;
      bp.sold_out_date = input.sold_out_today ? nowIST().date : null;
      audit(by, "branch_product", `${input.branch_id}/${input.product_id}`, "update", old, { ...bp });
      commit();
      return bp;
    }

    /* admin: delivery settings */
    case "GET /admin/delivery-settings": requireAdmin(token);
      return d.settings;
    case "PUT /admin/delivery-settings": {
      const by = requireAdmin(token);
      const next = { ...d.settings, ...(body as DeliverySettings), updated_at: stamp(), updated_by: by };
      next.slabs = [...next.slabs].map((x) => ({ upto_km: Number(x.upto_km), fee: Math.round(Number(x.fee)) }));
      validateSettings(next);
      audit(by, "delivery_settings", "1", "update", d.settings, next);
      d.settings = next;
      d.quoteCache = {}; // fees and radius may have changed
      commit();
      return next;
    }
    case "GET /admin/audit": requireAdmin(token);
      return { audit: d.audit, logs: d.logs.slice(0, 50) };
    case "POST /admin/reset": {
      const by = requireAdmin(token);
      db = seed();
      audit(by, "database", "*", "reset to seed", null, null);
      commit();
      return { ok: true };
    }
  }
  throw new ApiError(404, `No route for ${method} ${path}`);
}

/* only the editable fields; server-owned fields (ids, audit, deleted) are never taken from the client */
function stripBranch(b: Branch) {
  const { code, name_en, name_ta, type, address_en, address_ta, district, latitude, longitude, google_maps_url, phone, open_days, open_time, close_time, is_active, show_on_website, is_dispatch, delivery_radius_km, photo_url } = b;
  return { code, name_en: name_en.trim(), name_ta: name_ta.trim(), type, address_en, address_ta, district, latitude, longitude, google_maps_url, phone, open_days, open_time, close_time, is_active, show_on_website, is_dispatch, delivery_radius_km, photo_url };
}
function stripProduct(p: Product) {
  const { code, name_en, name_ta, size_label_en, size_label_ta, volume_ml, description_en, description_ta, image_url, base_price, is_active, sell_online, sell_in_pos, plan_eligible, max_qty_per_order, sort_order } = p;
  return { code, name_en: name_en.trim(), name_ta: name_ta.trim(), size_label_en, size_label_ta, volume_ml, description_en, description_ta, image_url, base_price: Math.round(base_price), is_active, sell_online, sell_in_pos, plan_eligible, max_qty_per_order, sort_order };
}
function diff(a: object, b: object) {
  const out: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(b)) {
    const x = (a as Record<string, unknown>)[k], y = (b as Record<string, unknown>)[k];
    if (k !== "updated_at" && JSON.stringify(x) !== JSON.stringify(y)) out[k] = [x, y];
  }
  return out;
}


/* =====================================================================
   Operations: orders, subscriptions, delivery jobs, partners, cash, visits
   ===================================================================== */
const NOT_OPS = Symbol("not-ops");

function recordOrder(d: Db, req: CreateOrderRequest, pricing: CreatedOrderPricing, mobile: string, name: string, email: string, address: AccountAddress | null) {
  const today = istDate();
  const products = d.products;
  const order: ServerOrder = {
    ref: pricing.order_ref, created_at: stamp(), date: today,
    customer: { mobile, name }, address, area: address?.area ?? "", branch_id: pricing.delivery.branch_id, distance_km: pricing.delivery.distance_km,
    items: pricing.items.map((i) => ({ name: i.productName, size: i.sizeLabel, qty: i.qty, lineTotal: i.lineTotal, plan: i.plan, planDays: i.planDays })),
    subtotal: pricing.subtotal, discount: pricing.couponDiscount + pricing.planDiscount, delivery_fee: pricing.deliveryFee, total: pricing.total,
    payment: req.payment ?? "upi", status: "placed",
  };
  (d.orders ??= []).unshift(order);
  // each plan line becomes a subscription, starting today
  for (const i of pricing.items.filter((x) => x.plan)) {
    const p = products.find((x) => x.id === i.productId);
    const discount = Math.round((i.lineTotal * (i.planDiscountPct ?? 0)) / 100);
    const s: Subscription = {
      id: uid("sub"), ref: "SUB-" + Math.floor(100000 + Math.random() * 900000), created_at: stamp(), order_ref: order.ref,
      customer: { mobile, name, email }, address, area: address?.area ?? "", branch_id: order.branch_id,
      product_id: i.productId, product_name: p?.name_en ?? i.productName, size: i.sizeLabel, qty: i.qty,
      plan_days: i.planDays ?? 7, discount_pct: i.planDiscountPct ?? 0, amount_paid: i.lineTotal - discount, payment: order.payment,
      start_date: today, records: {}, pauses: [], cancelled_at: null, cancel_end_date: null, notes: "",
    };
    (d.subs ??= []).unshift(s);
  }
  createOrderJob(d, order);
}

function viewSub(s: Subscription, today = istDate()) {
  const cal = planCalendar(s, today);
  return { ...s, calendar: cal.days, delivered: cal.delivered, failed: cal.failed, paused_days: cal.paused, remaining: cal.remaining, end_date: cal.endDate, status: cal.status };
}

function requirePartner(d: Db, token?: string) {
  const p = partnerFromToken(d, token);
  if (!p) throw new ApiError(401, "Please sign in again.", undefined, "PARTNER_SIGNED_OUT");
  return p;
}
function jobAudit(by: string, j: Job, action: string, note?: string) {
  j.history.push({ at: stamp(), action, by, note });
  audit(by, "delivery", j.ref, action, null, note ?? null);
}
const toOrderStatus: Record<Job["status"], ServerOrder["status"]> = { READY: "confirmed", PICKED: "preparing", OUT: "out_for_delivery", DELIVERED: "delivered", FAILED: "confirmed" };

/** Updates the order / subscription day / event a job came from. */
function syncSource(d: Db, j: Job) {
  if (j.type === "ORDER") {
    const o = (d.orders ?? []).find((x) => x.ref === j.source_id);
    if (o && o.status !== "cancelled") o.status = toOrderStatus[j.status];
  } else if (j.type === "SUBSCRIPTION") {
    const s = (d.subs ?? []).find((x) => x.id === j.source_id);
    const partner = (d.partners ?? []).find((p) => p.id === j.partner_id)?.name;
    if (s && j.status === "DELIVERED") s.records[j.date] = { status: "DELIVERED", partner, time: j.delivered_at };
    if (s && j.status === "FAILED") s.records[j.date] = { status: "FAILED", partner, time: j.failed_at, reason: j.fail_reason };
  } else if (j.type === "EVENT") {
    const e = (d.eventRequests ?? []).find((x) => x.id === j.source_id);
    if (e && j.status === "DELIVERED") { e.balance_collected = (e.balance_collected ?? 0) + (j.collected?.amount ?? 0); e.status = "COMPLETED"; }
  }
}

function opsRoute(method: string, scope: string, resource: string, id: string | undefined, body: unknown, adminToken?: string, customerToken?: string, partnerToken?: string): unknown {
  const d = load();
  const b = (body ?? {}) as Record<string, unknown>;
  const today = istDate();
  const route = `${method} /${scope}/${resource}${id ? "/:id" : ""}`;
  const wrap = <T,>(fn: () => T): T => { try { return fn(); } catch (e) { if (e instanceof OpsError) throw new ApiError(e.status, e.message, e.fields, e.code); throw e; } };
  const prepareJobs = () => ensureDailyJobs(d, d.eventRequests ?? [], today);

  switch (route) {
    /* ---------- public / customer ---------- */
    case "POST /visits/track": {
      // anonymous first-party visitor id + path; admin and partner pages are never sent
      const vid = String(b.vid ?? "").slice(0, 40), path = String(b.path ?? "").slice(0, 120);
      if (!vid || path.startsWith("/admin") || path.startsWith("/partner")) return { ok: true };
      (d.visits ??= []).push({ vid, path, at: stamp() });
      if (d.visits.length > 20000) d.visits = d.visits.slice(-20000);
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ }
      return { ok: true };
    }
    case "POST /orders/status": {
      const refs = new Set((b.refs as string[]) ?? []);
      return (d.orders ?? []).filter((o) => refs.has(o.ref)).map((o) => {
        const j = (d.jobs ?? []).find((x) => x.type === "ORDER" && x.source_id === o.ref);
        return { ref: o.ref, status: o.status, job: j ? { status: j.status, delivered_at: j.delivered_at ?? null } : null };
      });
    }
    case "POST /subscriptions/mine": {
      // signed in: all plans on the account; guest: plans from orders placed on this device
      const mobile = sessionCustomer(d, customerToken)?.mobile;
      const refs = new Set((b.orderRefs as string[]) ?? []);
      return (d.subs ?? []).filter((s) => (mobile && s.customer.mobile === mobile) || refs.has(s.order_ref)).map((s) => viewSub(s, today));
    }
    case "PUT /subscriptions/action": {
      const mobile = sessionCustomer(d, customerToken)?.mobile;
      const refs = new Set((b.orderRefs as string[]) ?? []);
      const s = (d.subs ?? []).find((x) => x.id === b.id && ((mobile && x.customer.mobile === mobile) || refs.has(x.order_ref)));
      if (!s) throw new ApiError(404, "Plan not found");
      // customers can only cancel; pause and resume are admin-only
      if (b.action !== "cancel") throw new ApiError(403, "Plans can't be paused. Call us if you need to change your deliveries.");
      wrap(() => subscriptionAction(s, "cancel", today));
      audit(`customer:${s.customer.mobile}`, "subscription", s.ref, String(b.action), null, null);
      commit();
      return viewSub(s, today);
    }

    /* ---------- delivery partner ---------- */
    case "POST /partner/login":
      return partnerLogin(d, String(b.mobile ?? ""), String(b.password ?? "")).then((r) => { commit(); return r; }, (e) => { throw e instanceof OpsError ? new ApiError(e.status, e.message) : e; });
    case "GET /partner/me": {
      const p = requirePartner(d, partnerToken);
      return { partner: publicPartner(p), summary: partnerSummary(d, p.id, today), branch: d.branches.find((x) => x.id === p.branch_id)?.name_en ?? "" };
    }
    case "PUT /partner/online": {
      const p = requirePartner(d, partnerToken);
      p.online = !!b.online;
      audit(`partner:${p.mobile}`, "partner", p.id, p.online ? "online" : "offline", null, null);
      commit();
      return { online: p.online };
    }
    case "GET /partner/jobs": {
      const p = requirePartner(d, partnerToken);
      prepareJobs(); commit();
      const jobs = d.jobs ?? [];
      return {
        available: p.online ? jobs.filter((j) => j.status === "READY" && j.branch_id === p.branch_id).map((j) => jobForPartner(j, p.id)) : [],
        mine: jobs.filter((j) => j.partner_id === p.id && (j.status === "PICKED" || j.status === "OUT")).map((j) => jobForPartner(j, p.id)),
        history: jobs.filter((j) => j.partner_id === p.id && (j.status === "DELIVERED" || j.status === "FAILED")).map((j) => jobForPartner(j, p.id)),
        summary: partnerSummary(d, p.id, today), online: p.online,
      };
    }
    case "POST /partner/pick":
    case "POST /partner/start":
    case "POST /partner/release":
    case "POST /partner/deliver":
    case "POST /partner/fail": {
      const p = requirePartner(d, partnerToken);
      const j = (d.jobs ?? []).find((x) => x.id === b.id);
      if (!j) throw new ApiError(404, "Order not found");
      const by = `partner:${p.mobile}`;
      if (resource === "pick") {
        if (!p.online) throw new ApiError(409, "Go online to pick orders.");
        // first tap wins: the job is only READY once
        if (j.status !== "READY" || j.partner_id) throw new ApiError(409, "Already picked by another partner.", undefined, "ALREADY_PICKED");
        Object.assign(j, { status: "PICKED", partner_id: p.id, picked_at: stamp() });
        jobAudit(by, j, "picked");
      } else {
        if (j.partner_id !== p.id || !(j.status === "PICKED" || j.status === "OUT")) throw new ApiError(409, "This order isn't in your list.");
        if (resource === "start") { j.status = "OUT"; j.out_at = stamp(); jobAudit(by, j, "out for delivery"); }
        if (resource === "release") {
          const reason = String(b.reason ?? "").trim();
          if (!reason) throw new ApiError(422, "Give a reason for releasing the order.", { reason: "Required" });
          Object.assign(j, { status: "READY", partner_id: null, picked_at: undefined, out_at: undefined });
          jobAudit(by, j, "released", reason);
        }
        if (resource === "deliver") {
          if (j.due > 0) {
            const method = b.method === "UPI" ? "UPI" : b.method === "CASH" ? "CASH" : null;
            const amount = Math.round(Number(b.amount));
            const reason = String(b.reason ?? "").trim();
            if (!method) throw new ApiError(422, "Choose Cash or UPI.", { method: "Required" });
            if (!(amount >= 0)) throw new ApiError(422, "Enter the amount received.", { amount: "Required" });
            if (amount !== j.due && !reason) throw new ApiError(422, "The amount differs from the amount due. Give a reason.", { reason: "Required when the amount differs" });
            j.collected = { method, amount, reason: reason || undefined };
          }
          Object.assign(j, { status: "DELIVERED", delivered_at: stamp(), location: (b.location as Job["location"]) ?? null });
          jobAudit(by, j, j.due > 0 ? `collected ${j.collected!.method} ₹${j.collected!.amount / 100} & delivered` : "delivered", j.collected?.reason);
        }
        if (resource === "fail") {
          const reason = String(b.reason ?? "").trim();
          if (!reason) throw new ApiError(422, "Choose a reason.", { reason: "Required" });
          Object.assign(j, { status: "FAILED", failed_at: stamp(), fail_reason: reason, fail_photo: (b.photo as string) || undefined, location: (b.location as Job["location"]) ?? null });
          jobAudit(by, j, "failed", reason);
        }
      }
      syncSource(d, j);
      commit();
      return jobForPartner(j, p.id);
    }

    /* ---------- admin ---------- */
    case "GET /admin/partners": requireAdmin(adminToken);
      return (d.partners ?? []).map((x) => ({ ...publicPartner(x), summary: partnerSummary(d, x.id, today) }));
    case "POST /admin/partners":
    case "PUT /admin/partners/:id": {
      const by = requireAdmin(adminToken);
      return upsertPartner(d, b as never, id).then((p) => {
        audit(by, "partner", p.id, id ? "update" : "create", null, { name: p.name, mobile: p.mobile, branch_id: p.branch_id, active: p.active, password_changed: !!b.password });
        commit();
        return publicPartner(p);
      }, (e) => { throw e instanceof OpsError ? new ApiError(e.status, e.message, e.fields) : e; });
    }
    case "GET /admin/orders": requireAdmin(adminToken);
      prepareJobs(); commit();
      return (d.orders ?? []).map((o) => ({ ...o, job: (d.jobs ?? []).find((j) => j.type === "ORDER" && j.source_id === o.ref) ?? null }));
    case "PUT /admin/orders/:id": {
      const by = requireAdmin(adminToken);
      const o = (d.orders ?? []).find((x) => x.ref === id);
      if (!o) throw new ApiError(404, "Order not found");
      if (b.action !== "cancel") throw new ApiError(422, "Unknown action");
      const j = (d.jobs ?? []).find((x) => x.type === "ORDER" && x.source_id === o.ref);
      if (j && j.status !== "READY") throw new ApiError(409, "A delivery partner already has this order.");
      o.status = "cancelled";
      if (j) d.jobs = d.jobs!.filter((x) => x !== j);
      audit(by, "order", o.ref, "cancel", null, null);
      commit();
      return o;
    }
    case "GET /admin/subscriptions": requireAdmin(adminToken);
      return (d.subs ?? []).map((s) => viewSub(s, today));
    case "PUT /admin/subscriptions/:id": {
      const by = requireAdmin(adminToken);
      const s = (d.subs ?? []).find((x) => x.id === id);
      if (!s) throw new ApiError(404, "Plan not found");
      if (b.action === "notes") { s.notes = String(b.notes ?? "").slice(0, 2000); audit(by, "subscription", s.ref, "notes", null, null); }
      else { wrap(() => subscriptionAction(s, b.action as "pause" | "resume" | "cancel", today)); audit(by, "subscription", s.ref, String(b.action), null, null); }
      commit();
      return viewSub(s, today);
    }
    case "GET /admin/jobs": {
      requireAdmin(adminToken);
      prepareJobs(); commit();
      const date = String(b.date ?? today);
      const names = Object.fromEntries((d.partners ?? []).map((p) => [p.id, p.name]));
      return (d.jobs ?? []).filter((j) => j.date === date || j.status === "READY" || j.status === "PICKED" || j.status === "OUT")
        .map((j) => ({ ...j, partner_name: j.partner_id ? names[j.partner_id] ?? "" : "" }));
    }
    case "GET /admin/cash": {
      requireAdmin(adminToken);
      return (d.partners ?? []).map((p) => {
        const mine = (d.jobs ?? []).filter((j) => j.partner_id === p.id && j.collected);
        const cashAll = mine.filter((j) => j.collected!.method === "CASH").reduce((n, j) => n + j.collected!.amount, 0);
        const handed = (d.handovers ?? []).filter((h) => h.partner_id === p.id).reduce((n, h) => n + h.amount, 0);
        const todays = mine.filter((j) => j.date === today);
        return {
          partner_id: p.id, name: p.name, mobile: p.mobile, branch_id: p.branch_id,
          cash_today: todays.filter((j) => j.collected!.method === "CASH").reduce((n, j) => n + j.collected!.amount, 0),
          upi_today: todays.filter((j) => j.collected!.method === "UPI").reduce((n, j) => n + j.collected!.amount, 0),
          handed_over: handed, pending: Math.max(0, cashAll - handed),
          handovers: (d.handovers ?? []).filter((h) => h.partner_id === p.id).slice(-5),
        };
      });
    }
    case "POST /admin/cash": {
      const by = requireAdmin(adminToken);
      const amount = Math.round(Number(b.amount));
      if (!(amount > 0)) throw new ApiError(422, "Enter the amount received.");
      (d.handovers ??= []).push({ id: uid("ho"), partner_id: String(b.partner_id), amount, at: stamp(), by });
      audit(by, "cash", String(b.partner_id), `received ₹${amount / 100}`, null, null);
      commit();
      return { ok: true };
    }
    case "GET /admin/dashboard": {
      requireAdmin(adminToken);
      prepareJobs(); commit();
      return {
        today,
        orders: d.orders ?? [],
        subs: (d.subs ?? []).map((s) => viewSub(s, today)),
        events: d.eventRequests ?? [],
        jobs: d.jobs ?? [],
        visits: d.visits ?? [],
        customers: Object.values(d.customers ?? {}).map((c) => ({ mobile: c.mobile, created_at: c.created_at })),
        partners: (d.partners ?? []).map((p) => ({ id: p.id, name: p.name, branch_id: p.branch_id })),
        handovers: d.handovers ?? [],
        branches: d.branches.filter((x) => !x.deleted).map((x) => ({ id: x.id, name: x.name_en })),
      };
    }
  }
  void addDays;
  return NOT_OPS;
}
