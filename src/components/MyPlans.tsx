import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, KeyRound, RotateCcw, Phone, Bell, Check, RefreshCw } from "lucide-react";
import { ops, inr, type CustomerSubView, type CalendarDay } from "@/api/ops";
import { ApiError } from "@/api/client";
import { useStore } from "@/store/store";
import { Modal } from "@/components/Modal";

const fmt = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
const time = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const DAY_LABEL: Record<CalendarDay["status"], string> = { DELIVERED: "Delivered", FAILED: "Skipped", PAUSED: "Paused", UPCOMING: "Upcoming", NOT_RECORDED: "Missed · added back" };
const TODAY_LABEL: Record<string, string> = { READY: "Scheduled", ASSIGNED: "Partner assigned", PICKED: "On the way", OUT: "On the way", DELIVERED: "Delivered today", FAILED: "Skipped today" };

/** One plan day's confirmation details. */
function DayDetail({ s, d, onClose }: { s: CustomerSubView; d: CalendarDay; onClose: () => void }) {
  const dayNo = s.calendar.filter((x) => x.date <= d.date && x.status !== "PAUSED" && x.status !== "FAILED" && x.status !== "NOT_RECORDED").length;
  return (
    <Modal open onClose={onClose} title={`${new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long" })}`} maxWidth={420}>
      <dl className="kv mp-day">
        <dt>Subscription</dt><dd>{s.ref}{d.status === "DELIVERED" && ` · day ${dayNo} of ${s.plan_days}`}</dd>
        <dt>Product</dt><dd>{s.product_name} {s.size} × {s.qty}</dd>
        <dt>Status</dt><dd>{DAY_LABEL[d.status]}{d.reason && ` · ${d.reason}`}</dd>
        {d.time && <><dt>Delivered at</dt><dd>{time(d.time)}</dd></>}
        {d.partner && <><dt>Delivery partner</dt><dd>{d.partner}</dd></>}
        <dt>Payment</dt><dd>Prepaid by UPI with the plan</dd>
        {d.status === "DELIVERED" && <><dt>OTP</dt><dd>{d.otp_verified_at ? `Verified · ${time(d.otp_verified_at)}` : "—"}</dd></>}
      </dl>
    </Modal>
  );
}

/**
 * The customer's daily plans, from the server. Signed in: all plans on the account; guest: plans from orders
 * placed on this device. Shows progress, today's delivery and OTP, every day's confirmation and the plan's messages.
 * Customers can only cancel; pausing is not offered.
 */
