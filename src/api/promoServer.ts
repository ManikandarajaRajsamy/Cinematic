// Promoters, their promo codes and commissions (mock backend).
//
// Fixed business rules (no settings):
//   Regular delivery orders  · customer 5% off product prices · promoter 10% commission
//   Subscription plans       · customer 5% off product prices · promoter 10% commission
//   Event orders             · no customer discount            · promoter 10% commission
// Discounts and commissions use product prices only, never delivery charges, taxes or service/transport fees.
// Commission is worked out on the product price before the customer's discount, recorded as PENDING when the
// order is placed, EARNED as soon as the customer's payment is received (online, by link, cash or QR at the door;
// events once the paruthipaal price is paid in full), and REVERSED if the order is cancelled or rejected before it is paid out.

export const PROMO_DISCOUNT_PCT = 5;
/** Where a promoter brings customers from. */
export const PROMOTER_CHANNELS = ["Instagram", "YouTube", "Event management", "Facebook", "WhatsApp", "Other"] as const;
export const COMMISSION_PCT = 10;

export interface Promoter {
  id: string; name: string; mobile: string; code: string; active: boolean; created_at: string;
  channel: string; brand: string; // e.g. Instagram · "Madurai Food Diaries"
  password_hash?: string; session_version?: number; // older records only: promoters don't sign in
}
export type CommissionKind = "REGULAR" | "PLAN" | "EVENT";
export type CommissionStatus = "PENDING" | "EARNED" | "REVERSED" | "PAID";
export interface Commission {
  id: string; promoter_id: string; code: string; kind: CommissionKind;
  ref: string; source_id: string; customer: string;
  base: number; rate: number; amount: number; discount: number; // paise
  status: CommissionStatus; created_at: string; earned_at?: string; reversed_at?: string; paid_at?: string; note?: string;
}
export interface PromoDb {
  promoters?: Promoter[];
  commissions?: Commission[];
}

export class PromoError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) { super(message); }
}

const iso = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;
export const normaliseCode = (code: unknown) => String(code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

/** The active promoter whose code this is, if any. */
export const promoterByCode = (db: PromoDb, code: unknown) => {
  const c = normaliseCode(code);
  return c ? (db.promoters ?? []).find((p) => p.active && p.code === c) : undefined;
};
export const discountOn = (productPrice: number) => Math.round((productPrice * PROMO_DISCOUNT_PCT) / 100);
export const commissionOn = (productPrice: number) => Math.round((productPrice * COMMISSION_PCT) / 100);

/** A new commission, pending until the order is completed. */
export function addCommission(db: PromoDb, p: Promoter, kind: CommissionKind, ref: string, sourceId: string, customer: string, base: number, discount: number) {
  if (!(base > 0)) return;
  (db.commissions ??= []).push({
    id: uid("cm"), promoter_id: p.id, code: p.code, kind, ref, source_id: sourceId, customer,
    base, rate: COMMISSION_PCT, amount: commissionOn(base), discount, status: "PENDING", created_at: iso(),
  });
}

/** Pending commissions for this order / plan / event become earned. */
export function earnCommissions(db: PromoDb, match: (c: Commission) => boolean) {
  for (const c of db.commissions ?? []) if (c.status === "PENDING" && match(c)) Object.assign(c, { status: "EARNED", earned_at: iso() });
}
/** Cancelled or rejected: commissions not yet paid out are reversed. */
export function reverseCommissions(db: PromoDb, match: (c: Commission) => boolean, note: string) {
  for (const c of db.commissions ?? []) if ((c.status === "PENDING" || c.status === "EARNED") && match(c)) Object.assign(c, { status: "REVERSED", reversed_at: iso(), note });
}

/** Admin / manager: add or edit a promoter. Promoters don't sign in; the code must be unique. */
export async function upsertPromoter(db: PromoDb, input: Partial<Promoter>, id?: string) {
  const f: Record<string, string> = {};
  const mobile = String(input.mobile ?? "").replace(/\D/g, "").slice(-10);
  const code = normaliseCode(input.code);
  if (!String(input.name ?? "").trim()) f.name = "Name is required";
  if (!/^[6-9]\d{9}$/.test(mobile)) f.mobile = "Enter a valid 10-digit mobile number";
  if (!/^[A-Z0-9]{4,16}$/.test(code)) f.code = "4–16 letters or numbers, e.g. RAJ5";
  const channel = String(input.channel ?? "").trim();
  if (!(PROMOTER_CHANNELS as readonly string[]).includes(channel)) f.channel = "Choose the channel";
  if (!String(input.brand ?? "").trim()) f.brand = "Brand or page name is required";
  const list = (db.promoters ??= []);
  if (list.some((p) => p.code === code && p.id !== id)) f.code = "Another promoter uses this code";
  if (list.some((p) => p.mobile === mobile && p.id !== id)) f.mobile = "Another promoter uses this number";
  if (Object.keys(f).length) throw new PromoError(422, "Please fix the highlighted fields", f);
  const existing = id ? list.find((p) => p.id === id) : undefined;
  if (id && !existing) throw new PromoError(404, "Promoter not found");
  const p = existing ?? ({ id: uid("pm"), created_at: iso() } as Promoter);
  Object.assign(p, { name: String(input.name).trim(), mobile, code, channel, brand: String(input.brand).trim(), active: input.active ?? true });
  if (!existing) list.push(p);
  return p;
}
export const publicPromoter = ({ password_hash: _h, session_version: _v, ...p }: Promoter) => { void _h; void _v; return p; };

/** Totals for one promoter's commissions. */
export function commissionTotals(list: Commission[]) {
  const sum = (st: CommissionStatus) => list.filter((c) => c.status === st).reduce((n, c) => n + c.amount, 0);
  return { pending: sum("PENDING"), earned: sum("EARNED"), paid: sum("PAID"), reversed: sum("REVERSED"), orders: new Set(list.map((c) => c.ref)).size };
}
