import { useMemo, useState } from "react";
import { Download, Eye, MessageCircle, Pause, Phone, Play, Search, XCircle, MapPin, Check, Ban } from "lucide-react";
import { useApi } from "@/api/client";
import { ops, inr, type AdminJob, type AdminSub, type SubView } from "@/api/ops";
import { Modal } from "@/components/Modal";
import { addDays, istDate } from "@/api/opsServer";
import { useStore } from "@/store/store";
import { errorsFrom } from "./shared";
import { Drawer, Skeleton, inBranch, useBranchFilter } from "./ui";
import { PlanPartnerSelect } from "./AdminDeliveries";

const fmt = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const short = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—");
const PAY = { upi: "UPI", card: "Card", cod: "Cash on delivery" } as const;

/** One state per plan for the list: waiting for the admin, then the plan's own calendar state. */
type View = "PENDING" | "REJECTED" | AdminSub["status"];
const viewOf = (s: AdminSub): View => (s.order_status === "pending" ? "PENDING" : s.order_status === "rejected" ? "REJECTED" : s.status);
const statusText = (s: SubView | AdminSub) => {
  const v = "order_status" in s ? viewOf(s) : s.status;
  return v === "PENDING" ? "Needs confirmation" : v === "REJECTED" ? "Rejected" : v === "CANCELLED" ? `Cancelled · ends ${short(s.end_date)}` : v === "PAUSED" ? "Paused" : v === "COMPLETED" ? "Completed" : "Active";
};
const statusCls = (s: SubView | AdminSub) => {
  const v = "order_status" in s ? viewOf(s) : s.status;
  return v === "ACTIVE" ? "badge-success" : v === "PENDING" ? "badge-saffron" : v === "PAUSED" ? "badge-gold" : v === "CANCELLED" || v === "REJECTED" ? "badge-error" : "";
};

const FILTERS: { id: string; label: string; test: (s: AdminSub, ctx: { today: string; weekEnd: string }) => boolean }[] = [
  { id: "PENDING", label: "Needs confirmation", test: (s) => viewOf(s) === "PENDING" },
  { id: "ACTIVE", label: "Active", test: (s) => viewOf(s) === "ACTIVE" },
  { id: "ENDING", label: "Ending this week", test: (s, c) => viewOf(s) === "ACTIVE" && !!s.end_date && s.end_date >= c.today && s.end_date <= c.weekEnd },
  { id: "PAUSED", label: "Paused", test: (s) => viewOf(s) === "PAUSED" },
  { id: "DONE", label: "Completed & cancelled", test: (s) => ["COMPLETED", "CANCELLED", "REJECTED"].includes(viewOf(s)) },
];

/**
 * Every daily plan in one place: confirm new plan orders, give each plan its delivery partner,
 * and pause, resume or cancel. (Regular parcel orders live under Orders.)
 */
