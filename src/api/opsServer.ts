// Operations for the mock backend: server-side orders, daily-plan subscriptions with a delivery calendar,
// delivery jobs that delivery partners pick themselves, partner accounts, cash handover and visitor counts.
// Pure data + rules; mockServer.ts owns storage and routing.
import bcrypt from "bcryptjs";
import type { StoredAddress } from "./authServer";

/* ---------------- dates (IST) ---------------- */
export function istDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const iso = () => new Date().toISOString();
const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, "0")).join("");
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

/* ---------------- types ---------------- */
export type PaymentMethod = "upi" | "card" | "cod";
export interface ServerOrder {
  ref: string; created_at: string; date: string;
  customer: { mobile: string; name: string };
  address: StoredAddress | null; area: string; branch_id: string; distance_km: number | null;
  items: { name: string; size: string; qty: number; lineTotal: number; plan: boolean; planDays?: number }[];
  subtotal: number; discount: number; delivery_fee: number; total: number; // paise
  payment: PaymentMethod;
  status: "placed" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
}
export interface DayRecord { status: "DELIVERED" | "FAILED"; partner?: string; time?: string; reason?: string }
export interface Subscription {
  id: string; ref: string; created_at: string; order_ref: string;
  customer: { mobile: string; name: string; email: string };
  address: StoredAddress | null; area: string; branch_id: string;
  product_id: string; product_name: string; size: string; qty: number;
  plan_days: number; discount_pct: number; amount_paid: number; payment: PaymentMethod;
  start_date: string;
  records: Record<string, DayRecord>;
  pauses: { from: string; to: string | null }[];
  cancelled_at: string | null; cancel_end_date: string | null;
  notes: string;
}
export type JobStatus = "READY" | "PICKED" | "OUT" | "DELIVERED" | "FAILED";
export interface Job {
  id: string; type: "ORDER" | "SUBSCRIPTION" | "EVENT"; ref: string; source_id: string; date: string;
  branch_id: string; area: string; distance_km: number | null;
  slot: string; slot_start: string; // ISO
  items: string[]; amount: number; payment: "PAID" | "COD"; due: number; // paise
  customer: { name: string; mobile: string }; address: string; landmark: string; lat: number | null; lng: number | null; notes: string;
  sub_info?: { day_no: number; plan_days: number };
  event_info?: { occasion: string; service: string; time: string; venue: string; advance: number; balance: number; litres: number };
  status: JobStatus; partner_id: string | null;
  picked_at?: string; out_at?: string; delivered_at?: string; failed_at?: string; fail_reason?: string; fail_photo?: string;
  collected?: { method: "CASH" | "UPI"; amount: number; reason?: string };
  location?: { lat: number; lng: number } | null;
  history: { at: string; action: string; by: string; note?: string }[];
}
export interface Partner {
  id: string; name: string; mobile: string; branch_id: string; vehicle: string; active: boolean;
  password_hash: string; session_version: number; online: boolean; created_at: string;
}
export interface Handover { id: string; partner_id: string; amount: number; at: string; by: string }
export interface Visit { vid: string; path: string; at: string }
export interface EventLike {
  id: string; ref: string; name: string; phone: string; event_type: string; event_date: string; event_time: string;
  service: string; litres: number; venue: string; notes: string; base_amount: number; status: string;
  advance_paid?: number; balance_collected?: number; branch_id?: string;
}
export interface OpsDb {
  orders?: ServerOrder[];
  subs?: Subscription[];
  jobs?: Job[];
  partners?: Partner[];
  partnerSessions?: Record<string, { partner_id: string; sv: number; expires: number }>;
  handovers?: Handover[];
  visits?: Visit[];
}

export class OpsError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>, public code?: string) { super(message); }
}

/* ---------------- subscriptions: the delivery calendar ---------------- */
export type DayStatus = "DELIVERED" | "FAILED" | "PAUSED" | "UPCOMING" | "NOT_RECORDED";
export interface CalendarDay { date: string; status: DayStatus; partner?: string; time?: string; reason?: string }

