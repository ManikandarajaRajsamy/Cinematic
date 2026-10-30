import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, useCallback, ReactNode } from "react";
import { COUPONS, type Product } from "@/data/catalog";
import { api, usePublicProducts, useDeliverySettings } from "@/api/client";
import { auth, type PublicCustomer } from "@/api/auth";
import { ops } from "@/api/ops";
import type { PublicProduct } from "@/api/types";

/* ---------------- Types ---------------- */
export interface CartLine {
  productId: string;
  variantId: string;
  qty: number; // per delivery, for plan lines
  subscription: boolean; // is this line a daily plan
  planDays?: number; // 7, 15 or 30 for plan lines: the line is paid for the whole plan
}

export interface Address {
  id: string;
  label: string; // "Home", "Work"
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  area: string;
  pincode: string;
  district: string; // must match the delivery district (checked by the server)
  lat: number | null; // map pin, used for the distance-based delivery fee
  lng: number | null;
}

export interface User {
  name: string;
  email: string;
  phone: string;
  loggedIn: boolean;
}

export interface OrderItem {
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  price: number;
  qty: number;
  lineTotal: number;
  subscription: boolean;
}

export type OrderStatus = "placed" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

export interface DemoOrder {
  id: string;
  number: string;
  items: OrderItem[];
  subtotal: number;
  couponCode?: string;
  couponDiscount: number;
  subscriptionDiscount: number;
  deliveryFee: number;
  total: number;
  address?: Address;
  customer: { name: string; phone: string; email: string };
  placedAt: string;
  status: OrderStatus;
  hasSubscription: boolean;
  /** set by the server when the order is created */
  delivery?: { branch_id: string; distance_km: number; method: string; freeReason?: string };
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  frequency: string; // "Monthly", "Fortnightly"
  productId: string;
  variantId: string;
  qty: number;
  status: "active" | "paused" | "cancelled";
  startedAt: string;
}

interface ToastMsg { id: number; text: string; kind: "default" | "success" | "error" }

interface State {
  user: User;
  addresses: Address[];
  cart: CartLine[];
  orders: DemoOrder[];
  subscriptions: SubscriptionPlan[];
  activeCoupon?: string;
}

/* ---------------- Helpers ---------------- */
const KEY = "ssp-state-v1";
function load<T>(): T | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function save(s: State) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

/** The online shop's view of an API product: one product per size, prices in rupees. */
function toShopProduct(p: PublicProduct): Product {
  const inStock = p.available && !p.sold_out_today;
  return {
    id: p.id, name: `${p.name_en} ${p.size_label_en}`, tagline: `${p.name_ta} ${p.size_label_ta}`.trim(),
    description: p.description_en, category: "parcel", image: p.image_url || "/media/closeup.webp", gallery: [p.image_url || "/media/closeup.webp"],
    variants: [{ id: "std", label: p.size_label_en, price: p.price / 100, inStock }],
    tags: [], maxQty: p.max_qty_per_order, planEligible: p.plan_eligible, soldOutToday: p.sold_out_today,
  };
}

// Kept in sync with the API products by StoreProvider so the pure pricing helpers see admin edits.
let liveProducts: Product[] = [];
export const productById = (id: string) => liveProducts.find((p) => p.id === id);
export const variantPrice = (p?: Product, vid?: string) =>
  p?.variants.find((v) => v.id === vid)?.price ?? 0;

export function lineSubtotal(line: CartLine): number {
  const p = productById(line.productId);
  return variantPrice(p, line.variantId) * line.qty * (line.subscription ? line.planDays ?? 1 : 1);
}

export function cartSubtotal(cart: CartLine[]): number {
  return cart.reduce((s, l) => s + lineSubtotal(l), 0);
}

export function applyCoupon(code: string | undefined, subtotal: number): { discount: number; label?: string; code?: string } {
  if (!code) return { discount: 0 };
  const c = COUPONS[code.toUpperCase()];
  if (!c) return { discount: 0 };
  const d = c.type === "percent" ? Math.round(subtotal * c.value) / 100 : Math.min(c.value, subtotal);
  return { discount: Math.round(d), label: c.label, code: code.toUpperCase() };
}

