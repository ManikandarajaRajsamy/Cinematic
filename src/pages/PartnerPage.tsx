import { useCallback, useEffect, useState } from "react";
import { Bike, Phone, Package, Repeat, PartyPopper, MapPin, Clock, LogOut, Check, Eye, EyeOff, Truck, RefreshCw, QrCode, ShieldCheck, Navigation } from "lucide-react";
import { QrPayment, OtpDelivery, doorPaymentStyles } from "@/components/DoorPayment";
import { ops, partnerSession, inr, type Job, type PartnerJobs, type PartnerPlan, type PartnerView } from "@/api/ops";
import { ApiError } from "@/api/client";
import { BrandLogo } from "@/components/BrandLogo";

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
          <small>{!needsPay ? "Paid online" : j.paid_at ? "UPI QR · verified" : "Pay on delivery"}</small>
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
            <button className="btn btn-primary btn-block" disabled={busy} onClick={onPay}><QrCode size={16} /> Collect payment</button>
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
function CustomerActions({ j }: { j: Job }) {
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

const SKIP_REASONS = ["Customer not available", "Customer asked to skip today", "House locked", "Other"];

/** One plan day: prepaid, no QR and no OTP. Mark it delivered, or skip it; a skipped day moves to the end of the plan. */
/** One plan day: prepaid, so no QR. Pickup, then the customer's OTP for that day confirms the delivery; or skip the day. */
function PlanDayCard({ j, busy, onAct, onOtp }: { j: Job; busy: boolean; onAct: (fn: () => Promise<unknown>, ok: string) => void; onOtp: () => void }) {
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState(SKIP_REASONS[0]);
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
          <label className="label" htmlFor={`sk-${j.id}`}>Why is today skipped?</label>
          <select id={`sk-${j.id}`} className="select" value={reason} onChange={(e) => setReason(e.target.value)}>{SKIP_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
          <div className="dp-actions">
            <button className="btn btn-ghost" onClick={() => setSkipping(false)}>Back</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => onAct(() => ops.skipPlanDay(j.id, reason), "Day skipped · added to the end of the plan")}>Skip today</button>
          </div>
        </div>
      ) : (
        <div className="dp-actions">
          {j.status === "ASSIGNED"
            ? <button className="btn btn-primary btn-block" disabled={busy} onClick={() => onAct(() => ops.confirmPickup(j.id), "Pickup confirmed · OTP sent to the customer")}><Package size={16} /> Confirm pickup</button>
            : <button className="btn btn-primary btn-block" disabled={busy} onClick={onOtp}><ShieldCheck size={16} /> {j.otp_status === "LOCKED" ? "Retry OTP" : "Verify OTP & confirm delivery"}</button>}
          <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => setSkipping(true)}>Customer not available · skip today</button>
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
            {p.address && <div><dt><MapPin size={14} /></dt><dd>{p.address}</dd></div>}
            <div><dt><Clock size={14} /></dt><dd>Next delivery: <strong>{day(p.next_date)}</strong>{p.today === "DELIVERED" && " · today done"}{p.today === "FAILED" && " · today skipped"}</dd></div>
          </dl>
          <p className="dp-lock" style={{ textAlign: "left" }}>{day(p.start_date)} → {day(p.end_date)} · {p.delivered} delivered · {p.remaining} remaining</p>
        </article>
      ))}
    </div>
  );
}

/* ---------------- app ---------------- */
/**
 * The delivery partner's restricted app, laid out like the admin workspace. It shows only the deliveries the
 * admin assigned to this partner and offers only pickup, payment and delivery confirmation; the API enforces the same.
 */
