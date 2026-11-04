// Mock backend. It stands in for the real server: it owns the data, enforces admin roles, computes
// delivery quotes and prices orders. Everything is saved in this browser's localStorage.
// Replace src/api/client.ts's transport with real fetch() calls and this file goes away.
import type {
  AuditEntry, Branch, BranchHoliday, BranchProduct, CreateOrderRequest, CreatedOrderPricing, DeliveryQuote,
  DeliverySettings, Product, PublicProduct, QuoteRequest,
} from "./types";
import bcrypt from "bcryptjs";
import { COUPONS } from "@/data/catalog";
import { ADMIN_SECTIONS, MANAGER_DEFAULT, SECTION_OF_RESOURCE, SHARED_READS, type AdminSection, type StaffRole } from "@/data/adminSections";
import {
  PromoError, addCommission, commissionTotals, discountOn, earnCommissions, normaliseCode, promoterByCode,
  publicPromoter, reverseCommissions, upsertPromoter, PROMO_DISCOUNT_PCT, type PromoDb,
} from "./promoServer";
import { DELIVERY_SLOTS, REGULAR_HOURS, regularDeliveryDate } from "@/data/slots";
import { drivingDistanceKm } from "@/lib/googleMaps";
import {
  OpsError, addDays, createOrderJob, ensureDailyJobs, istDate, jobForPartner, partnerFromToken, partnerLogin, partnerSummary,
  planCalendar, publicPartner, subscriptionAction, upsertPartner,
  type Job, type OpsDb, type ServerOrder, type Subscription,
  fullAddress, landmarkOf,
} from "./opsServer";
import { AuthError, handleAuth, isValidMobile, normaliseMobile, sessionCustomer, upsertCustomerForOrder, type AuthDb, type StoredAddress as AccountAddress } from "./authServer";
import { EVENT_RATE_PER_LITRE, SERVICE_OPTIONS, type ServiceOption } from "@/data/events";

export interface EventRequest {
  id: string; ref: string; created_at: string;
  name: string; phone: string; event_type: string; event_date: string; event_time: string;
  service: ServiceOption; litres: number; venue: string; notes: string;
  base_amount: number; // paise, litres × rate, computed here
  status: "NEW" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  promo_code?: string; // a promoter's code: no discount on events, the promoter earns commission
  advance_paid?: number; // paise, recorded by admin when confirming
  balance_collected?: number; // paise, collected by the delivery partner on the event date
  branch_id?: string;
}

export const SUPER_ADMINS = ["8825687662", "9942421611"];
const KEY = "ssp-db-v1";
const STATE_KEY = "ssp-state-v1"; // the shop's own storage, where customer addresses live

/** A staff member who can sign in to the admin workspace (besides the built-in owners). */
export interface StaffUser {
  mobile: string; name: string; role: StaffRole; sections: AdminSection[]; active: boolean; created_at: string; updated_by: string;
  password_hash?: string; session_version?: number; // staff sign in at /manager with mobile + password
}

interface Db extends AuthDb, OpsDb, PromoDb {
  staff?: StaffUser[];
  staffSessions?: Record<string, { mobile: string; sv: number; expires: number }>;
  /** owners' passwords (set on their first sign-in) */
  ownerAuth?: Record<string, { password_hash: string; session_version: number }>;
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
/** Daily plan discount by length: 7 days 5%, 15 days 5%, 30 days 10%. */
export const PLAN_DISCOUNTS: Record<string, number> = { "7": 5, "15": 5, "30": 10 };
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
      plan_free_delivery: true, plan_discount_percent: 10, plan_discounts: { ...PLAN_DISCOUNTS }, updated_at: stamp(), updated_by: SEED_BY,
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
  if (!done.includes("plan-discounts-5-5-10")) {
    // the shop's plan offers: 7 and 15 days 5% off, 30 days 10% off (promoter codes add their own 5%)
    d.settings.plan_discounts = { ...PLAN_DISCOUNTS };
    d.settings.plan_discount_percent = 10;
    done.push("plan-discounts-5-5-10");
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
  if (!done.includes("manual-order-lifecycle")) {
    // orders now wait for the admin; older statuses map onto the new lifecycle
    const map: Record<string, ServerOrder["status"]> = { placed: "pending", preparing: "picked_up", out_for_delivery: "picked_up" };
    for (const o of d.orders ?? []) {
      o.status = map[o.status as string] ?? o.status;
      o.payment_status ??= o.payment === "cod" ? "DUE" : "ONLINE";
    }
    for (const j of d.jobs ?? []) if (j.status === "OUT") j.status = "PICKED";
    done.push("manual-order-lifecycle");
  }
  if (!done.includes("otp-hashed")) {
    // delivery OTPs are kept as hashes only
    for (const r of Object.values(d.otps ?? {})) if (r.code) { r.hash = bcrypt.hashSync(r.code, 6); delete r.code; }
    done.push("otp-hashed");
  }
  if (!done.includes("demo-distance-fallback")) {
    d.settings.demo_distance_fallback = true;
    done.push("demo-distance-fallback");
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
  }
}

let lastSaved = "";
function commit() {
  // Reads also commit (they create today's plan and event deliveries the first time anyone looks), so only a real
  // change is saved and announced. Announcing every read made every open list reload, which read and announced
  // again: an endless loop that tripped the admin rate limit.
  const json = JSON.stringify(db);
  if (json === lastSaved) return;
  lastSaved = json;
  try { localStorage.setItem(KEY, json); } catch { /* storage full or blocked: keep in memory */ }
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
async function priceOrder(req: CreateOrderRequest, at?: { lat: number; lng: number; district: string }): Promise<CreatedOrderPricing> {
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
    const today = istDate();
    if (l.plan && l.startDate && (!/^\d{4}-\d{2}-\d{2}$/.test(l.startDate) || l.startDate < today || l.startDate > addDays(today, 30))) throw new ApiError(422, "Choose a plan start date within the next 30 days");
    return { productId: p.id, productName: p.name_en, sizeLabel: p.size_label_en, unitPrice: pp.price, qty: l.qty, lineTotal: pp.price * l.qty * days, plan: l.plan, planDays: l.plan ? days : undefined, planDiscountPct: l.plan ? planPct(s, days) : undefined, startDate: l.plan ? l.startDate || today : undefined, slot: l.plan && DELIVERY_SLOTS.includes(String(l.slot)) ? String(l.slot) : undefined };
  });
  const subtotal = items.reduce((n, i) => n + i.lineTotal, 0);
  const coupon = req.couponCode ? COUPONS[req.couponCode.toUpperCase()] : undefined;
  // a promoter's code: 5% off product prices only (regular parcels and plans); delivery is added after
  const promoter = !coupon ? promoterByCode(load(), req.couponCode) : undefined;
  const couponDiscount = promoter ? discountOn(subtotal) : !coupon ? 0 : coupon.type === "percent" ? Math.round((subtotal * coupon.value) / 100) : Math.min(coupon.value * 100, subtotal);
  const planDiscount = items.filter((i) => i.plan).reduce((n, i) => n + Math.round((i.lineTotal * (i.planDiscountPct ?? 0)) / 100), 0);
  const q = await quote(at ? { lat: at.lat, lng: at.lng, district: at.district, subtotal, hasPlan: items.some((i) => i.plan) } : { addressId: req.addressId, subtotal, hasPlan: items.some((i) => i.plan) });
  if (!q.deliverable) throw new ApiError(422, q.message);
  const total = Math.max(0, subtotal - couponDiscount - planDiscount + q.fee);
  return {
    items, subtotal, couponDiscount, planDiscount, deliveryFee: q.fee, total,
    promo: promoter ? { code: promoter.code, promoter_id: promoter.id, pct: PROMO_DISCOUNT_PCT } : undefined,
    delivery: { branch_id: q.branch!.id, distance_km: q.distanceKm!, method: q.method!, freeReason: q.freeReason },
    order_ref: "SSP-" + Math.floor(100000 + Math.random() * 900000), account: { created: false },
  };
}

