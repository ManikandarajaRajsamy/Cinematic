import { useState } from "react";
import { Plus, Pencil, Power, KeyRound, ShieldCheck, UserCog, Bike, Megaphone, Crown } from "lucide-react";
import { api, useApi } from "@/api/client";
import { ops, type PartnerView } from "@/api/ops";
import { useStore } from "@/store/store";
import { Modal } from "@/components/Modal";
import { ADMIN_SECTIONS, MANAGER_DEFAULT, ROLE_LABEL, type StaffRole } from "@/data/adminSections";
import { errorsFrom, FieldError } from "./shared";
import { Skeleton } from "./ui";

/** Staff (admin workspace) or a delivery partner (partner app): one form for both. */
type Role = StaffRole | "PARTNER";
type Form = { id?: string; name: string; mobile: string; role: Role; sections: string[]; active: boolean; password: string; branch_id: string; vehicle: string };
const ROLE_INFO: Record<Role, { label: string; help: string }> = {
  MANAGER: { label: "Manager", help: "Only the sections you choose" },
  SUPER_ADMIN: { label: "Super admin", help: "Everything, including team & access" },
  PARTNER: { label: "Delivery partner", help: "Partner app only: assigned deliveries" },
};

/**
 * Team & access (super admins only): who can sign in to this workspace and which sections each person can open.
 * Managers see only their sections; the server refuses everything else. Delivery partners and promoters have
 * their own apps and are managed in their own sections.
 */
