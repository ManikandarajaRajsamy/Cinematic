import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock, Phone, User, Mail, MessageCircle, ArrowLeft, ShoppingBag } from "lucide-react";
import { useStore } from "@/store/store";
import { auth, whatsappResetUrl, SHOP_PHONE } from "@/api/auth";
import { ApiError } from "@/api/client";

type View = "signin" | "register" | "forgot";
const prettyPhone = (p: string) => `${p.slice(0, 5)} ${p.slice(5)}`;

/** Backdrop video of the pour. Poster until it loads; poster only when the visitor prefers reduced motion. */
function PourVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => { if (!reduced) ref.current?.play().catch(() => { /* poster stays */ }); }, [reduced]);
  if (reduced) return <img className="lg-media" src="/media/pour-poster.jpg" alt="" />;
  return (
    <video ref={ref} className="lg-media" muted playsInline loop autoPlay preload="auto" poster="/media/pour-poster.jpg" aria-hidden="true">
      <source src="/media/pour-slow.webm" type="video/webm" />
      <source src="/media/pour-slow.mp4" type="video/mp4" />
    </video>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="lg-input">
      <Lock size={16} />
      <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder="••••••" />
      <button type="button" className="lg-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
    </div>
  );
}

function MobileInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="lg-input">
      <Phone size={16} />
      <span className="lg-prefix">+91</span>
      <input id={id} inputMode="numeric" autoComplete="tel-national" maxLength={10} value={value} placeholder="98765 43210"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))} />
    </div>
  );
}

