// The only file the app uses to talk to the backend. Today the transport is the in-browser mock
// (mockServer.ts); to go live, make `request` call fetch(`${API_BASE}${path}`) with the same methods and JSON.
import { useCallback, useEffect, useState } from "react";
import { ApiError, handle, type EventRequest } from "./mockServer";
import type {
  AuditEntry, Branch, BranchHoliday, BranchProduct, CreateOrderRequest, CreatedOrderPricing, DeliveryQuote,
  DeliverySettings, Product, PublicProduct, QuoteRequest,
} from "./types";

export { ApiError };
export type { EventRequest };
export type PublicBranch = Branch & { holidays: BranchHoliday[] };
export type AdminBranch = PublicBranch & { has_sales: boolean };
export type PublicDeliverySettings = Pick<DeliverySettings, "free_radius_km" | "max_radius_km" | "district_restriction" | "plan_free_delivery" | "plan_discount_percent" | "plan_discounts" | "free_above_amount" | "slabs" | "discount_above_amount" | "discount_percent" | "support_phone">;

const ADMIN_KEY = "ssp-admin-token";
export const adminSession = {
  get: () => { try { return sessionStorage.getItem(ADMIN_KEY) ?? undefined; } catch { return undefined; } },
  set: (t: string) => { try { sessionStorage.setItem(ADMIN_KEY, t); } catch { /* ignore */ } },
  clear: () => { try { sessionStorage.removeItem(ADMIN_KEY); } catch { /* ignore */ } },
};

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  await new Promise((r) => setTimeout(r, 120)); // network-like latency so loading states are exercised
  // JSON round trip, like a real HTTP call: the caller can never hand the server live objects
  const payload = body === undefined ? undefined : JSON.parse(JSON.stringify(body));
  // some routes are asynchronous (road distance lookups), so wait for the result either way
  let customerToken: string | undefined;
  try { customerToken = (JSON.parse(localStorage.getItem("ssp-customer-session") || "null") as { token?: string } | null)?.token; } catch { /* none */ }
  let partnerToken: string | undefined;
  try { partnerToken = (JSON.parse(localStorage.getItem("ssp-partner-session") || "null") as { token?: string } | null)?.token; } catch { /* none */ }
  const result = await handle(method, path, payload, adminSession.get(), customerToken, partnerToken);
  return JSON.parse(JSON.stringify(result)) as T;
}

/* ---------------- endpoints ---------------- */
export const api = {
  publicBranches: () => request<PublicBranch[]>("GET", "/api/public/branches"),
  publicProducts: () => request<PublicProduct[]>("GET", "/api/public/products"),
  publicDeliverySettings: () => request<PublicDeliverySettings>("GET", "/api/public/delivery-settings"),
  quote: (q: QuoteRequest) => request<DeliveryQuote>("POST", "/api/delivery/quote", q),
  createOrder: (o: CreateOrderRequest) => request<CreatedOrderPricing>("POST", "/api/orders/create", o),

  requestEvent: (r: Omit<EventRequest, "id" | "ref" | "created_at" | "base_amount" | "status">) => request<EventRequest>("POST", "/api/events/request", r),
  adminLogin: (phone: string) => request<{ token: string; phone: string }>("POST", "/api/auth/admin", { phone }),
  admin: {
    branches: () => request<AdminBranch[]>("GET", "/api/admin/branches"),
    saveBranch: (b: Branch & { holidays: BranchHoliday[] }, isNew: boolean) =>
      request<Branch>(isNew ? "POST" : "PUT", isNew ? "/api/admin/branches" : `/api/admin/branches/${b.id}`, b),
    deleteBranch: (id: string) => request<{ ok: true }>("DELETE", `/api/admin/branches/${id}`),
    reorderBranches: (ids: string[]) => request<{ ok: true }>("PUT", "/api/admin/branch-order", ids),
    products: () => request<PublicProduct[]>("GET", "/api/admin/products"),
    saveProduct: (p: Product, isNew: boolean) =>
      request<Product>(isNew ? "POST" : "PUT", isNew ? "/api/admin/products" : `/api/admin/products/${p.id}`, p),
    branchProducts: () => request<(BranchProduct & { sold_out_today: boolean })[]>("GET", "/api/admin/branch-products"),
    saveBranchProduct: (bp: { branch_id: string; product_id: string; price_override: number | null; is_available: boolean; sold_out_today: boolean }) =>
      request<BranchProduct>("PUT", "/api/admin/branch-products", bp),
    deliverySettings: () => request<DeliverySettings>("GET", "/api/admin/delivery-settings"),
    saveDeliverySettings: (s: DeliverySettings) => request<DeliverySettings>("PUT", "/api/admin/delivery-settings", s),
    audit: () => request<{ audit: AuditEntry[]; logs: { at: string; msg: string }[] }>("GET", "/api/admin/audit"),
    eventRequests: () => request<EventRequest[]>("GET", "/api/admin/event-requests"),
    setEventStatus: (id: string, status: EventRequest["status"], advance_paid?: number) => request<EventRequest>("PUT", `/api/admin/event-requests/${id}`, { status, advance_paid }),
    reset: () => request<{ ok: true }>("POST", "/api/admin/reset"),
  },
};

