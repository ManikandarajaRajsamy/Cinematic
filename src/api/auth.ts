// The customer auth service. Every sign-in related call goes through here, so another method (OTP) can be
// added later without touching checkout or the account screens. The mobile number is the customer ID.
import { request } from "./client";
import type { PublicCustomer, StoredAddress } from "./authServer";

export type { PublicCustomer };
const KEY = "ssp-customer-session";

interface SavedSession { token: string; expires_at: string }
export const customerSession = {
  get(): SavedSession | null {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null") as SavedSession | null;
      return s && new Date(s.expires_at).getTime() > Date.now() ? s : null;
    } catch { return null; }
  },
  set(s: SavedSession) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

type SessionResponse = { token: string; expires_at: string; customer: PublicCustomer };
const keep = (r: SessionResponse) => { customerSession.set({ token: r.token, expires_at: r.expires_at }); return r.customer; };

export const auth = {
  /** Password sign-in. Stays signed in on this device for 30 days. */
  signIn: (mobile: string, password: string) => request<SessionResponse>("POST", "/api/auth/login", { mobile, password }).then(keep),
  register: (r: { name: string; mobile: string; email?: string; password: string }) => request<SessionResponse>("POST", "/api/auth/register", r).then(keep),
  /** Sets the password on an account created from a guest order placed in this browser. */
  claim: (claimToken: string, password: string) => request<SessionResponse>("POST", "/api/auth/claim", { claimToken, password }).then(keep),
  /** The signed-in customer, or null if the session is missing, expired or was ended by a password reset. */
  current: async (): Promise<PublicCustomer | null> => {
    if (!customerSession.get()) return null;
    try { return (await request<{ customer: PublicCustomer }>("GET", "/api/auth/session")).customer; }
    catch { customerSession.clear(); return null; }
  },
  signOut: async () => { try { await request("POST", "/api/auth/logout"); } finally { customerSession.clear(); } },
  updateProfile: (p: { name: string; email: string }) => request<{ customer: PublicCustomer }>("PUT", "/api/me/profile", p).then((r) => r.customer),
  saveAddresses: (a: StoredAddress[]) => request("PUT", "/api/me/addresses", a),
  resetInfo: (token: string) => request<{ mobile_hint: string }>("GET", `/api/auth/reset/${token}`),
  resetPassword: (token: string, password: string, confirm: string) => request<{ ok: true }>("POST", "/api/auth/reset", { token, password, confirm }),
};

export const SHOP_PHONE = "8825687662";
export const whatsappResetUrl = () => `https://wa.me/91${SHOP_PHONE}?text=${encodeURIComponent("Hi, I need to reset my password. Registered number: ")}`;