/* ---------------- router ---------------- */
const hits: number[] = [];
/** wrong promoter number/code attempts per mobile, for the promoter self-check page */
const promoTries: Record<string, number[]> = {};
/** Wrong sign-in attempts per account (staff or partner): 5 within 15 minutes locks that number for 15 minutes. */
const loginFails: Record<string, number[]> = {};
const LOCK_MS = 15 * 60_000;
function loginLocked(key: string) {
  const recent = (loginFails[key] ?? []).filter((t) => Date.now() - t < LOCK_MS);
  loginFails[key] = recent;
  if (recent.length >= 5) throw new ApiError(429, "Too many wrong attempts. This number is locked for 15 minutes.");
}
const loginFailed = (key: string) => { (loginFails[key] ??= []).push(Date.now()); };
const loginOk = (key: string) => { delete loginFails[key]; };
function rateLimit() {
  const t = Date.now();
  while (hits.length && t - hits[0] > 60_000) hits.shift();
  if (hits.length >= 120) throw new ApiError(429, "Too many admin requests. Wait a minute and try again.");
  hits.push(t);
}
/** The signed-in staff member: a built-in owner (super admin), or an active staff account. */
function staffFor(token?: string): { mobile: string; name: string; role: StaffRole; sections: AdminSection[] } | null {
  if (!token) return null;
  const sess = load().staffSessions?.[token];
  if (sess && SUPER_ADMINS.includes(sess.mobile)) {
    const o = load().ownerAuth?.[sess.mobile];
    if (!o || sess.expires < Date.now() || sess.sv !== o.session_version) return null;
    return { mobile: sess.mobile, name: "Owner", role: "SUPER_ADMIN", sections: [...ADMIN_SECTIONS.map((x) => x.id), "team"] };
  }
  const s = sess ? load().staff?.find((x) => x.mobile === sess.mobile && x.active) : undefined;
  if (!sess || !s || sess.expires < Date.now() || sess.sv !== (s.session_version ?? 1)) return null;
  return { mobile: s.mobile, name: s.name, role: s.role, sections: s.role === "SUPER_ADMIN" ? [...ADMIN_SECTIONS.map((x) => x.id), "team"] : s.sections };
}
function requireAdmin(token?: string) {
  const who = staffFor(token);
  if (!who) throw new ApiError(403, "Admins only");
  rateLimit();
  return who.mobile;
}
/** Every admin request is checked against the person's sections (super admins can open everything). */
function requireSection(token: string | undefined, resource: string, method: string) {
  const who = staffFor(token);
  if (!who) return; // the route's own requireAdmin answers with "Admins only"
  if (who.role === "SUPER_ADMIN") return;
  if (method === "GET" && SHARED_READS.has(resource)) return;
  const section = SECTION_OF_RESOURCE[resource];
  const allowed = section === undefined ? [] : Array.isArray(section) ? section : [section];
  if (!allowed.some((x) => who.sections.includes(x))) throw new ApiError(403, "You don't have access to this section. Ask the super admin.");
}
const visibleBranches = () => load().branches.filter((b) => !b.deleted).sort((a, b) => a.sort_order - b.sort_order);

export function handle(method: string, path: string, body: unknown, token?: string, customerToken?: string, partnerToken?: string): unknown {
  // Re-read the stored data on every call, as a server would read its database: another tab (an admin,
  // or a second delivery partner) may have changed it, e.g. picked the same order a moment ago.
  db = null;
  const [, , scope, resource, id] = path.split("/"); // "", "api", scope, resource, id
  if (scope === "admin") requireSection(token, resource, method);
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
      // event orders: a promoter's code gives no discount; the promoter earns 10% of the paruthipaal price
      // (litres × rate), never of transport or live-counter service charges
      const evPromoter = promoterByCode(d, (b as { promo_code?: string }).promo_code);
      if ((b as { promo_code?: string }).promo_code && !evPromoter) throw new ApiError(422, "This promo code is not valid.", { promo_code: "Not a valid code" });
      if (evPromoter) { Object.assign(req, { promo_code: evPromoter.code }); addCommission(d, evPromoter, "EVENT", req.ref, req.id, req.name, req.base_amount, 0); }
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
      if (status === "COMPLETED") earnCommissions(d, (c) => c.kind === "EVENT" && c.source_id === r.id);
      if (status === "CANCELLED") reverseCommissions(d, (c) => c.kind === "EVENT" && c.source_id === r.id, "event cancelled");
      if (advance_paid != null) r.advance_paid = Math.max(0, Math.min(r.base_amount, Math.round(advance_paid)));
      r.branch_id ??= "br-main";
      commit();
      return r;
    }
    case "POST /auth/admin":
    case "POST /auth/staff": {
      // Owners, super admins and managers all sign in with mobile + password and get a 12-hour session.
      // An owner without a password yet sets it on this first sign-in.
      const sb = (body ?? {}) as { mobile?: string; phone?: string; password?: string };
      const mobile = String(sb.mobile ?? sb.phone ?? "").replace(/\D/g, "").slice(-10);
      const password = String(sb.password ?? "");
      const lockKey = `staff:${mobile}`;
      try { loginLocked(lockKey); } catch (e) { return Promise.reject(e); }
      const owner = SUPER_ADMINS.includes(mobile);
      const staff = owner ? undefined : (d.staff ?? []).find((x) => x.mobile === mobile && x.active);
      if (!owner && !staff) { loginFailed(lockKey); return Promise.reject(new ApiError(401, "Mobile number or password is incorrect.")); }
      const first = owner && !d.ownerAuth?.[mobile];
      if (first && password.length < 6) return Promise.reject(new ApiError(422, "First sign-in for this owner number: choose a password of at least 6 characters.", { password: "At least 6 characters" }, "OWNER_SETUP"));
      const check = first ? Promise.resolve(true)
        : bcrypt.compare(password, owner ? d.ownerAuth![mobile].password_hash : staff!.password_hash ?? "!");
      return check.then((ok) => {
        if (!ok) { loginFailed(lockKey); throw new ApiError(401, "Mobile number or password is incorrect."); }
        loginOk(lockKey);
        if (first) (d.ownerAuth ??= {})[mobile] = { password_hash: bcrypt.hashSync(password, 8), session_version: 1 };
        const sv = owner ? d.ownerAuth![mobile].session_version : staff!.session_version ?? 1;
        const t = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, "0")).join("");
        (d.staffSessions ??= {})[t] = { mobile, sv, expires: Date.now() + 12 * 3600_000 };
        audit(`staff:${mobile}`, "staff", mobile, first ? "owner password set · signed in" : "signed in", null, null);
        commit();
        const who = staffFor(t)!;
        return { token: t, phone: mobile, role: who.role, sections: who.sections, name: who.name, first };
      });
    }
    /* admin: who am I, and team & access */
    case "GET /admin/me": {
      const who = staffFor(token);
      if (!who) throw new ApiError(403, "Admins only");
      return who;
    }
    case "GET /admin/staff": requireAdmin(token);
      return { owners: SUPER_ADMINS, staff: (d.staff ?? []).map((x) => { const { password_hash: h, session_version: v, ...pub } = x; void v; return { ...pub, has_password: !!h }; }) };
    case "POST /admin/staff":
    case "PUT /admin/staff/:id": {
      const by = requireAdmin(token);
      const s = body as Partial<StaffUser>;
      const f: Record<string, string> = {};
      const mobile = String(s.mobile ?? "").replace(/\D/g, "").slice(-10);
      if (!String(s.name ?? "").trim()) f.name = "Name is required";
      if (!/^[6-9]\d{9}$/.test(mobile)) f.mobile = "Enter a valid 10-digit mobile number";
      if (SUPER_ADMINS.includes(mobile)) f.mobile = "This number is an owner already";
      const list = (d.staff ??= []);
      if (list.some((x) => x.mobile === mobile && x.mobile !== id)) f.mobile = "This number already has access";
      const role: StaffRole = s.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "MANAGER";
      const valid = new Set<string>(ADMIN_SECTIONS.map((x) => x.id));
      const sections = (Array.isArray(s.sections) ? s.sections : MANAGER_DEFAULT).filter((x) => valid.has(x)) as AdminSection[];
      if (role === "MANAGER" && !sections.length) f.sections = "Choose at least one section";
      const password = String((s as { password?: string }).password ?? "");
      const prev = id ? list.find((x) => x.mobile === id) : undefined;
      if (!prev && password.length < 6) f.password = "Set a password of at least 6 characters";
      if (password && password.length < 6) f.password = "At least 6 characters";
      if (Object.keys(f).length) throw new ApiError(422, "Please fix the highlighted fields", f);
      const existing = id ? list.find((x) => x.mobile === id) : undefined;
      if (id && !existing) throw new ApiError(404, "Staff member not found");
      const next: StaffUser = {
        mobile, name: String(s.name).trim(), role, sections: role === "MANAGER" ? sections : [], active: s.active ?? true, created_at: existing?.created_at ?? stamp(), updated_by: by,
        password_hash: existing?.password_hash, session_version: existing?.session_version ?? 1,
      };
      // a new password or removing access signs them out everywhere
      if (password) { next.password_hash = bcrypt.hashSync(password, 8); if (existing) next.session_version! += 1; }
      if (existing && existing.active && !next.active) next.session_version! += 1;
      if (existing) Object.assign(existing, next); else list.push(next);
      audit(by, "staff", mobile, existing ? "update" : "create", null, { role, sections: next.sections, active: next.active, password_changed: !!password });
      commit();
      const { password_hash: _h, session_version: _v, ...pub } = next; void _h; void _v;
      return pub;
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
    payment: req.payment ?? "upi", status: "pending",
    payment_status: req.payment === "cod" ? "DUE" : "ONLINE",
    // regular items go out between 10 am and 8 pm; an order placed after 8 pm is delivered the next day
    ...(pricing.items.some((i) => !i.plan)
      ? { delivery_date: regularDeliveryDate(), delivery_slot: REGULAR_HOURS.label }
      : { delivery_date: req.deliveryDate, delivery_slot: req.deliverySlot }),
    payment_ref: req.payment !== "cod" ? req.paymentRef : undefined,
    history: [{ at: stamp(), action: req.payment === "cod" ? "order placed · pay on delivery" : `order placed · paid online${req.paymentRef ? ` (${req.paymentRef})` : ""}`, by: `customer:${mobile}` }],
  };
  (d.orders ??= []).unshift(order);
  // each plan line becomes a subscription, starting on the date the customer chose (today by default)
  for (const i of pricing.items.filter((x) => x.plan)) {
    const p = products.find((x) => x.id === i.productId);
    const discount = Math.round((i.lineTotal * (i.planDiscountPct ?? 0)) / 100);
    const s: Subscription = {
      id: uid("sub"), ref: "SUB-" + Math.floor(100000 + Math.random() * 900000), created_at: stamp(), order_ref: order.ref,
      customer: { mobile, name, email }, address, area: address?.area ?? "", branch_id: order.branch_id,
      product_id: i.productId, product_name: p?.name_en ?? i.productName, size: i.sizeLabel, qty: i.qty,
      plan_days: i.planDays ?? 7, discount_pct: i.planDiscountPct ?? 0, amount_paid: i.lineTotal - discount, payment: order.payment,
      slot: i.slot, start_date: i.startDate ?? today, records: {}, pauses: [], cancelled_at: null, cancel_end_date: null, notes: "",
    };
    (d.subs ??= []).unshift(s);
  }
  // promoter: attribution on the order, and a pending commission per kind (regular parcels; each plan)
  const pm = pricing.promo ? d.promoters?.find((p) => p.id === pricing.promo!.promoter_id) : undefined;
  if (pm) {
    Object.assign(order, { promo_code: pm.code, promoter_id: pm.id, promo_discount: pricing.couponDiscount });
    const regularBase = pricing.items.filter((i) => !i.plan).reduce((n, i) => n + i.lineTotal, 0);
    addCommission(d, pm, "REGULAR", order.ref, order.ref, name, regularBase, discountOn(regularBase));
    for (const s of (d.subs ?? []).filter((x) => x.order_ref === order.ref)) {
      const line = pricing.items.find((i) => i.plan && i.productId === s.product_id);
      if (line) addCommission(d, pm, "PLAN", order.ref, s.id, name, line.lineTotal, discountOn(line.lineTotal));
    }
    orderLog(d, order.ref, `promo code ${pm.code} · customer saved ₹${pricing.couponDiscount / 100}`, "system");
  }
  // no delivery job yet: the admin confirms the order first (see PUT /admin/orders/:id)
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
const toOrderStatus: Record<Job["status"], ServerOrder["status"]> = { READY: "confirmed", ASSIGNED: "confirmed", PICKED: "picked_up", OUT: "picked_up", DELIVERED: "delivered", FAILED: "confirmed", CANCELLED: "cancelled" };

