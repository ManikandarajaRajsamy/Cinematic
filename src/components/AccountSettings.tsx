import { useEffect, useState } from "react";
import { User, Lock, Bell, Globe, ShieldCheck, Eye, EyeOff, LogOut, Check } from "lucide-react";
import { auth, type PublicCustomer, type Preferences } from "@/api/auth";
import { ApiError } from "@/api/client";
import { useStore } from "@/store/store";
import { useLang } from "@/i18n";

const fieldErrors = (e: unknown) => (e instanceof ApiError ? { ...(e.fields ?? {}), _: Object.keys(e.fields ?? {}).length ? "" : e.message } : { _: "Something went wrong. Please try again." });

/** A switch row: label, short help text and an on/off toggle. */
function Toggle({ label, help, on, onChange }: { label: string; help: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="as-toggle">
      <span><strong>{label}</strong><small>{help}</small></span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

/**
 * Account settings for a signed-in customer: personal details, password, notification preferences and language,
 * and signing out other devices. The mobile number is the account ID, so it is shown but not editable.
 */
export function AccountSettings() {
  const [customer, setCustomer] = useState<PublicCustomer | null>(null);
  useEffect(() => { auth.current().then(setCustomer); }, []);
  if (!customer) return <div className="skeleton" style={{ height: 420, borderRadius: 16 }} />;
  return <SettingsForms customer={customer} onSaved={setCustomer} />;
}

function SettingsForms({ customer, onSaved }: { customer: PublicCustomer; onSaved: (c: PublicCustomer) => void }) {
  const { signedIn: storeSignedIn, toast } = useStore();
  // keep the app's signed-in state and this screen in step after every save
  const signedIn = (c: PublicCustomer) => { storeSignedIn(c); onSaved(c); };
  const { setLang } = useLang();

  const [details, setDetails] = useState({ name: customer.name, email: customer.email });
  const [dErr, setDErr] = useState<Record<string, string>>({});
  const [dBusy, setDBusy] = useState(false);
  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault(); setDBusy(true); setDErr({});
    try { signedIn(await auth.updateProfile(details)); toast("Your details are saved", "success"); }
    catch (x) { setDErr(fieldErrors(x)); } finally { setDBusy(false); }
  };

  const [pw, setPw] = useState({ current: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [pErr, setPErr] = useState<Record<string, string>>({});
  const [pBusy, setPBusy] = useState(false);
  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setPBusy(true); setPErr({});
    try { signedIn(await auth.changePassword(pw)); setPw({ current: "", password: "", confirm: "" }); toast(customer.has_password ? "Password changed. Other devices are signed out." : "Password set", "success"); }
    catch (x) { setPErr(fieldErrors(x)); } finally { setPBusy(false); }
  };

  const [prefs, setPrefs] = useState<Preferences>(customer.preferences);
  const savePref = async (p: Partial<Preferences>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    if (p.lang) setLang(p.lang);
    try { signedIn(await auth.savePreferences(p)); toast("Preferences saved", "success"); }
    catch (x) { setPrefs(prefs); toast(x instanceof ApiError ? x.message : "Couldn't save", "error"); }
  };

  const signOutOthers = async () => {
    if (!confirm("Sign out of your account on all other phones and computers?")) return;
    try { await auth.signOutOthers(); toast("Signed out of other devices", "success"); }
    catch (x) { toast(x instanceof ApiError ? x.message : "Couldn't sign out other devices", "error"); }
  };

  const pwInput = (k: keyof typeof pw, label: string, auto: string) => (
    <div className="field">
      <label className="label" htmlFor={`as-${k}`}>{label}</label>
      <input id={`as-${k}`} className="input" type={show ? "text" : "password"} autoComplete={auto} value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} />
      {pErr[k] && <span className="field-error">{pErr[k]}</span>}
    </div>
  );

  return (
    <div className="as">
      <section className="card as-sec">
        <header><span className="as-ic"><User size={18} /></span><div><h2>Personal details</h2><p>Used on your orders and delivery updates.</p></div></header>
        <form onSubmit={saveDetails} noValidate className="as-form">
          <div className="field"><label className="label" htmlFor="as-name">Full name</label><input id="as-name" className="input" autoComplete="name" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />{dErr.name && <span className="field-error">{dErr.name}</span>}</div>
          <div className="field"><label className="label" htmlFor="as-email">Email (optional)</label><input id="as-email" className="input" type="email" autoComplete="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} />{dErr.email && <span className="field-error">{dErr.email}</span>}</div>
          <div className="field"><label className="label" htmlFor="as-mob">Mobile number</label><input id="as-mob" className="input" value={`+91 ${customer.mobile}`} readOnly disabled /><small className="as-help">Your mobile number is your account ID. To change it, please call us.</small></div>
          {dErr._ && <span className="field-error">{dErr._}</span>}
          <button className="btn btn-primary" disabled={dBusy || (details.name === customer.name && details.email === customer.email)}>{dBusy ? "Saving…" : <><Check size={15} /> Save details</>}</button>
        </form>
      </section>

      <section className="card as-sec">
        <header><span className="as-ic"><Lock size={18} /></span><div><h2>{customer.has_password ? "Change password" : "Set a password"}</h2><p>{customer.has_password ? "Changing it signs you out on your other devices." : "Set a password to sign in from any device."}</p></div></header>
        <form onSubmit={savePassword} noValidate className="as-form">
          {customer.has_password && pwInput("current", "Current password", "current-password")}
          {pwInput("password", "New password", "new-password")}
          {pwInput("confirm", "Confirm new password", "new-password")}
          <button type="button" className="btn btn-text btn-sm as-show" onClick={() => setShow((s) => !s)}>{show ? <><EyeOff size={14} /> Hide passwords</> : <><Eye size={14} /> Show passwords</>}</button>
          {pErr._ && <span className="field-error">{pErr._}</span>}
          <button className="btn btn-primary" disabled={pBusy || !pw.password}>{pBusy ? "Saving…" : customer.has_password ? "Change password" : "Set password"}</button>
        </form>
      </section>

      <section className="card as-sec">
        <header><span className="as-ic"><Bell size={18} /></span><div><h2>Notifications</h2><p>Choose how we keep you posted.</p></div></header>
        <div className="as-toggles">
          <Toggle label="Order updates by SMS" help="Confirmation, partner details and your delivery OTP" on={prefs.order_updates_sms} onChange={(v) => savePref({ order_updates_sms: v })} />
          <Toggle label="Order updates on WhatsApp" help="The same updates on WhatsApp" on={prefs.order_updates_whatsapp} onChange={(v) => savePref({ order_updates_whatsapp: v })} />
          <Toggle label="Offers by email" help="Festival offers and news, now and then" on={prefs.offers_email} onChange={(v) => savePref({ offers_email: v })} />
        </div>
        <p className="as-help">Delivery OTPs are always sent, so your orders can be handed over safely.</p>
      </section>

      <section className="card as-sec">
        <header><span className="as-ic"><Globe size={18} /></span><div><h2>Language</h2><p>The website's language on all your devices.</p></div></header>
        <div className="as-seg" role="radiogroup" aria-label="Language">
          <button role="radio" aria-checked={prefs.lang === "en"} className={prefs.lang === "en" ? "on" : ""} onClick={() => savePref({ lang: "en" })}>English</button>
          <button role="radio" aria-checked={prefs.lang === "ta"} className={prefs.lang === "ta" ? "on" : ""} onClick={() => savePref({ lang: "ta" })} lang="ta">தமிழ்</button>
        </div>
      </section>

      <section className="card as-sec">
        <header><span className="as-ic"><ShieldCheck size={18} /></span><div><h2>Security</h2><p>Member since {new Date(customer.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}.</p></div></header>
        <button className="btn btn-ghost" onClick={signOutOthers}><LogOut size={15} /> Sign out of all other devices</button>
      </section>

      <style>{`
        .as { display: flex; flex-direction: column; gap: var(--sp-5); }
        .as-sec { padding: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-5); border-radius: 16px; }
        .as-sec header { display: flex; gap: 14px; align-items: flex-start; }
        .as-ic { width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center; background: var(--accent-gold-glow); color: var(--green); }
        .as-sec h2 { font-family: var(--font-body); font-size: 1.1rem; font-weight: 700; }
        .as-sec header p { font-size: var(--font-sm); color: var(--text-dim); }
        .as-form { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); align-items: start; }
        .as-form > .btn, .as-form > .field-error, .as-show { grid-column: 1 / -1; justify-self: start; }
        .as-help { font-size: 12px; color: var(--text-dim); }
        .as-toggles { display: flex; flex-direction: column; }
        .as-toggle { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid var(--border); cursor: pointer; }
        .as-toggle:first-child { border-top: 0; padding-top: 0; }
        .as-toggle span { display: flex; flex-direction: column; gap: 2px; }
        .as-toggle small { font-size: 12px; color: var(--text-dim); }
        .as-toggle input { position: absolute; opacity: 0; pointer-events: none; }
        .as-toggle i { width: 46px; height: 26px; flex-shrink: 0; border-radius: 999px; background: var(--border-strong); position: relative; transition: background 200ms; }
        .as-toggle i::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25); transition: transform 200ms; }
        .as-toggle input:checked + i { background: var(--green); }
        .as-toggle input:checked + i::after { transform: translateX(20px); }
        .as-toggle input:focus-visible + i { outline: 2px solid var(--green); outline-offset: 2px; }
        .as-seg { display: inline-flex; align-self: flex-start; padding: 4px; border: 1px solid var(--border-strong); border-radius: 999px; }
        .as-seg button { padding: 10px 22px; border-radius: 999px; font-weight: 600; font-size: var(--font-sm); color: var(--text-muted); }
        .as-seg button.on { background: var(--green); color: #fff; }
        .as-sec > .btn { align-self: flex-start; }
        @media (max-width: 600px) { .as-sec { padding: var(--sp-5); } .as-form { grid-template-columns: 1fr; } .as-form > .btn { justify-self: stretch; } .as-sec > .btn { align-self: stretch; } }
      `}</style>
    </div>
  );
}
