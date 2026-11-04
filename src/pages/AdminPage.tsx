import { lazy, Suspense, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { ShieldCheck, Lock, Phone, ArrowRight, ClipboardList, CalendarCheck, BarChart3, Eye, EyeOff } from "lucide-react";
import { api, adminSession, ApiError, clearApiCache } from "@/api/client";
import { errorsFrom } from "./admin/shared";


// Super Admin workspace. (There is no Store Manager role; delivery partners use /partner.)


/** Staff sign-in (admins and managers): mobile + password, checked by the server. */
function AdminGate({ onIn }: { onIn: () => void }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) { setErr("Enter your 10-digit mobile number."); return; }
    if (!password) { setErr("Enter your password."); return; }
    setBusy(true); setErr("");
    try { const r = await api.adminLogin(phone, password); adminSession.set(r.token); clearApiCache(); onIn(); }
    catch (x) {
      const e2 = x as ApiError;
      if (e2?.code === "OWNER_SETUP") setSetup(true);
      setErr(errorsFrom(x).message);
    }
    finally { setBusy(false); }
  };
  return (
    <section className="ag">
      <div className="ag-brand">
        <img src="/brand/logo.webp" alt="Sri Sastha Paruthipaal" width={96} />
        <span className="ag-kicker"><ShieldCheck size={14} /> Admin workspace</span>
        <h1>Run the shop from one place.</h1>
        <ul>
          <li><ClipboardList size={16} /> Confirm orders and assign delivery partners</li>
          <li><CalendarCheck size={16} /> Manage daily subscriptions and event orders</li>
          <li><BarChart3 size={16} /> Products, prices, payments and reports</li>
        </ul>
      </div>
      <form className="ag-card" onSubmit={submit} noValidate>
        <div className="ag-head">
          <span className="ag-icon"><Lock size={20} /></span>
          <div><h2>Staff sign-in</h2><p>Admins and managers</p></div>
        </div>
        <label className="label" htmlFor="adm-phone">Mobile number</label>
        <div className={`ag-field ${err ? "bad" : ""}`}>
          <Phone size={18} /><span>+91</span>
          <input id="adm-phone" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10-digit number" autoFocus
            value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} aria-invalid={!!err} aria-describedby={err ? "adm-err" : undefined} />
        </div>
        <label className="label" htmlFor="adm-pass">{setup ? "Choose your password" : "Password"}</label>
        <div className="ag-field">
          <Lock size={18} />
          <input id="adm-pass" type={show ? "text" : "password"} autoComplete={setup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={setup ? "At least 6 characters" : ""} />
          <button type="button" className="ag-eye" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        {err && <span id="adm-err" className="field-error" role="alert">{err}</span>}
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>{busy ? "Signing in…" : <>Continue <ArrowRight size={16} /></>}</button>
        <p className="ag-note"><ShieldCheck size={13} /> Forgot your password? Ask the super admin to set a new one in Team & access.</p>
      </form>
      <style>{`
        /* the sign-in uses the admin theme (indigo, Montserrat) like the workspace behind it */
        .ag { --green: #5B5FEF; --green-deep: #3D40C9; --gold: #FFB547; --accent-gold-glow: rgba(91, 95, 239, 0.12);
          font-family: 'Montserrat', 'DM Sans', system-ui, sans-serif;
          min-height: calc(100vh - 64px); min-height: calc(100svh - 64px); display: grid; grid-template-columns: 1fr 1fr; background: #F4F5F7; }
        .ag :is(h1, h2) { font-family: 'Montserrat', 'DM Sans', system-ui, sans-serif; font-weight: 700; letter-spacing: -0.02em; }
        .ag .btn { border-radius: 10px; text-transform: none; letter-spacing: 0; font-size: 14px; }
        .ag .label { text-transform: none; letter-spacing: 0.02em; font-size: 12.5px; }
        .ag-brand { position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: var(--sp-5); padding: clamp(32px, 6vw, 80px); color: var(--cream);
          background: radial-gradient(120% 80% at 0% 0%, rgba(255, 122, 24, 0.18), transparent 55%), linear-gradient(160deg, var(--green) 0%, var(--green-deep) 100%); }
        .ag-brand img { width: 96px; height: auto; filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.3)); }
        .ag-kicker { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold); }
        .ag-brand h1 { color: #fff; font-size: clamp(2rem, 3.6vw, 3rem); line-height: 1.08; max-width: 14ch; }
        .ag-brand ul { list-style: none; display: flex; flex-direction: column; gap: 12px; }
        .ag-brand li { display: flex; align-items: center; gap: 10px; font-size: var(--font-sm); color: rgba(250, 247, 240, 0.88); }
        .ag-brand li svg { color: var(--gold); flex-shrink: 0; }
        .ag-card { position: relative; z-index: 2; align-self: center; justify-self: center; width: min(420px, calc(100% - 32px)); margin: 32px 0; padding: 32px; border-radius: 22px; background: #fff; box-shadow: 0 30px 70px rgba(41, 41, 35, 0.14); display: flex; flex-direction: column; gap: 12px; }
        .ag-head { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
        .ag-icon { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; background: var(--accent-gold-glow); color: var(--green); }
        .ag-head h2 { font-size: 1.45rem; line-height: 1.15; }
        .ag-head p { font-size: var(--font-sm); color: var(--text-dim); }
        .ag-field { display: flex; align-items: center; gap: 10px; min-height: 54px; padding: 0 16px; border: 1.5px solid var(--border-strong); border-radius: 14px; transition: border-color var(--t-fast), box-shadow var(--t-fast); }
        .ag-field:focus-within { border-color: var(--green); box-shadow: 0 0 0 4px var(--accent-gold-glow); }
        .ag-field.bad { border-color: var(--error); }
        .ag-field svg { color: var(--text-dim); flex-shrink: 0; }
        .ag-field span { font-weight: 600; color: var(--text-muted); }
        .ag-field input { flex: 1; min-width: 0; height: 52px; font-size: 17px; letter-spacing: 0.04em; }
        .ag-card .btn { margin-top: 8px; border-radius: 14px; }
        .ag-eye { padding: 6px; color: var(--text-dim); flex-shrink: 0; }
        .ag-note { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; color: var(--text-dim); margin-top: 4px; }
        .ag-note svg { flex-shrink: 0; margin-top: 1px; }
        @media (max-width: 860px) {
          .ag { grid-template-columns: 1fr; align-content: start; }
          .ag-brand { padding: 28px 20px 76px; gap: var(--sp-3); align-items: flex-start; }
          .ag-brand img { width: 72px; }
          .ag-brand h1 { font-size: 1.55rem; }
          .ag-brand ul { display: none; }
          .ag-card { margin: -52px auto 24px; padding: 24px 20px; width: calc(100% - 32px); }
        }
      `}</style>
    </section>
  );
}