/** Updates the order / subscription day / event a job came from. */
function syncSource(d: Db, j: Job) {
  if (j.type === "ORDER") {
    const o = (d.orders ?? []).find((x) => x.ref === j.source_id);
    if (o && o.status !== "cancelled" && o.status !== "rejected") {
      o.status = toOrderStatus[j.status];
      if (j.paid_at && o.payment_status === "DUE") o.payment_status = "COLLECTED";
      if (o.status === "delivered") earnCommissions(d, (c) => c.kind === "REGULAR" && c.ref === o.ref);
    }
  } else if (j.type === "SUBSCRIPTION") {
    const s = (d.subs ?? []).find((x) => x.id === j.source_id);
    const partner = (d.partners ?? []).find((p) => p.id === j.partner_id)?.name;
    if (s && j.status === "DELIVERED") s.records[j.date] = { status: "DELIVERED", partner, time: j.delivered_at, otp_verified_at: j.otp_verified_at, job_id: j.id };
    if (s && j.status === "FAILED") s.records[j.date] = { status: "FAILED", partner, time: j.failed_at, reason: j.fail_reason };
  } else if (j.type === "EVENT") {
    const e = (d.eventRequests ?? []).find((x) => x.id === j.source_id);
    if (e && j.status === "DELIVERED") { e.balance_collected = (e.balance_collected ?? 0) + (j.collected?.amount ?? 0); e.status = "COMPLETED"; earnCommissions(d, (c) => c.kind === "EVENT" && c.source_id === e.id); }
  }
}

const OTP_TTL_MS = 2 * 3600_000; // a delivery OTP stays valid for two hours
const OTP_MAX_ATTEMPTS = 5;

/** A message to the customer's registered mobile. Production sends these by SMS; this demo keeps them in an outbox. */
type Note = NonNullable<Db["outbox"]>[number];
function notify(d: Db, mobile: string, ref: string, text: string, extra: Partial<Pick<Note, "job_id" | "otp" | "kind" | "key" | "title">> = {}) {
  // the same delivery event never notifies twice
  if (extra.key && d.outbox?.some((n) => n.key === extra.key)) return;
  // in-app is always kept; SMS / WhatsApp are sent only once a provider is connected, and can be retried
  (d.outbox ??= []).push({ at: stamp(), mobile, ref, text, ...extra, channels: { in_app: "DELIVERED", sms: "NOT_CONFIGURED" } });
  if (d.outbox.length > 500) d.outbox = d.outbox.slice(-500);
}

const longDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/** The customer's confirmation for a finished delivery, and for a plan, its completion. Never includes the OTP. */
function afterDelivery(d: Db, j: Job, partnerName: string) {
  if (j.type === "ORDER") {
    notify(d, j.customer.mobile, j.source_id, `Your order ${j.source_id} has been delivered by ${partnerName}. Thank you for choosing Sri Sastha Paruthipaal!`,
      { kind: "DELIVERED", title: "Your order is delivered", key: `delivered:${j.id}` });
    return;
  }
  if (j.type !== "SUBSCRIPTION") return;
  const s = d.subs?.find((x) => x.id === j.source_id);
  if (!s) return;
  const v = viewSub(s, istDate());
  const day = j.sub_info?.day_no ?? v.delivered;
  notify(d, s.customer.mobile, s.ref, [
    `Your Day ${day} subscription delivery has been successfully completed.`,
    `Subscription ID: ${s.ref}`, `Delivery date: ${longDate(j.date)}`, `Product: ${s.product_name}`, `Quantity: ${s.size} × ${s.qty}`,
    `Delivery status: Successfully delivered`, `Delivery partner: ${partnerName}`,
    `${v.delivered} of ${s.plan_days} deliveries completed.`, `Thank you for choosing Sri Sastha Paruthipaal!`,
  ].join("\n"), { kind: "PLAN_DAY", title: "Your daily Paruthipaal delivery is completed!", key: `plan-day:${s.id}:${j.date}`, job_id: j.id });
  if (v.delivered >= s.plan_days) {
    earnCommissions(d, (c) => c.kind === "PLAN" && c.source_id === s.id);
    notify(d, s.customer.mobile, s.ref, `All ${s.plan_days} deliveries of your subscription ${s.ref} are complete. Amount paid: ₹${s.amount_paid / 100}. Renew anytime from your subscriptions page.`,
      { kind: "PLAN_DONE", title: "Your subscription is complete", key: `plan-done:${s.id}` });
    audit("system", "subscription", s.ref, "completed", null, null);
  }
}