export interface CartTotals {
  subtotal: number;
  couponDiscount: number;
  subscriptionDiscount: number;
  deliveryFee: number;
  total: number;
  hasSubscription: boolean;
}

/**
 * Display totals. The delivery fee comes from a server quote (in rupees) and the plan discount
 * percent from the delivery settings; the server recalculates everything again at order creation.
 */
export function computeTotals(cart: CartLine[], couponCode?: string, deliveryFee = 0, planPctFor: (days?: number) => number = () => 15): CartTotals {
  const subtotal = cartSubtotal(cart);
  const coupon = applyCoupon(couponCode, subtotal);
  const hasSubscription = cart.some((l) => l.subscription);
  // plan discount on the eligible (plan) lines only
  const subDiscount = cart.reduce((s, l) => s + (l.subscription ? Math.round((lineSubtotal(l) * planPctFor(l.planDays)) / 100) : 0), 0);
  const total = Math.max(0, subtotal - coupon.discount - subDiscount + deliveryFee);
  return { subtotal, couponDiscount: coupon.discount, subscriptionDiscount: subDiscount, deliveryFee, total, hasSubscription };
}

/* ---------------- Context ---------------- */
interface Ctx {
  state: State;
  // catalogue from the API
  products: Product[];
  productsLoading: boolean;
  productsError?: string;
  planDiscountPercent: number; // highest plan discount ("up to")
  planPctFor: (days?: number) => number;
  // cart
  addToCart: (productId: string, variantId: string, qty?: number, subscription?: boolean, planDays?: number) => void;
  updateQty: (productId: string, variantId: string, qty: number) => void;
  removeFromCart: (productId: string, variantId: string) => void;
  clearCart: () => void;
  cartCount: number;
  // coupon
  setCoupon: (code: string | undefined) => void;
  // auth (see api/auth.ts): the mobile number is the customer ID
  signedIn: (c: PublicCustomer) => void;
  signOut: () => Promise<void>;
  // addresses
  addAddress: (a: Omit<Address, "id">) => Address;
  updateAddress: (id: string, a: Partial<Address>) => void;
  removeAddress: (id: string) => void;
  // orders
  /** Sends the cart to the server, which prices it and recomputes the delivery fee. */
  placeOrder: (customer: { name: string; phone: string; email: string }, address: Address, payment: "upi" | "card" | "cod") => Promise<{ order: DemoOrder; account: { created: boolean; claimToken?: string } }>;
  advanceStatus: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  // subscriptions
  subscribe: (plan: Omit<SubscriptionPlan, "id" | "startedAt" | "status">) => void;
  setSubscriptionStatus: (id: string, status: SubscriptionPlan["status"]) => void;
  // toasts
  toasts: ToastMsg[];
  toast: (text: string, kind?: "default" | "success" | "error") => void;
  dismissToast: (id: number) => void;
}

const StoreCtx = createContext<Ctx | null>(null);

const defaultState: State = {
  user: { name: "", email: "", phone: "", loggedIn: false },
  addresses: [],
  cart: [],
  orders: [],
  subscriptions: [],
  activeCoupon: undefined,
};

