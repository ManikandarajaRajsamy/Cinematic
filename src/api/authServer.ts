// Customer auth for the mock backend: password sign-in (bcrypt hashes), 30-day sessions, lockout,
// admin-generated one-time reset links, and accounts created from guest orders.
// The mobile number is the customer ID everywhere. OTP can be added later as another sign-in method.
import bcrypt from "bcryptjs";

export interface StoredAddress {
  id: string; label: string; name: string; phone: string; line1: string; line2?: string; area: string; pincode: string;
  district: string; lat: number | null; lng: number | null;
}
export interface Customer {
  mobile: string; // 10 digits, the unique customer ID
  name: string;
  email: string;
  password_hash: string | null; // bcrypt; null until the customer sets a password
  mobile_verified: boolean; // false until OTP verification exists
  session_version: number; // bumped on password reset to sign out every device
  addresses: StoredAddress[];
  order_refs: string[];
  source: "register" | "guest_order";
  created_at: string;
  updated_at: string;
}
export interface PublicCustomer { mobile: string; name: string; email: string; mobile_verified: boolean; has_password: boolean; addresses: StoredAddress[] }
interface Session { mobile: string; sv: number; expires: number }
interface ResetLink { token: string; mobile: string; expires: number; used: boolean; created_by: string; created_at: string }

export interface AuthDb {
  customers?: Record<string, Customer>;
  sessions?: Record<string, Session>;
  resetLinks?: ResetLink[];
  loginFailures?: Record<string, number[]>;
  claimTokens?: Record<string, { mobile: string; expires: number }>;
}

export class AuthError extends Error {
  constructor(public status: number, message: string, public code?: string, public fields?: Record<string, string>) { super(message); }
}

const DAY = 86_400_000;
const SESSION_DAYS = 30;
const MAX_FAILS = 5;
const FAIL_WINDOW = 15 * 60_000;
const BCRYPT_ROUNDS = 10;

export const normaliseMobile = (v: unknown) => String(v ?? "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").slice(-10);
export const isValidMobile = (m: string) => /^[6-9]\d{9}$/.test(m);
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
const now = () => Date.now();

const publicView = (c: Customer): PublicCustomer => ({
  mobile: c.mobile, name: c.name, email: c.email, mobile_verified: c.mobile_verified, has_password: !!c.password_hash, addresses: c.addresses,
});

interface Ctx { db: AuthDb; commit: () => void; audit: (by: string, entity: string, id: string, action: string, old: unknown, next: unknown) => void; requireAdmin: (t?: string) => string }

function newSession(ctx: Ctx, c: Customer) {
  const token = rand();
  (ctx.db.sessions ??= {})[token] = { mobile: c.mobile, sv: c.session_version, expires: now() + SESSION_DAYS * DAY };
  return { token, expires_at: new Date(now() + SESSION_DAYS * DAY).toISOString(), customer: publicView(c) };
}
export function sessionCustomer(db: AuthDb, token?: string): Customer | null {
  const s = token ? db.sessions?.[token] : undefined;
  const c = s ? db.customers?.[s.mobile] : undefined;
  if (!s || !c || s.expires < now() || s.sv !== c.session_version) return null;
  return c;
}
function validatePassword(p: unknown, fields: Record<string, string>, key = "password") {
  if (typeof p !== "string" || p.length < 6) fields[key] = "Use at least 6 characters.";
}

/**
 * Called when an order is created. Attaches the order to the customer with this mobile number, or creates a
 * password-less account (name, mobile, address). A claim token is returned only for a newly created account, so
 * the person who placed the order can set its password; an existing account's details are never returned.
 */