/** A plan as its customer sees it: today's delivery and OTP, and the plan's notifications (OTP messages left out). */
function customerSubView(d: Db, s: Subscription, today: string) {
  const v = viewSub(s, today);
  const j = (d.jobs ?? []).find((x) => x.type === "SUBSCRIPTION" && x.source_id === s.id && x.date === today);
  const rec = j ? d.otps?.[j.id] : undefined;
  const otpOk = j && (j.status === "PICKED" || j.status === "OUT") && rec && !rec.used && rec.expires > Date.now() && j.otp_status !== "LOCKED";
  const partner = j?.partner_id ? d.partners?.find((p) => p.id === j.partner_id) : s.partner_id ? d.partners?.find((p) => p.id === s.partner_id) : undefined;
  return {
    ...v,
    partner: partner ? { name: partner.name, mobile: partner.mobile } : null,
    today: j ? { status: j.status, otp: otpOk ? [...(d.outbox ?? [])].reverse().find((n) => n.job_id === j.id && n.otp)?.otp ?? null : null, otp_status: j.otp_status ?? null } : null,
    notifications: (d.outbox ?? []).filter((n) => n.ref === s.ref && n.kind !== "OTP").slice(-20).reverse().map((n) => ({ at: n.at, title: n.title ?? "", text: n.text })),
  };
}
export type CustomerSubView = ReturnType<typeof customerSubView>;

function orderLog(d: Db, ref: string, action: string, by: string, note?: string) {
  const o = d.orders?.find((x) => x.ref === ref);
  if (o) (o.history ??= []).push({ at: stamp(), action, by, note });
}

/** A new single-use 6-digit OTP for an order delivery. In production it is sent by SMS to the customer's registered mobile. */
function issueOtp(d: Db, j: Job, by: string) {
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  // only a hash is stored with the order; the code itself goes to the customer (SMS in production, the outbox here)
  (d.otps ??= {})[j.id] = { hash: bcrypt.hashSync(code, 6), expires: Date.now() + OTP_TTL_MS, attempts: 0, used: false };
  const ref = j.type === "ORDER" ? j.source_id : j.ref.split("#")[0];
  const what = j.type === "SUBSCRIPTION" ? `today's ${ref} delivery${j.sub_info ? ` (day ${j.sub_info.day_no})` : ""}` : ref;
  notify(d, j.customer.mobile, ref, `Your Sri Sastha delivery OTP for ${what} is ${code}. Share it with the delivery partner only after you receive your order.`, { job_id: j.id, otp: code, kind: "OTP" });
  Object.assign(j, { otp_status: "SENT", otp_sent_at: stamp() });
  jobAudit(by, j, "delivery OTP sent to the customer");
  if (j.type === "ORDER") orderLog(d, j.source_id, "delivery OTP sent to the customer", by);
}

/** The gateway's verdict on a QR payment request (webhook). Only this marks a door payment as paid. */
/** An unpaid order paid online by the customer (UPI app or Razorpay), after the gateway confirms it. */
function markOrderPaidOnline(d: Db, o: ServerOrder, how: string, gatewayRef: string, amount: number) {
  if (o.payment_status !== "DUE") return; // settle once
  Object.assign(o, { payment_status: "VERIFIED", payment_ref: gatewayRef, paid_at: stamp() });
  // nothing left to collect at the door
  const j = (d.jobs ?? []).find((x) => x.type === "ORDER" && x.source_id === o.ref);
  if (j && !j.paid_at) { Object.assign(j, { due: 0, payment: "PAID", paid_at: o.paid_at }); jobAudit("gateway", j, `paid online by the customer · ${how}`, gatewayRef); }
  orderLog(d, o.ref, `paid online by the customer · ${how} ₹${amount / 100}`, "gateway", gatewayRef);
  audit("gateway", "order", o.ref, `paid online · ${how}`, null, { amount, ref: gatewayRef });
  notify(d, o.customer.mobile, o.ref, `We received your payment of ₹${amount / 100} for order ${o.ref}. Thank you!`, { kind: "CONFIRMED", title: "Payment received", key: `paid:${o.ref}` });
}

function settleQr(d: Db, payreqId: string, status: "PAID" | "FAILED", gatewayRef: string) {
  const r = d.payreqs?.[payreqId];
  if (!r) throw new ApiError(404, "Payment request not found");
  if (r.order_ref) {
    // a payment the customer started from their order page or the shop's link
    if (r.status === "PAID") return null;
    Object.assign(r, { status, gateway_ref: gatewayRef });
    const o = d.orders?.find((x) => x.ref === r.order_ref);
    if (o && status === "PAID") markOrderPaidOnline(d, o, "UPI", gatewayRef, r.amount);
    return null;
  }
  const j = (d.jobs ?? []).find((x) => x.id === r.job_id);
  if (!j || j.qr?.id !== payreqId) throw new ApiError(409, "This payment request is no longer active.");
  if (r.status === "PAID") return j; // webhooks can repeat: settle once
  Object.assign(r, { status, gateway_ref: gatewayRef });
  j.qr = { ...j.qr, status, gateway_ref: gatewayRef };
  if (status === "PAID") {
    j.collected = { method: "UPI", amount: r.amount };
    j.paid_at = stamp();
    jobAudit("gateway", j, `QR payment verified ₹${r.amount / 100}`, gatewayRef);
    if (j.type === "ORDER") {
      const o = d.orders?.find((x) => x.ref === j.source_id);
      if (o) { o.payment_status = "COLLECTED"; o.qr_ref = gatewayRef; o.paid_at = j.paid_at; }
      orderLog(d, j.source_id, `QR payment verified ₹${r.amount / 100}`, "gateway", gatewayRef);
    }
  } else jobAudit("gateway", j, "QR payment failed", gatewayRef);
  return j;
}

/** A random, unguessable token (share links). */
function rand() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, "0")).join(""); }

/** Plans that have finished (all deliveries made, or a cancelled plan past its end date) earn their commission. */
function refreshPlanCommissions(d: Db) {
  const today = istDate();
  for (const c of (d.commissions ?? []).filter((x) => x.kind === "PLAN" && x.status === "PENDING")) {
    const s = d.subs?.find((x) => x.id === c.source_id);
    const o = s && d.orders?.find((x) => x.ref === s.order_ref);
    if (o && (o.status === "rejected" || o.status === "cancelled")) reverseCommissions(d, (x) => x.id === c.id, `order ${o.status}`);
    else if (s && viewSub(s, today).status === "COMPLETED") earnCommissions(d, (x) => x.id === c.id);
  }
}

/** Manual assignment by the admin. An empty partner id takes the delivery back. */
function assignJob(d: Db, j: Job, partnerId: string, by: string) {
  if (j.status !== "READY" && j.status !== "ASSIGNED") throw new ApiError(409, "This delivery is already picked up.");
  const now = stamp();
  const open = j.assignments?.find((a) => !a.until);
  if (open) open.until = now; // the previous assignment stays in the record, closed
  if (!partnerId) {
    Object.assign(j, { status: "READY", partner_id: null, assigned_at: undefined });
    jobAudit(by, j, "unassigned");
    if (j.type === "ORDER") orderLog(d, j.source_id, "partner unassigned", by);
    return;
  }
  const p = (d.partners ?? []).find((x) => x.id === partnerId);
  if (!p || !p.active) throw new ApiError(422, "Choose an active delivery partner.", { partner_id: "Required" });
  Object.assign(j, { status: "ASSIGNED", partner_id: p.id, assigned_at: now });
  (j.assignments ??= []).push({ partner_id: p.id, name: p.name, mobile: p.mobile, at: now, by });
  jobAudit(by, j, open ? `reassigned from ${open.name} to ${p.name}` : `assigned to ${p.name}`);
  if (j.type === "ORDER") {
    orderLog(d, j.source_id, open ? `partner changed: ${open.name} → ${p.name} (${p.mobile})` : `partner assigned: ${p.name} (${p.mobile})`, by);
    notify(d, j.customer.mobile, j.source_id, `Your Sri Sastha order ${j.source_id} is confirmed. ${p.name} (${p.mobile}) will deliver it.`, { kind: "CONFIRMED", title: "Order confirmed" });
  }
}

