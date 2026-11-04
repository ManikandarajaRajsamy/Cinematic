import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, MapPin, Plus, Pencil, KeyRound, Power, Wallet, Banknote, Smartphone, HandCoins, Phone } from "lucide-react";
import { useApi } from "@/api/client";
import { ops, inr, type AdminJob, type PartnerView } from "@/api/ops";
import { useStore } from "@/store/store";
import { Modal } from "@/components/Modal";
import { errorsFrom, FieldError } from "./shared";
import { Picker } from "./Picker";
import { Skeleton, inBranch, useBranchFilter } from "./ui";

const TYPE_LABEL = { ORDER: "Delivery", SUBSCRIPTION: "Subscription", EVENT: "Event" } as const;
const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "");

/** Status of a delivery in words: Needs a partner → Assigned → Picked up → Delivered. */
export const jobStatusText = (s: AdminJob["status"]) => ({ READY: "Needs a partner", ASSIGNED: "Assigned", PICKED: "Picked up", OUT: "Picked up", DELIVERED: "Delivered", FAILED: "Failed", CANCELLED: "Cancelled" })[s];

/** Manual assignment: the admin picks an active partner for a delivery, or takes it back. */
export function AssignSelect({ j, onDone }: { j: { id: string; status: AdminJob["status"]; partner_id: string | null; branch_id: string }; onDone: () => void }) {
  const partners = useApi("admin-partners", ops.partners);
  const { toast } = useStore();
  if (j.status !== "READY" && j.status !== "ASSIGNED") return null;
  const active = (partners.data ?? []).filter((p) => p.active).sort((a, b) => Number(b.branch_id === j.branch_id) - Number(a.branch_id === j.branch_id));
  const assign = async (partnerId: string) => {
    try { await ops.assignJob(j.id, partnerId); toast(partnerId ? "Partner assigned" : "Assignment removed", "success"); onDone(); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
  };
  return (
    <Picker label="Assign delivery partner" value={j.partner_id ?? ""} placeholder="Assign a partner" emptyText="Add a partner first" clearLabel="Remove partner"
      options={active.map((p) => ({ id: p.id, label: p.name, sub: `+91 ${p.mobile}`, hint: p.branch_id === j.branch_id ? "Same branch" : undefined }))} onChange={assign} />
  );
}

/** Small tracking block reused by Orders, Subscriptions and Events. */
/** `badge={false}` where the row already shows a status chip, so it isn't repeated. */
export function JobTrack({ j, partnerName, badge = true }: { j: AdminJob | (Omit<AdminJob, "partner_name"> & { partner_name?: string }) | null; partnerName?: string; badge?: boolean }) {
  if (!j) return <span style={{ color: "var(--text-dim)" }}>—</span>;
  const name = partnerName ?? (j as AdminJob).partner_name;
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "var(--font-xs)" }}>
      {badge && <span className={`badge ${j.status === "DELIVERED" ? "badge-success" : j.status === "FAILED" ? "badge-error" : "badge-gold"}`} style={{ alignSelf: "flex-start" }}>{jobStatusText(j.status)}</span>}
      {name && <span>by {name}{j.picked_at && ` · picked ${time(j.picked_at)}`}</span>}
      {j.delivered_at && <span>delivered {time(j.delivered_at)}</span>}
      {j.collected && <span>{j.collected.method} {inr(j.collected.amount)}{j.collected.amount !== j.due && " ≠ due"}</span>}
      {j.location && <a href={`https://www.google.com/maps?q=${j.location.lat},${j.location.lng}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-gold-bright)" }}><MapPin size={10} /> confirmed here</a>}
      {j.fail_reason && <span style={{ color: "#FF8A70" }}>{j.fail_reason}</span>}
    </span>
  );
}

/** A subscription's own partner: every daily delivery of the plan is assigned to them. */
export function PlanPartnerSelect({ plan, onDone }: { plan: { id: string; partner_id?: string | null; branch_id: string }; onDone: () => void }) {
  const partners = useApi("admin-partners", ops.partners);
  const { toast } = useStore();
  const active = (partners.data ?? []).filter((p) => p.active).sort((a, b) => Number(b.branch_id === plan.branch_id) - Number(a.branch_id === plan.branch_id));
  const assign = async (partnerId: string) => {
    try { await ops.assignPlanPartner(plan.id, partnerId); toast(partnerId ? "Plan partner assigned: daily deliveries go to them" : "Plan partner removed", "success"); onDone(); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
  };
  return (
    <Picker label="Plan delivery partner" value={plan.partner_id ?? ""} placeholder="Assign plan partner" emptyText="Add a partner first" clearLabel="Remove plan partner"
      options={active.map((p) => ({ id: p.id, label: p.name, sub: `+91 ${p.mobile}`, hint: p.branch_id === plan.branch_id ? "Same branch" : undefined }))} onChange={assign} />
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
  const cols: [string, AdminJob["status"][]][] = [["Needs a partner", ["READY"]], ["Assigned", ["ASSIGNED"]], ["Picked up", ["PICKED", "OUT"]], ["Delivered", ["DELIVERED"]]];
  const now = Date.now();
  const alerts = [
    ...jobs.filter((j) => j.status === "READY" && new Date(j.slot_start).getTime() - now < 30 * 60_000)
      .map((j) => ({ k: `np-${j.id}`, warn: true, text: `${j.ref.split("#")[0]} (${j.area || TYPE_LABEL[j.type]}) has no partner yet — ${j.slot}` })),
    ...jobs.filter((j) => j.status === "FAILED").map((j) => ({ k: `f-${j.id}`, warn: false, text: `${j.ref.split("#")[0]} failed: ${j.fail_reason} (${j.partner_name})` })),
    ...jobs.filter((j) => j.collected && j.collected.amount !== j.due).map((j) => ({ k: `c-${j.id}`, warn: false, text: `${j.ref} COD collected ${inr(j.collected!.amount)}, due ${inr(j.due)}: ${j.collected!.reason ?? "no reason"} (${j.partner_name})` })),
  ];
  return (
    <div className="page-fade">
      <p className="adm-hint">Assign each delivery to a partner by hand. Partners only see what you assign to them. Updates every 30 seconds. {data && `Last updated ${new Date().toLocaleTimeString("en-IN")}.`}</p>
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
                    <span>{j.due > 0 ? `Collect ${inr(j.due)}${j.paid_at ? " · payment confirmed" : ""}` : "Paid"}</span>
                    {j.partner_name && <span>{j.partner_name}{j.picked_at && ` · picked ${time(j.picked_at)}`}{j.delivered_at && ` → delivered ${time(j.delivered_at)}`}</span>}
                    <AssignSelect j={j} onDone={reload} />
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
/** Cash the partners collected at the door, and what is still to be handed over to the shop. */
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
  if (!rows.length) return <div className="card admin-empty">No delivery partners yet. Add them under Delivery partners.</div>;
  const sum = (k: "pending" | "cash_today" | "upi_today" | "handed_over") => rows.reduce((n, r) => n + r[k], 0);
  const tiles = [
    { label: "Pending with partners", value: sum("pending"), icon: Wallet, tone: "t-wait" },
    { label: "Cash collected today", value: sum("cash_today"), icon: Banknote, tone: "t-done" },
    { label: "UPI collected today", value: sum("upi_today"), icon: Smartphone, tone: "t-info" },
    { label: "Handed over (all time)", value: sum("handed_over"), icon: HandCoins, tone: "t-all" },
  ];
  return (
    <div className="page-fade cc">
      <div className="cc-tiles">
        {tiles.map((t) => (
          <div key={t.label} className={`cc-tile ${t.tone}`}>
            <span className="cc-ic"><t.icon size={20} /></span>
            <div><small>{t.label}</small><strong>{inr(t.value)}</strong></div>
          </div>
        ))}
      </div>
      <ul className="cc-list">
        {rows.map((r) => {
          const last = r.handovers[r.handovers.length - 1];
          return (
            <li key={r.partner_id} className={`cc-card ${r.pending ? "due" : ""}`}>
              <div className="cc-who">
                <span className="cc-av">{r.name.charAt(0).toUpperCase()}</span>
                <div><strong>{r.name}</strong><a href={`tel:+91${r.mobile}`}><Phone size={12} /> +91 {r.mobile}</a></div>
                <span className={`badge dot ${r.pending ? "badge-saffron" : "badge-success"}`}>{r.pending ? "To collect" : "Settled"}</span>
              </div>
              <div className="cc-due">
                <small>Pending handover</small>
                <strong>{inr(r.pending)}</strong>
              </div>
              <dl className="cc-stats">
                <div><dt>Cash today</dt><dd>{inr(r.cash_today)}</dd></div>
                <div><dt>UPI today</dt><dd>{inr(r.upi_today)}</dd></div>
                <div><dt>Handed over</dt><dd>{inr(r.handed_over)}</dd></div>
              </dl>
              <div className="cc-foot">
                <span>{last ? <>Last handover {inr(last.amount)} · {new Date(last.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</> : "No handovers yet"}</span>
                {r.pending > 0 && <button className="btn btn-primary btn-sm" onClick={() => receive(r.partner_id, r.name, r.pending)}><Wallet size={14} /> Mark received</button>}
              </div>
            </li>
          );
        })}
      </ul>
      <style>{`
        .cc-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
        .cc-tile { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-card); }
        .cc-tile > div { display: flex; flex-direction: column; min-width: 0; }
        .cc-tile small { font-size: 12px; color: var(--text-dim); }
        .cc-tile strong { font-size: 1.3rem; }
        .cc-ic { width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center; }
        .t-all .cc-ic { background: rgba(91, 95, 239, 0.12); color: #5B5FEF; }
        .t-wait .cc-ic { background: rgba(255, 159, 67, 0.16); color: #D9770F; }
        .t-info .cc-ic { background: rgba(0, 184, 217, 0.13); color: #0091AD; }
        .t-done .cc-ic { background: rgba(40, 199, 111, 0.14); color: #1E9E57; }
        .cc-list { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
        .cc-card { display: flex; flex-direction: column; gap: 14px; padding: 18px; border-radius: 14px; border: 1px solid var(--border); background: var(--bg-card); }
        .cc-card.due { box-shadow: inset 3px 0 0 #FF9F43; }
        .cc-who { display: flex; align-items: center; gap: 12px; }
        .cc-who > div { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .cc-who a { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; color: var(--accent-gold); }
        .cc-av { width: 42px; height: 42px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: var(--accent-gold-glow); color: var(--accent-gold); font-weight: 700; font-size: 16px; }
        .cc-due { padding: 14px 16px; border-radius: 12px; background: var(--bg-elevated); display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .cc-due small { font-size: 12.5px; color: var(--text-dim); }
        .cc-due strong { font-size: 1.6rem; }
        .cc-card.due .cc-due strong { color: #D9770F; }
        .cc-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .cc-stats div { display: flex; flex-direction: column; gap: 2px; padding: 10px; border-radius: 10px; border: 1px solid var(--border); }
        .cc-stats dt { font-size: 11.5px; color: var(--text-dim); }
        .cc-stats dd { font-weight: 700; }
        .cc-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 12px; border-top: 1px dashed var(--border); font-size: 12.5px; color: var(--text-dim); }
        @media (max-width: 1100px) { .cc-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 700px) {
          .cc-tiles { gap: 8px; }
          .cc-tile { padding: 12px; gap: 10px; }
          .cc-ic { width: 36px; height: 36px; }
          .cc-tile strong { font-size: 1.1rem; }
          .cc-list { grid-template-columns: 1fr; }
          .cc-foot .btn { flex: 1 1 100%; }
        }
      `}</style>
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
    if (p.active && !confirm(`Deactivate ${p.name}? They are signed out and can't be assigned deliveries.`)) return;
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
                  <td data-label="Today">{p.summary.picked} picked up · {p.summary.delivered} delivered</td>
                  <td data-label="Status">{p.active ? <span className="badge badge-success">Active</span> : <span className="badge badge-error">Inactive</span>}</td>
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
            <label className="adm-inline" style={{ gap: 8 }}><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active (can sign in and be assigned deliveries)</label>
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