let toastId = 0;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => {
    // older saves carried their own catalogue; the catalogue now comes from the API
    const { products: _p, branches: _b, ...saved } = (load<State & { products?: unknown; branches?: unknown }>() ?? {}) as State & { products?: unknown; branches?: unknown };
    void _p; void _b;
    return { ...defaultState, ...saved };
  });
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const productsApi = usePublicProducts();
  const settings = useDeliverySettings();
  const products = useMemo(() => (productsApi.data ?? []).map(toShopProduct), [productsApi.data]);
  liveProducts = products;

  // drop cart lines for products the shop no longer sells (or from the old demo catalogue)
  useEffect(() => {
    if (!productsApi.data) return;
    setState((s) => {
      const cart = s.cart.filter((l) => products.some((p) => p.id === l.productId && p.variants.some((v) => v.id === l.variantId)));
      return cart.length === s.cart.length ? s : { ...s, cart };
    });
  }, [productsApi.data, products]);
  // layout effect: saved before child screens run their effects (e.g. a delivery quote for a just-added address)
  useLayoutEffect(() => { save(state); }, [state]);

  const toast = useCallback((text: string, kind: "default" | "success" | "error" = "default") => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // --- cart ops ---
  const addToCart = useCallback<Ctx["addToCart"]>((productId, variantId, qty = 1, subscription = false, planDays) => {
    setState((s) => {
      // a plan line is its own line per plan length; it is replaced, not added to
      if (subscription) {
        const cart = s.cart.filter((l) => !(l.subscription && l.productId === productId));
        return { ...s, cart: [...cart, { productId, variantId, qty, subscription: true, planDays }] };
      }
      const idx = s.cart.findIndex((l) => l.productId === productId && l.variantId === variantId && l.subscription === subscription);
      const max = productById(productId)?.maxQty ?? Infinity;
      const cart = idx >= 0
        ? s.cart.map((l, i) => (i === idx ? { ...l, qty: Math.min(max, l.qty + qty) } : l))
        : [...s.cart, { productId, variantId, qty: Math.min(max, qty), subscription }];
      return { ...s, cart };
    });
  }, []);
  const updateQty = useCallback<Ctx["updateQty"]>((productId, variantId, qty) => {
    setState((s) => ({
      ...s,
      cart: qty <= 0
        ? s.cart.filter((l) => !(l.productId === productId && l.variantId === variantId))
        : s.cart.map((l) => (l.productId === productId && l.variantId === variantId ? { ...l, qty: Math.min(productById(productId)?.maxQty ?? Infinity, qty) } : l)),
    }));
  }, []);
  const removeFromCart = useCallback<Ctx["removeFromCart"]>((productId, variantId) => {
    setState((s) => ({ ...s, cart: s.cart.filter((l) => !(l.productId === productId && l.variantId === variantId)) }));
  }, []);
  const clearCart = useCallback(() => setState((s) => ({ ...s, cart: [] })), []);

  const setCoupon = useCallback((code: string | undefined) => setState((s) => ({ ...s, activeCoupon: code })), []);

  const cartCount = state.cart.reduce((n, l) => n + l.qty, 0);

  // --- auth ---
  // --- auth ---
  // Signing in loads the account's own saved addresses; signing out removes them from this device,
  // so a guest using the same device never sees another person's details.
  const signedIn = useCallback((c: PublicCustomer) => {
    setState((s) => ({
      ...s,
      user: { name: c.name, email: c.email, phone: c.mobile, loggedIn: true },
      addresses: c.addresses.map((a) => ({ ...a, line2: a.line2 ?? "" })),
    }));
  }, []);
  const signOut = useCallback(async () => {
    await auth.signOut().catch(() => {});
    setState((s) => ({ ...s, user: { name: "", email: "", phone: "", loggedIn: false }, addresses: [] }));
  }, []);
  // order statuses come from the server (a delivery partner picks, delivers or marks failed)
  const orderRefs = state.orders.map((o) => o.number).join(",");
  useEffect(() => {
    if (!orderRefs) return;
    const sync = () => ops.orderStatuses(orderRefs.split(",")).then((rows) => {
      const by = new Map(rows.map((r) => [r.ref, r.status]));
      setState((s) => {
        let changed = false;
        const orders = s.orders.map((o) => { const st = by.get(o.number); if (st && st !== o.status) { changed = true; return { ...o, status: st }; } return o; });
        return changed ? { ...s, orders } : s;
      });
    }).catch(() => {});
    sync();
    const t = window.setInterval(sync, 30_000);
    window.addEventListener("ssp-db-changed", sync);
    return () => { window.clearInterval(t); window.removeEventListener("ssp-db-changed", sync); };
  }, [orderRefs]);

  // check the session once on load (it may have expired, or been ended by a password reset)
  useEffect(() => {
    auth.current().then((c) => {
      if (c) signedIn(c);
      else setState((s) => (s.user.loggedIn ? { ...s, user: { name: "", email: "", phone: "", loggedIn: false }, addresses: [] } : s));
    });
  }, [signedIn]);
  // keep a signed-in customer's saved addresses on their account
  useEffect(() => {
    if (!state.user.loggedIn) return;
    const t = window.setTimeout(() => { auth.saveAddresses(state.addresses).catch(() => {}); }, 400);
    return () => window.clearTimeout(t);
  }, [state.addresses, state.user.loggedIn]);

  // --- addresses ---
  const addAddress = useCallback<Ctx["addAddress"]>((a) => {
    const id = "addr-" + Math.random().toString(36).slice(2, 8);
    const full: Address = { ...a, id };
    setState((s) => ({ ...s, addresses: [...s.addresses, full] }));
    return full;
  }, []);
  const updateAddress = useCallback<Ctx["updateAddress"]>((id, a) => {
    setState((s) => ({ ...s, addresses: s.addresses.map((x) => (x.id === id ? { ...x, ...a } : x)) }));
  }, []);
  const removeAddress = useCallback<Ctx["removeAddress"]>((id) => {
    setState((s) => ({ ...s, addresses: s.addresses.filter((x) => x.id !== id) }));
  }, []);

  // --- orders ---
  const placeOrder = useCallback<Ctx["placeOrder"]>(async (customer, address, payment) => {
    // Only product ids, quantities, the address id and the coupon code are sent. The server looks up
    // prices and recomputes the delivery fee, so nothing priced in the browser can change the total.
    const priced = await api.createOrder({
      lines: state.cart.map((l) => ({ productId: l.productId, qty: l.qty, plan: l.subscription, planDays: l.planDays })),
      payment,
      addressId: address.id, couponCode: state.activeCoupon, customer,
    });
    const r = (paise: number) => paise / 100;
    const order: DemoOrder = {
      id: "ord-" + Math.random().toString(36).slice(2, 8),
      number: priced.order_ref,
      items: priced.items.map((i) => ({ productId: i.productId, productName: i.productName, variantId: "std", variantLabel: i.sizeLabel, price: r(i.unitPrice), qty: i.qty, lineTotal: r(i.lineTotal), subscription: i.plan })),
      subtotal: r(priced.subtotal),
      couponCode: state.activeCoupon,
      couponDiscount: r(priced.couponDiscount),
      subscriptionDiscount: r(priced.planDiscount),
      deliveryFee: r(priced.deliveryFee),
      total: r(priced.total),
      address,
      customer,
      placedAt: new Date().toISOString(),
      status: "placed",
      hasSubscription: priced.items.some((i) => i.plan),
      delivery: priced.delivery,
    };
    setState((s) => ({ ...s, orders: [order, ...s.orders], cart: [], activeCoupon: undefined }));
    return { order, account: priced.account };
  }, [state.cart, state.activeCoupon]);

  const advanceStatus = useCallback<Ctx["advanceStatus"]>((orderId) => {
    const order: OrderStatus[] = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered"];
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => {
        if (o.id !== orderId || o.status === "delivered" || o.status === "cancelled") return o;
        const i = order.indexOf(o.status);
        return { ...o, status: order[i + 1] ?? o.status };
      }),
    }));
  }, []);
  const cancelOrder = useCallback<Ctx["cancelOrder"]>((orderId) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, status: "cancelled" as OrderStatus } : o)),
    }));
  }, []);

  // --- subscriptions ---
  const subscribe = useCallback<Ctx["subscribe"]>((plan) => {
    const id = "sub-" + Math.random().toString(36).slice(2, 8);
    setState((s) => ({ ...s, subscriptions: [...s.subscriptions, { ...plan, id, startedAt: new Date().toISOString(), status: "active" }] }));
  }, []);
  const setSubscriptionStatus = useCallback<Ctx["setSubscriptionStatus"]>((id, status) => {
    setState((s) => ({ ...s, subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, status } : x)) }));
  }, []);

  const value: Ctx = {
    state, products, productsLoading: productsApi.loading, productsError: productsApi.error,
    planDiscountPercent: settings.data?.plan_discount_percent ?? 15,
    planPctFor: (days?: number) => (days ? settings.data?.plan_discounts?.[String(days)] : undefined) ?? settings.data?.plan_discount_percent ?? 15,
    addToCart, updateQty, removeFromCart, clearCart, cartCount, setCoupon,
    signedIn, signOut,
    addAddress, updateAddress, removeAddress,
    placeOrder, advanceStatus, cancelOrder,
    subscribe, setSubscriptionStatus,
    toasts, toast, dismissToast,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}
