import { useState } from "react";
import { RotateCcw, LogOut, ShieldCheck } from "lucide-react";
import { useStore } from "@/store/store";
import { api, adminSession, useApi } from "@/api/client";
import { AdminBranches } from "./admin/AdminBranches";
import { AdminProducts } from "./admin/AdminProducts";
import { AdminDelivery, AdminAudit } from "./admin/AdminDelivery";
import { errorsFrom } from "./admin/shared";
import { AdminEvents } from "./admin/AdminEvents";
import { AdminCustomers } from "./admin/AdminCustomers";
import { AdminDashboard } from "./admin/AdminDashboard";
import { AdminDeliveries, AdminCash, AdminPartners } from "./admin/AdminDeliveries";
import { AdminOrders } from "./admin/AdminOrders";
import { AdminSubscriptions } from "./admin/AdminSubscriptions";
import { AdminUiStyles, BranchFilterCtx } from "./admin/ui";


// Super Admin workspace. (There is no Store Manager role; delivery partners use /partner.)
const TABS = ["dashboard", "deliveries", "orders", "subscriptions", "events", "cash", "partners", "customers", "products", "branches", "delivery", "audit"] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = {
  dashboard: "Dashboard", deliveries: "Deliveries today", orders: "Orders", subscriptions: "Subscriptions", events: "Events", cash: "Cash",
  partners: "Delivery partners", customers: "Customers", products: "Products", branches: "Branches", delivery: "Delivery fees", audit: "Audit",
};
type Tab = (typeof TABS)[number];


/** Super-admin sign-in. The mock server checks the number on every admin call (not real security). */
function AdminGate({ onIn }: { onIn: () => void }) {
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { const r = await api.adminLogin(phone); adminSession.set(r.token); onIn(); }
    catch (x) { setErr(errorsFrom(x).message); }
  };
  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)", minHeight: "80vh" }}>
      <form className="container-narrow card admin-form" style={{ maxWidth: 440, padding: 32 }} onSubmit={submit}>
        <span className="eyebrow"><ShieldCheck size={14} /> Admin</span>
        <h1 className="title-xl">Sign in</h1>
        <p style={{ color: "var(--text-dim)", fontSize: "var(--font-sm)" }}>Super admins only. In this local demo the number is checked without an OTP.</p>
        <div className="field">
          <label className="label" htmlFor="adm-phone">Mobile number</label>
          <input id="adm-phone" className="input" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" />
          {err && <span className="field-error">{err}</span>}
        </div>
        <button className="btn btn-primary btn-block" type="submit">Continue</button>
      </form>
    </section>
  );
}

export function AdminPage() {
  const [signedIn, setSignedIn] = useState(() => !!adminSession.get());
  return signedIn ? <Dashboard onOut={() => { adminSession.clear(); setSignedIn(false); }} /> : <AdminGate onIn={() => setSignedIn(true)} />;
}