export function MyPlans({ title = "Your daily plans", emptyText }: { title?: string; emptyText?: string }) {
  const { state, toast } = useStore();
  const refs = state.orders.map((o) => o.number);
  const key = refs.join(",") + state.user.phone;
  const [plans, setPlans] = useState<CustomerSubView[] | null>(null);
  const [day, setDay] = useState<{ s: CustomerSubView; d: CalendarDay } | null>(null);
  const load = useCallback(() => { ops.mySubscriptions(refs).then(setPlans).catch(() => setPlans([])); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
    // today's delivery and OTP change during the morning: refresh while the page is open
    const t = window.setInterval(load, 20_000);
    window.addEventListener("ssp-db-changed", load);
    return () => { window.clearInterval(t); window.removeEventListener("ssp-db-changed", load); };
  }, [load]);

  const cancel = async (s: CustomerSubView) => {
    if (!confirm(`Cancel this plan? There's no refund; deliveries continue until ${fmt(s.end_date) || "the end of the current period"}.`)) return;
    try { await ops.subscriptionAction(s.id, "cancel", refs); toast("Plan cancelled", "success"); load(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't update the plan", "error"); }
  };
  const resend = async (s: CustomerSubView) => {
    try { await ops.resendPlanOtp(s.id, refs); toast("A new OTP is ready", "success"); load(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't get a new OTP", "error"); }
  };

  if (!plans) return null;
  if (!plans.length) return emptyText ? <p style={{ color: "var(--text-dim)" }}>{emptyText}</p> : null;
  return (
    <div className="mp-plans">
      {title && <h2 className="title-xl mb-6">{title}</h2>}
      <div className="mp-grid">
        {plans.map((s) => {
          const live = s.status === "ACTIVE" || s.status === "PAUSED";
          const otpNow = s.today && (s.today.status === "PICKED" || s.today.status === "OUT");
          return (
            <article className="card mp-card" key={s.id}>
              <div className="mp-top">
                <span className={`badge ${s.status === "ACTIVE" ? "badge-success" : s.status === "PAUSED" ? "badge-gold" : s.status === "CANCELLED" ? "badge-error" : ""}`}>
                  {s.status === "CANCELLED" ? `Ends ${fmt(s.end_date)}` : s.status === "COMPLETED" ? "Completed" : s.status.toLowerCase()}
                </span>
                <span className="mp-ref">{s.ref}</span>
              </div>
              <h3 className="title-md">{s.product_name} {s.size} × {s.qty} · {s.plan_days} days</h3>
              <p className="mp-count"><strong>{s.delivered} / {s.plan_days}</strong> deliveries completed · {s.remaining} remaining</p>
              <div className="mp-bar" role="progressbar" aria-valuenow={s.delivered} aria-valuemin={0} aria-valuemax={s.plan_days}><span style={{ width: `${(s.delivered / s.plan_days) * 100}%` }} /></div>
              <p className="mp-sub">{fmt(s.start_date)} → {s.end_date ? fmt(s.end_date) : "on resume"}</p>

              {live && s.today && (
                <div className={`mp-today ${otpNow ? "otp" : ""}`}>
                  <span className="label">Today · {TODAY_LABEL[s.today.status] ?? s.today.status}</span>
                  {otpNow && (s.today.otp
                    ? <><strong className="mp-otp"><KeyRound size={16} /> {s.today.otp}</strong><p>Please share your delivery OTP with the delivery partner only after receiving your order.</p></>
                    : <p>Your OTP expired or was locked. <button className="btn btn-text btn-sm" onClick={() => resend(s)}><RotateCcw size={13} /> Get a new OTP</button></p>)}
                </div>
              )}
              {s.partner && live && <p className="mp-sub"><Phone size={13} /> {s.partner.name} · <a href={`tel:${s.partner.mobile}`}>{s.partner.mobile}</a></p>}

              <div className="mp-days" aria-label="Delivery days">
                {s.calendar.map((d) => (
                  <button key={d.date} type="button" className={`mp-d ${d.status}`} onClick={() => setDay({ s, d })} title={`${fmt(d.date)} · ${DAY_LABEL[d.status]}`}>
                    <b>{new Date(d.date + "T00:00:00").getDate()}</b>{d.status === "DELIVERED" && <Check size={11} />}
                  </button>
                ))}
              </div>

              {s.notifications.length > 0 && (
                <details className="mp-notes">
                  <summary><Bell size={13} /> Notifications ({s.notifications.length})</summary>
                  <ul>{s.notifications.map((n, i) => <li key={i}><strong>{n.title || "Update"}</strong><time>{time(n.at)}</time><p>{n.text}</p></li>)}</ul>
                </details>
              )}

              {s.status === "COMPLETED" && (
                <div className="mp-done">
                  <p>All {s.plan_days} deliveries completed · {inr(s.amount_paid)} paid ({s.discount_pct}% off)</p>
                  <Link className="btn btn-primary btn-sm" to={`/subscriptions?days=${s.plan_days}&size=${encodeURIComponent(s.size)}&qty=${s.qty}#plan`}><RefreshCw size={14} /> Renew this plan</Link>
                </div>
              )}
              {live && <div className="mp-actions"><button className="btn btn-text btn-sm" onClick={() => cancel(s)}><X size={14} /> Cancel plan</button></div>}
            </article>
          );
        })}
      </div>
      <p className="mp-fine">Tap a day to see its delivery details. Skipped or missed days are added to the end of your plan. Cancelling stops the plan at the end of the current period; there are no refunds.</p>
      {day && <DayDetail s={day.s} d={day.d} onClose={() => setDay(null)} />}
      <style>{`
        .mp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--sp-4); }
        .mp-card { padding: var(--sp-5); display: flex; flex-direction: column; gap: 10px; }
        .mp-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .mp-ref { font-size: var(--font-xs); color: var(--text-dim); font-weight: 600; letter-spacing: 0.06em; }
        .mp-count { font-size: var(--font-sm); color: var(--text-muted); }
        .mp-sub { display: flex; align-items: center; gap: 6px; font-size: var(--font-sm); color: var(--text-dim); }
        .mp-sub a { color: var(--accent-gold); font-weight: 600; }
        .mp-bar { height: 8px; border-radius: 999px; background: var(--bg-sunk); overflow: hidden; }
        .mp-bar span { display: block; height: 100%; background: var(--accent-gold); border-radius: inherit; transition: width 600ms var(--ease); }
        .mp-today { padding: 12px 14px; border-radius: var(--radius-md); background: var(--bg-sunk); display: flex; flex-direction: column; gap: 4px; }
        .mp-today.otp { background: var(--accent-gold-glow); border: 1px solid var(--accent-gold); }
        .mp-today p { font-size: var(--font-sm); }
        .mp-otp { display: inline-flex; align-items: center; gap: 8px; font-size: 1.9rem; letter-spacing: 0.25em; color: var(--accent-gold-bright); }
        .mp-days { display: grid; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)); gap: 6px; }
        .mp-d { height: 38px; border-radius: 8px; border: 1px solid var(--border); background: var(--white); display: flex; align-items: center; justify-content: center; gap: 2px; font-size: 13px; }
        .mp-d.DELIVERED { background: var(--accent-gold); border-color: var(--accent-gold); color: #fff; }
        .mp-d.FAILED, .mp-d.NOT_RECORDED { border-color: var(--error); color: var(--error); }
        .mp-d.PAUSED { background: var(--bg-sunk); color: var(--text-dim); }
        .mp-notes summary { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-sm); font-weight: 600; color: var(--accent-gold); }
        .mp-notes ul { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
        .mp-notes li { padding: 10px 12px; border-radius: var(--radius-md); background: var(--bg-sunk); font-size: var(--font-sm); display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; }
        .mp-notes time { font-size: var(--font-xs); color: var(--text-dim); }
        .mp-notes p { grid-column: 1 / -1; white-space: pre-line; font-size: var(--font-xs); }
        .mp-done { padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--accent-gold); display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
        .mp-done p { font-size: var(--font-sm); }
        .mp-day { padding: var(--sp-6) var(--sp-8) var(--sp-8); display: grid; grid-template-columns: 130px 1fr; gap: 6px 12px; font-size: var(--font-sm); }
        .mp-day dt { color: var(--text-dim); }
        .mp-actions { display: flex; gap: 8px; }
        .mp-fine { margin-top: var(--sp-4); font-size: var(--font-xs); color: var(--text-dim); }
      `}</style>
    </div>
  );
}