/** Orders a guest looked up on this device: order ID → the mobile number they proved it with. */
function guestTracked(raw: unknown) {
  const list = Array.isArray(raw) ? (raw as { ref?: unknown; mobile?: unknown; token?: unknown }[]) : [];
  return new Map(list.slice(0, 50).filter((t) => t.mobile).map((t) => [String(t.ref ?? ""), normaliseMobile(String(t.mobile ?? ""))]));
}
/** Share-link tokens a guest has opened on this device. */
const trackedTokens = (raw: unknown) => new Set((Array.isArray(raw) ? (raw as { token?: unknown }[]) : []).map((t) => String(t.token ?? "")).filter(Boolean));

/** What a customer sees for one order: the five-step timeline, payment and the assigned partner. */
function customerOrderView(d: Db, o: ServerOrder) {
  const j = (d.jobs ?? []).find((x) => x.type === "ORDER" && x.source_id === o.ref);
  const p = j?.partner_id ? (d.partners ?? []).find((x) => x.id === j.partner_id) : undefined;
  const paidAt = o.payment_status === "VERIFIED" ? o.confirmed_at : o.payment_status === "COLLECTED" ? j?.paid_at : undefined;
  return {
    ref: o.ref, status: o.status, created_at: o.created_at, payment: o.payment, payment_status: o.payment_status ?? (o.payment === "cod" ? "DUE" : "ONLINE"),
    items: o.items, subtotal: o.subtotal, discount: o.discount, delivery_fee: o.delivery_fee, total: o.total,
    delivery_date: j?.date ?? o.delivery_date ?? null, delivery_slot: o.delivery_slot ?? null, reject_reason: o.reject_reason ?? null,
    history: (o.history ?? []).filter((h) => !h.action.startsWith("delivery OTP") && !h.action.startsWith("promo code")).map((h) => ({ at: h.at, action: h.action })),
    steps: {
      placed: o.created_at, confirmed: o.confirmed_at ?? null, assigned: j?.assignments?.[0]?.at ?? j?.assigned_at ?? null,
      picked: j?.picked_at ?? null, paid: o.payment === "cod" ? paidAt ?? null : null, otp: j?.otp_verified_at ?? null, delivered: j?.delivered_at ?? null,
    },
    partner: p && o.status !== "rejected" && o.status !== "cancelled" ? { name: p.name, mobile: p.mobile } : null,
    // the delivery OTP is shown only once the partner has picked up the order, and never after delivery
    // the OTP the customer was sent, shown only while the order is out for delivery and the OTP is still usable
    otp: j && (j.status === "PICKED" || j.status === "OUT") && d.otps?.[j.id] && !d.otps[j.id].used && d.otps[j.id].expires > Date.now() && j.otp_status !== "LOCKED"
      ? [...(d.outbox ?? [])].reverse().find((m) => m.job_id === j.id && m.otp)?.otp ?? null : null,
    assigned_at: j?.assignments?.find((a) => !a.until)?.at ?? j?.assigned_at ?? null,
    delivery_status: j ? ({ READY: "Waiting for a partner", ASSIGNED: "Partner assigned", PICKED: "Out for delivery", OUT: "Out for delivery", DELIVERED: "Delivered", FAILED: "Not delivered", CANCELLED: "Cancelled" } as const)[j.status] : null,
    // the promoter's code is never shown to customers: only the amount saved
    promo_code: null as string | null, promo_discount: o.promo_discount ?? 0,
    pay_online_due: o.payment_status === "DUE" && !["rejected", "cancelled", "delivered"].includes(o.status) ? o.total : null,
    online_paid: o.payment !== "cod" ? { at: o.created_at, verified_at: o.payment_status === "VERIFIED" ? o.confirmed_at ?? null : null } : null,
    otp_status: j?.otp_status ?? null,
  };
}
export type CustomerOrderView = ReturnType<typeof customerOrderView>;

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
      // signed in: every order on the account; guest: orders placed on this device, plus orders they looked up
      // with the order ID and the mobile number used for it
      const mobile = sessionCustomer(d, customerToken)?.mobile;
      const refs = new Set((b.refs as string[]) ?? []);
      const tracked = guestTracked(b.tracked);
      const tokens = trackedTokens(b.tracked);
      return (d.orders ?? []).filter((o) => refs.has(o.ref) || (mobile && o.customer.mobile === mobile) || tracked.get(o.ref) === o.customer.mobile || (!!o.share_token && tokens.has(o.share_token))).map((o) => customerOrderView(d, o));
    }
    case "POST /orders/by-link": {
      // the tracking link the shop shares: the private token alone opens that one order
      const o = (d.orders ?? []).find((x) => !!x.share_token && x.share_token === String(b.token ?? ""));
      if (!o) throw new ApiError(404, "This order link is not valid. Please check the link or call us.");
      return customerOrderView(d, o);
    }
    case "POST /orders/lookup": {
      // guest tracking from any device: the order ID alone is not enough, the order's mobile number must match
      const ref = String(b.ref ?? "").trim().toUpperCase().replace(/^(SSP)-?/, "SSP-");
      const m = normaliseMobile(String(b.mobile ?? ""));
      const o = (d.orders ?? []).find((x) => x.ref === ref && x.customer.mobile === m);
      if (!o) throw new ApiError(404, "We couldn't find an order with that ID and mobile number.");
      return customerOrderView(d, o);
    }
    case "POST /orders/pay-start":
    case "POST /orders/pay-status":
    case "POST /orders/pay-razorpay": {
      // only the order's own customer: signed in, this device's order, or opened from the shop's link
      const mobile = sessionCustomer(d, customerToken)?.mobile;
      const refs = new Set((b.refs as string[]) ?? []);
      const tracked = guestTracked(b.tracked);
      const tokens = trackedTokens(b.tracked);
      const o = (d.orders ?? []).find((x) => x.ref === b.ref && (refs.has(x.ref) || (mobile && x.customer.mobile === mobile) || tracked.get(x.ref) === x.customer.mobile || (!!x.share_token && tokens.has(x.share_token))));
      if (!o) throw new ApiError(404, "Order not found.");
      if (resource === "pay-status") {
        const r = d.payreqs?.[String(b.id ?? "")];
        return { status: r?.order_ref === o.ref ? r.status : null, order: customerOrderView(d, o) };
      }
      if (o.payment_status !== "DUE") throw new ApiError(409, "This order is already paid.");
      if (o.status === "rejected" || o.status === "cancelled" || o.status === "delivered") throw new ApiError(409, "This order can't be paid online now.");
      if (resource === "pay-razorpay") {
        // Production: verify the Razorpay payment (signature / fetch the payment) on the server before this.
        const pid = String(b.payment_id ?? "").trim();
        if (!pid) throw new ApiError(422, "Payment id missing.");
        markOrderPaidOnline(d, o, "Razorpay", pid, o.total);
        commit();
        return { status: "PAID", order: customerOrderView(d, o) };
      }
      // reuse an open request; the amount is always the order total, set by the server
      const open = Object.entries(d.payreqs ?? {}).find(([, r]) => r.order_ref === o.ref && r.status === "WAITING" && r.amount === o.total);
      const id = open?.[0] ?? uid("pl");
      if (!open) (d.payreqs ??= {})[id] = { job_id: "", order_ref: o.ref, amount: o.total, status: "WAITING", created_at: stamp() };
      commit();
      return { id, amount: o.total, status: "WAITING" };
    }
    case "POST /orders/otp-resend": {
      // only the customer who owns the order (signed in, or this device's order) can ask for a new OTP
      const mobile = sessionCustomer(d, customerToken)?.mobile;
      const refs = new Set((b.refs as string[]) ?? []);
      const tracked = guestTracked(b.tracked);
      const tokens = trackedTokens(b.tracked);
      const o = (d.orders ?? []).find((x) => x.ref === b.ref && (refs.has(x.ref) || (mobile && x.customer.mobile === mobile) || tracked.get(x.ref) === x.customer.mobile || (!!x.share_token && tokens.has(x.share_token))));
      const j = o && (d.jobs ?? []).find((x) => x.type === "ORDER" && x.source_id === o.ref);
      if (!o || !j || !(j.status === "PICKED" || j.status === "OUT")) throw new ApiError(409, "An OTP is issued once your order is out for delivery.");
      issueOtp(d, j, `customer:${o.customer.mobile}`);
      commit();
      return customerOrderView(d, o);
    }
    case "POST /subscriptions/mine": {
      // signed in: all plans on the account; guest: plans from orders placed on this device
      const mobile = sessionCustomer(d, customerToken)?.mobile;
      const refs = new Set((b.orderRefs as string[]) ?? []);
      return (d.subs ?? []).filter((s) => (mobile && s.customer.mobile === mobile) || refs.has(s.order_ref)).map((s) => customerSubView(d, s, today));
    }
    case "POST /subscriptions/otp-resend": {
      // the plan's own customer asks for a new OTP for today's delivery
      const mobile = sessionCustomer(d, customerToken)?.mobile;
      const refs = new Set((b.orderRefs as string[]) ?? []);
      const s = (d.subs ?? []).find((x) => x.id === b.id && ((mobile && x.customer.mobile === mobile) || refs.has(x.order_ref)));
      const j = s && (d.jobs ?? []).find((x) => x.type === "SUBSCRIPTION" && x.source_id === s.id && x.date === today);
      if (!s || !j || !(j.status === "PICKED" || j.status === "OUT")) throw new ApiError(409, "An OTP is issued once today's delivery is on its way.");
      issueOtp(d, j, `customer:${s.customer.mobile}`);
      commit();
      return customerSubView(d, s, today);
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
    /* ---------- promo codes and promoters ---------- */
    case "POST /promo/check": {
      // is this code valid? (shop coupons and promoters' codes)
      const code = normaliseCode(b.code);
      const coupon = COUPONS[code];
      if (coupon) return { valid: true, code, kind: "coupon", label: coupon.label, type: coupon.type, value: coupon.value };
      const p = promoterByCode(d, code);
      if (p) return { valid: true, code, kind: "promoter", label: `${PROMO_DISCOUNT_PCT}% off product prices`, type: "percent", value: PROMO_DISCOUNT_PCT };
      return { valid: false, code };
    }
    case "POST /promo/stats": {
      // a promoter checks their own numbers with their mobile + code (no account); counts and commission only, never customer details
      const mobile = String(b.mobile ?? "").replace(/\D/g, "").slice(-10);
      const tries = (promoTries[mobile] ??= []).filter((t) => Date.now() - t < 15 * 60_000);
      promoTries[mobile] = tries;
      if (tries.length >= 5) throw new ApiError(429, "Too many tries. Wait 15 minutes and try again.");
      const p = (d.promoters ?? []).find((x) => x.active && x.mobile === mobile && x.code === normaliseCode(b.code));
      if (!p) { tries.push(Date.now()); throw new ApiError(401, "This number and promo code don't match. Check both and try again."); }
      refreshPlanCommissions(d);
      const mine = (d.commissions ?? []).filter((c) => c.promoter_id === p.id);
      const t = commissionTotals(mine);
      const count = (k: string) => new Set(mine.filter((c) => c.kind === k && c.status !== "REVERSED").map((c) => c.ref)).size;
      return {
        name: p.name, code: p.code, brand: p.brand, channel: p.channel,
        counts: {
          regular: count("REGULAR"), plan: count("PLAN"), event: count("EVENT"),
          total: new Set(mine.filter((c) => c.status !== "REVERSED").map((c) => c.ref)).size,
          completed: new Set(mine.filter((c) => c.status === "EARNED" || c.status === "PAID").map((c) => c.ref)).size,
          cancelled: new Set(mine.filter((c) => c.status === "REVERSED").map((c) => c.ref)).size,
        },
        // money is shown only once an order is delivered and its payment confirmed (earned or paid out)
        commission: { earned: t.earned, paid: t.paid },
        in_progress: new Set(mine.filter((c) => c.status === "PENDING").map((c) => c.ref)).size,
        recent: [...mine].reverse().slice(0, 30).map((c) => ({ date: c.created_at, kind: c.kind, ref: c.ref, status: c.status, amount: c.status === "EARNED" || c.status === "PAID" ? c.amount : null })),
      };
    }
    case "GET /admin/promoters": {
      requireAdmin(adminToken);
      refreshPlanCommissions(d);
      return (d.promoters ?? []).map((p) => ({ ...publicPromoter(p), totals: commissionTotals((d.commissions ?? []).filter((c) => c.promoter_id === p.id)) }));
    }
    case "POST /admin/promoters":
    case "PUT /admin/promoters/:id": {
      const by = requireAdmin(adminToken);
      return upsertPromoter(d, b as never, id).then((p) => {
        audit(by, "promoter", p.id, id ? "update" : "create", null, { name: p.name, code: p.code, active: p.active });
        commit();
        return publicPromoter(p);
      }, (e) => { throw e instanceof PromoError ? new ApiError(e.status, e.message, e.fields) : e; });
    }
    case "GET /admin/commissions": {
      requireAdmin(adminToken);
      refreshPlanCommissions(d);
      commit();
      const names = Object.fromEntries((d.promoters ?? []).map((p) => [p.id, p.name]));
      const brands = Object.fromEntries((d.promoters ?? []).map((p) => [p.id, [p.brand, p.channel].filter(Boolean).join(" · ")]));
      return (d.commissions ?? []).slice().reverse().map((c) => ({ ...c, promoter_name: names[c.promoter_id] ?? "", promoter_brand: brands[c.promoter_id] ?? "" }));
    }
    case "POST /admin/commissions/pay": {
      // pay out earned commissions (by id); pending or reversed ones can't be paid
      const by = requireAdmin(adminToken);
      const ids = new Set((b.ids as string[]) ?? []);
      let n = 0;
      for (const c of d.commissions ?? []) if (ids.has(c.id) && c.status === "EARNED") { Object.assign(c, { status: "PAID", paid_at: stamp() }); n++; }
      audit(by, "commission", [...ids].join(","), `paid ${n}`, null, null);
      commit();
      return { paid: n };
    }

    case "POST /partner/login":
    {
      const lockKey = `partner:${String(b.mobile ?? "").replace(/\D/g, "").slice(-10)}`;
      loginLocked(lockKey);
      return partnerLogin(d, String(b.mobile ?? ""), String(b.password ?? "")).then((r) => { loginOk(lockKey); commit(); return r; },
        (e) => { if (e instanceof OpsError && e.status === 401) loginFailed(lockKey); throw e instanceof OpsError ? new ApiError(e.status, e.message) : e; });
    }
    case "GET /partner/me": {
      const p = requirePartner(d, partnerToken);
      return { partner: publicPartner(p), summary: partnerSummary(d, p.id, today), branch: d.branches.find((x) => x.id === p.branch_id)?.name_en ?? "" };
    }
    case "POST /partner/password": {
      const p = requirePartner(d, partnerToken);
      const cur = String(b.current ?? ""), next = String(b.next ?? "");
      if (next.length < 6) throw new ApiError(422, "Please fix the highlighted fields", { next: "At least 6 characters" });
      return bcrypt.compare(cur, p.password_hash).then((ok) => {
        if (!ok) throw new ApiError(422, "Please fix the highlighted fields", { current: "Current password is incorrect" });
        p.password_hash = bcrypt.hashSync(next, 8);
        p.session_version += 1;
        const sess = d.partnerSessions?.[partnerToken!];
        if (sess) sess.sv = p.session_version;
        audit(`partner:${p.mobile}`, "partner", p.mobile, "changed password", null, null);
        commit();
        return { ok: true };
      });
    }
    case "GET /partner/jobs": {
      const p = requirePartner(d, partnerToken);
      prepareJobs(); commit();
      const jobs = (d.jobs ?? []).filter((j) => j.partner_id === p.id);
      return {
        mine: jobs.filter((j) => j.status === "ASSIGNED" || j.status === "PICKED" || j.status === "OUT").map((j) => jobForPartner(j, p.id)),
        // their finished deliveries, plus ones cancelled or moved to another partner while assigned to them
        history: (d.jobs ?? []).filter((j) => (j.partner_id === p.id && ["DELIVERED", "FAILED", "CANCELLED"].includes(j.status))
          || (j.partner_id !== p.id && j.assignments?.some((a) => a.partner_id === p.id)))
          .slice(-50).map((j) => ({ ...jobForPartner(j, p.id), reassigned: j.partner_id !== p.id })),
        summary: partnerSummary(d, p.id, today),
        // the subscription customers this partner serves every plan day, with their next delivery
        plans: (d.subs ?? []).filter((s) => s.partner_id === p.id).map((s) => viewSub(s, today))
          .filter((s) => s.status === "ACTIVE" || s.status === "PAUSED")
          .map((s) => {
            const next = s.calendar.find((c) => c.status === "UPCOMING" && c.date >= today)?.date ?? null;
            const todayJob = jobs.find((j) => j.type === "SUBSCRIPTION" && j.source_id === s.id && j.date === today);
            return {
              id: s.id, ref: s.ref, status: s.status, customer: s.customer.name, mobile: s.customer.mobile, area: s.area,
              // the same location details a delivery card has, so the partner can call, navigate and see the pin
              address: fullAddress(s.address), landmark: landmarkOf(s.address), lat: s.address?.lat ?? null, lng: s.address?.lng ?? null, notes: s.address?.instructions ?? "",
              item: `${s.product_name} ${s.size} × ${s.qty}`, start_date: s.start_date, end_date: s.end_date,
              delivered: s.delivered, remaining: s.remaining, next_date: next, today: todayJob?.status ?? null,
            };
          }),
      };
    }
    // A partner can only act on deliveries the admin assigned to them: confirm pickup, open the QR for the
    // exact amount due, and complete the delivery with the customer's OTP. Payment status is never set by a partner.
    case "POST /partner/pickup":
    case "POST /partner/qr":
    case "POST /partner/qr-status":
    case "POST /partner/cash":
    case "POST /partner/deliver":
    case "POST /partner/skip":
    case "POST /partner/otp-resend": {
      const p = requirePartner(d, partnerToken);
      const j = (d.jobs ?? []).find((x) => x.id === b.id);
      if (!j || j.partner_id !== p.id) throw new ApiError(404, "This order isn't assigned to you.");
      const by = `partner:${p.mobile}`;
      const out = j.status === "PICKED" || j.status === "OUT";
      if (resource === "pickup") {
        if (j.status !== "ASSIGNED") throw new ApiError(409, "Pickup is already confirmed.");
        Object.assign(j, { status: "PICKED", picked_at: stamp() });
        jobAudit(by, j, "pickup confirmed");
        if (j.type === "ORDER") orderLog(d, j.source_id, `pickup confirmed by ${p.name}`, by);
        if (j.type === "ORDER" || j.type === "SUBSCRIPTION") issueOtp(d, j, "system");
      }
      if (resource === "qr") {
        if (!out) throw new ApiError(409, "Confirm pickup first.");
        if (!(j.due > 0) || j.paid_at) throw new ApiError(409, "This order is already paid.");
        // reuse an open request; the amount always comes from the order, never from the partner
        if (!j.qr || j.qr.status === "FAILED" || j.qr.amount !== j.due) {
          const id = uid("qr");
          (d.payreqs ??= {})[id] = { job_id: j.id, amount: j.due, status: "WAITING", created_at: stamp() };
          j.qr = { id, amount: j.due, status: "WAITING", created_at: stamp() };
          jobAudit(by, j, `QR payment request ₹${j.due / 100}`);
        }
      }
      if (resource === "qr-status") {
        if (!j.qr) throw new ApiError(404, "No payment request yet.");
      }
      if (resource === "cash") {
        // cash at the door: the partner confirms the exact amount due; it is counted in their cash to hand over
        if (!out) throw new ApiError(409, "Confirm pickup first.");
        if (!(j.due > 0) || j.paid_at) throw new ApiError(409, "This order is already paid.");
        if (Math.round(Number(b.amount)) !== j.due) throw new ApiError(422, `Collect exactly ₹${j.due / 100}.`, { amount: "Must match the amount due" });
        j.collected = { method: "CASH", amount: j.due };
        j.paid_at = stamp();
        jobAudit(by, j, `cash received ₹${j.due / 100}`);
        if (j.type === "ORDER") {
          const o = d.orders?.find((x) => x.ref === j.source_id);
          if (o) { o.payment_status = "COLLECTED"; o.paid_at = j.paid_at; }
          orderLog(d, j.source_id, `cash received ₹${j.due / 100} by ${p.name}`, by);
        }
      }
      if (resource === "otp-resend") {
        if (!out || j.type === "EVENT") throw new ApiError(409, "An OTP is issued once the order is picked up.");
        issueOtp(d, j, by);
      }
      if (resource === "skip") {
        // plan day only: the customer wasn't available or asked to skip; the day isn't counted, so the plan runs a day longer
        if (j.type !== "SUBSCRIPTION") throw new ApiError(403, "Only a subscription day can be skipped.");
        if (j.status === "DELIVERED" || j.status === "FAILED") throw new ApiError(409, "This day is already recorded.");
        // a partner skips one day, today's, and only when the customer isn't available; the plan itself is never skipped
        if (j.date !== istDate()) throw new ApiError(409, "Only today's delivery can be skipped.");
        const reason = "Customer not available";
        Object.assign(j, { status: "FAILED", failed_at: stamp(), fail_reason: reason });
        jobAudit(by, j, "plan day skipped", reason);
      }
      if (resource === "deliver") {
        if (j.status === "DELIVERED") throw new ApiError(409, "This delivery is already confirmed.");
        if (!out) throw new ApiError(409, "Confirm pickup first.");
        if (j.due > 0 && !j.paid_at) throw new ApiError(409, "Payment isn't verified yet. Collect it by QR first.");
        // every home delivery and every plan day is confirmed with the customer's OTP
        if (j.type === "ORDER" || j.type === "SUBSCRIPTION") {
          const rec = d.otps?.[j.id];
          if (!rec || rec.used) throw new ApiError(409, "No active OTP. Send a new OTP to the customer.", undefined, "OTP_MISSING");
          if (j.otp_status === "LOCKED" || rec.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(429, "Too many wrong attempts. Send a new OTP to the customer.", undefined, "OTP_LOCKED");
          if (rec.expires < Date.now()) throw new ApiError(410, "This OTP has expired. Send a new OTP to the customer.", undefined, "OTP_EXPIRED");
          if (!bcrypt.compareSync(String(b.otp ?? "").replace(/\D/g, ""), rec.hash)) {
            rec.attempts += 1;
            const left = OTP_MAX_ATTEMPTS - rec.attempts;
            if (left <= 0) j.otp_status = "LOCKED";
            jobAudit(by, j, "wrong OTP entered");
            commit();
            throw new ApiError(422, left > 0 ? `Incorrect OTP. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Send a new OTP to the customer.", { otp: "Incorrect" }, left > 0 ? "OTP_WRONG" : "OTP_LOCKED");
          }
          rec.used = true;
          Object.assign(j, { otp_status: "VERIFIED", otp_verified_at: stamp() });
        }
        Object.assign(j, { status: "DELIVERED", delivered_at: stamp(), delivered_by: p.name });
        jobAudit(by, j, j.otp_status === "VERIFIED" ? "OTP verified · delivery confirmed" : "delivery confirmed");
        if (j.type === "ORDER") orderLog(d, j.source_id, `OTP verified · delivered by ${p.name}`, by);
      }
      syncSource(d, j);
      // notifications go out only after the delivery itself is recorded
      if (resource === "deliver") afterDelivery(d, j, p.name);
      commit();
      return jobForPartner(j, p.id);
    }

    /* ---------- payment gateway ---------- */
    case "POST /gateway/qr-webhook": {
      // Stands in for the gateway's signed webhook (e.g. Razorpay qr_code.credited). A real server verifies the
      // webhook signature here; the partner app can never call this.
      settleQr(d, String(b.payreq ?? ""), b.status === "FAILED" ? "FAILED" : "PAID", String(b.gateway_ref ?? uid("pay")));
      commit();
      return { ok: true, status: d.payreqs?.[String(b.payreq ?? "")]?.status };
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
      return (d.orders ?? []).map((o) => ({
        ...o, job: (d.jobs ?? []).find((j) => j.type === "ORDER" && j.source_id === o.ref) ?? null,
        plans: (d.subs ?? []).filter((s) => s.order_ref === o.ref).map((s) => ({ id: s.id, ref: s.ref, partner_id: s.partner_id ?? null, branch_id: s.branch_id })),
      }));
    case "PUT /admin/orders/:id": {
      const by = requireAdmin(adminToken);
      const o = (d.orders ?? []).find((x) => x.ref === id);
      if (!o) throw new ApiError(404, "Order not found");
      const j = (d.jobs ?? []).find((x) => x.type === "ORDER" && x.source_id === o.ref);
      if (b.action === "confirm") {
        if (o.status !== "pending") throw new ApiError(409, "Only pending orders can be confirmed.");
        o.status = "confirmed"; o.confirmed_at = stamp();
        orderLog(d, o.ref, o.payment_status === "ONLINE" ? "confirmed · online payment verified" : "confirmed", by);
        if (o.payment_status === "ONLINE") o.payment_status = "VERIFIED"; // the admin has checked the UPI payment
        createOrderJob(d, o);
        const job = d.jobs?.find((x) => x.type === "ORDER" && x.source_id === o.ref);
        if (job && b.partner_id) assignJob(d, job, String(b.partner_id), by);
        audit(by, "order", o.ref, "confirm", null, null);
      } else if (b.action === "reject") {
        if (o.status !== "pending") throw new ApiError(409, "Only pending orders can be rejected.");
        const reason = String(b.reason ?? "").trim();
        if (!reason) throw new ApiError(422, "Give a reason for rejecting the order.", { reason: "Required" });
        Object.assign(o, { status: "rejected", rejected_at: stamp(), reject_reason: reason });
        reverseCommissions(d, (c) => c.ref === o.ref, "order rejected");
        // a rejected plan order never starts: stop its plan before the first day
        for (const s of (d.subs ?? []).filter((x) => x.order_ref === o.ref && !x.cancelled_at)) Object.assign(s, { cancelled_at: stamp(), cancel_end_date: addDays(s.start_date, -1) });
        orderLog(d, o.ref, "rejected", by, reason);
        audit(by, "order", o.ref, "reject", null, reason);
      } else if (b.action === "assign") {
        if (!j) throw new ApiError(409, "Confirm the order before assigning a partner.");
        assignJob(d, j, String(b.partner_id ?? ""), by);
      } else if (b.action === "cancel") {
        if (j && j.status !== "READY" && j.status !== "ASSIGNED") throw new ApiError(409, j.status === "CANCELLED" ? "Already cancelled." : "The partner has already picked up this order.");
        o.status = "cancelled";
        orderLog(d, o.ref, "cancelled", by);
        reverseCommissions(d, (c) => c.ref === o.ref && c.kind === "REGULAR", "order cancelled");
        if (j) {
          // the delivery record is kept for history, closed as cancelled
          const open = j.assignments?.find((a) => !a.until);
          if (open) open.until = stamp();
          Object.assign(j, { status: "CANCELLED", cancelled_at: stamp() });
          jobAudit(by, j, "cancelled");
        }
        audit(by, "order", o.ref, "cancel", null, null);
      } else throw new ApiError(422, "Unknown action");
      commit();
      return o;
    }
    case "POST /admin/orders": {
      // The shop places an order for a customer (phone or walk-in). Priced by the same rules as the website,
      // created already confirmed, optionally assigned, and shared with the customer by a private tracking link.
      const by = requireAdmin(adminToken);
      const c = (b.customer ?? {}) as { name?: string; mobile?: string };
      const a = (b.address ?? {}) as Partial<AccountAddress> & { location_text?: string };
      const name = String(c.name ?? "").trim();
      const mobile = normaliseMobile(String(c.mobile ?? ""));
      const f: Record<string, string> = {};
      if (!name) f.name = "Customer name is required";
      if (!isValidMobile(mobile)) f.mobile = "Enter a valid 10-digit mobile number";
      if (a.pincode && !/^\d{6}$/.test(String(a.pincode).trim())) f.pincode = "6-digit pincode, or leave it empty";
      if (a.lat == null || a.lng == null) f.location = "Set the delivery location on the map";
      const lines = ((b.lines as { productId: string; qty: number }[]) ?? []).filter((l) => l.qty > 0);
      if (!lines.length) f.lines = "Add at least one product";
      if (Object.keys(f).length) throw new ApiError(422, "Please fix the highlighted fields", f);
      const paid = b.payment === "paid";
      const req: CreateOrderRequest = {
        lines: lines.map((l) => ({ productId: l.productId, qty: Math.round(l.qty), plan: false })),
        addressId: "", payment: paid ? "upi" : "cod", customer: { name, phone: mobile, email: "" },
        // b.payment: "cash" or "qr" (pay on delivery) or "paid"
        paymentRef: paid ? String(b.payment_ref ?? "").trim() || undefined : undefined,
      };
      const address: AccountAddress = {
        id: uid("addr"), label: "Delivery", name, phone: mobile,
        line1: String(a.line1 ?? "").trim() || String(a.location_text ?? "").trim() || "Pinned location", line2: String(a.line2 ?? "").trim(),
        area: String(a.area ?? "").trim() || String(a.landmark ?? "").trim() || "—", pincode: String(a.pincode ?? "").trim(), district: String(a.district ?? d.settings.district_restriction).trim(),
        lat: Number(a.lat), lng: Number(a.lng), landmark: String(a.landmark ?? "").trim(), instructions: String(a.instructions ?? "").trim(),
      };
      return priceOrder(req, { lat: address.lat!, lng: address.lng!, district: address.district }).then((pricing) => {
        pricing.account = upsertCustomerForOrder(d, mobile, name, address, pricing.order_ref);
        recordOrder(d, req, pricing, mobile, name, "", address);
        const o = d.orders!.find((x) => x.ref === pricing.order_ref)!;
        Object.assign(o, {
          created_by: by, share_token: rand(),
          status: "confirmed", confirmed_at: stamp(), payment_status: paid ? "VERIFIED" : "DUE",
        });
        const atDoor = b.payment === "qr" ? "UPI QR" : "cash";
        o.history = [{ at: stamp(), action: `order created by the shop · ${paid ? "paid (verified by admin)" : `pay on delivery by ${atDoor}`}`, by }];
        audit(by, "order", o.ref, "create for customer", null, { mobile, total: o.total });
        createOrderJob(d, o);
        const job = d.jobs?.find((x) => x.type === "ORDER" && x.source_id === o.ref);
        if (job && !paid) job.notes = [`Customer will pay by ${atDoor}`, job.notes].filter(Boolean).join(" · ");
        if (job && b.partner_id) assignJob(d, job, String(b.partner_id), by);
        notify(d, mobile, o.ref, `Sri Sastha Paruthipaal has placed order ${o.ref} for you (₹${o.total / 100}). Track it here: {link}`, { kind: "CONFIRMED", title: "Your order is placed" });
        commit();
        return { order: o, share_token: o.share_token };
      }, (e) => { throw e instanceof ApiError ? e : new ApiError(422, (e as Error).message); });
    }
    case "PUT /admin/jobs/:id": {
      // assign a delivery (order, plan day or event) to a partner, or take it back
      const by = requireAdmin(adminToken);
      const j = (d.jobs ?? []).find((x) => x.id === id);
      if (!j) throw new ApiError(404, "Delivery not found");
      assignJob(d, j, String(b.partner_id ?? ""), by);
      commit();
      return j;
    }
    case "GET /admin/subscriptions": requireAdmin(adminToken);
      // with the paying order's state, so plans waiting for confirmation (or rejected) are shown as such
      return (d.subs ?? []).map((s) => {
        const o = d.orders?.find((x) => x.ref === s.order_ref);
        return { ...viewSub(s, today), order_status: o?.status ?? "confirmed", payment_status: o?.payment_status ?? null };
      });
    case "PUT /admin/subscriptions/:id": {
      const by = requireAdmin(adminToken);
      const s = (d.subs ?? []).find((x) => x.id === id);
      if (!s) throw new ApiError(404, "Plan not found");
      if (b.action === "assign") {
        // the plan's partner: today's undelivered delivery moves to them too, later days are created assigned
        const pid = String(b.partner_id ?? "");
        const p = pid ? (d.partners ?? []).find((x) => x.id === pid && x.active) : undefined;
        if (pid && !p) throw new ApiError(422, "Choose an active delivery partner.");
        s.partner_id = p?.id ?? null;
        audit(by, "subscription", s.ref, p ? `plan partner: ${p.name}` : "plan partner removed", null, null);
        for (const j of (d.jobs ?? []).filter((x) => x.type === "SUBSCRIPTION" && x.source_id === s.id && (x.status === "READY" || x.status === "ASSIGNED"))) assignJob(d, j, p?.id ?? "", by);
        orderLog(d, s.order_ref, p ? `plan partner: ${p.name} (${p.mobile})` : "plan partner removed", by);
      } else if (b.action === "notes") { s.notes = String(b.notes ?? "").slice(0, 2000); audit(by, "subscription", s.ref, "notes", null, null); }
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
