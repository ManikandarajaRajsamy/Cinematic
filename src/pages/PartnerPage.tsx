import { useCallback, useEffect, useState } from "react";
import { Bike, Phone, Package, Repeat, PartyPopper, MapPin, Clock, LogOut, Check, Eye, EyeOff, Truck, RefreshCw, QrCode, ShieldCheck, Navigation, Banknote, Menu, UserRound, Settings, KeyRound, ChevronsRight, CalendarCheck } from "lucide-react";
import { QrPayment, OtpDelivery, doorPaymentStyles } from "@/components/DoorPayment";
import { ops, partnerSession, inr, type Job, type PartnerJobs, type PartnerPlan, type PartnerView } from "@/api/ops";
import { ApiError } from "@/api/client";
import { BrandLogo } from "@/components/BrandLogo";
import { AdminUiStyles } from "@/pages/admin/ui";
import { adminShellCss } from "@/pages/admin/shellStyles";
import { useIdleSignOut } from "@/hooks/useIdleSignOut";

const TYPE: Record<Job["type"], { label: string; icon: typeof Package }> = {
  ORDER: { label: "Home delivery", icon: Package },
  SUBSCRIPTION: { label: "Subscription", icon: Repeat },
  EVENT: { label: "Event order", icon: PartyPopper },
};

/** Slim bar in place of the site header: the partner app has no customer navigation. */
function PartnerBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="dp-bar">
      <div className="container dp-bar-in">
        <BrandLogo size={44} />
        <div className="admin-actions">{children}</div>
      </div>
    </header>
  );
}

/* ---------------- sign in (same card as the admin sign-in) ---------------- */
function PartnerLogin({ onIn }: { onIn: () => void }) {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { const r = await ops.partnerLogin(mobile, password); partnerSession.set(r.token); onIn(); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Couldn't sign in."); }
    finally { setBusy(false); }
  };
  return (
    <section className="section" style={{ minHeight: "80vh" }}>
      <form className="container-narrow card admin-form" style={{ maxWidth: 440, padding: 32 }} onSubmit={submit} noValidate>
        <span className="eyebrow"><Bike size={14} /> Delivery partner</span>
        <h1 className="title-xl">Sign in</h1>
        <p style={{ color: "var(--text-dim)", fontSize: "var(--font-sm)" }}>Your account is created by the shop admin. Forgot your password? Ask the shop.</p>
        <div className="field">
          <label className="label" htmlFor="dp-mobile">Mobile number</label>
          <input id="dp-mobile" className="input" inputMode="numeric" maxLength={10} placeholder="10-digit number" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} autoComplete="tel-national" />
        </div>
        <div className="field">
          <label className="label" htmlFor="dp-pass">Password</label>
          <div className="dp-pass">
            <input id="dp-pass" className="input" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          {err && <span className="field-error" role="alert">{err}</span>}
        </div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Signing in…" : "Continue"}</button>
      </form>
    </section>
  );
}

