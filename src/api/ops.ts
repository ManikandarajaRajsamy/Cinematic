// Client calls for operations: subscriptions, delivery partners, deliveries board, cash, dashboard, visits.
import { request } from "./client";
import type { CalendarDay, Job, ServerOrder, Subscription, Partner, Handover, Visit } from "./opsServer";
import type { CustomerOrderView, CustomerSubView } from "./mockServer";
import type { Promoter, Commission } from "./promoServer";

export type { CalendarDay, Job, ServerOrder, CustomerOrderView, CustomerSubView };
export type SubView = Subscription & {
  calendar: CalendarDay[]; delivered: number; failed: number; paused_days: number; remaining: number;
  end_date: string | null; status: "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";
};
export type AdminSub = SubView & { order_status: ServerOrder["status"]; payment_status: ServerOrder["payment_status"] | null };
export type PromoterView = Omit<Promoter, "password_hash" | "session_version">;
export type { Commission };
export interface CommissionTotals { pending: number; earned: number; paid: number; reversed: number; orders: number }
export type PartnerView = Omit<Partner, "password_hash" | "session_version">;
export type AdminJob = Job & { partner_name: string };
export type AdminOrder = ServerOrder & { job: Job | null; plans: { id: string; ref: string; partner_id: string | null; branch_id: string }[] };
export interface CashRow { partner_id: string; name: string; mobile: string; branch_id: string; cash_today: number; upi_today: number; handed_over: number; pending: number; handovers: Handover[] }
export interface PartnerPlan {
  id: string; ref: string; status: "ACTIVE" | "PAUSED"; customer: string; mobile: string; area: string; address: string; landmark: string; lat: number | null; lng: number | null; notes: string; item: string;
  start_date: string; end_date: string | null; delivered: number; remaining: number; next_date: string | null; today: Job["status"] | null;
}
export interface PartnerJobs { mine: Job[]; history: (Job & { reassigned?: boolean })[]; summary: PartnerSummary; plans: PartnerPlan[] }
export interface PartnerSummary { picked: number; delivered: number; cash_today: number; cash_to_hand_over: number }
export interface DashboardData {
  today: string; orders: ServerOrder[]; subs: SubView[]; jobs: Job[]; visits: Visit[];
  events: { id: string; ref: string; name: string; phone: string; event_type: string; event_date: string; service: string; litres: number; base_amount: number; advance_paid?: number; balance_collected?: number; status: string; branch_id?: string; created_at: string }[];
  customers: { mobile: string; created_at: string }[];
  partners: { id: string; name: string; branch_id: string }[];
  handovers: Handover[];
  branches: { id: string; name: string }[];
}

/** Orders a guest has looked up (order ID + mobile), kept on this device so their tracking history stays. */
const TRACKED_KEY = "ssp-tracked-orders";
export const guestTracking = {
  get: (): { ref: string; mobile?: string; token?: string }[] => { try { return JSON.parse(localStorage.getItem(TRACKED_KEY) || "[]"); } catch { return []; } },
  add: (ref: string, mobile: string) => guestTracking.save({ ref, mobile }),
  /** an order opened from the shop's tracking link */
  addLink: (ref: string, token: string) => guestTracking.save({ ref, token }),
  save: (entry: { ref: string; mobile?: string; token?: string }) => {
    const list = guestTracking.get().filter((t) => t.ref !== entry.ref);
    try { localStorage.setItem(TRACKED_KEY, JSON.stringify([entry, ...list].slice(0, 20))); } catch { /* private mode: lasts for this visit */ }
  },
  remove: (ref: string) => { try { localStorage.setItem(TRACKED_KEY, JSON.stringify(guestTracking.get().filter((t) => t.ref !== ref))); } catch { /* ignore */ } },
};

const PARTNER_KEY = "ssp-partner-session";
export const partnerSession = {
  get: () => { try { return JSON.parse(localStorage.getItem(PARTNER_KEY) || "null") as { token: string } | null; } catch { return null; } },
  set: (token: string) => { try { localStorage.setItem(PARTNER_KEY, JSON.stringify({ token })); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(PARTNER_KEY); } catch { /* ignore */ } },
};