export function LoginPage() {
  const { signedIn, toast } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/account";
  const [view, setView] = useState<View>(params.get("view") === "register" ? "register" : "signin");
  const [f, setF] = useState({ name: "", mobile: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errCode, setErrCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const switchView = (v: View) => { setView(v); setErrors({}); setErrCode(undefined); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (view === "register" && !f.name.trim()) er.name = "Enter your full name.";
    if (!/^[6-9]\d{9}$/.test(f.mobile)) er.mobile = "Enter a valid 10-digit mobile number.";
    if (view === "register" && f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) er.email = "Enter a valid email address.";
    if (view === "register" ? f.password.length < 6 : !f.password) er.password = view === "register" ? "Use at least 6 characters." : "Enter your password.";
    setErrors(er); setErrCode(undefined);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const c = view === "register"
        ? await auth.register({ name: f.name.trim(), mobile: f.mobile, email: f.email.trim() || undefined, password: f.password })
        : await auth.signIn(f.mobile, f.password);
      signedIn(c);
      toast(view === "register" ? `Welcome, ${c.name.split(" ")[0]}!` : "Signed in", "success");
      navigate(next, { replace: true });
    } catch (x) {
      const a = x instanceof ApiError ? x : null;
      setErrCode(a?.code);
      setErrors({ ...(a?.fields ?? {}), _: a?.message ?? "Something went wrong. Please try again." });
    } finally { setBusy(false); }
  };

  return (
    <section className="lg">
      <div className="lg-visual">
        <PourVideo />
        <div className="lg-overlay" />
        <div className="lg-brand">
          <Link to="/" aria-label="Sri Sastha Paruthipaal home"><img src="/brand/logo.png" alt="Sri Sastha Paruthipaal logo" /></Link>
          <strong>Sri Sastha Paruthipaal</strong>
          <span>Since 1999 · Madurai</span>
        </div>
      </div>

      <div className="lg-panel">
        <div className="lg-form-wrap">
          {view === "forgot" ? (
            <div className="lg-forgot">
              <button type="button" className="lg-back" onClick={() => switchView("signin")}><ArrowLeft size={15} /> Back to sign in</button>
              <h1 className="lg-title">Forgot password?</h1>
              <p className="lg-lead">To reset your password, contact us from your registered mobile number. We'll send you a reset link on WhatsApp.</p>
              <a className="btn btn-primary btn-lg btn-block" href={whatsappResetUrl()} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp us</a>
              <a className="btn btn-ghost btn-lg btn-block" href={`tel:+91${SHOP_PHONE}`}><Phone size={16} /> Call {prettyPhone(SHOP_PHONE)}</a>
            </div>
          ) : (
            <>
              <div className="lg-toggle" role="tablist" aria-label="Sign in or register">
                <button role="tab" aria-selected={view === "signin"} className={view === "signin" ? "on" : ""} onClick={() => switchView("signin")}>Sign In</button>
                <button role="tab" aria-selected={view === "register"} className={view === "register" ? "on" : ""} onClick={() => switchView("register")}>Register</button>
              </div>
              <h1 className="lg-title">{view === "signin" ? "Welcome back" : "Create your account"}</h1>
              <form className="lg-form" onSubmit={submit} noValidate>
                {view === "register" && (
                  <div className="field">
                    <label className="label" htmlFor="lg-name">Full name</label>
                    <div className="lg-input"><User size={16} /><input id="lg-name" autoComplete="name" value={f.name} onChange={(e) => set("name")(e.target.value)} placeholder="Your name" /></div>
                    {errors.name && <span className="field-error">{errors.name}</span>}
                  </div>
                )}
                <div className="field">
                  <label className="label" htmlFor="lg-mobile">Mobile number</label>
                  <MobileInput id="lg-mobile" value={f.mobile} onChange={set("mobile")} />
                  {errors.mobile && <span className="field-error">{errors.mobile}</span>}
                </div>
                {view === "register" && (
                  <div className="field">
                    <label className="label" htmlFor="lg-email">Email (optional)</label>
                    <div className="lg-input"><Mail size={16} /><input id="lg-email" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email")(e.target.value)} placeholder="you@email.com" /></div>
                    {errors.email && <span className="field-error">{errors.email}</span>}
                  </div>
                )}
                <div className="field">
                  <label className="label" htmlFor="lg-password">Password</label>
                  <PasswordInput id="lg-password" value={f.password} onChange={set("password")} autoComplete={view === "register" ? "new-password" : "current-password"} />
                  {errors.password && <span className="field-error">{errors.password}</span>}
                  {view === "signin" && <button type="button" className="lg-link lg-forgot-link" onClick={() => switchView("forgot")}>Forgot password?</button>}
                </div>
                {errors._ && (
                  <div className="lg-alert" role="alert">
                    {errors._}
                    {errCode === "ALREADY_REGISTERED" && <> <button type="button" className="lg-link" onClick={() => switchView("signin")}>Sign in</button></>}
                    {(errCode === "NO_PASSWORD" || errCode === "LOCKED") && <> <button type="button" className="lg-link" onClick={() => switchView("forgot")}>Forgot password</button></>}
                  </div>
                )}
                <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
                  {busy ? "Please wait…" : view === "signin" ? <>Sign in <ArrowRight size={18} /></> : <>Create account <ArrowRight size={18} /></>}
                </button>
              </form>
            </>
          )}

          <div className="lg-guest">
            <span className="lg-or">or</span>
            <Link to="/products" className="btn btn-ghost btn-lg btn-block"><ShoppingBag size={16} /> Continue without login</Link>
            <p>No account needed to order.</p>
          </div>
        </div>
      </div>

      <style>{`
        .lg { min-height: 100vh; min-height: 100svh; display: grid; grid-template-columns: 55fr 45fr; background: #001A16; position: relative; z-index: 1; }
        .lg-visual { position: relative; overflow: hidden; }
        .lg-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 74% 58%; }
        .lg-overlay { position: absolute; inset: 0; background: rgba(11, 46, 34, 0.6); }
        .lg-brand { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 24px; }
        .lg-brand img { width: 140px; height: auto; filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.5)); }
        .lg-brand strong { font-family: var(--font-display); font-size: clamp(1.6rem, 2.6vw, 2.4rem); font-weight: 500; letter-spacing: -0.03em; color: #FAF7F0; text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5); margin-top: 8px; }
        .lg-brand span { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent-gold-bright); }
        .lg-panel { display: flex; align-items: center; justify-content: center; padding: 48px clamp(20px, 5vw, 72px); background: radial-gradient(80% 60% at 70% 20%, rgba(0, 91, 79, 0.35), transparent 70%), #001A16; }
        .lg-form-wrap { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 20px; }
        .lg-toggle { display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 999px; border: 1px solid var(--border-strong); background: rgba(250, 247, 240, 0.04); }
        .lg-toggle button { padding: 11px; border-radius: 999px; font-weight: 600; font-size: var(--font-sm); color: var(--text-muted); transition: background 250ms, color 250ms; }
        .lg-toggle button.on { background: var(--accent-gold); color: #1d0c00; box-shadow: 0 4px 18px rgba(255, 122, 24, 0.35); }
        .lg-title { font-family: var(--font-display); font-size: clamp(1.8rem, 3vw, 2.4rem); font-weight: 400; letter-spacing: -0.035em; }
        .lg-lead { color: var(--text-muted); line-height: 1.6; }
        .lg-form { display: flex; flex-direction: column; gap: 16px; }
        .lg-input { display: flex; align-items: center; gap: 10px; padding: 0 14px; border-radius: var(--radius-md); border: 1px solid var(--border-strong); background: rgba(0, 36, 31, 0.8); transition: border-color 200ms, box-shadow 200ms; }
        .lg-input:focus-within { border-color: var(--accent-gold); box-shadow: 0 0 0 3px rgba(255, 122, 24, 0.18); }
        .lg-input > svg { color: var(--text-dim); flex-shrink: 0; }
        .lg-input input { flex: 1; min-width: 0; padding: 14px 0; background: none; border: none; color: var(--text); font-size: var(--font-base); }
        .lg-prefix { font-weight: 600; color: var(--text-muted); padding-right: 10px; border-right: 1px solid var(--border-strong); }
        .lg-eye { color: var(--text-dim); padding: 6px; border-radius: 6px; }
        .lg-eye:hover { color: var(--text); }
        .lg-link { color: var(--accent-gold-bright); font-weight: 600; font-size: var(--font-sm); text-decoration: underline; text-underline-offset: 3px; }
        .lg-forgot-link { align-self: flex-end; margin-top: 2px; text-decoration: none; }
        .lg-alert { padding: 12px 14px; border-radius: var(--radius-md); background: rgba(176, 73, 47, 0.16); border: 1px solid rgba(224, 140, 112, 0.45); color: #f1b8a4; font-size: var(--font-sm); line-height: 1.5; }
        .lg-forgot { display: flex; flex-direction: column; gap: 16px; }
        .lg-back { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-sm); color: var(--text-muted); }
        .lg-guest { display: flex; flex-direction: column; gap: 10px; text-align: center; }
        .lg-guest p { font-size: var(--font-xs); color: var(--text-dim); }
        .lg-or { display: flex; align-items: center; gap: 12px; font-size: var(--font-xs); text-transform: uppercase; letter-spacing: 0.14em; color: var(--text-dim); }
        .lg-or::before, .lg-or::after { content: ""; flex: 1; height: 1px; background: var(--border); }
        @media (max-width: 1023px) {
          .lg { grid-template-columns: 1fr; grid-template-rows: 220px auto; }
          .lg-brand { gap: 6px; }
          .lg-brand img { width: 84px; }
          .lg-brand strong { font-size: 1.4rem; margin-top: 2px; }
          .lg-brand span { font-size: 10.5px; }
          .lg-panel { align-items: flex-start; padding: 28px 16px 40px; }
        }
      `}</style>
    </section>
  );
}