function Dashboard({ onOut }: { onOut: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [branch, setBranch] = useState("ALL");
  const { toast } = useStore();
  const { data: branchList } = useApi("admin-branches", api.admin.branches);
  const branches = (branchList ?? []).map((b) => ({ id: b.id, name: b.name_en }));
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;

  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container">
        <div className="admin-head">
          <div>
            <span className="eyebrow">Super Admin</span>
            <h1 className="display-3">Store dashboard</h1>
            <p style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)", marginTop: 8 }}>
              Signed in as {adminSession.get()?.replace("admin:", "")}.
            </p>
          </div>
          <div className="admin-actions">
            <label className="adm-branch">
              <span className="label">Branch</span>
              <select className="select" value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch filter">
                <option value="ALL">All branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <button className="btn btn-ghost btn-sm" title="Mock data only: remove before going live" onClick={async () => {
              if (!confirm("Reset branches, products and delivery settings to the seed data?")) return;
              try { await api.admin.reset(); toast("Reset to seed data", "success"); } catch (e) { toast(errorsFrom(e).message, "error"); }
            }}><RotateCcw size={14} /> Reset data</button>
            <button className="btn btn-ghost btn-sm" onClick={onOut}><LogOut size={14} /> Sign out</button>
          </div>
        </div>

        <div className="tabs mt-8" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        <BranchFilterCtx.Provider value={{ branch, setBranch }}>
        <div className="mt-8 page-enter" key={tab}>
          {tab === "dashboard" && <AdminDashboard />}
          {tab === "deliveries" && <AdminDeliveries />}
          {tab === "cash" && <AdminCash />}
          {tab === "partners" && <AdminPartners branches={branches} />}
          {tab === "products" && <AdminProducts />}
          {tab === "delivery" && <AdminDelivery />}
          {tab === "audit" && <AdminAudit />}
          {tab === "events" && <AdminEvents />}
          {tab === "orders" && <AdminOrders branchName={branchName} />}
          {tab === "subscriptions" && <AdminSubscriptions branchName={branchName} />}
          {tab === "customers" && <AdminCustomers />}
          {tab === "branches" && <AdminBranches />}
        </div>
        </BranchFilterCtx.Provider>
        <AdminUiStyles />
      </div>
      <style>{`
        .adm-branch { display: flex; flex-direction: column; gap: 4px; }
        .adm-branch .select { min-width: 220px; padding-top: 8px; padding-bottom: 8px; }
        .admin-head { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--sp-4); flex-wrap: wrap; }
        .admin-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4); }
        .admin-stat { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-2); }
        .admin-stat strong { font-family: var(--font-display); font-size: 1.8rem; font-weight: 400; color: var(--accent-gold-bright); }
        .admin-controls { display: flex; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-6); align-items: center; }
        .admin-search { position: relative; flex: 2 1 240px; }
        .admin-search svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-dim); }
        .admin-search .input { padding-left: 40px; }
        .admin-controls .select { flex: 1 1 180px; width: auto; }
        .admin-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-md, 12px); }
        .admin-table { width: 100%; border-collapse: collapse; font-size: var(--font-sm); }
        .admin-table th { text-align: left; padding: var(--sp-3) var(--sp-4); font-size: var(--font-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim); font-weight: 600; background: var(--bg-elevated); white-space: nowrap; }
        .admin-table td { padding: var(--sp-3) var(--sp-4); border-top: 1px solid var(--border); vertical-align: middle; }
        .admin-table tr:hover td { background: var(--bg-glass-light); }
        .admin-thumb { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; }
        .admin-variants { display: flex; flex-wrap: wrap; gap: 6px; }
        .stock-toggle { font-size: var(--font-xs); padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); transition: all var(--t-fast); }
        .stock-toggle.on { border-color: rgba(46, 156, 126,0.45); color: var(--accent-green-bright); }
        .stock-toggle.off { color: #e08c70; border-color: rgba(176,73,47,0.4); text-decoration: line-through; }
        .admin-actions { display: flex; gap: var(--sp-2); justify-content: flex-end; }
        .admin-empty { padding: var(--sp-12); text-align: center; color: var(--text-dim); }
        .admin-form { padding: var(--sp-6) var(--sp-8) var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-4); }
        .admin-variant-row { display: grid; grid-template-columns: 1fr 1fr auto auto; gap: var(--sp-2); align-items: center; }
        .admin-bars { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-5); }
        .admin-bar { display: grid; grid-template-columns: 140px 1fr 40px; gap: var(--sp-3); align-items: center; font-size: var(--font-sm); }
        .admin-bar-track { height: 8px; border-radius: 999px; background: var(--bg-elevated); overflow: hidden; }
        .admin-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent-gold-dim), var(--accent-gold-bright)); border-radius: inherit; transition: width 700ms var(--ease); }
        .adm-hint { font-size: var(--font-xs); color: var(--text-dim); margin: 0 0 12px; }
        .adm-grip { white-space: nowrap; color: var(--text-dim); cursor: grab; }
        .adm-grip svg { display: inline; vertical-align: middle; }
        .adm-icon { padding: 4px; border-radius: 6px; color: var(--text-muted); }
        .adm-icon:hover { background: var(--bg-glass-light); color: var(--text); }
        tr.dragging td { opacity: 0.4; }
        .adm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .adm-chip { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border); font-size: var(--font-sm); }
        .adm-chip.on { background: var(--accent-gold-glow); border-color: var(--border-bright); color: var(--accent-gold-bright); }
        .adm-box { padding: 14px; border: 1px dashed var(--border-strong); border-radius: 12px; gap: 10px; }
        .adm-inline { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .adm-inline .input { flex: 1 1 160px; width: auto; }
        .adm-preview { width: 64px; height: 64px; object-fit: cover; border-radius: 10px; }
        .adm-toggles { display: flex; flex-wrap: wrap; gap: 14px 24px; }
        .adm-toggle { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; font-size: var(--font-sm); position: relative; }
        .adm-toggle input { position: absolute; opacity: 0; pointer-events: none; }
        .adm-toggle-track { width: 38px; height: 22px; border-radius: 999px; background: var(--ink-600); position: relative; transition: background 200ms; flex-shrink: 0; }
        .adm-toggle-track::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--text); transition: transform 200ms; }
        .adm-toggle input:checked + .adm-toggle-track { background: var(--accent-gold); }
        .adm-toggle input:checked + .adm-toggle-track::after { transform: translateX(16px); }
        .adm-toggle input:focus-visible + .adm-toggle-track { outline: 2px solid var(--accent-gold-bright); outline-offset: 2px; }
        .adm-toggle small { display: block; color: var(--text-dim); font-size: var(--font-xs); }
        .adm-slab { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: center; }
        .adm-slab-head { font-size: var(--font-xs); color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
        .adm-preview-list { list-style: none; display: flex; flex-direction: column; }
        .adm-preview-list li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: var(--font-sm); }
        .adm-diff { font-size: 12px; white-space: normal; word-break: break-word; color: var(--text-muted); }
        .admin-two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-6); }
        @media (max-width: 900px) { .admin-stats { grid-template-columns: repeat(2, 1fr); } .admin-two { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .admin-form { padding: var(--sp-5); } .admin-variant-row { grid-template-columns: 1fr 1fr; } .admin-bar { grid-template-columns: 100px 1fr 32px; } }
      `}</style>
    </section>
  );
}