export const ops = {
  // customer
  orderStatuses: (refs: string[]) => request<CustomerOrderView[]>("POST", "/api/orders/status", { refs, tracked: guestTracking.get() }),
  orderByLink: (token: string) => request<CustomerOrderView>("POST", "/api/orders/by-link", { token }),
  lookupOrder: (ref: string, mobile: string) => request<CustomerOrderView>("POST", "/api/orders/lookup", { ref, mobile }),
  payStart: (ref: string, refs: string[]) => request<{ id: string; amount: number; status: string }>("POST", "/api/orders/pay-start", { ref, refs, tracked: guestTracking.get() }),
  payStatus: (ref: string, id: string, refs: string[]) => request<{ status: string | null; order: CustomerOrderView }>("POST", "/api/orders/pay-status", { ref, id, refs, tracked: guestTracking.get() }),
  payRazorpay: (ref: string, payment_id: string, refs: string[]) => request<{ status: string; order: CustomerOrderView }>("POST", "/api/orders/pay-razorpay", { ref, payment_id, refs, tracked: guestTracking.get() }),
  resendCustomerOtp: (ref: string, refs: string[]) => request<CustomerOrderView>("POST", "/api/orders/otp-resend", { ref, refs, tracked: guestTracking.get() }),
  mySubscriptions: (orderRefs: string[]) => request<CustomerSubView[]>("POST", "/api/subscriptions/mine", { orderRefs }),
  resendPlanOtp: (id: string, orderRefs: string[]) => request<CustomerSubView>("POST", "/api/subscriptions/otp-resend", { id, orderRefs }),
  subscriptionAction: (id: string, action: "pause" | "resume" | "cancel", orderRefs: string[]) => request<SubView>("PUT", "/api/subscriptions/action", { id, action, orderRefs }),
  trackVisit: (vid: string, path: string) => request("POST", "/api/visits/track", { vid, path }),

  // delivery partner
  partnerLogin: (mobile: string, password: string) => request<{ token: string; partner: PartnerView }>("POST", "/api/partner/login", { mobile, password }),
  partnerMe: () => request<{ partner: PartnerView; summary: PartnerSummary; branch: string }>("GET", "/api/partner/me"),
  partnerPassword: (current: string, next: string) => request<{ ok: true }>("POST", "/api/partner/password", { current, next }),
  partnerJobs: () => request<PartnerJobs>("GET", "/api/partner/jobs"),
  // the only three things a partner can do
  confirmPickup: (id: string) => request<Job>("POST", "/api/partner/pickup", { id }),
  openQr: (id: string) => request<Job>("POST", "/api/partner/qr", { id }),
  cashReceived: (id: string, amount: number) => request<Job>("POST", "/api/partner/cash", { id, amount }),
  qrStatus: (id: string) => request<Job>("POST", "/api/partner/qr-status", { id }),
  completeDelivery: (id: string, otp: string) => request<Job>("POST", "/api/partner/deliver", { id, otp }),
  resendOtp: (id: string) => request<Job>("POST", "/api/partner/otp-resend", { id }),
  skipPlanDay: (id: string, reason: string) => request<Job>("POST", "/api/partner/skip", { id, reason }),
  // demo stand-in for the gateway webhook; never called by the partner app itself
  gatewayWebhook: (payreq: string, status: "PAID" | "FAILED") => request<{ ok: boolean }>("POST", "/api/gateway/qr-webhook", { payreq, status }),

  // admin
  promoters: () => request<(PromoterView & { totals: CommissionTotals })[]>("GET", "/api/admin/promoters"),
  savePromoter: (p: Partial<PromoterView>, id?: string) => request<PromoterView>(id ? "PUT" : "POST", id ? `/api/admin/promoters/${id}` : "/api/admin/promoters", p),
  commissions: () => request<(Commission & { promoter_name: string; promoter_brand: string })[]>("GET", "/api/admin/commissions"),
  payCommissions: (ids: string[]) => request<{ paid: number }>("POST", "/api/admin/commissions/pay", { ids }),
  partners: () => request<(PartnerView & { summary: PartnerSummary })[]>("GET", "/api/admin/partners"),
  savePartner: (p: Partial<PartnerView> & { password?: string }, id?: string) => request<PartnerView>(id ? "PUT" : "POST", id ? `/api/admin/partners/${id}` : "/api/admin/partners", p),
  orders: () => request<AdminOrder[]>("GET", "/api/admin/orders"),
  cancelOrder: (ref: string) => request<ServerOrder>("PUT", `/api/admin/orders/${ref}`, { action: "cancel" }),
  createOrderFor: (o: {
    customer: { name: string; mobile: string };
    address: { line1?: string; line2?: string; area?: string; pincode?: string; district: string; landmark?: string; instructions?: string; location_text?: string; lat: number | null; lng: number | null };
    lines: { productId: string; qty: number }[]; payment: "cash" | "qr" | "paid"; payment_ref?: string; partner_id?: string;
  }) => request<{ order: ServerOrder; share_token: string }>("POST", "/api/admin/orders", o),
  confirmOrder: (ref: string, partner_id?: string) => request<ServerOrder>("PUT", `/api/admin/orders/${ref}`, { action: "confirm", partner_id }),
  rejectOrder: (ref: string, reason: string) => request<ServerOrder>("PUT", `/api/admin/orders/${ref}`, { action: "reject", reason }),
  assignJob: (jobId: string, partner_id: string) => request<Job>("PUT", `/api/admin/jobs/${jobId}`, { partner_id }),
  subscriptions: () => request<AdminSub[]>("GET", "/api/admin/subscriptions"),
  adminSubAction: (id: string, action: "pause" | "resume" | "cancel" | "notes", notes?: string) => request<SubView>("PUT", `/api/admin/subscriptions/${id}`, { action, notes }),
  assignPlanPartner: (id: string, partner_id: string) => request<SubView>("PUT", `/api/admin/subscriptions/${id}`, { action: "assign", partner_id }),
  jobs: () => request<AdminJob[]>("GET", "/api/admin/jobs"),
  cash: () => request<CashRow[]>("GET", "/api/admin/cash"),
  receiveCash: (partner_id: string, amount: number) => request("POST", "/api/admin/cash", { partner_id, amount }),
  dashboard: () => request<DashboardData>("GET", "/api/admin/dashboard"),
};

/** Current position for delivery confirmations; null if the browser can't or won't share it. */
export function currentLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }),
      () => resolve(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

/** ₹ in Indian grouping, from paise: 12345600 → ₹1,23,456 */
export const inr = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");
