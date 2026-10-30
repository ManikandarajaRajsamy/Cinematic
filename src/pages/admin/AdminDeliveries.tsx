import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, MapPin, Plus, Pencil, KeyRound, Power, Wallet } from "lucide-react";
import { useApi } from "@/api/client";
import { ops, inr, type AdminJob, type PartnerView } from "@/api/ops";
import { useStore } from "@/store/store";
import { Modal } from "@/components/Modal";
import { errorsFrom, FieldError } from "./shared";
import { Skeleton, inBranch, useBranchFilter } from "./ui";

const TYPE_LABEL = { ORDER: "Delivery", SUBSCRIPTION: "Subscription", EVENT: "Event" } as const;
const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "");

/** Status of a delivery in words: Ready → Picked → Out for delivery → Delivered / Failed. */
export const jobStatusText = (s: AdminJob["status"]) => ({ READY: "Ready", PICKED: "Picked", OUT: "Out for delivery", DELIVERED: "Delivered", FAILED: "Failed" })[s];

/** Small tracking block reused by Orders, Subscriptions and Events. */
export function JobTrack({ j, partnerName }: { j: AdminJob | (Omit<AdminJob, "partner_name"> & { partner_name?: string }) | null; partnerName?: string }) {
  if (!j) return <span style={{ color: "var(--text-dim)" }}>—</span>;
  const name = partnerName ?? (j as AdminJob).partner_name;
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "var(--font-xs)" }}>
      <span className={`badge ${j.status === "DELIVERED" ? "badge-success" : j.status === "FAILED" ? "badge-error" : "badge-gold"}`} style={{ alignSelf: "flex-start" }}>{jobStatusText(j.status)}</span>
      {name && <span>by {name}{j.picked_at && ` · picked ${time(j.picked_at)}`}</span>}
      {j.delivered_at && <span>delivered {time(j.delivered_at)}</span>}
      {j.collected && <span>{j.collected.method} {inr(j.collected.amount)}{j.collected.amount !== j.due && " ≠ due"}</span>}
      {j.location && <a href={`https://www.google.com/maps?q=${j.location.lat},${j.location.lng}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-gold-bright)" }}><MapPin size={10} /> confirmed here</a>}
      {j.fail_reason && <span style={{ color: "#FF8A70" }}>{j.fail_reason}</span>}
    </span>
  );
}

/* ---------------- Deliveries today ---------------- */
export function AdminDeliveries() {
  const { data, loading, reload } = useApi("admin-jobs", ops.jobs);
  const { branch } = useBranchFilter();
  const [, tick] = useState(0);
  // live: refetch every 30 s (and instantly when another tab on this device changes something)
  useEffect(() => { const t = window.setInterval(() => { reload(); tick((n) => n + 1); }, 30_000); return () => window.clearInterval(t); }, [reload]);
  const jobs = useMemo(() => (data ?? []).filter((j) => inBranch(branch, j.branch_id)), [data, branch]);
  const cols: [string, AdminJob["status"][]][] = [["Ready (not picked)", ["READY"]], ["Picked", ["PICKED", "OUT"]], ["Delivered", ["DELIVERED"]], ["Failed", ["FAILED"]]];
  const now = Date.now();
  const alerts = [
    ...jobs.filter((j) => j.status === "READY" && new Date(j.slot_start).getTime() - now < 30 * 60_000)
      .map((j) => ({ k: `np-${j.id}`, warn: true, text: `${j.ref.split("#")[0]} (${j.area || TYPE_LABEL[j.type]}) not picked — slot ${j.slot}` })),
    ...jobs.filter((j) => j.status === "FAILED").map((j) => ({ k: `f-${j.id}`, warn: false, text: `${j.ref.split("#")[0]} failed: ${j.fail_reason} (${j.partner_name})` })),
    ...jobs.filter((j) => j.collected && j.collected.amount !== j.due).map((j) => ({ k: `c-${j.id}`, warn: false, text: `${j.ref} COD collected ${inr(j.collected!.amount)}, due ${inr(j.due)}: ${j.collected!.reason ?? "no reason"} (${j.partner_name})` })),
  ];
  return (
    <div className="page-fade">
      <p className="adm-hint">Updates every 30 seconds. {data && `Last updated ${new Date().toLocaleTimeString("en-IN")}.`}</p>
      {alerts.length > 0 && <div className="alerts" style={{ marginBottom: 14 }}>{alerts.map((a) => <div key={a.k} className={`alert ${a.warn ? "warn" : ""}`}><AlertTriangle size={16} /> {a.text}</div>)}</div>}
      {loading && !data ? <Skeleton rows={4} h={90} /> : (
        <div className="board">
          {cols.map(([title, st]) => {
            const list = jobs.filter((j) => st.includes(j.status));
            return (
              <div className="board-col" key={title}>
                <h4>{title}<span>{list.length}</span></h4>
                {list.length === 0 && <p className="adm-hint">None</p>}
                {list.map((j) => (
                  <div className="board-card" key={j.id}>
                    <div className="adm-inline" style={{ justifyContent: "space-between" }}><strong>{j.ref.split("#")[0]}</strong><span className="badge">{TYPE_LABEL[j.type]}</span></div>
                    <span><MapPin size={11} /> {j.area || "—"} · <Clock size={11} /> {j.slot}</span>
                    <span style={{ color: "var(--text-dim)" }}>{j.items.join(", ")}</span>
                    <span>{j.due > 0 ? `COD ${inr(j.due)}` : "Paid"}{j.status === "OUT" && " · out for delivery"}</span>
                    {j.partner_name && <span>{j.partner_name}{j.picked_at && ` · ${time(j.picked_at)}`}{j.delivered_at && ` → ${time(j.delivered_at)}`}</span>}
                    {j.collected && <span>{j.collected.method} {inr(j.collected.amount)}</span>}
                    {j.fail_reason && <span style={{ color: "#FF8A70" }}>{j.fail_reason}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Cash collection ---------------- */
export function AdminCash() {
  const { data, loading, reload } = useApi("admin-cash", ops.cash);
  const { branch } = useBranchFilter();
  const { toast } = useStore();
  const rows = (data ?? []).filter((r) => inBranch(branch, r.branch_id));
  const receive = async (partnerId: string, name: string, pending: number) => {
    const v = prompt(`Cash received from ${name} (₹). Pending: ${pending / 100}`, String(pending / 100));
    if (v == null) return;
    try { await ops.receiveCash(partnerId, Math.round(Number(v) * 100)); toast("Handover recorded", "success"); reload(); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
  };
  if (loading && !data) return <Skeleton rows={3} />;
  if (!rows.length) return <div className="card admin-empty">No delivery partners yet.</div>;
  return (
    <div className="admin-table-wrap page-fade">
      <table className="admin-table rt">
        <thead><tr><th>Partner</th><th>COD cash today</th><th>UPI today</th><th>Handed over (all)</th><th>Pending</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.partner_id}>
              <td data-label="Partner"><strong>{r.name}</strong><br /><small>+91 {r.mobile}</small></td>
              <td data-label="Cash today">{inr(r.cash_today)}</td>
              <td data-label="UPI today">{inr(r.upi_today)}</td>
              <td data-label="Handed over">{inr(r.handed_over)}{r.handovers.length > 0 && <><br /><small style={{ color: "var(--text-dim)" }}>last {new Date(r.handovers[r.handovers.length - 1].at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small></>}</td>
              <td data-label="Pending"><strong style={{ color: r.pending ? "var(--accent-gold-bright)" : undefined }}>{inr(r.pending)}</strong></td>
              <td data-label=""><button className="btn btn-sm btn-primary" disabled={!r.pending} onClick={() => receive(r.partner_id, r.name, r.pending)}><Wallet size={14} /> Mark received</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Delivery partner accounts ---------------- */
type PForm = { id?: string; name: string; mobile: string; branch_id: string; vehicle: string; active: boolean; password: string };
export function AdminPartners({ branches }: { branches: { id: string; name: string }[] }) {
  const { data, loading, reload } = useApi("admin-partners", ops.partners);
  const { branch } = useBranchFilter();
  const { toast } = useStore();
  const [form, setForm] = useState<PForm | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const bname = (id: string) => branches.find((b) => b.id === id)?.name ?? id;
  const open = (p?: PartnerView) => { setErrs({}); setForm(p ? { id: p.id, name: p.name, mobile: p.mobile, branch_id: p.branch_id, vehicle: p.vehicle, active: p.active, password: "" } : { name: "", mobile: "", branch_id: branches[0]?.id ?? "", vehicle: "", active: true, password: "" }); };
  const save = async () => {
    if (!form) return;
    try {
      const { id, password, ...rest } = form;
      await ops.savePartner({ ...rest, ...(password ? { password } : {}) }, id);
      toast(id ? "Partner updated" : "Partner added", "success"); setForm(null); reload();
    } catch (e) { const { fields, message } = errorsFrom(e); setErrs({ ...fields, _: message }); }
  };
  const toggle = async (p: PartnerView) => {
    if (p.active && !confirm(`Deactivate ${p.name}? They are signed out and can't pick orders.`)) return;
    try { await ops.savePartner({ name: p.name, mobile: p.mobile, branch_id: p.branch_id, vehicle: p.vehicle, active: !p.active }, p.id); toast(p.active ? "Deactivated" : "Activated", "success"); reload(); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
  };
  const rows = (data ?? []).filter((p) => inBranch(branch, p.branch_id));
  return (
    <div className="page-fade">
      <div className="admin-controls"><button className="btn btn-primary btn-sm" onClick={() => open()}><Plus size={14} /> Add delivery partner</button>
        <span className="adm-hint" style={{ margin: 0 }}>Partners sign in at <code>/partner</code> with their mobile number and password.</span></div>
      {loading && !data ? <Skeleton rows={3} /> : rows.length === 0 ? <div className="card admin-empty">No delivery partners yet.</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table rt">
            <thead><tr><th>Name</th><th>Mobile</th><th>Branch</th><th>Vehicle</th><th>Today</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={p.active ? undefined : { opacity: 0.55 }}>
                  <td data-label="Name"><strong>{p.name}</strong></td>
                  <td data-label="Mobile">+91 {p.mobile}</td>
                  <td data-label="Branch">{bname(p.branch_id)}</td>
                  <td data-label="Vehicle">{p.vehicle || "—"}</td>
                  <td data-label="Today">{p.summary.picked} picked · {p.summary.delivered} delivered</td>
                  <td data-label="Status">{!p.active ? <span className="badge badge-error">Inactive</span> : p.online ? <span className="badge badge-success">Online</span> : <span className="badge">Offline</span>}</td>
                  <td data-label=""><div className="admin-actions">
                    <button className="btn btn-sm btn-solid" onClick={() => open(p)}><Pencil size={13} /> Edit</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => { open(p); }} title="Set a new password in the edit form"><KeyRound size={13} /> Reset password</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => toggle(p)}><Power size={13} /> {p.active ? "Deactivate" : "Activate"}</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Edit delivery partner" : "Add delivery partner"} maxWidth={520}>
        {form && (
          <div className="admin-form">
            <div className="field"><label className="label" htmlFor="pf-name">Name</label><input id="pf-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><FieldError msg={errs.name} /></div>
            <div className="field-row">
              <div className="field"><label className="label" htmlFor="pf-mobile">Mobile</label><input id="pf-mobile" className="input" inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })} /><FieldError msg={errs.mobile} /></div>
              <div className="field"><label className="label" htmlFor="pf-vehicle">Vehicle number</label><input id="pf-vehicle" className="input" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="TN 59 AB 1234" /></div>
            </div>
            <div className="field"><label className="label" htmlFor="pf-branch">Branch</label>
              <select id="pf-branch" className="select" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><FieldError msg={errs.branch_id} /></div>
            <div className="field"><label className="label" htmlFor="pf-pass">{form.id ? "New password (leave empty to keep)" : "Password"}</label><input id="pf-pass" className="input" type="text" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><FieldError msg={errs.password} />
              {form.id && <span className="adm-hint" style={{ margin: 0 }}>Setting a new password signs the partner out on their phone.</span>}</div>
            {errs._ && <span className="field-error">{errs._}</span>}
            <button className="btn btn-primary btn-block" onClick={save}>{form.id ? "Save" : "Add partner"}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