/* ---------------- cached reads ---------------- */
// Short TTL so admin changes reach the site within 60 s even without a signal; saves also bust the cache at once.
const TTL = 60_000;
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
if (typeof window !== "undefined") window.addEventListener("ssp-db-changed", () => cache.clear());

function cached<T>(key: string, fn: () => Promise<T>, force = false): Promise<T> {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.data as T);
  if (!inflight.has(key)) {
    inflight.set(key, fn().then((data) => { cache.set(key, { at: Date.now(), data }); return data; }).finally(() => inflight.delete(key)));
  }
  return inflight.get(key) as Promise<T>;
}

/** Loads data, refetches when the cache expires (every 60 s) and as soon as anything is saved. */
export function useApi<T>(key: string, fn: () => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>(() => {
    const hit = cache.get(key);
    return hit ? { data: hit.data as T, loading: false } : { loading: true };
  });
  const load = useCallback((force = false) => {
    cached(key, fn, force)
      .then((data) => setState({ data, loading: false }))
      .catch((e: Error) => setState((s) => ({ ...s, error: e.message, loading: false })));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
    const bust = () => load(true);
    window.addEventListener("ssp-db-changed", bust);
    const t = window.setInterval(() => load(), TTL);
    return () => { window.removeEventListener("ssp-db-changed", bust); window.clearInterval(t); };
  }, [load]);
  return { ...state, reload: () => load(true) };
}

export const usePublicBranches = () => useApi("branches", api.publicBranches);
export const usePublicProducts = () => useApi("products", api.publicProducts);
export const useDeliverySettings = () => useApi("delivery-settings", api.publicDeliverySettings);

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Fills {free_radius_km}, {max_radius_km}, {district}, {plan_free_suffix} in policy and FAQ text from live settings. */
export function fillDeliveryText(text: string, s?: PublicDeliverySettings) {
  if (!s) return text.replace(/\{[a-z_]+\}/g, "…");
  return text
    .replace(/\{free_radius_km\}/g, String(s.free_radius_km))
    .replace(/\{max_radius_km\}/g, String(s.max_radius_km))
    .replace(/\{district\}/g, s.district_restriction)
    .replace(/\{discount_above\}/g, s.discount_above_amount != null ? `₹${s.discount_above_amount / 100}` : "the set amount")
    .replace(/\{discount_percent\}/g, String(s.discount_percent))
    .replace(/\{support_phone\}/g, s.support_phone)
    .replace(/\{plan_free_suffix\}/g, s.plan_free_delivery ? " at any distance we deliver to" : " only within the free radius");
}
