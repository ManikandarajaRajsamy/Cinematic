import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Check, Phone, Bike, Package, X, KeyRound, RotateCcw, Search, ArrowLeft, ChevronRight, ReceiptText, BadgeCheck, UserCheck, Wallet, PackageCheck, Clock,
} from "lucide-react";
import { ops, inr, guestTracking, type CustomerOrderView } from "@/api/ops";
import { ApiError } from "@/api/client";
import { OrderPay } from "@/components/OrderPay";
import { useStore } from "@/store/store";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, statusBadge } from "@/data/orderStatus";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const ACTIVE: CustomerOrderView["status"][] = ["pending", "confirmed", "picked_up"];
const statusLabel = (o: CustomerOrderView) => (o.status === "confirmed" && o.partner ? "Partner assigned" : o.status === "picked_up" ? "Out for delivery" : ORDER_STATUS_LABEL[o.status]);
const itemsLine = (o: CustomerOrderView) => o.items.map((i) => `${i.name} ${i.size} × ${i.qty}${i.plan ? ` · ${i.planDays}-day plan` : ""}`).join(", ");

/** The order's stages: done, the current one highlighted, then what is still to come. */
function Timeline({ o }: { o: CustomerOrderView }) {
  const steps = [
    { icon: ReceiptText, label: "Order placed", note: `${o.items.reduce((n, i) => n + i.qty, 0)} item(s) · ${inr(o.total)}`, at: o.steps.placed },
    { icon: BadgeCheck, label: "Order confirmed", note: "The shop has confirmed your order.", at: o.steps.confirmed },
    { icon: UserCheck, label: "Partner assigned", note: o.partner ? `${o.partner.name} will deliver your order.` : "A delivery partner will be assigned.", at: o.steps.assigned },
    { icon: Bike, label: "Out for delivery", note: "Your order is on its way.", at: o.steps.picked },
    ...(o.payment === "cod" ? [{ icon: Wallet, label: "Payment confirmed", note: "Pay the partner by cash or UPI QR at your door.", at: o.steps.paid }] : []),
    { icon: KeyRound, label: "OTP verified", note: "Share your OTP once you receive the order.", at: o.steps.otp },
    { icon: PackageCheck, label: "Delivered", note: "Enjoy your paruthipaal!", at: o.steps.delivered },
  ];
  const stopped = o.status === "rejected" || o.status === "cancelled";
  const currentIdx = stopped ? -1 : steps.findIndex((s) => !s.at);
  return (
    <ol className="tkl">
      {steps.map((s, i) => {
        const st = s.at ? "done" : i === currentIdx ? "now" : "next";
        return (
          <li key={s.label} className={st}>
            <span className="tk2-dot">{st === "done" ? <Check size={15} strokeWidth={3} /> : <s.icon size={16} />}</span>
            <div className="tk2-body">
              <div className="tk2-row"><strong>{s.label}</strong>{s.at && <time>{fmt(s.at)}</time>}{st === "now" && <span className="tk2-now">In progress</span>}</div>
              <p>{s.note}</p>
            </div>
          </li>
        );
      })}
      {stopped && (
        <li className="stop">
          <span className="tk2-dot"><X size={15} strokeWidth={3} /></span>
          <div className="tk2-body"><div className="tk2-row"><strong>{ORDER_STATUS_LABEL[o.status]}</strong></div><p>{o.reject_reason || "This order won't be delivered. Please call us if you have any questions."}</p></div>
        </li>
      )}
    </ol>
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
    <form className="card tk2-find" onSubmit={submit} noValidate>
      <div className="field"><label className="label" htmlFor="tf-ref">Order ID</label><input id="tf-ref" className="input" placeholder="SSP-123456" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
      <div className="field"><label className="label" htmlFor="tf-mob">Mobile number</label><input id="tf-mob" className="input" inputMode="numeric" maxLength={10} placeholder="10-digit number" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} /></div>
      <button className="btn btn-primary" disabled={busy}><Search size={15} /> {busy ? "Finding…" : "Track order"}</button>
      {err && <span className="field-error">{err}</span>}
    </form>
  );
}