export function AdminSubscriptions({ branchName }: { branchName: (id: string) => string }) {
  const { data, loading, reload } = useApi("admin-subscriptions", ops.subscriptions);
  const partners = useApi("admin-partners", ops.partners);
  const jobs = useApi("admin-jobs", ops.jobs);
  const { branch } = useBranchFilter();
  const { toast } = useStore();
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("ALL");
  const [filter, setFilter] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<{ s: AdminSub; partner: string } | null>(null);
  const today = istDate();
  const ctx = { today, weekEnd: addDays(today, 6) };

  const base = useMemo(() => (data ?? []).filter((s) => inBranch(branch, s.branch_id)), [data, branch]);
  const pending = base.filter((s) => viewOf(s) === "PENDING").length;
  const chosen = FILTERS.find((x) => x.id === (filter || (pending ? "PENDING" : "ACTIVE")))!;
  const list = base.filter((s) => {
    const needle = q.trim().toLowerCase();
    if (needle && ![s.customer.name, s.customer.mobile, s.area, s.ref].some((v) => v.toLowerCase().includes(needle))) return false;
    if (plan !== "ALL" && String(s.plan_days) !== plan) return false;
    return chosen.test(s, ctx);
  });

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok, "success"); reload(); return true; } catch (e) { toast(errorsFrom(e).message, "error"); return false; }
  };
  const act = (s: AdminSub, action: "pause" | "resume" | "cancel") => {
    if (action === "cancel" && !confirm(`Cancel ${s.ref}? No refund. The plan stops after its current end date (${fmt(s.end_date)}).`)) return;
    run(() => ops.adminSubAction(s.id, action), `${s.ref} ${action === "pause" ? "paused from tomorrow" : action === "resume" ? "resumed" : "cancelled"}`);
  };
  const reject = (s: AdminSub) => {
    const reason = prompt(`Reject ${s.order_ref}? Give a reason (shown to the customer).`);
    if (reason?.trim()) run(() => ops.rejectOrder(s.order_ref, reason), `${s.order_ref} rejected`);
  };

  const exportCsv = () => {
    const rows = [["Ref", "Name", "Mobile", "Area", "Branch", "Plan days", "Discount %", "Product", "Qty", "Start", "End", "Delivered", "Remaining", "Amount paid", "Status"],
      ...list.map((s) => [s.ref, s.customer.name, s.customer.mobile, s.area, branchName(s.branch_id), s.plan_days, s.discount_pct, `${s.product_name} ${s.size}`, s.qty, s.start_date, s.end_date ?? "", s.delivered, s.remaining, s.amount_paid / 100, statusText(s)])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = `subscriptions-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const view = (data ?? []).find((s) => s.id === viewId) ?? null;
  return (
    <div className="page-fade">
      <TodayPlanDeliveries jobs={(jobs.data ?? []).filter((j) => j.type === "SUBSCRIPTION" && j.date === today && inBranch(branch, j.branch_id))} />
      <div className="chips" role="tablist" style={{ marginBottom: 14 }}>
        {FILTERS.map((x) => {
          const n = base.filter((s) => x.test(s, ctx)).length;
          return (
            <button key={x.id} role="tab" aria-selected={chosen.id === x.id} className={`chip ${chosen.id === x.id ? "on" : ""}`} onClick={() => setFilter(x.id)}>
              {x.label} <b>{n}</b>
            </button>
          );
        })}
      </div>
      <div className="admin-controls">
        <label className="admin-search"><Search size={16} /><input className="input" placeholder="Search name, mobile, area or plan" aria-label="Search subscriptions" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="select" aria-label="Plan length" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="ALL">All plan lengths</option><option value="7">7 days</option><option value="15">15 days</option><option value="30">30 days</option>
        </select>
        <button className="btn btn-sm btn-ghost" onClick={exportCsv} disabled={!list.length}><Download size={14} /> Export CSV</button>
      </div>

      {loading && !data ? <Skeleton rows={4} h={96} /> : list.length === 0 ? <div className="card admin-empty">No plans here.</div> : (
        <ul className="sl">
          {list.map((s) => {
            const v = viewOf(s);
            const live = v === "ACTIVE" || v === "PAUSED";
            const pct = Math.round((s.delivered / s.plan_days) * 100);
            return (
              <li key={s.id} className={`card sl-row ${v === "PENDING" ? "pending" : ""}`}>
                <div className="sl-who">
                  <strong>{s.customer.name}</strong>
                  <span className="sl-sub">
                    <a href={`tel:+91${s.customer.mobile}`}><Phone size={12} /> {s.customer.mobile}</a>
                    <a href={`https://wa.me/91${s.customer.mobile}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${s.customer.name}`}><MessageCircle size={13} /></a>
                  </span>
                  <span className="sl-sub"><MapPin size={12} /> {s.area || "—"}</span>
                </div>
                <div className="sl-plan">
                  <strong>{s.size} × {s.qty} · {s.plan_days} days</strong>
                  <span className="sl-sub">{inr(s.amount_paid)} paid · {s.discount_pct}% off</span>
                </div>
                <div className="sl-prog">
                  <span className="sl-dates">{short(s.start_date)} → {s.end_date ? short(s.end_date) : "on resume"}</span>
                  <div className="sl-bar" role="progressbar" aria-valuenow={s.delivered} aria-valuemin={0} aria-valuemax={s.plan_days}><span style={{ width: `${pct}%` }} /></div>
                  <span className="sl-sub">{s.delivered} of {s.plan_days} delivered{s.failed ? ` · ${s.failed} skipped` : ""}</span>
                </div>
                <div className="sl-status"><span className={`badge ${statusCls(s)}`}>{statusText(s)}</span></div>
                <div className="sl-partner">
                  {live ? <PlanPartnerSelect plan={s} onDone={reload} /> : v === "PENDING" ? <span className="sl-sub">Assign when confirming</span> : <span className="sl-sub">—</span>}
                </div>
                <div className="sl-act">
                  {v === "PENDING" && <>
                    <button className="btn btn-sm btn-primary" onClick={() => setConfirmFor({ s, partner: "" })}><Check size={13} /> Confirm</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => reject(s)}><Ban size={13} /> Reject</button>
                  </>}
                  <button className="btn btn-sm btn-solid" onClick={() => setViewId(s.id)}><Eye size={14} /> View</button>
                  {v === "ACTIVE" && <button className="btn btn-sm btn-ghost" onClick={() => act(s, "pause")} title="Pause from tomorrow"><Pause size={13} /></button>}
                  {v === "PAUSED" && <button className="btn btn-sm btn-ghost" onClick={() => act(s, "resume")} title="Resume"><Play size={13} /></button>}
                  {live && <button className="btn btn-sm btn-ghost" onClick={() => act(s, "cancel")} title="Cancel plan"><XCircle size={13} /></button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!confirmFor} onClose={() => setConfirmFor(null)} title={confirmFor ? `Confirm ${confirmFor.s.order_ref}` : ""} maxWidth={460}>
        {confirmFor && (
          <div className="admin-form">
            <p>{confirmFor.s.customer.name} · {confirmFor.s.size} × {confirmFor.s.qty} for {confirmFor.s.plan_days} days from {fmt(confirmFor.s.start_date)} · {inr(confirmFor.s.amount_paid)}</p>
            {confirmFor.s.payment_status === "ONLINE" && <p className="adm-hint" style={{ margin: 0 }}>Check that the UPI payment of {inr(confirmFor.s.amount_paid)} has arrived. Confirming marks it as verified.</p>}
            <div className="field"><label className="label" htmlFor="sc-partner">Plan delivery partner (every plan day goes to them)</label>
              <select id="sc-partner" className="select" value={confirmFor.partner} onChange={(e) => setConfirmFor({ ...confirmFor, partner: e.target.value })}>
                <option value="">Assign later</option>
                {(partners.data ?? []).filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mobile}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-block" onClick={async () => {
              const { s, partner } = confirmFor;
              const ok = await run(async () => {
                await ops.confirmOrder(s.order_ref);
                if (partner) await ops.assignPlanPartner(s.id, partner);
              }, `${s.ref} confirmed`);
              if (ok) setConfirmFor(null);
            }}><Check size={14} /> Confirm plan</button>
          </div>
        )}
      </Modal>

      <Drawer open={!!view} onClose={() => setViewId(null)} title={view ? `${view.ref} · ${view.customer.name}` : ""}>
        {view && <SubDetail s={view} branchName={branchName} onSaved={reload} />}
      </Drawer>

      <style>{`
        .sl { list-style: none; display: flex; flex-direction: column; gap: var(--sp-3); }
        .sl-row { display: grid; grid-template-columns: 1.3fr 1.1fr 1.3fr auto 210px auto; gap: var(--sp-5); align-items: center; padding: var(--sp-4) var(--sp-5); }
        .sl-row.pending { border-color: var(--accent-saffron); }
        .sl-row > div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .sl-sub { display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-xs); color: var(--text-dim); }
        .sl-sub a { display: inline-flex; align-items: center; gap: 4px; color: var(--accent-gold); }
        .sl-dates { font-size: var(--font-sm); }
        .sl-bar { height: 6px; border-radius: 999px; background: var(--bg-sunk); overflow: hidden; }
        .sl-bar span { display: block; height: 100%; background: var(--accent-gold); border-radius: inherit; }
        .sl-partner .assign-select { min-width: 0; width: 100%; }
        .sl-act { flex-direction: row !important; flex-wrap: wrap; justify-content: flex-end; gap: var(--sp-2) !important; }
        @media (max-width: 1180px) {
          .sl-row { grid-template-columns: 1fr 1fr 1fr; }
          .sl-act { grid-column: 1 / -1; justify-content: flex-start; }
        }
        @media (max-width: 640px) { .sl-row { grid-template-columns: 1fr; gap: var(--sp-3); } }
      `}</style>
    </div>
  );
}