/**
 * Walks the plan day by day. Paused and failed days are not counted, so the plan moves forward:
 * remaining deliveries go up and the end date moves later. Cancelling stops the plan at the end date
 * it had when it was cancelled. An open pause stops the calendar until the plan is resumed.
 */
export function planCalendar(s: Subscription, today = istDate()) {
  const days: CalendarDay[] = [];
  let counted = 0, delivered = 0, failed = 0, paused = 0;
  let d = s.start_date;
  let openPause = false;
  for (let guard = 0; guard < 500 && counted < s.plan_days; guard++, d = addDays(d, 1)) {
    if (s.cancel_end_date && d > s.cancel_end_date) break;
    const pause = s.pauses.find((p) => p.from <= d && (p.to === null || d < p.to));
    if (pause) {
      if (pause.to === null && d > today) { openPause = true; break; }
      days.push({ date: d, status: "PAUSED" }); paused++; continue;
    }
    const rec = s.records[d];
    if (rec?.status === "FAILED") { days.push({ ...rec, date: d, status: "FAILED" }); failed++; continue; }
    if (rec?.status === "DELIVERED") { days.push({ ...rec, date: d, status: "DELIVERED" }); delivered++; counted++; continue; }
    days.push({ date: d, status: d < today ? "NOT_RECORDED" : "UPCOMING" });
    counted++;
  }
  const remaining = s.plan_days - delivered;
  const endDate = openPause ? null : days.length ? days[days.length - 1].date : s.start_date;
  let status: "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";
  if (delivered >= s.plan_days || (s.cancel_end_date && today > s.cancel_end_date) || (!openPause && endDate && today > endDate)) status = "COMPLETED";
  else if (s.cancelled_at) status = "CANCELLED";
  else if (s.pauses.some((p) => p.to === null)) status = "PAUSED";
  else status = "ACTIVE";
  return { days, delivered, failed, paused, remaining: Math.max(0, remaining), endDate, status };
}

export function subscriptionAction(s: Subscription, action: "pause" | "resume" | "cancel", today = istDate()) {
  const cal = planCalendar(s, today);
  const tomorrow = addDays(today, 1);
  if (cal.status === "COMPLETED") throw new OpsError(409, "This plan has finished.");
  if (action === "pause") {
    if (s.cancelled_at) throw new OpsError(409, "A cancelled plan can't be paused.");
    if (s.pauses.some((p) => p.to === null)) throw new OpsError(409, "Already paused.");
    s.pauses.push({ from: tomorrow, to: null }); // today's parcel may already be on its way
  } else if (action === "resume") {
    const open = s.pauses.find((p) => p.to === null);
    if (!open) throw new OpsError(409, "This plan isn't paused.");
    open.to = tomorrow < open.from ? open.from : tomorrow;
  } else {
    if (s.cancelled_at) throw new OpsError(409, "Already cancelled.");
    // no refunds: the plan stops at the end of the current period
    const open = s.pauses.find((p) => p.to === null);
    if (open) open.to = tomorrow < open.from ? open.from : tomorrow;
    s.cancelled_at = iso();
    s.cancel_end_date = planCalendar(s, today).endDate ?? today;
  }
}

/* ---------------- jobs ---------------- */
const fullAddress = (a: StoredAddress | null) => (a ? [a.line1, a.line2, a.area, a.pincode && `— ${a.pincode}`].filter(Boolean).join(", ") : "");