/* ---------------- one assigned delivery ---------------- */
function Step({ done, label, at }: { done: boolean; label: string; at?: string }) {
  return (
    <li className={done ? "done" : ""}>
      <span className="dp-dot">{done && <Check size={12} />}</span>
      <span>{label}</span>
      {at && <time>{new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</time>}
    </li>
  );
}

function DeliveryCard({ j, busy, onAct, onPay, onOtp }: { j: Job; busy: boolean; onAct: (fn: () => Promise<unknown>, ok: string) => void; onPay: () => void; onOtp: () => void }) {
  if (j.type === "SUBSCRIPTION") return <PlanDayCard j={j} busy={busy} onAct={onAct} onOtp={onOtp} />;
  const T = TYPE[j.type];
  const picked = j.status === "PICKED" || j.status === "OUT" || j.status === "DELIVERED";
  const needsPay = j.due > 0;
  const paid = !needsPay || !!j.paid_at;
  const delivered = j.status === "DELIVERED" || j.status === "CANCELLED" || !!(j as { reassigned?: boolean }).reassigned;
  const closed = j.status === "CANCELLED" ? "Cancelled" : (j as { reassigned?: boolean }).reassigned ? "Reassigned" : null;
  return (
    <article className="card dp-card">
      <div className="dp-card-top">
        <span className="badge"><T.icon size={12} /> {T.label}</span>
        <span className={`badge ${closed ? "badge-error" : delivered ? "badge-success" : picked ? "badge-gold" : "badge-saffron"}`}>{closed ?? (delivered ? "Delivered" : picked ? "Picked up" : "Assigned")}</span>
      </div>
      <div>
        <span className="dp-ref">Order {j.ref.split("#")[0]}</span>
        <h3 className="title-md">{j.customer.name}</h3>
      </div>
      {!delivered && (
        <dl className="dp-kv">
          {j.customer.mobile && <div><dt><Phone size={14} /></dt><dd><a href={`tel:${j.customer.mobile}`}>{j.customer.mobile}</a></dd></div>}
          {j.address && <div><dt><MapPin size={14} /></dt><dd>{j.address}{j.landmark && <><br /><small>Landmark: {j.landmark}</small></>}</dd></div>}
          <div><dt><Clock size={14} /></dt><dd>{new Date(j.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {j.slot}</dd></div>
          <div><dt><Package size={14} /></dt><dd>{j.items.join(", ")}</dd></div>
        </dl>
      )}
      {j.notes && !delivered && <p className="dp-note"><b>Instructions:</b> {j.notes}</p>}
      {!delivered && j.status !== "CANCELLED" && <CustomerActions j={j} />}
      <div className="dp-money">
        <div><span className="label">Total</span><strong>{inr(needsPay ? j.due : j.amount)}</strong></div>
        <div className="dp-money-r">
          <span className={`badge ${paid ? "badge-success" : "badge-saffron"}`}>{paid ? "Paid" : "Payment pending"}</span>
          <small>{!needsPay ? "Paid online" : j.paid_at ? (j.collected?.method === "CASH" ? "Cash · received" : "UPI QR · verified") : "Cash or UPI QR"}</small>
        </div>
      </div>

      <ol className="dp-steps">
        <Step done={picked} label="Pickup confirmed" at={j.picked_at} />
        {needsPay && <Step done={!!j.paid_at} label="Payment verified" at={j.paid_at} />}
        {j.type === "ORDER" && <Step done={j.otp_status === "VERIFIED"} label="OTP verified" at={j.otp_verified_at} />}
        <Step done={delivered} label="Delivery confirmed" at={j.delivered_at} />
      </ol>

      {!delivered && (
        <div className="dp-actions">
          {!picked && <button className="btn btn-primary btn-block" disabled={busy} onClick={() => onAct(() => ops.confirmPickup(j.id), "Pickup confirmed · OTP sent to the customer")}><Package size={16} /> Confirm pickup</button>}
          {picked && !paid && <>
            <button className="btn btn-primary" disabled={busy} onClick={onPay}><QrCode size={16} /> Collect by UPI QR</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => {
              if (confirm(`Confirm you have received ${inr(j.due)} in cash from ${j.customer.name}?`)) onAct(() => ops.cashReceived(j.id, j.due), "Cash payment recorded");
            }}><Banknote size={16} /> Cash received</button>
            <p className="dp-lock">OTP verification becomes available after the payment is verified.</p>
          </>}
          {picked && paid && (j.type === "ORDER"
            ? <button className="btn btn-primary btn-block" disabled={busy} onClick={onOtp}><ShieldCheck size={16} /> {j.otp_status === "LOCKED" ? "Retry OTP" : "Verify OTP & complete delivery"}</button>
            : <button className="btn btn-primary btn-block" disabled={busy} onClick={() => onAct(() => ops.completeDelivery(j.id, ""), "Delivery confirmed")}><Truck size={16} /> Confirm delivery</button>)}
        </div>
      )}
      {delivered && (closed
        ? <p className="dp-lock" style={{ textAlign: "left" }}>{closed === "Cancelled" ? "The shop cancelled this order." : "The shop moved this order to another partner."}</p>
        : <dl className="dp-hist">
            <div><dt>Delivered</dt><dd>{j.delivered_at ? new Date(j.delivered_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—"}</dd></div>
            <div><dt>Payment</dt><dd>{j.due > 0 ? (j.paid_at ? `Collected by UPI QR · ${inr(j.due)}` : "Not collected") : "Paid online"}</dd></div>
            {j.type === "ORDER" && <div><dt>OTP</dt><dd>{j.otp_status === "VERIFIED" ? "Verified" : "—"}</dd></div>}
          </dl>)}
    </article>
  );
}

/**
 * Call the customer, or open turn-by-turn directions from the partner's current position. Google Maps uses the
 * map pin when there is one and the written address otherwise; "Other map app" opens the phone's default map app.
 * The partner's location is only used by the map app they open; it is never tracked or sent anywhere.
 */
function CustomerActions({ j }: { j: Pick<Job, "lat" | "lng" | "address" | "landmark" | "customer"> }) {
  const [map, setMap] = useState(false);
  const hasPin = j.lat != null && j.lng != null;
  const dest = hasPin ? `${j.lat},${j.lng}` : [j.address, j.landmark].filter(Boolean).join(", ");
  if (!dest && !j.customer.mobile) return null;
  const google = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving&dir_action=navigate`;
  const other = hasPin ? `geo:${j.lat},${j.lng}?q=${j.lat},${j.lng}(${encodeURIComponent(j.customer.name)})` : `geo:0,0?q=${encodeURIComponent(dest)}`;
  return (
    <div className="dp-go">
      <div className="dp-go-row">
        {j.customer.mobile && <a className="btn btn-ghost" href={`tel:${j.customer.mobile}`}><Phone size={15} /> Call customer</a>}
        {dest && <a className="btn btn-primary" href={google} target="_blank" rel="noreferrer"><Navigation size={15} /> Navigate to customer</a>}
      </div>
      {dest && (
        <div className="dp-go-more">
          <a href={other}>Other map app</a>
          {hasPin && <button type="button" onClick={() => setMap((m) => !m)}>{map ? "Hide map" : "Show on map"}</button>}
          {!hasPin && <span>No map pin: directions use the address</span>}
        </div>
      )}
      {map && hasPin && <iframe className="dp-map" title={`Map: ${j.customer.name}`} loading="lazy" src={`https://maps.google.com/maps?q=${j.lat},${j.lng}&z=16&output=embed`} />}
    </div>
  );
}


/** One plan day: prepaid, no QR and no OTP. Mark it delivered, or skip it; a skipped day moves to the end of the plan. */
/** One plan day: prepaid, so no QR. Pickup, then the customer's OTP for that day confirms the delivery; or skip the day. */
function PlanDayCard({ j, busy, onAct, onOtp }: { j: Job; busy: boolean; onAct: (fn: () => Promise<unknown>, ok: string) => void; onOtp: () => void }) {
  const [skipping, setSkipping] = useState(false);
  const moved = !!(j as { reassigned?: boolean }).reassigned;
  const done = j.status === "DELIVERED" || j.status === "FAILED" || j.status === "CANCELLED" || moved;
  return (
    <article className="card dp-card">
      <div className="dp-card-top">
        <span className="badge"><Repeat size={12} /> Subscription{j.sub_info && ` · day ${j.sub_info.day_no} of ${j.sub_info.plan_days}`}</span>
        <span className={`badge ${j.status === "DELIVERED" ? "badge-success" : j.status === "FAILED" ? "badge-error" : "badge-saffron"}`}>{moved ? "Reassigned" : j.status === "DELIVERED" ? "Delivered" : j.status === "FAILED" ? "Skipped" : j.status === "CANCELLED" ? "Cancelled" : "To deliver"}</span>
      </div>
      <div>
        <span className="dp-ref">Plan {j.ref.split("#")[0]}</span>
        <h3 className="title-md">{j.customer.name}</h3>
      </div>
      {!done && (
        <dl className="dp-kv">
          {j.customer.mobile && <div><dt><Phone size={14} /></dt><dd><a href={`tel:${j.customer.mobile}`}>{j.customer.mobile}</a></dd></div>}
          {j.address && <div><dt><MapPin size={14} /></dt><dd>{j.address}{j.landmark && <><br /><small>Landmark: {j.landmark}</small></>}</dd></div>}
          <div><dt><Clock size={14} /></dt><dd>Today · {j.slot}</dd></div>
          <div><dt><Package size={14} /></dt><dd>{j.items.join(", ")}</dd></div>
        </dl>
      )}
      {j.notes && !done && <p className="dp-note"><b>Instructions:</b> {j.notes}</p>}
      {!done && <CustomerActions j={j} />}
      <p className="dp-pay"><Check size={14} /> Plan paid online · nothing to collect</p>
      {!done && (
        <ol className="dp-steps">
          <Step done={j.status === "PICKED" || j.status === "OUT"} label="Pickup confirmed" at={j.picked_at} />
          <Step done={false} label="OTP verified" />
          <Step done={false} label="Delivery confirmed" />
        </ol>
      )}
      {j.status === "DELIVERED" && <p className="dp-lock" style={{ textAlign: "left" }}>Delivered {j.delivered_at && new Date(j.delivered_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{j.otp_status === "VERIFIED" && " · OTP verified"}</p>}
      {j.status === "FAILED" && <p className="dp-lock" style={{ textAlign: "left" }}>Skipped: {j.fail_reason}. This day is added to the end of the plan.</p>}
      {!done && (skipping ? (
        <div className="dp-skip">
          <p className="dp-lock" style={{ textAlign: "left" }}>Skip only today's delivery, because the customer isn't available. The rest of the plan continues and this day is added to the end.</p>
          <div className="dp-actions">
            <button className="btn btn-ghost" onClick={() => setSkipping(false)}>Back</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => onAct(() => ops.skipPlanDay(j.id, "Customer not available"), "Day skipped · added to the end of the plan")}>Customer not available · skip today</button>
          </div>
        </div>
      ) : (
        <div className="dp-actions">
          {j.status === "ASSIGNED"
            ? <button className="btn btn-primary btn-block" disabled={busy} onClick={() => onAct(() => ops.confirmPickup(j.id), "Pickup confirmed · OTP sent to the customer")}><Package size={16} /> Confirm pickup</button>
            : <button className="btn btn-primary btn-block" disabled={busy} onClick={onOtp}><ShieldCheck size={16} /> {j.otp_status === "LOCKED" ? "Retry OTP" : "Verify OTP & confirm delivery"}</button>}
          {/* only today's plan day can be skipped (the API checks the same) */}
          {j.date === new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10) && <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => setSkipping(true)}>Customer not available · skip today</button>}
        </div>
      ))}
    </article>
  );
}

/** The partner's subscription customers: every plan day of these is theirs. */
function PlanList({ plans }: { plans: PartnerPlan[] }) {
  const day = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "—");
  if (!plans.length) return <div className="card admin-empty">No subscriptions are assigned to you. The shop assigns plans here.</div>;
  return (
    <div className="dp-grid">
      {plans.map((p) => (
        <article className="card dp-card" key={p.id}>
          <div className="dp-card-top">
            <span className="badge"><Repeat size={12} /> {p.item}</span>
            <span className={`badge ${p.status === "ACTIVE" ? "badge-success" : "badge-saffron"}`}>{p.status === "ACTIVE" ? "Active" : "Paused"}</span>
          </div>
          <div><span className="dp-ref">Plan {p.ref}</span><h3 className="title-md">{p.customer}</h3></div>
          <dl className="dp-kv">
            <div><dt><Phone size={14} /></dt><dd><a href={`tel:${p.mobile}`}>{p.mobile}</a></dd></div>
            {p.address && <div><dt><MapPin size={14} /></dt><dd>{p.address}{p.landmark && <><br /><small>Landmark: {p.landmark}</small></>}</dd></div>}
            {p.notes && <div><dt><Clock size={14} style={{ visibility: "hidden" }} /></dt><dd><small>Note: {p.notes}</small></dd></div>}
            <div><dt><Clock size={14} /></dt><dd>Next delivery: <strong>{day(p.next_date)}</strong>{p.today === "DELIVERED" && " · today done"}{p.today === "FAILED" && " · today skipped"}</dd></div>
          </dl>
          <CustomerActions j={{ lat: p.lat, lng: p.lng, address: p.address, landmark: p.landmark, customer: { name: p.customer, mobile: p.mobile } }} />
          <p className="dp-lock" style={{ textAlign: "left" }}>{day(p.start_date)} → {day(p.end_date)} · {p.delivered} delivered · {p.remaining} remaining</p>
        </article>
      ))}
    </div>
  );
}

/* ---------------- account settings ---------------- */
function PartnerAccount({ me, onOut, say }: { me: { partner: PartnerView; branch: string } | null; onOut: () => void; say: (t: string, k?: "ok" | "err") => void }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== again) { setErrs({ again: "Passwords don't match" }); return; }
    setBusy(true); setErrs({});
    try { await ops.partnerPassword(cur, next); setCur(""); setNext(""); setAgain(""); say("Password changed"); }
    catch (x) { setErrs(x instanceof ApiError && x.fields ? x.fields : { _: x instanceof ApiError ? x.message : "Couldn't change the password." }); }
    finally { setBusy(false); }
  };
  const p = me?.partner;
  const pass = (id: string, label: string, v: string, set: (v: string) => void, auto: string) => (
    <div className="field">
      <label className="label" htmlFor={`pw-${id}`}>{label}</label>
      <input id={`pw-${id}`} className="input" type={show ? "text" : "password"} autoComplete={auto} value={v} onChange={(e) => set(e.target.value)} />
      {errs[id] && <span className="field-error">{errs[id]}</span>}
    </div>
  );
  return (
    <div className="dp-acc">
      <div className="card dp-acc-card">
        <div className="dp-acc-who">
          <span className="adx-avatar"><UserRound size={22} /></span>
          <div><h3 className="title-md">{p?.name ?? "…"}</h3><small>Delivery partner</small></div>
        </div>
        <dl className="dp-acc-kv">
          <div><dt>Mobile</dt><dd>+91 {p?.mobile ?? "—"}</dd></div>
          <div><dt>Branch</dt><dd>{me?.branch || "—"}</dd></div>
          <div><dt>Vehicle</dt><dd>{p?.vehicle || "—"}</dd></div>
        </dl>
        <p className="dp-lock" style={{ textAlign: "left" }}>To change your name, number, branch or vehicle, ask the shop admin.</p>
        <button className="btn btn-ghost" onClick={onOut}><LogOut size={15} /> Sign out</button>
      </div>
      <form className="card dp-acc-card" onSubmit={save} noValidate>
        <h3 className="title-md"><KeyRound size={17} /> Change password</h3>
        {pass("current", "Current password", cur, setCur, "current-password")}
        {pass("next", "New password", next, setNext, "new-password")}
        {pass("again", "Repeat new password", again, setAgain, "new-password")}
        <label className="dp-show"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
        {errs._ && <span className="field-error" role="alert">{errs._}</span>}
        <button className="btn btn-primary" disabled={busy || !cur || !next}>{busy ? "Saving…" : "Change password"}</button>
      </form>
    </div>
  );
}