/** Today's plan deliveries at a glance: who delivers, when it was confirmed, and what is still pending. */
function TodayPlanDeliveries({ jobs }: { jobs: AdminJob[] }) {
  if (!jobs.length) return null;
  const done = jobs.filter((j) => j.status === "DELIVERED").length;
  const label = (j: AdminJob) => ({ READY: "Needs a partner", ASSIGNED: "Pending", PICKED: "On the way", OUT: "On the way", DELIVERED: "Delivered", FAILED: "Skipped", CANCELLED: "Cancelled" })[j.status];
  return (
    <details className="card tpd" open={done < jobs.length}>
      <summary><strong>Today's plan deliveries</strong> <span className={`badge ${done === jobs.length ? "badge-success" : "badge-saffron"}`}>{done} / {jobs.length} delivered</span></summary>
      <ul className="tpd-list">
        {jobs.map((j) => (
          <li key={j.id}>
            <div className="tpd-main">
              <strong>{j.customer.name}</strong>
              <span>{j.ref.split("#")[0]}{j.sub_info && ` · day ${j.sub_info.day_no} of ${j.sub_info.plan_days}`} · {j.slot}</span>
              <span>{j.partner_name ? `Partner: ${j.partner_name}` : "No partner yet"}{j.delivered_at && ` · delivered ${new Date(j.delivered_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`}{j.otp_status === "VERIFIED" && " · OTP verified"}{j.fail_reason && ` · ${j.fail_reason}`}</span>
            </div>
            <span className={`badge ${j.status === "DELIVERED" ? "badge-success" : j.status === "FAILED" || j.status === "READY" ? "badge-error" : "badge-saffron"}`}>{label(j)}</span>
          </li>
        ))}
      </ul>
      <style>{`
        .tpd { padding: var(--sp-4) var(--sp-5); margin-bottom: var(--sp-5); }
        .tpd summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; cursor: pointer; }
        .tpd-list { list-style: none; display: flex; flex-direction: column; margin-top: 10px; }
        .tpd-list li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px dashed var(--border); }
        .tpd-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .tpd-main strong { font-size: 14px; }
        .tpd-main span { font-size: 12px; color: var(--text-dim); }
        .tpd-list .badge { flex-shrink: 0; }
      `}</style>
    </details>
  );
}

