import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Eye, EyeOff, Lock, MessageCircle } from "lucide-react";
import { auth, whatsappResetUrl } from "@/api/auth";
import { ApiError } from "@/api/client";

/** Opened from the one-time link our team sends on WhatsApp. */
export function ResetPasswordPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [hint, setHint] = useState("");
  const [message, setMessage] = useState("");
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    auth.resetInfo(token)
      .then((r) => { setHint(r.mobile_hint); setState("ready"); })
      .catch((e) => { setMessage(e instanceof ApiError ? e.message : "This reset link isn't valid."); setState("invalid"); });
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (pw.password.length < 6) er.password = "Use at least 6 characters.";
    if (pw.password !== pw.confirm) er.confirm = "Passwords don't match.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try { await auth.resetPassword(token, pw.password, pw.confirm); setState("done"); }
    catch (x) {
      if (x instanceof ApiError && x.status === 410) { setMessage(x.message); setState("invalid"); }
      else setErrors({ ...(x instanceof ApiError ? x.fields ?? {} : {}), _: (x as Error).message });
    } finally { setBusy(false); }
  };

  const input = (k: "password" | "confirm", label: string) => (
    <div className="field">
      <label className="label" htmlFor={`rp-${k}`}>{label}</label>
      <div className="lg-input">
        <Lock size={16} />
        <input id={`rp-${k}`} type={show ? "text" : "password"} autoComplete="new-password" value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} />
        {k === "password" && <button type="button" className="lg-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
      </div>
      {errors[k] && <span className="field-error">{errors[k]}</span>}
    </div>
  );

  return (
    <section className="rp">
      <div className="rp-card">
        <Link to="/" className="rp-logo"><img src="/brand/logo.png" alt="Sri Sastha Paruthipaal" /></Link>
        {state === "checking" && <p className="rp-lead">Checking your link…</p>}
        {state === "invalid" && (
          <>
            <h1 className="rp-title">Link not valid</h1>
            <p className="rp-lead">{message}</p>
            <a className="btn btn-primary btn-lg btn-block" href={whatsappResetUrl()} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp us for a new link</a>
          </>
        )}
        {state === "ready" && (
          <form onSubmit={submit} noValidate className="rp-form">
            <h1 className="rp-title">Set a new password</h1>
            <p className="rp-lead">For the account with mobile number {hint}.</p>
            {input("password", "New password")}
            {input("confirm", "Confirm password")}
            {errors._ && <div className="lg-alert">{errors._}</div>}
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
          </form>
        )}
        {state === "done" && (
          <>
            <div className="rp-ok"><Check size={28} /></div>
            <h1 className="rp-title">Password updated. Please sign in.</h1>
            <p className="rp-lead">For your security, you've been signed out on all other devices.</p>
            <Link className="btn btn-primary btn-lg btn-block" to="/login">Sign in</Link>
          </>
        )}
      </div>
      <style>{`
        .rp { min-height: 100vh; min-height: 100svh; display: grid; place-items: center; padding: 24px 16px; background: radial-gradient(70% 50% at 50% 0%, rgba(0, 91, 79, 0.45), transparent 70%), #001A16; position: relative; z-index: 1; }
        .rp-card { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 16px; padding: 32px; border-radius: var(--radius-lg); border: 1px solid var(--border-strong); background: rgba(0, 36, 31, 0.85); box-shadow: var(--shadow-lg); }
        .rp-logo img { width: 84px; margin: 0 auto 4px; }
        .rp-title { font-family: var(--font-display); font-size: 1.9rem; font-weight: 400; letter-spacing: -0.035em; text-align: center; }
        .rp-lead { text-align: center; color: var(--text-muted); }
        .rp-form { display: flex; flex-direction: column; gap: 16px; }
        .rp-ok { width: 60px; height: 60px; margin: 0 auto; border-radius: 50%; display: grid; place-items: center; background: rgba(46, 156, 126, 0.2); color: var(--accent-green-bright); }
        .rp .lg-input { display: flex; align-items: center; gap: 10px; padding: 0 14px; border-radius: var(--radius-md); border: 1px solid var(--border-strong); background: rgba(0, 26, 22, 0.8); }
        .rp .lg-input:focus-within { border-color: var(--accent-gold); box-shadow: 0 0 0 3px rgba(255, 122, 24, 0.18); }
        .rp .lg-input > svg { color: var(--text-dim); }
        .rp .lg-input input { flex: 1; padding: 14px 0; background: none; border: none; color: var(--text); }
        .rp .lg-eye { color: var(--text-dim); padding: 6px; }
        .rp .lg-alert { padding: 12px 14px; border-radius: var(--radius-md); background: rgba(176, 73, 47, 0.16); border: 1px solid rgba(224, 140, 112, 0.45); color: #f1b8a4; font-size: var(--font-sm); }
      `}</style>
    </section>
  );
}