/** One order in the list. */
function OrderRow({ o, on, onPick }: { o: CustomerOrderView; on: boolean; onPick: () => void }) {
  return (
    <li>
      <button className={`tk2-row-btn ${on ? "on" : ""}`} aria-current={on} onClick={onPick}>
        <span className="tk2-row-icon"><Package size={18} /></span>
        <span className="tk2-row-main">
          <span className="tk2-row-top"><strong>{o.ref}</strong><span className={`badge ${statusBadge(o.status)}`}>{statusLabel(o)}</span></span>
          <span className="tk2-row-sub">{itemsLine(o)}</span>
          <span className="tk2-row-sub">{fmt(o.created_at)} · <b>{inr(o.total)}</b></span>
        </span>
        <ChevronRight size={18} className="tk2-chev" />
      </button>
    </li>
  );
}

/** My orders: order list, and for each order a summary, the delivery timeline, the partner, the OTP and the bill. */
export function TrackingPage() {
  const { id, token } = useParams<{ id: string; token: string }>();
  const [linkErr, setLinkErr] = useState("");
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
  // phones show the list or one order; a link to a specific order opens straight on it
  const [showDetail, setShowDetail] = useState(!!id);
  const current = orders?.find((o) => o.ref === selected) ?? orders?.[0];
  const [otpMsg, setOtpMsg] = useState("");
  const resendOtp = async (ref: string) => {
    try { await ops.resendCustomerOtp(ref, refs); setOtpMsg("A new OTP is ready."); load(); }
    catch (e) { setOtpMsg((e as Error).message); }
  };
  const pick = (ref: string) => { setSelected(ref); setShowDetail(true); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // guest tracking: order ID + mobile number, remembered on this device
  const found = (o: CustomerOrderView, mobile: string) => {
    guestTracking.add(o.ref, mobile);
    setTrackedKey(guestTracking.get().map((t) => t.ref).join(","));
    pick(o.ref);
  };
  const lookup = <TrackLookup onFound={found} />;

  // opened from the tracking link the shop shared: remember the order on this device and open it
  useEffect(() => {
    if (!token) return;
    ops.orderByLink(token).then((o) => {
      guestTracking.addLink(o.ref, token);
      setTrackedKey(guestTracking.get().map((t) => t.ref).join(","));
      setSelected(o.ref); setShowDetail(true);
    }).catch((e) => setLinkErr(e instanceof ApiError ? e.message : "Couldn't open this order link."));
  }, [token]);

  if (orders && !current) {
    return (
      <section className="section tk2-page">
        <div className="container-narrow">
          <span className="eyebrow">Order tracking</span>
          <h1 className="display-3 mt-4">Track your order</h1>
          {linkErr && <p className="field-error mt-4">{linkErr}</p>}
          <p className="lead mt-4">Enter your order ID and the mobile number you ordered with. No account needed. {!state.user.loggedIn && <>Have an account? <Link to="/login?next=/tracking" className="text-link">Sign in</Link> to see all your orders.</>}</p>
          <div className="mt-8">{lookup}</div>
        </div>
        <TrackStyles />
      </section>
    );
  }

  const active = (orders ?? []).filter((o) => ACTIVE.includes(o.status));
  const past = (orders ?? []).filter((o) => !ACTIVE.includes(o.status));
  return (
    <section className="section tk2-page">
      <div className="container">
        <div className={`tk2 ${showDetail ? "detail" : "list"}`}>
          <aside className="tk2-list">
            <span className="eyebrow">My orders</span>
            <h1 className="title-xl">Order history</h1>
            <details className="tk2-more"><summary><Search size={14} /> Track another order</summary><div className="mt-4">{lookup}</div></details>
            {!orders ? <div className="skeleton" style={{ height: 200 }} /> : (
              <>
                {active.length > 0 && <><h2 className="label">Active ({active.length})</h2><ul>{active.map((o) => <OrderRow key={o.ref} o={o} on={o.ref === current?.ref} onPick={() => pick(o.ref)} />)}</ul></>}
                {past.length > 0 && <><h2 className="label">Past ({past.length})</h2><ul>{past.map((o) => <OrderRow key={o.ref} o={o} on={o.ref === current?.ref} onPick={() => pick(o.ref)} />)}</ul></>}
              </>
            )}
          </aside>

          {current && (
            <div className="tk2-detail">
              <button className="tk2-back" onClick={() => setShowDetail(false)}><ArrowLeft size={16} /> All orders</button>

              <div className="card tk2-summary">
                <div className="tk2-sum-top">
                  <div><span className="label">Order</span><strong className="tk2-ref">{current.ref}</strong></div>
                  <span className={`badge ${statusBadge(current.status)}`}>{statusLabel(current)}</span>
                </div>
                <p className="tk2-items">{itemsLine(current)}</p>
                <div className="tk2-facts">
                  <span><Clock size={14} /> {fmt(current.created_at)}</span>
                  <span><Wallet size={14} /> {PAYMENT_STATUS_LABEL[current.payment_status]}</span>
                  <strong>{inr(current.total)}</strong>
                </div>
              </div>

              {current.pay_online_due != null && <OrderPay key={current.ref} order={current} refs={refs} onPaid={load} />}

              {(current.otp || (current.status === "picked_up" && current.otp_status !== "VERIFIED")) && (
                <div className="card tk2-otp">
                  <span className="label"><KeyRound size={14} /> Delivery OTP</span>
                  {current.otp ? <strong className="tk2-otp-code" aria-label={`OTP ${current.otp.split("").join(" ")}`}>{current.otp}</strong>
                    : <p>Your OTP expired or was locked after wrong attempts.</p>}
                  <p>Please share your delivery OTP with the delivery partner only after receiving your order.</p>
                  <button className="btn btn-text btn-sm" onClick={() => resendOtp(current.ref)}><RotateCcw size={14} /> Get a new OTP</button>
                  {otpMsg && <span className="tk2-note">{otpMsg}</span>}
                </div>
              )}

              {current.partner && (
                <div className="card tk2-partner">
                  <span className="tk2-avatar"><Bike size={20} /></span>
                  <div><strong>{current.partner.name}</strong><span>Delivery partner{current.assigned_at && ` · assigned ${fmt(current.assigned_at)}`}</span>{current.delivery_status && <span>{current.delivery_status}</span>}</div>
                  <a className="tk2-call" href={`tel:${current.partner.mobile}`} aria-label={`Call ${current.partner.name}`}><Phone size={18} /></a>
                </div>
              )}

              <div className="card tk2-tl">
                <h2 className="label">Order status</h2>
                <Timeline o={current} />
              </div>

              <div className="card tk2-bill">
                <h2 className="label">Bill details</h2>
                <ul>{current.items.map((i, k) => <li key={k}><span>{i.name} {i.size} × {i.qty}{i.plan && ` · ${i.planDays}-day plan`}</span><b>{inr(i.lineTotal)}</b></li>)}</ul>
                <dl>
                  <div><dt>Subtotal</dt><dd>{inr(current.subtotal)}</dd></div>
                  {current.promo_discount > 0 && <div><dt>Promo discount</dt><dd>−{inr(current.promo_discount)}</dd></div>}
                  {current.discount - (current.promo_discount ?? 0) > 0 && <div><dt>{current.promo_discount > 0 ? "Plan discount" : "Discount"}</dt><dd>−{inr(current.discount - (current.promo_discount ?? 0))}</dd></div>}
                  <div><dt>Delivery</dt><dd>{current.delivery_fee ? inr(current.delivery_fee) : "Free"}</dd></div>
                  <div className="tot"><dt>Total</dt><dd>{inr(current.total)}</dd></div>
                </dl>
                <p className="tk2-note">{current.payment === "cod" ? "Pay on delivery by cash or UPI QR" : `Paid online by UPI${current.online_paid?.verified_at ? ` · verified ${fmt(current.online_paid.verified_at)}` : ""}`}</p>
              </div>

              {current.history.length > 0 && (
                <details className="card tk2-log">
                  <summary>Full activity ({current.history.length})</summary>
                  <ol>{current.history.map((h, i) => <li key={i}><time>{fmt(h.at)}</time><span>{h.action}</span></li>)}</ol>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
      <TrackStyles />
    </section>
  );
}

function TrackStyles() {
  return (
    <style>{`
      .tk2-page { padding-top: var(--sp-10); }
      .tk2 { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: var(--sp-8); align-items: start; }
      .tk2-list { display: flex; flex-direction: column; gap: var(--sp-3); position: sticky; top: calc(var(--nav-h) + 16px); }
      .tk2-list .title-xl { margin-bottom: var(--sp-2); }
      .tk2-list h2.label { margin-top: var(--sp-3); }
      .tk2-list ul { display: flex; flex-direction: column; gap: var(--sp-2); }
      .tk2-more summary { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-sm); font-weight: 600; color: var(--green); }
      .tk2-row-btn { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px; text-align: left; background: var(--white); border: 1px solid var(--border); border-radius: 16px; transition: border-color var(--t-fast), box-shadow var(--t-fast); }
      .tk2-row-btn:hover { box-shadow: var(--shadow-md); }
      .tk2-row-btn.on { border-color: var(--green); box-shadow: 0 0 0 1px var(--green); }
      .tk2-row-icon { width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center; background: var(--accent-gold-glow); color: var(--green); }
      .tk2-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .tk2-row-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .tk2-row-top strong { font-size: var(--font-sm); }
      .tk2-row-top .badge { font-size: 11px; padding: 2px 8px; white-space: nowrap; }
      .tk2-row-sub { font-size: 12px; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tk2-row-sub b { color: var(--text); }
      .tk2-chev { color: var(--text-dim); flex-shrink: 0; }
      .tk2-find { padding: var(--sp-5); display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--sp-3); align-items: end; }
      .tk2-find .field-error { grid-column: 1 / -1; }
      .tk2-list .tk2-find { grid-template-columns: 1fr; }

      .tk2-detail { display: flex; flex-direction: column; gap: var(--sp-4); min-width: 0; }
      .tk2-back { display: none; align-items: center; gap: 6px; font-size: var(--font-sm); font-weight: 600; color: var(--green); padding: 4px 0; }
      .tk2-detail .card { border-radius: 18px; }
      .tk2-summary { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); }
      .tk2-sum-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
      .tk2-sum-top > div { display: flex; flex-direction: column; gap: 2px; }
      .tk2-ref { font-family: var(--font-display); font-size: 1.7rem; line-height: 1.1; }
      .tk2-items { font-size: var(--font-sm); color: var(--text); }
      .tk2-facts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding-top: var(--sp-3); border-top: 1px solid var(--border); font-size: 13px; color: var(--text-muted); }
      .tk2-facts span { display: inline-flex; align-items: center; gap: 6px; }
      .tk2-facts strong { margin-left: auto; font-family: var(--font-display); font-size: 1.5rem; }
      .tk2-otp { padding: var(--sp-5); display: flex; flex-direction: column; gap: 6px; align-items: flex-start; background: var(--accent-gold-glow); border-color: var(--green); }
      .tk2-otp .label { display: inline-flex; align-items: center; gap: 6px; color: var(--green-deep); }
      .tk2-otp-code { font-size: clamp(2rem, 9vw, 2.6rem); letter-spacing: 0.3em; color: var(--green-deep); line-height: 1.1; }
      .tk2-otp p { font-size: var(--font-sm); }
      .tk2-partner { padding: var(--sp-4) var(--sp-5); display: flex; align-items: center; gap: 12px; }
      .tk2-avatar { width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: var(--green); color: #fff; }
      .tk2-partner > div { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .tk2-partner span { font-size: 12px; color: var(--text-dim); }
      .tk2-call { width: 46px; height: 46px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: var(--accent-gold-glow); color: var(--green); }
      .tk2-tl { padding: var(--sp-5); }

      ol.tkl { list-style: none; display: flex; flex-direction: column; margin-top: var(--sp-4); }
      ol.tkl li { position: relative; display: flex; gap: 14px; padding-bottom: 22px; }
      ol.tkl li:last-child { padding-bottom: 0; }
      ol.tkl li:not(:last-child)::before { content: ""; position: absolute; left: 17px; top: 38px; bottom: 2px; width: 2px; border-radius: 2px; background: var(--border-strong); }
      ol.tkl li.done:not(:last-child)::before { background: var(--green); }
      .tk2-dot { width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: var(--bg-sunk); color: var(--text-dim); border: 2px solid var(--border-strong); }
      li.done .tk2-dot { background: var(--green); border-color: var(--green); color: #fff; }
      li.now .tk2-dot { background: #fff; border-color: var(--gold); color: var(--gold); box-shadow: 0 0 0 5px rgba(255, 122, 24, 0.15); animation: tk2Pulse 2s ease-in-out infinite; }
      li.stop .tk2-dot { background: var(--error); border-color: var(--error); color: #fff; }
      @keyframes tk2Pulse { 50% { box-shadow: 0 0 0 9px rgba(255, 122, 24, 0.05); } }
      .tk2-body { flex: 1; min-width: 0; padding-top: 6px; }
      .tk2-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
      .tk2-row strong { font-size: var(--font-base); }
      li.next .tk2-row strong { color: var(--text-dim); font-weight: 500; }
      .tk2-row time { font-size: 12px; color: var(--text-dim); }
      .tk2-now { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gold); }
      .tk2-body p { font-size: 13px; margin-top: 2px; color: var(--text-muted); }
      li.next .tk2-body p { color: var(--text-dim); }

      .tk2-bill { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); }
      .tk2-bill ul { display: flex; flex-direction: column; gap: 8px; font-size: var(--font-sm); }
      .tk2-bill li { display: flex; justify-content: space-between; gap: 12px; }
      .tk2-bill dl { display: flex; flex-direction: column; gap: 6px; padding-top: var(--sp-3); border-top: 1px dashed var(--border-strong); font-size: var(--font-sm); }
      .tk2-bill dl div { display: flex; justify-content: space-between; }
      .tk2-bill dt { color: var(--text-muted); }
      .tk2-bill .tot { font-weight: 700; font-size: var(--font-md); padding-top: 6px; }
      .tk2-note { font-size: 12px; color: var(--text-dim); }
      .tk2-log { padding: var(--sp-4) var(--sp-5); }
      .tk2-log summary { cursor: pointer; font-size: var(--font-sm); font-weight: 600; color: var(--green); }
      .tk2-log ol { list-style: none; margin-top: var(--sp-3); display: flex; flex-direction: column; gap: 8px; }
      .tk2-log li { display: grid; grid-template-columns: 120px 1fr; gap: 10px; font-size: 13px; }
      .tk2-log time { color: var(--text-dim); font-size: 12px; }

      /* phones and small tablets: the list, or one order with a back link */
      @media (max-width: 900px) {
        .tk2 { grid-template-columns: 1fr; gap: var(--sp-4); }
        .tk2-list { position: static; }
        .tk2.detail .tk2-list { display: none; }
        .tk2.list .tk2-detail { display: none; }
        .tk2-back { display: inline-flex; }
        .tk2-page { padding-top: var(--sp-6); }
      }
      @media (max-width: 560px) {
        .tk2-find { grid-template-columns: 1fr; }
        .tk2-summary, .tk2-tl, .tk2-bill, .tk2-otp { padding: var(--sp-4); }
        .tk2-ref { font-size: 1.4rem; }
        .tk2-log li { grid-template-columns: 1fr; gap: 0; }
      }
    `}</style>
  );
}