function SubDetail({ s, branchName, onSaved }: { s: SubView; branchName: (id: string) => string; onSaved: () => void }) {
  const { toast } = useStore();
  const [notes, setNotes] = useState(s.notes);
  const a = s.address;
  const map = a?.lat != null && a?.lng != null ? `https://www.google.com/maps?q=${a.lat},${a.lng}` : "";
  const discount = Math.round((s.amount_paid * s.discount_pct) / (100 - s.discount_pct));
  return (
    <>
      <section>
        <span className="label">Customer</span>
        <dl className="kv mt-2">
          <dt>Name</dt><dd>{s.customer.name}</dd>
          <dt>Mobile</dt><dd><a href={`tel:+91${s.customer.mobile}`} style={{ color: "var(--accent-gold-bright)" }}>+91 {s.customer.mobile}</a> · <a href={`https://wa.me/91${s.customer.mobile}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-green-bright)" }}>WhatsApp</a></dd>
          {s.customer.email && <><dt>Email</dt><dd>{s.customer.email}</dd></>}
          <dt>Address</dt><dd>{a ? `${a.line1}${a.line2 ? `, ${a.line2}` : ""}, ${a.area} — ${a.pincode}` : "—"}{map && <> · <a href={map} target="_blank" rel="noreferrer" style={{ color: "var(--accent-gold-bright)" }}><MapPin size={12} /> Map</a></>}</dd>
          <dt>Branch</dt><dd>{branchName(s.branch_id)}</dd>
        </dl>
      </section>
      <section>
        <span className="label">Plan</span>
        <dl className="kv mt-2">
          <dt>Plan</dt><dd>{s.plan_days} days · {s.product_name} {s.size} × {s.qty} a day</dd>
          <dt>Amount paid</dt><dd>{inr(s.amount_paid)} <small style={{ color: "var(--text-dim)" }}>(discount {s.discount_pct}% · {inr(discount)})</small></dd>
          <dt>Payment</dt><dd>{PAY[s.payment]}</dd>
          <dt>Dates</dt><dd>{fmt(s.start_date)} → {s.end_date ? fmt(s.end_date) : "on resume"}</dd>
          <dt>Deliveries</dt><dd>{s.delivered} delivered · {s.remaining} remaining{s.failed ? ` · ${s.failed} skipped (added to the end)` : ""}{s.paused_days ? ` · ${s.paused_days} paused` : ""}</dd>
          <dt>Status</dt><dd><span className={`badge ${statusCls(s)}`}>{statusText(s)}</span></dd>
        </dl>
      </section>
      <section>
        <span className="label">Delivery calendar</span>
        <div className="cal mt-2">
          {s.calendar.map((d) => (
            <div key={d.date} className={`cal-day ${d.status}`} title={[d.status, d.partner, d.time && new Date(d.time).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }), d.reason].filter(Boolean).join(" · ")}>
              <b>{new Date(d.date + "T00:00:00").getDate()}</b>
              <span>{d.status === "DELIVERED" ? "Delivered" : d.status === "FAILED" ? "Skipped" : d.status === "PAUSED" ? "Paused" : d.status === "UPCOMING" ? "Upcoming" : "—"}</span>
              {d.partner && <small>{d.partner.split(" ")[0]}{d.time && ` ${new Date(d.time).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`}</small>}
            </div>
          ))}
        </div>
      </section>
      <section>
        <span className="label">Pause history</span>
        {s.pauses.length === 0 ? <p className="adm-hint mt-2">Never paused.</p> : (
          <ul className="mt-2" style={{ listStyle: "none", fontSize: "var(--font-sm)" }}>
            {s.pauses.map((p, i) => <li key={i}>{fmt(p.from)} → {p.to ? fmt(addDays(p.to, -1)) : "still paused"}</li>)}
          </ul>
        )}
        {s.cancelled_at && <p className="adm-hint mt-2">Cancelled on {new Date(s.cancelled_at).toLocaleDateString("en-IN")} · ends {fmt(s.cancel_end_date)}</p>}
      </section>
      <section className="field">
        <label className="label" htmlFor="sub-notes">Staff notes</label>
        <textarea id="sub-notes" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. leave at the gate, call before coming" />
        <button className="btn btn-sm btn-primary mt-2" onClick={async () => {
          try { await ops.adminSubAction(s.id, "notes", notes); toast("Notes saved", "success"); onSaved(); } catch (e) { toast(errorsFrom(e).message, "error"); }
        }}>Save notes</button>
      </section>
    </>
  );
}