export function PartnerPage() {
  const [signedIn, setSignedIn] = useState(() => !!partnerSession.get());
  const [me, setMe] = useState<{ partner: PartnerView; branch: string } | null>(null);
  const [data, setData] = useState<PartnerJobs | null>(null);
  const [tab, setTab] = useState<"mine" | "plans" | "history">("mine");
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<Job | null>(null);
  const [otpFor, setOtpFor] = useState<Job | null>(null);

  const say = (text: string, kind: "ok" | "err" = "ok") => { setToast({ text, kind }); window.setTimeout(() => setToast(null), 3000); };
  const signOut = () => { partnerSession.clear(); setSignedIn(false); setMe(null); setData(null); };

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

  const act = async (j: Job, fn: () => Promise<unknown>, okText: string) => {
    setBusyId(j.id);
    try { await fn(); say(okText); }
    catch (x) { say(x instanceof ApiError ? x.message : "Something went wrong", "err"); }
    finally { setBusyId(null); await refresh(); }
  };

  if (!signedIn) return <div className="dp"><PartnerBar /><PartnerLogin onIn={() => setSignedIn(true)} /><PartnerStyles /></div>;

  // today's plan days first: they are due in the morning slot
  const list = tab === "mine" ? [...(data?.mine ?? [])].sort((a, b) => Number(b.type === "SUBSCRIPTION") - Number(a.type === "SUBSCRIPTION")) : [...(data?.history ?? [])].reverse();
  return (
    <div className="dp">
      <PartnerBar>
        <button className="btn btn-ghost btn-sm" onClick={refresh}><RefreshCw size={14} /> Refresh</button>
        <button className="btn btn-ghost btn-sm" onClick={signOut}><LogOut size={14} /> Sign out</button>
      </PartnerBar>
      <section className="section dp-main">
        <div className="container">
          <div className="admin-head">
            <div>
              <span className="eyebrow"><Bike size={14} /> Delivery partner</span>
              <h1 className="display-3">My deliveries</h1>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)", marginTop: 8 }}>
                Signed in as {me?.partner.name ?? "…"}{me?.branch && ` · ${me.branch}`}.
              </p>
            </div>
          </div>

          <div className="admin-stats mt-8">
            <div className="card admin-stat"><span className="label">To deliver</span><strong>{data?.mine.length ?? "—"}</strong></div>
            <div className="card admin-stat"><span className="label">Picked up today</span><strong>{data?.summary.picked ?? "—"}</strong></div>
            <div className="card admin-stat"><span className="label">Delivered today</span><strong>{data?.summary.delivered ?? "—"}</strong></div>
            <div className="card admin-stat"><span className="label">Cash to hand over</span><strong>{data ? inr(data.summary.cash_to_hand_over) : "—"}</strong></div>
          </div>

          <div className="tabs mt-8" role="tablist">
            <button role="tab" aria-selected={tab === "mine"} className={`tab ${tab === "mine" ? "active" : ""}`} onClick={() => setTab("mine")}>Assigned to me{data ? ` (${data.mine.length})` : ""}</button>
            <button role="tab" aria-selected={tab === "plans"} className={`tab ${tab === "plans" ? "active" : ""}`} onClick={() => setTab("plans")}>My subscriptions{data ? ` (${data.plans.length})` : ""}</button>
            <button role="tab" aria-selected={tab === "history"} className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>Order history{data ? ` (${data.history.length})` : ""}</button>
          </div>

          <div className="mt-8">
            {tab === "plans" && data ? <PlanList plans={data.plans} />
              : !data ? <div className="skeleton" style={{ height: 220 }} />
              : list.length === 0 ? <div className="card admin-empty">{tab === "mine" ? "No deliveries assigned to you right now. The shop will assign orders here." : "No completed deliveries yet."}</div>
              : <div className="dp-grid">{list.map((j) => <DeliveryCard key={j.id} j={j} busy={busyId === j.id} onAct={(fn, ok) => act(j, fn, ok)} onPay={() => setPayFor(j)} onOtp={() => setOtpFor(j)} />)}</div>}
          </div>
        </div>
      </section>
      {payFor && <QrPayment job={payFor} onClose={() => { setPayFor(null); refresh(); }}
        onPaid={async () => { const paidJob = payFor; setPayFor(null); await refresh(); say("Payment verified"); if (paidJob.type === "ORDER") setOtpFor(paidJob); }} />}
      {otpFor && <OtpDelivery job={otpFor} onClose={() => { setOtpFor(null); refresh(); }} onDone={() => { setOtpFor(null); refresh(); say("Delivery confirmed"); }} />}
      {toast && <div className="toast-wrap"><div className={`toast ${toast.kind === "err" ? "error" : "success"}`} role="status">{toast.text}</div></div>}
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
      @media (max-width: 900px) { .admin-stats { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 420px) { .dp-hist { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 420px) { .dp-grid { grid-template-columns: 1fr; } .dp-actions { grid-template-columns: 1fr; } .dp-bar .btn { padding-inline: 10px; } }
    `}</style>
  );
}
