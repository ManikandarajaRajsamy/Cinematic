import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Phone, Bike, Clock, Package, X, KeyRound, RotateCcw, Search, History } from "lucide-react";
import { ops, inr, guestTracking, type CustomerOrderView } from "@/api/ops";
import { ApiError } from "@/api/client";
import { useStore } from "@/store/store";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, statusBadge } from "@/data/orderStatus";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

/** The order's seven steps. Payment appears as a step only when it was due on delivery; online payment is its own record. */
function Timeline({ o }: { o: CustomerOrderView }) {
  const steps = [
    { label: "Order placed", note: `${o.items.reduce((n, i) => n + i.qty, 0)} item(s) · ${inr(o.total)}`, at: o.steps.placed },
    { label: "Order confirmed", note: "Confirmed by the shop.", at: o.steps.confirmed },
    { label: "Delivery partner assigned", note: o.partner ? `${o.partner.name} · ${o.partner.mobile}` : "The shop assigns a partner.", at: o.steps.assigned },
    { label: "Out for delivery", note: "Your partner has picked up the order.", at: o.steps.picked },
    ...(o.payment === "cod" ? [{ label: "Payment confirmed", note: "Paid by UPI QR at your door, verified by the payment gateway.", at: o.steps.paid }] : []),
    { label: "OTP verified", note: "You shared your delivery OTP with the partner.", at: o.steps.otp },
    { label: "Delivered", note: "Enjoy your paruthipaal!", at: o.steps.delivered },
  ];
  const stopped = o.status === "rejected" || o.status === "cancelled";
  return (
    <ol className="tl">
      {steps.map((s, i) => (
        <li key={s.label} className={s.at ? "done" : ""}>
          <span className="tl-dot">{s.at ? <Check size={14} /> : i + 1}</span>
          <div><strong>{s.label}{s.at && <time> · {fmt(s.at)}</time>}</strong><p>{s.note}</p></div>
        </li>
      ))}
      {stopped && (
        <li className="tl-stop"><span className="tl-dot"><X size={14} /></span>
          <div><strong>{ORDER_STATUS_LABEL[o.status]}</strong><p>{o.reject_reason || "This order won't be delivered. Call us if you have questions."}</p></div>
        </li>
      )}
    </ol>
  );
}

const ACTIVE: CustomerOrderView["status"][] = ["pending", "confirmed", "picked_up"];
const statusLabel = (o: CustomerOrderView) => (o.status === "confirmed" && o.partner ? "Confirmed · partner assigned" : o.status === "picked_up" ? "Out for delivery" : ORDER_STATUS_LABEL[o.status]);

