import { useMemo, useState } from "react";
import { Download, Eye, MessageCircle, Pause, Phone, Play, Search, XCircle, MapPin } from "lucide-react";
import { useApi } from "@/api/client";
import { ops, inr, type SubView } from "@/api/ops";
import { addDays, istDate } from "@/api/opsServer";
import { useStore } from "@/store/store";
import { errorsFrom } from "./shared";
import { Drawer, Skeleton, inBranch, useBranchFilter } from "./ui";

const fmt = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const statusText = (s: SubView) =>
  s.status === "CANCELLED" ? `Ends on ${fmt(s.end_date)} (cancelled)` : s.status === "PAUSED" ? "Paused" : s.status === "COMPLETED" ? "Completed" : "Active";
const statusCls = (s: SubView) => (s.status === "ACTIVE" ? "badge-success" : s.status === "PAUSED" ? "badge-gold" : s.status === "CANCELLED" ? "badge-error" : "");
const PAY = { upi: "UPI", card: "Card", cod: "Cash on delivery" } as const;

export function AdminSubscriptions({ branchName }: { branchName: (id: string) => string }) {
  const { data, loading, reload } = useApi("admin-subscriptions", ops.subscriptions);
  const { branch } = useBranchFilter();
  const { toast } = useStore();
  const [q, setQ] = useState("");
  const [f, setF] = useState({ status: "ALL", plan: "ALL", area: "ALL", from: "", to: "", chip: "" });
  const [viewId, setViewId] = useState<string | null>(null);
  const today = istDate();
  const weekEnd = addDays(today, 6);

  const base = useMemo(() => (data ?? []).filter((s) => inBranch(branch, s.branch_id)), [data, branch]);
  const areas = [...new Set(base.map((s) => s.area).filter(Boolean))].sort();
  const endingThisWeek = (s: SubView) => s.status !== "COMPLETED" && !!s.end_date && s.end_date >= today && s.end_date <= weekEnd;
  const list = base.filter((s) => {
    const needle = q.trim().toLowerCase();
    if (needle && ![s.customer.name, s.customer.mobile, s.area].some((v) => v.toLowerCase().includes(needle))) return false;
    if (f.status !== "ALL" && s.status !== f.status) return false;
    if (f.plan !== "ALL" && String(s.plan_days) !== f.plan) return false;
    if (f.area !== "ALL" && s.area !== f.area) return false;
    if (f.from && s.start_date < f.from) return false;
    if (f.to && s.start_date > f.to) return false;
    if (f.chip === "ENDING" && !endingThisWeek(s)) return false;
    return true;
  });
  const count = (st: SubView["status"]) => base.filter((s) => s.status === st).length;

  const act = async (s: SubView, action: "pause" | "resume" | "cancel") => {
    if (action === "cancel" && !confirm(`Cancel ${s.ref}? No refund. The plan stops after its current end date (${fmt(s.end_date)}).`)) return;
    try { await ops.adminSubAction(s.id, action); toast(`${s.ref} ${action === "pause" ? "paused from tomorrow" : action === "resume" ? "resumed" : "cancelled"}`, "success"); reload(); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
  };

  const exportCsv = () => {
    const rows = [["Ref", "Name", "Mobile", "Area", "Branch", "Plan days", "Discount %", "Product", "Qty", "Start", "End", "Delivered", "Remaining", "Amount paid", "Status"],
      ...list.map((s) => [s.ref, s.customer.name, s.customer.mobile, s.area, branchName(s.branch_id), s.plan_days, s.discount_pct, `${s.product_name} ${s.size}`, s.qty, s.start_date, s.end_date ?? "", s.delivered, s.remaining, s.amount_paid / 100, statusText(s)])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = `subscriptions-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const view = (data ?? []).find((s) => s.id === viewId) ?? null;
  return (
    <div className="page-fade">
      <div className="chips" style={{ marginBottom: 14 }}>
        {[["ACTIVE", "Active", count("ACTIVE")], ["PAUSED", "Paused", count("PAUSED")], ["ENDING", "Ending this week", base.filter(endingThisWeek).length], ["COMPLETED", "Completed", count("COMPLETED")]].map(([k, l, n]) => (
          <button key={k} className={`chip ${(k === "ENDING" ? f.chip === "ENDING" : f.status === k) ? "on" : ""}`}
            onClick={() => setF(k === "ENDING" ? { ...f, chip: f.chip === "ENDING" ? "" : "ENDING", status: "ALL" } : { ...f, chip: "", status: f.status === k ? "ALL" : String(k) })}>
            {l} <b>{n}</b>
          </button>
        ))}
      </div>
      <div className="admin-controls">
        <label className="admin-search"><Search size={16} /><input className="input" placeholder="Search name, mobile or area" aria-label="Search subscriptions" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="select" aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, chip: "" })}>
          <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="CANCELLED">Cancelled</option><option value="COMPLETED">Completed</option>
        </select>
        <select className="select" aria-label="Plan" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
          <option value="ALL">All plans</option><option value="7">7 days</option><option value="15">15 days</option><option value="30">30 days</option>
        </select>
        <select className="select" aria-label="Area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
          <option value="ALL">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}
        </select>
        <label className="adm-inline" style={{ fontSize: "var(--font-xs)", color: "var(--text-dim)" }}>Start
          <input type="date" className="input" aria-label="Start from" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />–
          <input type="date" className="input" aria-label="Start to" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        </label>
        <button className="btn btn-sm btn-ghost" onClick={exportCsv} disabled={!list.length}><Download size={14} /> Export CSV</button>
      </div>

      {loading && !data ? <Skeleton rows={5} /> : list.length === 0 ? <div className="card admin-empty">No subscriptions match.</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table rt">
            <thead><tr><th>Subscriber</th><th>Area</th><th>Branch</th><th>Plan</th><th>Product</th><th>Start → End</th><th>Deliveries</th><th>Paid</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td data-label="Subscriber"><strong>{s.customer.name}</strong><br />
                    <span className="adm-inline" style={{ gap: 6 }}>
                      <a href={`tel:+91${s.customer.mobile}`} style={{ color: "var(--accent-gold-bright)" }}><Phone size={11} /> {s.customer.mobile}</a>
                      <a href={`https://wa.me/91${s.customer.mobile}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${s.customer.name}`} style={{ color: "var(--accent-green-bright)" }}><MessageCircle size={13} /></a>
                    </span>
                  </td>
                  <td data-label="Area">{s.area || "—"}</td>
                  <td data-label="Branch">{branchName(s.branch_id)}</td>
                  <td data-label="Plan">{s.plan_days} days · {s.discount_pct}% off</td>
                  <td data-label="Product">{s.product_name} {s.size} × {s.qty}</td>
                  <td data-label="Start → End" style={{ whiteSpace: "nowrap" }}>{fmt(s.start_date)}<br /><small style={{ color: "var(--text-dim)" }}>→ {s.end_date ? fmt(s.end_date) : "on resume"}</small></td>
                  <td data-label="Deliveries">{s.delivered} done / {s.remaining} remaining</td>
                  <td data-label="Paid">{inr(s.amount_paid)}</td>
                  <td data-label="Status"><span className={`badge ${statusCls(s)}`}>{statusText(s)}</span></td>
                  <td data-label=""><div className="admin-actions">
                    <button className="btn btn-sm btn-solid" onClick={() => setViewId(s.id)}><Eye size={14} /> View</button>
                    {s.status === "ACTIVE" && <button className="btn btn-sm btn-ghost" onClick={() => act(s, "pause")}><Pause size={13} /> Pause</button>}
                    {s.status === "PAUSED" && <button className="btn btn-sm btn-ghost" onClick={() => act(s, "resume")}><Play size={13} /> Resume</button>}
                    {(s.status === "ACTIVE" || s.status === "PAUSED") && <button className="btn btn-sm btn-ghost" onClick={() => act(s, "cancel")}><XCircle size={13} /> Cancel</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={!!view} onClose={() => setViewId(null)} title={view ? `${view.ref} · ${view.customer.name}` : ""}>
        {view && <SubDetail s={view} branchName={branchName} onSaved={reload} />}
      </Drawer>
    </div>
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
          <dt>Deliveries</dt><dd>{s.delivered} delivered · {s.remaining} remaining{s.failed ? ` · ${s.failed} failed (served later)` : ""}{s.paused_days ? ` · ${s.paused_days} paused` : ""}</dd>
          <dt>Status</dt><dd><span className={`badge ${statusCls(s)}`}>{statusText(s)}</span></dd>
        </dl>
      </section>
      <section>
        <span className="label">Delivery calendar</span>
        <div className="cal mt-2">
          {s.calendar.map((d) => (
            <div key={d.date} className={`cal-day ${d.status}`} title={[d.status, d.partner, d.time && new Date(d.time).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }), d.reason].filter(Boolean).join(" · ")}>
              <b>{new Date(d.date + "T00:00:00").getDate()}</b>
              <span>{d.status === "DELIVERED" ? "Delivered" : d.status === "FAILED" ? "Failed" : d.status === "PAUSED" ? "Paused" : d.status === "UPCOMING" ? "Upcoming" : "—"}</span>
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
