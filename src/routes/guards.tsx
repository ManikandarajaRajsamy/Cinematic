// Route guards: one place that decides who may open which screen.
// The server checks every request again; these keep people out of screens they can't use and stop
// stale or tampered sessions from showing a workspace (or another person's data) even for a moment.
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, adminSession } from "@/api/client";
import { ops, partnerSession } from "@/api/ops";
import { useStore } from "@/store/store";

function Checking() {
  return <div role="status" aria-label="Checking your session" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F4F5F7" }}><div className="skeleton" style={{ width: 180, height: 10, borderRadius: 999 }} /></div>;
}

/**
 * Admin and manager workspace. A saved session is checked with the server before the workspace renders;
 * an expired, revoked or tampered session is removed, so the sign-in screen shows instead.
 */
export function StaffGuard({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => !adminSession.get());
  useEffect(() => {
    if (ready) return;
    api.adminMe().catch(() => adminSession.clear()).finally(() => setReady(true));
  }, [ready]);
  return ready ? <>{children}</> : <Checking />;
}

/** Delivery partner app: the same check for the partner's session. */
export function PartnerGuard({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => !partnerSession.get());
  useEffect(() => {
    if (ready) return;
    ops.partnerMe().catch(() => partnerSession.clear()).finally(() => setReady(true));
  }, [ready]);
  return ready ? <>{children}</> : <Checking />;
}

/** Where to go after signing in: a path on this site only (never another website), and never a staff app. */
// eslint-disable-next-line react-refresh/only-export-components
export function safeNext(raw: string | null) {
  const n = String(raw ?? "");
  if (!n.startsWith("/") || n.startsWith("//") || n.includes("\\") || /^\/(admin|manager|partner|promoter)/i.test(n)) return "/account";
  return n;
}

/** Sign-in page: a customer who is already signed in goes straight on (to the safe ?next= page). */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const { search } = useLocation();
  return state.user.loggedIn ? <Navigate to={safeNext(new URLSearchParams(search).get("next"))} replace /> : <>{children}</>;
}

/** Checkout needs something in the cart. Decided when the page opens, so placing the order (which empties the cart) isn't interrupted. */
export function RequireCart({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const [empty] = useState(() => state.cart.length === 0);
  return empty ? <Navigate to="/cart" replace /> : <>{children}</>;
}

/**
 * Order confirmation only right after placing an order (checkout passes the order id).
 * Opening /confirmation directly would otherwise show the last order made on this device to whoever uses it next.
 */
export function RequireJustOrdered({ children }: { children: ReactNode }) {
  const loc = useLocation() as { state?: { orderId?: string } };
  return loc.state?.orderId ? <>{children}</> : <Navigate to="/tracking" replace />;
}