export function createOrderJob(db: OpsDb, o: ServerOrder) {
  const regular = o.items.filter((i) => !i.plan);
  const cod = o.payment === "cod";
  if (!regular.length && !cod) return; // a prepaid plan-only order is delivered by its daily plan jobs
  const placed = new Date(o.created_at);
  const by = new Date(placed.getTime() + 60 * 60_000);
  (db.jobs ??= []).push({
    id: uid("job"), type: "ORDER", ref: o.ref, source_id: o.ref, date: o.date, branch_id: o.branch_id, area: o.area,
    distance_km: o.distance_km, slot: `By ${by.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}`,
    slot_start: by.toISOString(),
    items: (regular.length ? regular : o.items).map((i) => `${i.name} ${i.size} × ${i.qty}${i.plan ? ` (${i.planDays}-day plan payment)` : ""}`),
    amount: o.total, payment: cod ? "COD" : "PAID", due: cod ? o.total : 0,
    customer: { name: o.customer.name, mobile: o.customer.mobile }, address: fullAddress(o.address), landmark: o.address?.line2 ?? "",
    lat: o.address?.lat ?? null, lng: o.address?.lng ?? null, notes: "",
    status: "READY", partner_id: null, history: [{ at: iso(), action: "ready", by: "system" }],
  });
}

/** Today's subscription parcels and event deliveries become jobs the first time anyone looks. */
export function ensureDailyJobs(db: OpsDb, events: EventLike[], today = istDate()) {
  const jobs = (db.jobs ??= []);
  for (const s of db.subs ?? []) {
    const cal = planCalendar(s, today);
    const idx = cal.days.findIndex((x) => x.date === today);
    if (idx < 0 || cal.days[idx].status !== "UPCOMING" || cal.status === "PAUSED" || cal.status === "COMPLETED") continue;
    const ref = `${s.ref}#${today}`;
    if (jobs.some((j) => j.ref === ref && j.status !== "FAILED")) continue;
    if (jobs.some((j) => j.ref === ref)) continue;
    const dayNo = cal.days.slice(0, idx + 1).filter((x) => x.status !== "PAUSED" && x.status !== "FAILED").length;
    jobs.push({
      id: uid("job"), type: "SUBSCRIPTION", ref, source_id: s.id, date: today, branch_id: s.branch_id, area: s.area, distance_km: null,
      slot: "7:00 – 9:00 am", slot_start: new Date(`${today}T07:00:00+05:30`).toISOString(),
      items: [`${s.product_name} ${s.size} × ${s.qty}`], amount: 0, payment: "PAID", due: 0,
      customer: { name: s.customer.name, mobile: s.customer.mobile }, address: fullAddress(s.address), landmark: s.address?.line2 ?? "",
      lat: s.address?.lat ?? null, lng: s.address?.lng ?? null, notes: s.notes,
      sub_info: { day_no: dayNo, plan_days: s.plan_days },
      status: "READY", partner_id: null, history: [{ at: iso(), action: "ready", by: "system" }],
    });
  }
  for (const e of events) {
    if (e.status !== "CONFIRMED" || e.event_date !== today || e.service === "PICKUP") continue;
    if (jobs.some((j) => j.type === "EVENT" && j.source_id === e.id)) continue;
    const balance = Math.max(0, e.base_amount - (e.advance_paid ?? 0) - (e.balance_collected ?? 0));
    jobs.push({
      id: uid("job"), type: "EVENT", ref: e.ref, source_id: e.id, date: today, branch_id: e.branch_id ?? "br-main", area: e.venue.split(",").slice(-2, -1)[0]?.trim() || e.venue.split(",")[0],
      distance_km: null, slot: `At ${e.event_time}`, slot_start: new Date(`${today}T${e.event_time}:00+05:30`).toISOString(),
      items: [`Paruthippaal ${e.litres} L`], amount: e.base_amount, payment: balance > 0 ? "COD" : "PAID", due: balance,
      customer: { name: e.name, mobile: e.phone.replace(/\D/g, "").slice(-10) }, address: e.venue, landmark: "", lat: null, lng: null, notes: e.notes,
      event_info: { occasion: e.event_type, service: e.service, time: e.event_time, venue: e.venue, advance: e.advance_paid ?? 0, balance, litres: e.litres },
      status: "READY", partner_id: null, history: [{ at: iso(), action: "ready", by: "system" }],
    });
  }
}