export function AdminTeam({ goTo }: { goTo: (tab: "partners" | "promoters") => void }) {
  const { data, loading, reload: reloadStaff } = useApi("admin-staff", api.staff);
  const partners = useApi("admin-partners", ops.partners);
  const branches = useApi("admin-branches", api.admin.branches);
  const reload = () => { reloadStaff(); partners.reload(); };
  const branchName = (id: string) => branches.data?.find((b) => b.id === id)?.name_en ?? id;
  const { toast } = useStore();
  const [form, setForm] = useState<Form | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  // reset password: the admin sets a new one directly; the person is signed out on every device
  type PwTarget = { kind: "staff"; s: { name: string; mobile: string; role: StaffRole; sections: string[]; active: boolean } } | { kind: "partner"; p: PartnerView };
  const [pwFor, setPwFor] = useState<PwTarget | null>(null);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const openPw = (t: PwTarget) => { setPw(""); setPwErr(""); setPwFor(t); };
  const savePw = async () => {
    if (!pwFor) return;
    if (pw.length < 6) { setPwErr("At least 6 characters"); return; }
    setPwBusy(true);
    try {
      if (pwFor.kind === "staff") { const { name, mobile, role, sections, active } = pwFor.s; await api.saveStaff({ name, mobile, role, sections, active, password: pw }, mobile); }
      else { const x = pwFor.p; await ops.savePartner({ name: x.name, mobile: x.mobile, branch_id: x.branch_id, vehicle: x.vehicle, active: x.active, password: pw }, x.id); }
      toast("Password updated · they're signed out everywhere", "success"); setPwFor(null); reload();
    } catch (e) { const { fields, message } = errorsFrom(e); setPwErr(fields.password ?? message); }
    finally { setPwBusy(false); }
  };

  const blank = { password: "", branch_id: branches.data?.[0]?.id ?? "", vehicle: "" };
  const open = (s?: { name: string; mobile: string; role: StaffRole; sections: string[]; active: boolean }) => { setErrs({}); setForm(s ? { ...blank, ...s, id: s.mobile } : { ...blank, name: "", mobile: "", role: "MANAGER", sections: [...MANAGER_DEFAULT], active: true }); };
  const openPartner = (p: PartnerView) => { setErrs({}); setForm({ ...blank, id: p.id, name: p.name, mobile: p.mobile, role: "PARTNER", sections: [], active: p.active, branch_id: p.branch_id, vehicle: p.vehicle }); };
  const save = async () => {
    if (!form) return;
    try {
      const { id, password, role, branch_id, vehicle, ...rest } = form;
      if (role === "PARTNER") {
        await ops.savePartner({ name: rest.name, mobile: rest.mobile, branch_id, vehicle, active: rest.active, ...(password ? { password } : {}) }, id);
        toast(id ? "Partner updated" : "Delivery partner added", "success");
      } else {
        await api.saveStaff({ ...rest, role, ...(password ? { password } : {}) }, id);
        toast(id ? "Access updated" : "Staff member added", "success");
      }
      setForm(null); reload();
    } catch (e) { const { fields, message } = errorsFrom(e); setErrs({ ...fields, _: message }); }
  };
  const togglePartner = async (p: PartnerView) => {
    if (p.active && !confirm(`Remove ${p.name}'s access? They are signed out of the partner app.`)) return;
    try { await ops.savePartner({ name: p.name, mobile: p.mobile, branch_id: p.branch_id, vehicle: p.vehicle, active: !p.active }, p.id); toast(p.active ? "Access removed" : "Access restored", "success"); reload(); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
  };
  const toggle = async (s: { name: string; mobile: string; role: StaffRole; sections: string[]; active: boolean }) => {
    if (s.active && !confirm(`Remove ${s.name}'s access? They can no longer sign in.`)) return;
    try { await api.saveStaff({ ...s, active: !s.active }, s.mobile); toast(s.active ? "Access removed" : "Access restored", "success"); reload(); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
  };
  const flip = (id: string) => form && setForm({ ...form, sections: form.sections.includes(id) ? form.sections.filter((x) => x !== id) : [...form.sections, id] });

  return (
    <div className="page-fade tm">
      <div className="tm-apps">
        <div className="tm-app"><span className="t-all"><UserCog size={20} /></span><div><strong>Managers & staff</strong><small>Everyone signs in at /admin with mobile + password</small></div></div>
        <button className="tm-app" onClick={() => goTo("partners")}><span className="t-info"><Bike size={20} /></span><div><strong>Delivery partners</strong><small>Partner app at /partner · add them here or in Delivery partners</small></div></button>
        <button className="tm-app" onClick={() => goTo("promoters")}><span className="t-wait"><Megaphone size={20} /></span><div><strong>Promoters</strong><small>No login · managed by managers in Promoters</small></div></button>
      </div>

      <div className="pm-bar">
        <h3 className="tm-h">Team</h3>
        <button className="btn btn-primary" onClick={() => open()}><Plus size={16} /> Add team member</button>
      </div>

      {loading && !data ? <Skeleton rows={3} /> : (
        <ul className="tm-list">
          {(data?.owners ?? []).map((m) => (
            <li key={m} className="tm-card">
              <div className="tm-who"><span className="tm-av own"><Crown size={18} /></span><div><strong>Owner</strong><small>+91 {m}</small></div><span className="badge dot badge-gold">Super admin</span></div>
              <p className="tm-secs">Full access to every section, including Team & access. Built in; sets their password on first sign-in.</p>
            </li>
          ))}
          {(data?.staff ?? []).map((s) => (
            <li key={s.mobile} className={`tm-card ${s.active ? "" : "off"}`}>
              <div className="tm-who">
                <span className="tm-av">{s.name.charAt(0).toUpperCase()}</span>
                <div><strong>{s.name}</strong><small>+91 {s.mobile}</small></div>
                <span className={`badge dot ${!s.active ? "badge-error" : s.role === "SUPER_ADMIN" ? "badge-gold" : "badge-success"}`}>{s.active ? ROLE_LABEL[s.role] : "No access"}</span>
              </div>
              <div className="tm-chips">
                {s.role === "SUPER_ADMIN" ? <span className="tm-chip all">All sections</span>
                  : s.sections.map((x) => <span key={x} className="tm-chip">{ADMIN_SECTIONS.find((a) => a.id === x)?.label ?? x}</span>)}
              </div>
              <div className="admin-actions" style={{ justifyContent: "flex-start" }}>
                <button className="btn btn-sm btn-solid" onClick={() => open(s)}><Pencil size={13} /> Edit access</button>
                <button className="btn btn-sm btn-ghost" onClick={() => openPw({ kind: "staff", s })}><KeyRound size={13} /> Reset password</button>
                <button className="btn btn-sm btn-ghost" onClick={() => toggle(s)}><Power size={13} /> {s.active ? "Remove access" : "Restore access"}</button>
              </div>
            </li>
          ))}
          {(partners.data ?? []).map((pt) => (
            <li key={pt.id} className={`tm-card ${pt.active ? "" : "off"}`}>
              <div className="tm-who">
                <span className="tm-av part"><Bike size={18} /></span>
                <div><strong>{pt.name}</strong><small>+91 {pt.mobile}</small></div>
                <span className={`badge dot ${pt.active ? "badge-success" : "badge-error"}`}>{pt.active ? "Delivery partner" : "No access"}</span>
              </div>
              <div className="tm-chips"><span className="tm-chip">{branchName(pt.branch_id)}</span>{pt.vehicle && <span className="tm-chip">{pt.vehicle}</span>}<span className="tm-chip">Partner app</span></div>
              <div className="admin-actions" style={{ justifyContent: "flex-start" }}>
                <button className="btn btn-sm btn-solid" onClick={() => openPartner(pt)}><Pencil size={13} /> Edit</button>
                <button className="btn btn-sm btn-ghost" onClick={() => openPw({ kind: "partner", p: pt })}><KeyRound size={13} /> Reset password</button>
                <button className="btn btn-sm btn-ghost" onClick={() => togglePartner(pt)}><Power size={13} /> {pt.active ? "Remove access" : "Restore access"}</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? (form.role === "PARTNER" ? "Edit delivery partner" : "Edit access") : "Add team member"} maxWidth={560}>
        {form && (
          <div className="admin-form">
            <div className="field-row">
              <div className="field"><label className="label" htmlFor="tm-name">Name</label><input id="tm-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><FieldError msg={errs.name} /></div>
              <div className="field"><label className="label" htmlFor="tm-mob">Mobile (they sign in with it)</label><input id="tm-mob" className="input" inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })} /><FieldError msg={errs.mobile} /></div>
            </div>
            <span className="label">Role</span>
            <div className="tm-roles" role="radiogroup" aria-label="Role">
              {(["MANAGER", "SUPER_ADMIN", "PARTNER"] as Role[]).map((r) => {
                // an existing person keeps their kind of account: staff can't become a partner here, and the other way round
                const locked = !!form.id && ((form.role === "PARTNER") !== (r === "PARTNER"));
                return (
                  <button key={r} type="button" role="radio" aria-checked={form.role === r} disabled={locked} className={`tm-role ${form.role === r ? "on" : ""}`} onClick={() => setForm({ ...form, role: r })}>
                    {r === "MANAGER" ? <UserCog size={18} /> : r === "SUPER_ADMIN" ? <ShieldCheck size={18} /> : <Bike size={18} />}
                    <strong>{ROLE_INFO[r].label}</strong>
                    <small>{ROLE_INFO[r].help}</small>
                  </button>
                );
              })}
            </div>
            {form.role === "PARTNER" && (
              <div className="field-row">
                <div className="field"><label className="label" htmlFor="tm-branch">Branch</label>
                  <select id="tm-branch" className="select" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                    {(branches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}
                  </select><FieldError msg={errs.branch_id} /></div>
                <div className="field"><label className="label" htmlFor="tm-veh">Vehicle number (optional)</label><input id="tm-veh" className="input" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="TN 59 AB 1234" /></div>
              </div>
            )}
            {form.role === "MANAGER" && (
              <>
                <span className="label">Sections this manager can open</span>
                <div className="tm-secgrid">
                  {ADMIN_SECTIONS.map((a) => (
                    <label key={a.id} className={`tm-sec ${form.sections.includes(a.id) ? "on" : ""}`}>
                      <input type="checkbox" checked={form.sections.includes(a.id)} onChange={() => flip(a.id)} /> {a.label}
                    </label>
                  ))}
                </div>
                <FieldError msg={errs.sections} />
              </>
            )}
            <div className="field"><label className="label" htmlFor="tm-pass">{form.id ? "New password (leave empty to keep)" : "Password"}</label>
              <input id="tm-pass" className="input" type="text" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><FieldError msg={errs.password} />
              <span className="adm-hint" style={{ margin: 0 }}>{form.role === "PARTNER" ? <>They sign in to the partner app at <code>/partner</code> with their mobile number and this password.</> : <>They sign in at <code>/admin</code> (or <code>/manager</code>) with their mobile number and this password.</>}</span></div>
            <label className="adm-inline" style={{ gap: 8 }}><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Can sign in</label>
            {errs._ && <span className="field-error">{errs._}</span>}
            <button className="btn btn-primary btn-block" onClick={save}>{form.id ? "Save" : form.role === "PARTNER" ? "Add delivery partner" : "Add team member"}</button>
          </div>
        )}
      </Modal>

      <Modal open={!!pwFor} onClose={() => setPwFor(null)} title="Reset password" maxWidth={440}>
        {pwFor && (
          <form className="admin-form" onSubmit={(e) => { e.preventDefault(); savePw(); }}>
            <p className="adm-hint" style={{ margin: 0 }}>
              New password for <b>{pwFor.kind === "staff" ? pwFor.s.name : pwFor.p.name}</b> (+91 {pwFor.kind === "staff" ? pwFor.s.mobile : pwFor.p.mobile}).
              They're signed out on every device and sign in again {pwFor.kind === "partner" ? <>at <code>/partner</code></> : <>at <code>/admin</code></>} with this password.
            </p>
            <div className="field"><label className="label" htmlFor="tm-newpw">New password</label>
              <input id="tm-newpw" className="input" type="text" autoComplete="new-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" />
              <FieldError msg={pwErr} /></div>
            <button className="btn btn-primary btn-block" disabled={pwBusy}>{pwBusy ? "Saving…" : "Update password"}</button>
          </form>
        )}
      </Modal>

      <style>{`
        .tm .pm-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .tm-apps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
        .tm-app { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-card); text-align: left; }
        button.tm-app:hover { border-color: var(--border-bright); }
        .tm-app > span { width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center; }
        .tm-app > div { display: flex; flex-direction: column; min-width: 0; }
        .tm-app small { font-size: 12px; color: var(--text-dim); }
        .t-all { background: rgba(91, 95, 239, 0.12); color: #5B5FEF; }
        .t-info { background: rgba(0, 184, 217, 0.13); color: #0091AD; }
        .t-wait { background: rgba(255, 159, 67, 0.16); color: #D9770F; }
        .tm-h { font-size: 15px; font-weight: 700; }
        .tm-list { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
        .tm-card { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 14px; border: 1px solid var(--border); background: var(--bg-card); }
        .tm-card.off { opacity: 0.6; }
        .tm-who { display: flex; align-items: center; gap: 12px; }
        .tm-who > div { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .tm-who small { font-size: 12.5px; color: var(--text-dim); }
        .tm-av { width: 42px; height: 42px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: var(--accent-gold-glow); color: var(--accent-gold); font-weight: 700; }
        .tm-av.own { background: rgba(255, 159, 67, 0.16); color: #D9770F; }
        .tm-secs { font-size: 13px; color: var(--text-dim); }
        .tm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .tm-chip { padding: 3px 9px; border-radius: 6px; background: var(--bg-elevated); font-size: 12px; font-weight: 600; color: var(--text-muted); }
        .tm-chip.all { background: rgba(91, 95, 239, 0.12); color: #4549D8; }
        .tm-roles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .tm-role:disabled { opacity: 0.4; cursor: not-allowed; }
        .tm-av.part { background: rgba(0, 184, 217, 0.13); color: #0091AD; }
        .tm-role { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px; border-radius: 12px; border: 1.5px solid var(--border-strong); text-align: left; color: var(--text); }
        .tm-role svg { color: var(--accent-gold); }
        .tm-role small { font-size: 12px; color: var(--text-dim); }
        .tm-role.on { border-color: var(--accent-gold); background: var(--accent-gold-glow); }
        .tm-secgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .tm-sec { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); font-size: 13.5px; cursor: pointer; }
        .tm-sec.on { border-color: var(--accent-gold); background: var(--accent-gold-glow); font-weight: 600; }
        .tm-sec input { width: 16px; height: 16px; accent-color: var(--accent-gold); }
        @media (max-width: 800px) { .tm-apps { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .tm-roles, .tm-secgrid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
