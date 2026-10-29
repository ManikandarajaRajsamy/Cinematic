import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { PRODUCTS, COUPONS, DELIVERY_FEE, SUBSCRIPTION_DISCOUNT, Product } from "@/data/catalog";

/* ---------------- Types ---------------- */
export interface CartLine {
  productId: string;
  variantId: string;
  qty: number;
  subscription: boolean; // is this line part of a subscription plan
}

export interface Address {
  id: string;
  label: string; // "Home", "Work"
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  area: string; // used for Madurai eligibility check
  pincode: string;
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

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
export const variantPrice = (p?: Product, vid?: string) =>
  p?.variants.find((v) => v.id === vid)?.price ?? 0;

export function lineSubtotal(line: CartLine): number {
  const p = productById(line.productId);
  return variantPrice(p, line.variantId) * line.qty;
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

export function computeTotals(cart: CartLine[], couponCode?: string): CartTotals {
  const subtotal = cartSubtotal(cart);
  const coupon = applyCoupon(couponCode, subtotal);
  const hasSubscription = cart.some((l) => l.subscription);
  // 15% subscription discount on the eligible (subscription) lines only
  const eligibleSub = cart.reduce((s, l) => (l.subscription ? lineSubtotal(l) : 0) + s, 0);
  const subDiscount = hasSubscription ? Math.round(eligibleSub * SUBSCRIPTION_DISCOUNT) : 0;
  const deliveryFee = subtotal > 0 ? DELIVERY_FEE : 0;
  const total = Math.max(0, subtotal - coupon.discount - subDiscount + deliveryFee);
  return { subtotal, couponDiscount: coupon.discount, subscriptionDiscount: subDiscount, deliveryFee, total, hasSubscription };
}

/* ---------------- Context ---------------- */
interface Ctx {
  state: State;
  // cart
  addToCart: (productId: string, variantId: string, qty?: number, subscription?: boolean) => void;
  updateQty: (productId: string, variantId: string, qty: number) => void;
  removeFromCart: (productId: string, variantId: string) => void;
  clearCart: () => void;
  cartCount: number;
  // coupon
  setCoupon: (code: string | undefined) => void;
  // auth
  login: (email: string, name?: string) => void;
  register: (name: string, email: string, phone: string) => void;
  logout: () => void;
  // addresses
  addAddress: (a: Omit<Address, "id">) => Address;
  updateAddress: (id: string, a: Partial<Address>) => void;
  removeAddress: (id: string) => void;
  // orders
  placeOrder: (customer: { name: string; phone: string; email: string }, address?: Address) => DemoOrder;
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
  const [state, setState] = useState<State>(() => ({ ...defaultState, ...load<State>() }));
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => { save(state); }, [state]);

  const toast = useCallback((text: string, kind: "default" | "success" | "error" = "default") => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // --- cart ops ---
  const addToCart = useCallback<Ctx["addToCart"]>((productId, variantId, qty = 1, subscription = false) => {
    setState((s) => {
      const idx = s.cart.findIndex((l) => l.productId === productId && l.variantId === variantId && l.subscription === subscription);
      const cart = idx >= 0
        ? s.cart.map((l, i) => (i === idx ? { ...l, qty: l.qty + qty } : l))
        : [...s.cart, { productId, variantId, qty, subscription }];
      return { ...s, cart };
    });
  }, []);
  const updateQty = useCallback<Ctx["updateQty"]>((productId, variantId, qty) => {
    setState((s) => ({
      ...s,
      cart: qty <= 0
        ? s.cart.filter((l) => !(l.productId === productId && l.variantId === variantId))
        : s.cart.map((l) => (l.productId === productId && l.variantId === variantId ? { ...l, qty } : l)),
    }));
  }, []);
  const removeFromCart = useCallback<Ctx["removeFromCart"]>((productId, variantId) => {
    setState((s) => ({ ...s, cart: s.cart.filter((l) => !(l.productId === productId && l.variantId === variantId)) }));
  }, []);
  const clearCart = useCallback(() => setState((s) => ({ ...s, cart: [] })), []);

  const setCoupon = useCallback((code: string | undefined) => setState((s) => ({ ...s, activeCoupon: code })), []);

  const cartCount = state.cart.reduce((n, l) => n + l.qty, 0);

  // --- auth ---
  const login = useCallback((email: string, name?: string) => {
    setState((s) => ({ ...s, user: { ...s.user, email, name: name || s.user.name || email.split("@")[0], loggedIn: true } }));
  }, []);
  const register = useCallback((name: string, email: string, phone: string) => {
    setState((s) => ({ ...s, user: { name, email, phone, loggedIn: true } }));
  }, []);
  const logout = useCallback(() => setState((s) => ({ ...s, user: { name: "", email: "", phone: "", loggedIn: false } })), []);

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
  const placeOrder = useCallback<Ctx["placeOrder"]>((customer, address) => {
    const t = computeTotals(state.cart, state.activeCoupon);
    const items: OrderItem[] = state.cart.map((l) => {
      const p = productById(l.productId)!;
      const v = p.variants.find((v) => v.id === l.variantId)!;
      return { productId: l.productId, productName: p.name, variantId: l.variantId, variantLabel: v.label, price: v.price, qty: l.qty, lineTotal: v.price * l.qty, subscription: l.subscription };
    });
    const order: DemoOrder = {
      id: "ord-" + Math.random().toString(36).slice(2, 8),
      number: "SSP-" + Math.floor(100000 + Math.random() * 900000),
      items,
      subtotal: t.subtotal,
      couponCode: state.activeCoupon,
      couponDiscount: t.couponDiscount,
      subscriptionDiscount: t.subscriptionDiscount,
      deliveryFee: t.deliveryFee,
      total: t.total,
      address,
      customer,
      placedAt: new Date().toISOString(),
      status: "placed",
      hasSubscription: t.hasSubscription,
    };
    setState((s) => ({ ...s, orders: [order, ...s.orders], cart: [], activeCoupon: undefined }));
    return order;
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
    state, addToCart, updateQty, removeFromCart, clearCart, cartCount, setCoupon,
    login, register, logout,
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