/* ---------------- app ---------------- */
type PTab = "today" | "plans" | "orders" | "days" | "account";
const P_NAV: { title: string; items: { id: PTab; label: string; icon: typeof Package }[] }[] = [
  { title: "Deliveries", items: [{ id: "today", label: "Assigned to me", icon: Truck }, { id: "plans", label: "My subscriptions", icon: Repeat }] },
  { title: "History", items: [{ id: "orders", label: "Regular orders", icon: Package }, { id: "days", label: "Subscription deliveries", icon: CalendarCheck }] },
  { title: "Account", items: [{ id: "account", label: "Account settings", icon: Settings }] },
];
const P_ITEMS = P_NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));
const pTabFromHash = (): PTab => (P_ITEMS.find((i) => i.id === window.location.hash.slice(1))?.id ?? "today");
const greeting = () => { const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" })); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

/**
 * The delivery partner's restricted app, in the admin workspace layout. It shows only the deliveries the
 * admin assigned to this partner and offers only pickup, payment and delivery confirmation; the API enforces the same.
 */
export function PartnerPage() {
  const [signedIn, setSignedIn] = useState(() => !!partnerSession.get());
  const [me, setMe] = useState<{ partner: PartnerView; branch: string } | null>(null);
  const [data, setData] = useState<PartnerJobs | null>(null);
  const [tab, setTabState] = useState<PTab>(pTabFromHash);
  const [navOpen, setNavOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<Job | null>(null);
  const [otpFor, setOtpFor] = useState<Job | null>(null);

  const say = (text: string, kind: "ok" | "err" = "ok") => { setToast({ text, kind }); window.setTimeout(() => setToast(null), 3000); };
  const signOut = () => { partnerSession.clear(); setSignedIn(false); setMe(null); setData(null); setMenu(false); };
  const setTab = (t: PTab) => { setTabState(t); setNavOpen(false); setMenu(false); if (window.location.hash.slice(1) !== t) window.history.pushState(null, "", `#${t}`); window.scrollTo({ top: 0 }); };
  useEffect(() => { const on = () => setTabState(pTabFromHash()); window.addEventListener("popstate", on); return () => window.removeEventListener("popstate", on); }, []);
  // the admin theme covers the whole page (dialogs open outside the workspace)
  useEffect(() => { const html = document.documentElement; html.classList.add("adx-on"); return () => html.classList.remove("adx-on"); }, []);
  useEffect(() => { if (!menu) return; const close = () => setMenu(false); window.addEventListener("click", close); return () => window.removeEventListener("click", close); }, [menu]);

  const refresh = useCallback(async () => {
    try { setData(await ops.partnerJobs()); }
    catch (x) { if (x instanceof ApiError && x.status === 401) signOut(); }
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    ops.partnerMe().then((r) => setMe({ partner: r.partner, branch: r.branch })).catch(() => signOut());
    refresh();
    // new assignments from the admin show up without a reload
    const t = window.setInterval(refresh, 15_000);
    const on = () => refresh();
    window.addEventListener("ssp-db-changed", on);
    return () => { window.clearInterval(t); window.removeEventListener("ssp-db-changed", on); };
  }, [signedIn, refresh]);

  // a phone left signed in signs itself out after 4 hours without activity
  useIdleSignOut(signedIn, 240, signOut, "partner");

  const act = async (j: Job, fn: () => Promise<unknown>, okText: string) => {
    setBusyId(j.id);
    try { await fn(); say(okText); }
    catch (x) { say(x instanceof ApiError ? x.message : "Something went wrong", "err"); }
    finally { setBusyId(null); await refresh(); }
  };

  if (!signedIn) return <div className="dp"><PartnerBar /><PartnerLogin onIn={() => setSignedIn(true)} /><PartnerStyles /></div>;

  // today's plan days first: they are due in the morning slot
  const mine = [...(data?.mine ?? [])].sort((a, b) => Number(b.type === "SUBSCRIPTION") - Number(a.type === "SUBSCRIPTION"));
  const hist = [...(data?.history ?? [])].reverse();
  const orderHist = hist.filter((j) => j.type !== "SUBSCRIPTION");
  const dayHist = hist.filter((j) => j.type === "SUBSCRIPTION");
  const current = P_ITEMS.find((i) => i.id === tab) ?? P_ITEMS[0];
  const cards = (list: Job[], empty: string) => !data ? <div className="skeleton" style={{ height: 220 }} />
    : list.length === 0 ? <div className="admin-empty">{empty}</div>
    : <div className="dp-grid">{list.map((j) => <DeliveryCard key={j.id} j={j} busy={busyId === j.id} onAct={(fn, ok) => act(j, fn, ok)} onPay={() => setPayFor(j)} onOtp={() => setOtpFor(j)} />)}</div>;
  const histStats = (list: Job[], skippedLabel: string) => {
    const done = list.filter((j) => j.status === "DELIVERED").length;
    const skipped = list.filter((j) => j.status === "FAILED").length;
    return (
      <div className="admin-stats dp-hstats">
        <div className="card admin-stat"><span className="label">In history</span><strong>{list.length}</strong></div>
        <div className="card admin-stat"><span className="label">Delivered</span><strong>{done}</strong></div>
        <div className="card admin-stat"><span className="label">{skippedLabel}</span><strong>{skipped}</strong></div>
        <div className="card admin-stat"><span className="label">Cancelled / moved</span><strong>{list.length - done - skipped}</strong></div>
      </div>
    );
  };

  return (
    <div className={`adx dp ${navOpen ? "nav-open" : ""}`}>
      <aside className="adx-side" aria-label="Partner navigation">
        <div className="adx-logo"><img src="/brand/logo.webp" alt="" width={40} /><span><b>Sri Sastha</b><small>Delivery partner</small></span></div>
        <nav>
          {P_NAV.map((g) => (
            <div key={g.title} className="adx-group">
              <span className="adx-group-t">{g.title}</span>
              {g.items.map((i) => (
                <button key={i.id} className={`adx-link ${tab === i.id ? "on" : ""}`} onClick={() => setTab(i.id)} aria-current={tab === i.id ? "page" : undefined}>
                  <i.icon size={19} /><span>{i.label}</span>{i.id === "today" && mine.length > 0 && <em>{mine.length}</em>}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="adx-scrim" onClick={() => setNavOpen(false)} />

      <div className="adx-main">
        <header className="adx-top">
          <button className="adx-ic dp-burger" aria-label="Menu" onClick={() => setNavOpen(true)}><Menu size={20} /></button>
          <h2 className="adx-hello">{greeting()}, {me?.partner.name.split(" ")[0] ?? "…"}!</h2>
          <div className="adx-tools">
            <button className="adx-ic" aria-label="Refresh" onClick={refresh}><RefreshCw size={19} /></button>
            <div className="adx-rel" onClick={(e) => e.stopPropagation()}>
              <button className="adx-avatar" aria-label="Account menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><UserRound size={20} /></button>
              {menu && (
                <div className="adx-pop adx-user">
                  <div className="adx-user-h"><span className="adx-avatar"><UserRound size={20} /></span><div><b>{me?.partner.name ?? "…"}</b><small>Delivery partner · +91 {me?.partner.mobile ?? ""}</small></div></div>
                  <button onClick={() => setTab("account")}><Settings size={15} /> Account settings</button>
                  <button className="out" onClick={signOut}><LogOut size={15} /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="adx-content">
          <div className="adx-head">
            <h1>{current.label}</h1>
            <nav className="adx-crumb" aria-label="Breadcrumb"><span>Partner</span><ChevronsRight size={13} /><span>{current.group}</span><ChevronsRight size={13} /><b>{current.label}</b></nav>
          </div>
          {tab === "today" && (
            <div className="admin-stats dp-tstats">
              <div className="card admin-stat"><span className="label">To deliver</span><strong>{data?.mine.length ?? "—"}</strong></div>
              <div className="card admin-stat"><span className="label">Picked up today</span><strong>{data?.summary.picked ?? "—"}</strong></div>
              <div className="card admin-stat"><span className="label">Delivered today</span><strong>{data?.summary.delivered ?? "—"}</strong></div>
              <div className="card admin-stat"><span className="label">Cash to hand over</span><strong>{data ? inr(data.summary.cash_to_hand_over) : "—"}</strong></div>
            </div>
          )}
          {tab === "orders" && data && histStats(orderHist, "Not delivered")}
          {tab === "days" && data && histStats(dayHist, "Skipped")}
          <section className="adx-panel" key={tab}>
            {tab === "today" && cards(mine, "No deliveries assigned to you right now. The shop will assign orders here.")}
            {tab === "plans" && (data ? <PlanList plans={data.plans} /> : <div className="skeleton" style={{ height: 220 }} />)}
            {tab === "orders" && cards(orderHist, "No regular or event orders in your history yet.")}
            {tab === "days" && cards(dayHist, "No subscription deliveries in your history yet.")}
            {tab === "account" && <PartnerAccount me={me} onOut={signOut} say={say} />}
          </section>
          <footer className="adx-foot">© {new Date().getFullYear()} Sri Sastha Paruthipaal · Delivery partner</footer>
        </main>
      </div>
      {payFor && <QrPayment job={payFor} onClose={() => { setPayFor(null); refresh(); }}
        onPaid={async () => { const paidJob = payFor; setPayFor(null); await refresh(); say("Payment verified"); if (paidJob.type === "ORDER") setOtpFor(paidJob); }} />}
      {otpFor && <OtpDelivery job={otpFor} onClose={() => { setOtpFor(null); refresh(); }} onDone={() => { setOtpFor(null); refresh(); say("Delivery confirmed"); }} />}
      {toast && <div className="toast-wrap"><div className={`toast ${toast.kind === "err" ? "error" : "success"}`} role="status">{toast.text}</div></div>}
      <AdminUiStyles />
      <style>{adminShellCss}</style>
      <PartnerStyles />
    </div>
  );
}

function PartnerStyles() {
  return (
    <style>{`
      .dp { min-height: 100vh; min-height: 100svh; background: var(--bg); }
      .dp-bar { position: sticky; top: 0; z-index: 10; background: var(--cream); border-bottom: 1px solid var(--border); }
      .dp-bar-in { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-4); padding-block: 10px; }
      .dp-main { padding-top: var(--sp-12); }
      .admin-head { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--sp-4); flex-wrap: wrap; }
      .admin-actions { display: flex; gap: var(--sp-2); }
      .admin-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4); }
      .admin-stat { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-2); }
      .admin-stat strong { font-family: var(--font-display); font-size: 1.8rem; font-weight: 500; color: var(--accent-gold-bright); }
      .admin-empty { padding: var(--sp-12); text-align: center; color: var(--text-dim); }
      .admin-form { display: flex; flex-direction: column; gap: var(--sp-4); }
      .dp-pass { position: relative; }
      .dp-pass .input { padding-right: 48px; }
      .dp-pass button { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); padding: 6px; color: var(--text-dim); }
      .dp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--sp-4); align-items: start; }
      .dp-card { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; overflow: hidden; }
      .dp-card-top { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
      .dp-ref { font-size: var(--font-xs); color: var(--text-dim); font-weight: 600; letter-spacing: 0.06em; }
      .dp-go { display: flex; flex-direction: column; gap: var(--sp-2); }
      /* full-width, stacked buttons: card widths vary, and long labels must never spill out of the card */
      .dp-go-row { display: flex; flex-direction: column; gap: var(--sp-2); }
      .dp-card .btn { width: 100%; min-width: 0; white-space: normal; text-align: center; letter-spacing: 0.06em; padding-inline: 14px; }
      .dp-go-more { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: var(--font-xs); color: var(--text-dim); }
      .dp-go-more a, .dp-go-more button { color: var(--accent-gold); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
      .dp-map { width: 100%; height: 200px; border: 0; border-radius: var(--radius-md); }
      .dp-hist { display: grid; grid-template-columns: repeat(3, auto); gap: var(--sp-3); font-size: var(--font-sm); padding-top: var(--sp-3); border-top: 1px solid var(--border); }
      .dp-hist dt { font-size: var(--font-xs); color: var(--text-dim); }
      .dp-kv small { color: var(--text-dim); }
      .dp-kv { display: flex; flex-direction: column; gap: 8px; font-size: var(--font-sm); }
      .dp-kv div { display: flex; gap: 10px; }
      .dp-kv dt { color: var(--accent-gold); padding-top: 2px; }
      .dp-kv a { color: var(--accent-gold); font-weight: 600; }
      .dp-note { font-size: var(--font-sm); padding: 8px 12px; border-radius: var(--radius-sm); background: var(--bg-sunk); }
      .dp-pay { display: flex; align-items: center; gap: 6px; font-size: var(--font-sm); font-weight: 600; color: var(--accent-gold); }
      .dp-money { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-radius: var(--radius-md); background: var(--bg-sunk); }
      .dp-money > div:first-child { display: flex; flex-direction: column; }
      .dp-money strong { font-family: var(--font-display); font-size: 1.9rem; line-height: 1.1; }
      .dp-money-r { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
      .dp-money-r small { font-size: var(--font-xs); color: var(--text-dim); }
      .dp-skip { display: flex; flex-direction: column; gap: var(--sp-2); }
      .dp-lock { grid-column: 1 / -1; font-size: var(--font-xs); color: var(--text-dim); text-align: center; }
      .dp-pay.due { color: var(--accent-saffron-bright); }
      .dp-steps { display: flex; flex-direction: column; gap: 6px; padding-top: var(--sp-3); border-top: 1px solid var(--border); }
      .dp-steps li { display: flex; align-items: center; gap: 10px; font-size: var(--font-sm); color: var(--text-dim); }
      .dp-steps li.done { color: var(--text); font-weight: 600; }
      .dp-steps time { margin-left: auto; font-size: var(--font-xs); color: var(--text-dim); font-weight: 400; }
      .dp-dot { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--border-strong); display: grid; place-items: center; flex-shrink: 0; }
      .done .dp-dot { background: var(--accent-gold); border-color: var(--accent-gold); color: #fff; }
      .dp-actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
      .dp-actions .btn-block { grid-column: 1 / -1; }
      ${doorPaymentStyles}

      /* ===== admin design for the partner app: indigo accent, Montserrat, light grey canvas, white cards ===== */
      .dp {
        --green: #5B5FEF; --green-deep: #4549D8; --gold: #FF9F43;
        --accent-gold: #5B5FEF; --accent-gold-bright: #4549D8; --accent-gold-glow: rgba(91, 95, 239, 0.1);
        --accent-saffron-bright: #D9770F; --border-bright: rgba(91, 95, 239, 0.45);
        --bg: #F4F5F7; --bg-card: #FFFFFF; --bg-elevated: #F4F5F7; --bg-sunk: #F4F5F7;
        --text: #1E2430; --text-muted: #4B5563; --text-dim: #6B7280; --border: #E9EBEF; --border-strong: #D9DCE2;
        --font-display: 'Montserrat', 'DM Sans', system-ui, sans-serif; --font-body: 'Montserrat', 'DM Sans', system-ui, sans-serif;
        font-family: var(--font-body); background: #F4F5F7; color: #1E2430;
      }
      .dp :is(h1, h2, h3) { font-family: var(--font-body); letter-spacing: -0.01em; }
      .dp .display-3 { font-size: 1.6rem; font-weight: 700; }
      .dp .title-md { font-size: 1.05rem; font-weight: 700; }
      .dp .eyebrow, .dp .label { font-family: var(--font-body); letter-spacing: 0.02em; text-transform: none; font-size: 12px; font-weight: 600; color: var(--text-dim); }
      .dp .btn { border-radius: 10px; text-transform: none; letter-spacing: 0; font-size: 14px; font-weight: 600; min-height: 46px; }
      .dp .btn-primary { background: #5B5FEF; color: #fff; box-shadow: 0 4px 12px rgba(91, 95, 239, 0.25); }
      .dp .btn-ghost { background: #fff; border-color: var(--border); color: var(--text); }
      .dp .input, .dp .select { border-radius: 10px; border-color: var(--border); }
      .dp .card { border-radius: 14px; border-color: var(--border); box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04); }
      .dp .badge { border-radius: 6px; border: 0; font-weight: 600; font-size: 11.5px; }
      .dp .badge-success { background: rgba(40, 199, 111, 0.14); color: #1E9E57; }
      .dp .badge-saffron { background: rgba(255, 159, 67, 0.16); color: #C9690C; }
      .dp .badge-error { background: rgba(234, 84, 85, 0.13); color: #D63B3C; }
      .dp .badge-gold { background: rgba(91, 95, 239, 0.12); color: #4549D8; }
      .dp-bar { background: #fff; border-bottom: 1px solid var(--border); }
      .dp-bar-in { min-height: 64px; }
      .dp-main { padding-top: 24px; }
      /* stat tiles with an icon chip, like the admin dashboard */
      .dp .admin-stats { gap: 12px; }
      .dp .admin-stat { position: relative; padding: 16px 16px 16px 64px; min-height: 76px; justify-content: center; gap: 2px; }
      .dp .admin-stat::before { content: ""; position: absolute; left: 16px; top: 50%; width: 36px; height: 36px; margin-top: -18px; border-radius: 10px; background: rgba(91, 95, 239, 0.12) no-repeat center / 18px; }
      .dp .admin-stat:nth-child(1)::before { background-color: rgba(91, 95, 239, 0.12); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235B5FEF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M16.5 9.4 7.55 4.24'/%3E%3Cpath d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'/%3E%3C/svg%3E"); }
      .dp .admin-stat:nth-child(2)::before { background-color: rgba(0, 184, 217, 0.13); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230091AD' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='5.5' cy='17.5' r='3.5'/%3E%3Ccircle cx='18.5' cy='17.5' r='3.5'/%3E%3Cpath d='M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2'/%3E%3C/svg%3E"); }
      .dp .admin-stat:nth-child(3)::before { background-color: rgba(40, 199, 111, 0.14); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231E9E57' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E"); }
      .dp .admin-stat:nth-child(4)::before { background-color: rgba(255, 159, 67, 0.16); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23D9770F' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2' y='6' width='20' height='12' rx='2'/%3E%3Ccircle cx='12' cy='12' r='2'/%3E%3C/svg%3E"); }
      .dp .admin-stat .label { color: var(--text-dim); }
      .dp .admin-stat strong { font-family: var(--font-body); font-size: 1.35rem; font-weight: 700; color: var(--text); }
      /* tabs as a segmented switch */
      .dp .tabs { display: inline-flex; gap: 0; padding: 3px; border: 1px solid var(--border); border-radius: 10px; background: #fff; max-width: 100%; overflow-x: auto; }
      .dp .tab { border: 0; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; color: var(--text-dim); white-space: nowrap; }
      .dp .tab.active { background: rgba(91, 95, 239, 0.1); color: #5B5FEF; }
      .dp-card { gap: 12px; }
      .dp-kv dt, .dp-kv a { color: #5B5FEF; }
      .dp-note { background: rgba(255, 159, 67, 0.12); border-radius: 10px; }
      .dp-steps { border-top: 1px dashed var(--border); }
      .done .dp-dot { background: #28C76F; border-color: #28C76F; }
      .dp-go-more a, .dp-go-more button { color: #5B5FEF; }
      .dp.adx { min-height: 100vh; }
      .dp-burger { display: none; }
      @media (max-width: 1024px) { .dp-burger { display: inline-flex; } }
      .dp .dp-tstats, .dp .dp-hstats { margin-bottom: 20px; }
      .dp .adx-panel .dp-card { box-shadow: none; }
      .dp-acc { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
      .dp-acc-card { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
      .dp-acc-card h3 { display: flex; align-items: center; gap: 8px; }
      .dp-acc-who { display: flex; align-items: center; gap: 12px; }
      .dp-acc-who small { color: var(--text-dim); font-size: 13px; }
      .dp-acc-kv { display: grid; gap: 10px; font-size: 14px; }
      .dp-acc-kv div { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
      .dp-acc-kv dt { color: var(--text-dim); }
      .dp-acc-kv dd { font-weight: 600; text-align: right; }
      .dp-show { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted); }
      @media (max-width: 760px) { .dp-acc { grid-template-columns: 1fr; } }
      @media (max-width: 600px) { .dp .admin-stats { grid-template-columns: 1fr 1fr; } .dp .admin-stat { padding: 12px 12px 12px 56px; } .dp .admin-stat::before { left: 12px; } .dp .tabs { display: flex; } .dp .tab { flex: 1; } }
      @media (max-width: 900px) { .admin-stats { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 420px) { .dp-hist { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 420px) { .dp-grid { grid-template-columns: 1fr; } .dp-actions { grid-template-columns: 1fr; } .dp-bar .btn { padding-inline: 10px; } }
    `}</style>
  );
}