/** Order history: active orders first, then past ones; picking one shows its details. */
function OrderHistoryList({ orders, current, onPick }: { orders: CustomerOrderView[]; current?: string; onPick: (ref: string) => void }) {
  const groups: [string, CustomerOrderView[]][] = [["Active orders", orders.filter((o) => ACTIVE.includes(o.status))], ["Past orders", orders.filter((o) => !ACTIVE.includes(o.status))]];
  return (
    <nav className="ohl" aria-label="Order history">
      {groups.map(([title, list]) => list.length > 0 && (
        <div key={title}>
          <h2 className="label">{title} ({list.length})</h2>
          <ul>
            {list.map((o) => (
              <li key={o.ref}>
                <button className={o.ref === current ? "on" : ""} aria-current={o.ref === current} onClick={() => onPick(o.ref)}>
                  <span className="ohl-top"><strong>{o.ref}</strong><span className={`badge ${statusBadge(o.status)}`}>{statusLabel(o)}</span></span>
                  <span className="ohl-sub">{fmt(o.created_at)} · {inr(o.total)}</span>
                  <span className="ohl-sub">{o.items.map((i) => `${i.size} × ${i.qty}${i.plan ? " plan" : ""}`).join(", ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Guest lookup: the order ID plus the mobile number used for the order. */
function TrackLookup({ onFound }: { onFound: (o: CustomerOrderView, mobile: string) => void }) {
  const [ref, setRef] = useState("");
  const [mobile, setMobile] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ref.trim() || mobile.length !== 10) { setErr("Enter the order ID and your 10-digit mobile number."); return; }
    setBusy(true); setErr("");
    try { onFound(await ops.lookupOrder(ref, mobile), mobile); setRef(""); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Couldn't look up the order."); }
    finally { setBusy(false); }
  };
  return (
    <form className="card tl-find" style={{ padding: "var(--sp-5)" }} onSubmit={submit} noValidate>
      <div className="field"><label className="label" htmlFor="tf-ref">Order ID</label><input id="tf-ref" className="input" placeholder="SSP-123456" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
      <div className="field"><label className="label" htmlFor="tf-mob">Mobile number</label><input id="tf-mob" className="input" inputMode="numeric" maxLength={10} placeholder="10-digit number" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} /></div>
      <button className="btn btn-primary" disabled={busy}><Search size={15} /> {busy ? "Finding…" : "Track"}</button>
      {err && <span className="field-error" style={{ gridColumn: "1 / -1" }}>{err}</span>}
    </form>
  );
}

/** Order details: status timeline, items and prices, payment and the delivery partner once assigned. */
export function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useStore();
  const [orders, setOrders] = useState<CustomerOrderView[] | null>(null);
  const refs = state.orders.map((o) => o.number);
  const [trackedKey, setTrackedKey] = useState(() => guestTracking.get().map((t) => t.ref).join(","));
  const key = refs.join(",") + state.user.phone + trackedKey;
  const load = useCallback(() => { ops.orderStatuses(refs).then((r) => setOrders(r.sort((a, b) => b.created_at.localeCompare(a.created_at)))).catch(() => setOrders([])); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
    const t = window.setInterval(load, 20_000);
    window.addEventListener("ssp-db-changed", load);
    return () => { window.clearInterval(t); window.removeEventListener("ssp-db-changed", load); };
  }, [load]);

  const localRef = state.orders.find((o) => o.id === id)?.number;
  const [selected, setSelected] = useState<string | undefined>(localRef ?? id);
  const current = orders?.find((o) => o.ref === selected) ?? orders?.[0];
  const [otpMsg, setOtpMsg] = useState("");
  const resendOtp = async (ref: string) => {
    try { await ops.resendCustomerOtp(ref, refs); setOtpMsg("A new OTP is ready below."); load(); }
    catch (e) { setOtpMsg((e as Error).message); }
  };

  // guest tracking: order ID + mobile number, remembered on this device
  const found = (o: CustomerOrderView, mobile: string) => {
    guestTracking.add(o.ref, mobile);
    setTrackedKey(guestTracking.get().map((t) => t.ref).join(","));
    setSelected(o.ref);
  };
  const lookup = <TrackLookup onFound={found} />;

  if (orders && !current) {
    return (
      <section className="section">
        <div className="container-narrow">
          <span className="eyebrow">Order tracking</span>
          <h1 className="display-3 mt-4">Track your order</h1>
          <p className="lead mt-4">Enter your order ID and the mobile number you ordered with. No account needed. {!state.user.loggedIn && <>Have an account? <Link to="/login?next=/tracking" className="text-link">Sign in</Link> to see all your orders.</>}</p>
          <div className="mt-8">{lookup}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container od">
        <span className="eyebrow">My orders</span>
        <h1 className="display-3 mt-4">Order history</h1>
        <details className="od-find mt-4"><summary><Search size={14} /> Track another order</summary><div className="mt-4">{lookup}</div></details>
        <div className="od-layout mt-8">
          {orders && orders.length > 0 && <OrderHistoryList orders={orders} current={current?.ref} onPick={setSelected} />}
        {!current ? <div className="skeleton" style={{ height: 320 }} /> : (
          <div className="od-grid">
            <div className="card od-main">
              <div className="od-head">
                <div><span className="label">Order ID</span><strong className="od-ref">{current.ref}</strong><span className="od-meta">{fmt(current.created_at)} · {current.payment === "cod" ? "Pay on delivery" : "Paid online (UPI)"}</span></div>
                <span className={`badge ${statusBadge(current.status)}`}>{statusLabel(current)}</span>
              </div>
              <Timeline o={current} />
              {current.history.length > 0 && (
                <div className="od-hist">
                  <h2 className="label"><History size={13} /> Order history</h2>
                  <ol>{current.history.map((h, i) => <li key={i}><time>{fmt(h.at)}</time><span>{h.action}</span></li>)}</ol>
                </div>
              )}
            </div>
            <aside className="od-side">
              {(current.otp || (current.status === "picked_up" && current.otp_status !== "VERIFIED")) && (
                <div className="card od-box od-otp">
                  <h2 className="title-md"><KeyRound size={18} /> Delivery OTP</h2>
                  {current.otp ? <strong className="od-otp-code" aria-label={`OTP ${current.otp.split("").join(" ")}`}>{current.otp}</strong>
                    : <p className="muted">Your OTP has expired or was locked after wrong attempts.</p>}
                  <p>Please share your delivery OTP with the delivery partner only after receiving your order.</p>
                  <button className="btn btn-text" onClick={() => resendOtp(current.ref)}><RotateCcw size={14} /> Get a new OTP</button>
                  {otpMsg && <span className="od-otp-msg">{otpMsg}</span>}
                </div>
              )}
              <div className="card od-box">
                <h2 className="title-md">Delivery partner</h2>
                {current.partner ? (
                  <>
                    <p className="od-partner"><Bike size={18} /> <strong>{current.partner.name}</strong></p>
                    <dl className="od-pkv">
                      <div><dt>Mobile</dt><dd>{current.partner.mobile}</dd></div>
                      {current.assigned_at && <div><dt>Assigned</dt><dd>{fmt(current.assigned_at)}</dd></div>}
                      {current.delivery_status && <div><dt>Delivery</dt><dd>{current.delivery_status}</dd></div>}
                    </dl>
                    <a className="btn btn-primary btn-sm" href={`tel:${current.partner.mobile}`}><Phone size={14} /> Call {current.partner.name.split(" ")[0]}</a>
                  </>
                ) : <p className="muted">{current.status === "pending" ? "Shown here once the shop confirms your order and assigns a partner." : current.status === "rejected" || current.status === "cancelled" ? "—" : "The shop will assign a partner shortly."}</p>}
                {current.delivery_date && <p className="od-when"><Clock size={15} /> {new Date(current.delivery_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}{current.delivery_slot && ` · ${current.delivery_slot}`}</p>}
              </div>
              <div className="card od-box">
                <h2 className="title-md">Items</h2>
                <ul className="od-items">
                  {current.items.map((i, k) => <li key={k}><Package size={14} /> <span>{i.name} {i.size} × {i.qty}{i.plan && ` · ${i.planDays}-day plan`}</span><b>{inr(i.lineTotal)}</b></li>)}
                </ul>
                <dl className="od-sum">
                  <div><dt>Subtotal</dt><dd>{inr(current.subtotal)}</dd></div>
                  {current.discount > 0 && <div><dt>Discount</dt><dd>−{inr(current.discount)}</dd></div>}
                  <div><dt>Delivery</dt><dd>{current.delivery_fee ? inr(current.delivery_fee) : "Free"}</dd></div>
                  <div className="od-total"><dt>Total</dt><dd>{inr(current.total)}</dd></div>
                </dl>
                <p className="od-paystat"><span className="label">Payment</span> {PAYMENT_STATUS_LABEL[current.payment_status]}</p>
                {current.online_paid && <p className="od-paystat"><span className="label">Paid online</span> {fmt(current.online_paid.at)}{current.online_paid.verified_at && ` · verified ${fmt(current.online_paid.verified_at)}`}</p>}
              </div>
            </aside>
          </div>
        )}
        </div>
      </div>
      <style>{`
        .od-layout { display: grid; grid-template-columns: 300px 1fr; gap: var(--sp-6); align-items: start; }
        .od-layout > .skeleton:only-child, .od-layout > .od-grid:only-child { grid-column: 1 / -1; }
        .ohl { display: flex; flex-direction: column; gap: var(--sp-5); position: sticky; top: calc(var(--nav-h) + 16px); max-height: calc(100vh - var(--nav-h) - 32px); overflow-y: auto; }
        .ohl ul { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-2); }
        .ohl button { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 4px; padding: var(--sp-3) var(--sp-4); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--white); transition: border-color var(--t-fast); }
        .ohl button:hover { border-color: var(--border-strong); }
        .ohl button.on { border-color: var(--accent-gold); box-shadow: inset 3px 0 0 var(--accent-gold); }
        .ohl-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .ohl-top .badge { font-size: 11px; padding: 2px 8px; }
        .ohl-sub { font-size: var(--font-xs); color: var(--text-dim); }
        .od-meta { font-size: var(--font-xs); color: var(--text-dim); }
        .tl time { font-weight: 400; font-size: var(--font-xs); color: var(--text-dim); }
        .od-pkv { width: 100%; display: flex; flex-direction: column; gap: 4px; font-size: var(--font-sm); }
        .od-pkv div { display: flex; justify-content: space-between; gap: 12px; }
        .od-pkv dt { color: var(--text-dim); }
        @media (max-width: 1000px) { .od-layout { grid-template-columns: 1fr; } .ohl { position: static; max-height: none; } .ohl ul { flex-direction: row; overflow-x: auto; } .ohl li { min-width: 240px; } }
        .od-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: var(--sp-6); align-items: start; }
        .od-main { padding: var(--sp-8); }
        .od-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-4); padding-bottom: var(--sp-6); border-bottom: 1px solid var(--border); margin-bottom: var(--sp-6); }
        .od-head > div { display: flex; flex-direction: column; gap: 4px; }
        .od-ref { font-family: var(--font-display); font-size: 1.8rem; }
        .tl { display: flex; flex-direction: column; }
        .tl li { position: relative; display: flex; gap: var(--sp-4); padding-bottom: var(--sp-6); }
        .tl li:not(:last-child)::before { content: ""; position: absolute; left: 15px; top: 32px; bottom: 0; width: 2px; background: var(--border); }
        .tl li.done:not(:last-child)::before { background: var(--green); }
        .tl-dot { width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; border: 2px solid var(--border-strong); font-size: 13px; font-weight: 700; color: var(--text-dim); background: var(--white); }
        .tl li.done .tl-dot { background: var(--green); border-color: var(--green); color: #fff; }
        .tl li strong { display: block; margin-top: 4px; }
        .tl li p { font-size: var(--font-sm); }
        .tl li:not(.done):not(.tl-stop) strong { color: var(--text-dim); font-weight: 500; }
        .tl-stop .tl-dot { background: var(--error); border-color: var(--error); color: #fff; }
        .od-side { display: flex; flex-direction: column; gap: var(--sp-4); }
        .od-box { padding: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-3); align-items: flex-start; }
        .od-find summary { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-sm); font-weight: 600; color: var(--accent-gold); }
        .tl-find { display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--sp-3); align-items: end; }
        .od-hist { margin-top: var(--sp-6); padding-top: var(--sp-5); border-top: 1px solid var(--border); }
        .od-hist h2 { display: flex; align-items: center; gap: 6px; }
        .od-hist ol { margin-top: var(--sp-3); display: flex; flex-direction: column; gap: 8px; }
        .od-hist li { display: grid; grid-template-columns: 130px 1fr; gap: 12px; font-size: var(--font-sm); }
        .od-hist time { color: var(--text-dim); font-size: var(--font-xs); padding-top: 2px; }
        @media (max-width: 600px) { .tl-find { grid-template-columns: 1fr; } .od-hist li { grid-template-columns: 1fr; gap: 0; } }
        .od-otp { border-color: var(--accent-gold); background: var(--accent-gold-glow); }
        .od-otp h2 { display: flex; align-items: center; gap: 8px; }
        .od-otp-code { font-family: var(--font-body); font-size: 2.4rem; font-weight: 700; letter-spacing: 0.3em; color: var(--accent-gold-bright); }
        .od-otp p { font-size: var(--font-sm); }
        .od-otp-msg { font-size: var(--font-xs); color: var(--text-muted); }
        .od-partner, .od-when { display: flex; align-items: center; gap: 8px; }
        .od-partner svg, .od-when svg { color: var(--green); }
        .od-when { font-size: var(--font-sm); color: var(--text-muted); }
        .od-items { width: 100%; display: flex; flex-direction: column; gap: 8px; font-size: var(--font-sm); }
        .od-items li { display: flex; align-items: center; gap: 8px; }
        .od-items span { flex: 1; }
        .od-sum { width: 100%; display: flex; flex-direction: column; gap: 6px; padding-top: var(--sp-3); border-top: 1px solid var(--border); font-size: var(--font-sm); }
        .od-sum div { display: flex; justify-content: space-between; }
        .od-total { font-weight: 700; font-size: var(--font-md); }
        .od-paystat { font-size: var(--font-sm); display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
        @media (max-width: 1180px) { .od-grid { grid-template-columns: 1fr; } }
        @media (max-width: 800px) { .od-grid { grid-template-columns: 1fr; } .od-main { padding: var(--sp-5); } }
      `}</style>
    </section>
  );
}