export function upsertCustomerForOrder(db: AuthDb, mobile: string, name: string, address: StoredAddress | undefined, orderRef: string) {
  const customers = (db.customers ??= {});
  const existing = customers[mobile];
  if (existing) {
    existing.order_refs.push(orderRef);
    return { created: false as const };
  }
  const t = new Date().toISOString();
  customers[mobile] = {
    mobile, name, email: "", password_hash: null, mobile_verified: false, session_version: 1,
    addresses: address ? [address] : [], order_refs: [orderRef], source: "guest_order", created_at: t, updated_at: t,
  };
  const claimToken = rand();
  (db.claimTokens ??= {})[claimToken] = { mobile, expires: now() + DAY };
  return { created: true as const, claimToken };
}

export async function handleAuth(ctx: Ctx, method: string, route: string, id: string | undefined, body: unknown, adminToken?: string, customerToken?: string): Promise<unknown> {
  const db = ctx.db;
  const customers = (db.customers ??= {});
  const b = (body ?? {}) as Record<string, unknown>;

  switch (`${method} ${route}`) {
    case "POST /auth/register": {
      const mobile = normaliseMobile(b.mobile);
      const name = String(b.name ?? "").trim();
      const email = String(b.email ?? "").trim();
      const f: Record<string, string> = {};
      if (!name) f.name = "Enter your full name.";
      if (!isValidMobile(mobile)) f.mobile = "Enter a valid 10-digit mobile number.";
      if (email && !isEmail(email)) f.email = "Enter a valid email address.";
      validatePassword(b.password, f);
      if (Object.keys(f).length) throw new AuthError(422, "Please fix the highlighted fields", undefined, f);
      if (customers[mobile]) throw new AuthError(409, "This number already has an account. Sign in instead.", "ALREADY_REGISTERED");
      const t = new Date().toISOString();
      const c: Customer = {
        mobile, name, email, password_hash: await bcrypt.hash(String(b.password), BCRYPT_ROUNDS), mobile_verified: false,
        session_version: 1, addresses: [], order_refs: [], source: "register", created_at: t, updated_at: t,
      };
      customers[mobile] = c;
      const session = newSession(ctx, c);
      ctx.commit();
      return session;
    }

    case "POST /auth/login": {
      const mobile = normaliseMobile(b.mobile);
      const fails = ((db.loginFailures ??= {})[mobile] ?? []).filter((t) => now() - t < FAIL_WINDOW);
      db.loginFailures[mobile] = fails;
      if (fails.length >= MAX_FAILS) throw new AuthError(429, "Too many attempts. Please try again in 15 minutes or use Forgot password.", "LOCKED");
      const c = customers[mobile];
      if (c && !c.password_hash) throw new AuthError(409, "No password set yet. Use Forgot password to set one.", "NO_PASSWORD");
      const ok = !!c && typeof b.password === "string" && (await bcrypt.compare(b.password, c.password_hash!));
      if (!ok) {
        fails.push(now());
        ctx.commit();
        throw new AuthError(401, "Mobile number or password is incorrect.", "BAD_CREDENTIALS");
      }
      delete db.loginFailures[mobile];
      const session = newSession(ctx, c!);
      ctx.commit();
      return session;
    }

    case "GET /auth/session": {
      const c = sessionCustomer(db, customerToken);
      if (!c) throw new AuthError(401, "Signed out", "NO_SESSION");
      return { customer: publicView(c) };
    }

    case "POST /auth/logout": {
      if (customerToken && db.sessions) delete db.sessions[customerToken];
      ctx.commit();
      return { ok: true };
    }

    case "PUT /me/profile": {
      const c = sessionCustomer(db, customerToken);
      if (!c) throw new AuthError(401, "Please sign in again.", "NO_SESSION");
      const name = String(b.name ?? "").trim();
      const email = String(b.email ?? "").trim();
      const f: Record<string, string> = {};
      if (!name) f.name = "Enter your full name.";
      if (email && !isEmail(email)) f.email = "Enter a valid email address.";
      if (Object.keys(f).length) throw new AuthError(422, "Please fix the highlighted fields", undefined, f);
      Object.assign(c, { name, email, updated_at: new Date().toISOString() });
      ctx.commit();
      return { customer: publicView(c) };
    }

    case "PUT /me/addresses": {
      const c = sessionCustomer(db, customerToken);
      if (!c) throw new AuthError(401, "Please sign in again.", "NO_SESSION");
      c.addresses = Array.isArray(body) ? (body as StoredAddress[]) : [];
      c.updated_at = new Date().toISOString();
      ctx.commit();
      return { ok: true };
    }

    case "POST /auth/claim": {
      // set a password on an account just created from this browser's guest order
      const claim = db.claimTokens?.[String(b.claimToken ?? "")];
      const f: Record<string, string> = {};
      validatePassword(b.password, f);
      if (Object.keys(f).length) throw new AuthError(422, "Please fix the highlighted fields", undefined, f);
      const c = claim && claim.expires > now() ? customers[claim.mobile] : undefined;
      if (!c || c.password_hash) throw new AuthError(410, "This link has expired. Use Forgot password to set a password.", "CLAIM_EXPIRED");
      c.password_hash = await bcrypt.hash(String(b.password), BCRYPT_ROUNDS);
      c.updated_at = new Date().toISOString();
      delete db.claimTokens![String(b.claimToken)];
      const session = newSession(ctx, c);
      ctx.commit();
      return session;
    }

    case "GET /auth/reset/:id": {
      const link = db.resetLinks?.find((l) => l.token === id);
      if (!link || link.used || link.expires < now()) throw new AuthError(410, "This reset link has expired or was already used. Please contact us for a new one.", "LINK_INVALID");
      return { mobile_hint: `•••••${link.mobile.slice(-5)}` };
    }

    case "POST /auth/reset": {
      const link = db.resetLinks?.find((l) => l.token === String(b.token ?? ""));
      if (!link || link.used || link.expires < now()) throw new AuthError(410, "This reset link has expired or was already used. Please contact us for a new one.", "LINK_INVALID");
      const f: Record<string, string> = {};
      validatePassword(b.password, f);
      if (b.password !== b.confirm) f.confirm = "Passwords don't match.";
      if (Object.keys(f).length) throw new AuthError(422, "Please fix the highlighted fields", undefined, f);
      const c = customers[link.mobile];
      if (!c) throw new AuthError(404, "Account not found.");
      c.password_hash = await bcrypt.hash(String(b.password), BCRYPT_ROUNDS);
      c.session_version += 1; // every existing session is now invalid
      c.updated_at = new Date().toISOString();
      for (const [t, s] of Object.entries(db.sessions ?? {})) if (s.mobile === c.mobile) delete db.sessions![t];
      delete db.loginFailures?.[c.mobile];
      link.used = true;
      ctx.audit("customer", "customer", c.mobile, "password reset via link", null, null);
      ctx.commit();
      return { ok: true };
    }

    /* admin (Super Admin / Store Manager) */
    case "GET /admin/customers": {
      ctx.requireAdmin(adminToken);
      return Object.values(customers)
        .sort((a, b2) => b2.created_at.localeCompare(a.created_at))
        .map((c) => ({ mobile: c.mobile, name: c.name, email: c.email, has_password: !!c.password_hash, mobile_verified: c.mobile_verified, source: c.source, orders: c.order_refs.length, created_at: c.created_at }));
    }
    case "POST /admin/reset-links": {
      const by = ctx.requireAdmin(adminToken);
      const mobile = normaliseMobile(b.mobile);
      if (!customers[mobile]) throw new AuthError(404, "No customer with this mobile number.");
      const link: ResetLink = { token: rand(), mobile, expires: now() + DAY, used: false, created_by: by, created_at: new Date().toISOString() };
      (db.resetLinks ??= []).forEach((l) => { if (l.mobile === mobile && !l.used) l.used = true; }); // only the newest link works
      db.resetLinks.push(link);
      ctx.audit(by, "customer", mobile, "reset link generated", null, { expires_at: new Date(link.expires).toISOString() });
      ctx.commit();
      return { token: link.token, mobile, expires_at: new Date(link.expires).toISOString() };
    }
  }
  return undefined; // not an auth route
}