// the workspace (every admin screen) is a separate download, fetched only once signed in
const Dashboard = lazy(() => import("./admin/Workspace").then((m) => ({ default: m.Dashboard })));

export function AdminPage() {
  const [signedIn, setSignedIn] = useState(() => !!adminSession.get());
  // the admin workspace stands alone: no customer header, footer or links into the shop
  return (
    <div className="adm-shell">
      {!signedIn && <header className="adm-bar">
        <div className="container adm-bar-in">
          <BrandLogo size={44} />
          <span className="adm-bar-tag"><ShieldCheck size={14} /> Admin</span>
        </div>
      </header>}
      {signedIn ? <Suspense fallback={<div className="adm-loading" role="status" aria-label="Loading the workspace" />}><Dashboard onOut={() => { adminSession.clear(); clearApiCache(); setSignedIn(false); }} /></Suspense> : <AdminGate onIn={() => setSignedIn(true)} />}
      <style>{`
        .adm-loading { min-height: 100vh; background: #F4F5F7; }
        .adm-shell { min-height: 100vh; min-height: 100svh; background: var(--bg); }
        .adm-bar { position: sticky; top: 0; z-index: 50; background: #2E3192; color: #fff; font-family: 'Montserrat', 'DM Sans', system-ui, sans-serif; }
        .adm-bar-in { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-4); padding-block: 10px; }
        .adm-bar .brand-l2 { color: var(--gold); }
        .adm-bar-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold); }
      `}</style>
    </div>
  );
}