/** What a partner may see: area only until they pick it; full details while it's theirs and up to 24 h after delivery. */
export function jobForPartner(j: Job, partnerId: string) {
  const mine = j.partner_id === partnerId;
  const doneAt = j.delivered_at ?? j.failed_at;
  const recent = !doneAt || Date.now() - new Date(doneAt).getTime() < 24 * 3600_000;
  if (mine && recent) return j;
  return { ...j, customer: { name: j.customer.name.split(" ")[0], mobile: "" }, address: "", landmark: "", lat: null, lng: null, notes: mine ? "" : j.notes };
}

export function partnerSummary(db: OpsDb, partnerId: string, today = istDate()) {
  const mine = (db.jobs ?? []).filter((j) => j.partner_id === partnerId);
  const todays = mine.filter((j) => j.date === today);
  const cashIn = mine.filter((j) => j.collected?.method === "CASH").reduce((n, j) => n + (j.collected!.amount), 0);
  const handed = (db.handovers ?? []).filter((h) => h.partner_id === partnerId).reduce((n, h) => n + h.amount, 0);
  return {
    picked: todays.filter((j) => j.picked_at).length,
    delivered: todays.filter((j) => j.status === "DELIVERED").length,
    cash_today: todays.filter((j) => j.collected?.method === "CASH").reduce((n, j) => n + j.collected!.amount, 0),
    cash_to_hand_over: Math.max(0, cashIn - handed),
  };
}

/* ---------------- partners ---------------- */
export async function upsertPartner(db: OpsDb, input: Partial<Partner> & { password?: string }, id?: string) {
  const f: Record<string, string> = {};
  const mobile = String(input.mobile ?? "").replace(/\D/g, "").slice(-10);
  if (!String(input.name ?? "").trim()) f.name = "Name is required";
  if (!/^[6-9]\d{9}$/.test(mobile)) f.mobile = "Enter a valid 10-digit mobile number";
  if (!input.branch_id) f.branch_id = "Pick a branch";
  if (!id && !(input.password && input.password.length >= 6)) f.password = "Set a password of at least 6 characters";
  if (input.password && input.password.length < 6) f.password = "At least 6 characters";
  const partners = (db.partners ??= []);
  if (partners.some((p) => p.mobile === mobile && p.id !== id)) f.mobile = "Another partner uses this number";
  if (Object.keys(f).length) throw new OpsError(422, "Please fix the highlighted fields", f);
  const existing = id ? partners.find((p) => p.id === id) : undefined;
  if (id && !existing) throw new OpsError(404, "Partner not found");
  const base = existing ?? { id: uid("dp"), created_at: iso(), session_version: 1, online: false, password_hash: "" } as Partner;
  Object.assign(base, { name: String(input.name).trim(), mobile, branch_id: input.branch_id, vehicle: String(input.vehicle ?? "").trim().toUpperCase(), active: input.active ?? true });
  if (input.password) { base.password_hash = await bcrypt.hash(input.password, 10); base.session_version += existing ? 1 : 0; }
  if (existing && input.active === false) base.session_version += 1; // deactivating signs them out
  if (!existing) partners.push(base);
  return base;
}
export const publicPartner = ({ password_hash: _h, session_version: _v, ...p }: Partner) => { void _h; void _v; return p; };

export async function partnerLogin(db: OpsDb, mobile: string, password: string) {
  const m = String(mobile).replace(/\D/g, "").slice(-10);
  const p = (db.partners ?? []).find((x) => x.mobile === m);
  const ok = !!p && p.active && (await bcrypt.compare(String(password), p.password_hash));
  if (!ok) throw new OpsError(401, "Mobile number or password is incorrect.");
  const token = rand();
  (db.partnerSessions ??= {})[token] = { partner_id: p!.id, sv: p!.session_version, expires: Date.now() + 30 * 86_400_000 };
  return { token, partner: publicPartner(p!) };
}
export function partnerFromToken(db: OpsDb, token?: string) {
  const s = token ? db.partnerSessions?.[token] : undefined;
  const p = s ? db.partners?.find((x) => x.id === s.partner_id) : undefined;
  if (!s || !p || !p.active || s.expires < Date.now() || s.sv !== p.session_version) return null;
  return p;
}
