// Client calls for operations: subscriptions, delivery partners, deliveries board, cash, dashboard, visits.
import { request } from "./client";
import type { CalendarDay, Job, ServerOrder, Subscription, Partner, Handover, Visit } from "./opsServer";

export type { CalendarDay, Job, ServerOrder };
export type SubView = Subscription & {
  calendar: CalendarDay[]; delivered: number; failed: number; paused_days: number; remaining: number;
  end_date: string | null; status: "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";
};
export type PartnerView = Omit<Partner, "password_hash" | "session_version">;
export type AdminJob = Job & { partner_name: string };
export type AdminOrder = ServerOrder & { job: Job | null };
export interface CashRow { partner_id: string; name: string; mobile: string; branch_id: string; cash_today: number; upi_today: number; handed_over: number; pending: number; handovers: Handover[] }
export interface PartnerJobs { available: Job[]; mine: Job[]; history: Job[]; summary: PartnerSummary; online: boolean }
export interface PartnerSummary { picked: number; delivered: number; cash_today: number; cash_to_hand_over: number }
export interface DashboardData {
  today: string; orders: ServerOrder[]; subs: SubView[]; jobs: Job[]; visits: Visit[];
  events: { id: string; ref: string; name: string; phone: string; event_type: string; event_date: string; service: string; litres: number; base_amount: number; advance_paid?: number; balance_collected?: number; status: string; branch_id?: string; created_at: string }[];
  customers: { mobile: string; created_at: string }[];
  partners: { id: string; name: string; branch_id: string }[];
  handovers: Handover[];
  branches: { id: string; name: string }[];
}

const PARTNER_KEY = "ssp-partner-session";
export const partnerSession = {
  get: () => { try { return JSON.parse(localStorage.getItem(PARTNER_KEY) || "null") as { token: string } | null; } catch { return null; } },
  set: (token: string) => { try { localStorage.setItem(PARTNER_KEY, JSON.stringify({ token })); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(PARTNER_KEY); } catch { /* ignore */ } },
};

export const ops = {
  // customer
  orderStatuses: (refs: string[]) => request<{ ref: string; status: ServerOrder["status"]; job: { status: Job["status"]; delivered_at: string | null } | null }[]>("POST", "/api/orders/status", { refs }),
  mySubscriptions: (orderRefs: string[]) => request<SubView[]>("POST", "/api/subscriptions/mine", { orderRefs }),
  subscriptionAction: (id: string, action: "pause" | "resume" | "cancel", orderRefs: string[]) => request<SubView>("PUT", "/api/subscriptions/action", { id, action, orderRefs }),
  trackVisit: (vid: string, path: string) => request("POST", "/api/visits/track", { vid, path }),

  // delivery partner
  partnerLogin: (mobile: string, password: string) => request<{ token: string; partner: PartnerView }>("POST", "/api/partner/login", { mobile, password }),
  partnerMe: () => request<{ partner: PartnerView; summary: PartnerSummary; branch: string }>("GET", "/api/partner/me"),
  partnerOnline: (online: boolean) => request<{ online: boolean }>("PUT", "/api/partner/online", { online }),
  partnerJobs: () => request<PartnerJobs>("GET", "/api/partner/jobs"),
  pick: (id: string) => request<Job>("POST", "/api/partner/pick", { id }),
  start: (id: string) => request<Job>("POST", "/api/partner/start", { id }),
  release: (id: string, reason: string) => request<Job>("POST", "/api/partner/release", { id, reason }),
  deliver: (id: string, p: { method?: "CASH" | "UPI"; amount?: number; reason?: string; location: { lat: number; lng: number } | null }) => request<Job>("POST", "/api/partner/deliver", { id, ...p }),
  fail: (id: string, p: { reason: string; photo?: string; location: { lat: number; lng: number } | null }) => request<Job>("POST", "/api/partner/fail", { id, ...p }),

  // admin
  partners: () => request<(PartnerView & { summary: PartnerSummary })[]>("GET", "/api/admin/partners"),
  savePartner: (p: Partial<PartnerView> & { password?: string }, id?: string) => request<PartnerView>(id ? "PUT" : "POST", id ? `/api/admin/partners/${id}` : "/api/admin/partners", p),
  orders: () => request<AdminOrder[]>("GET", "/api/admin/orders"),
  cancelOrder: (ref: string) => request<ServerOrder>("PUT", `/api/admin/orders/${ref}`, { action: "cancel" }),
  subscriptions: () => request<SubView[]>("GET", "/api/admin/subscriptions"),
  adminSubAction: (id: string, action: "pause" | "resume" | "cancel" | "notes", notes?: string) => request<SubView>("PUT", `/api/admin/subscriptions/${id}`, { action, notes }),
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
