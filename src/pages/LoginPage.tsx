import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Mail, Lock, User, Phone, Check } from "lucide-react";
import { useStore } from "@/store/store";

type Mode = "login" | "register" | "forgot";

export function LoginPage() {
  const { login, register, toast } = useStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [forgotSent, setForgotSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (mode === "register" && !form.name.trim()) err.name = "Name is required";
    if (!form.email.trim()) err.email = "Email or phone is required";
    else if (mode !== "forgot" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && !/^[0-9+\-\s]{8,}$/.test(form.email)) err.email = "Enter a valid email or phone";
    if (mode !== "forgot" && !form.password) err.password = "Password is required";
    else if (mode === "register" && form.password.length < 4) err.password = "Use at least 4 characters";
    if (mode === "register" && form.phone && !/^[0-9+\-\s]{8,}$/.test(form.phone)) err.phone = "Enter a valid phone";
    setErrors(err);
    if (Object.keys(err).length) return;

    if (mode === "forgot") { setForgotSent(true); toast("Demo reset link sent (simulated)", "success"); return; }
    if (mode === "register") { register(form.name, form.email, form.phone); toast("Account created — signed in (demo)", "success"); }
    else { login(form.email, form.name); toast("Signed in (demo)", "success"); }
    navigate("/account");
  };

  return (
    <section className="auth-page">
      <div className="auth-aside">
        <div className="auth-aside-inner">
          <Link to="/" className="auth-logo">
            <svg width="40" height="40" viewBox="0 0 64 64">
              <rect width="64" height="64" rx="14" fill="rgba(0,0,0,0.3)" />
              <path d="M32 12 C 24 16, 20 24, 20 32 C 20 42, 28 50, 32 52 C 36 50, 44 42, 44 32 C 44 24, 40 16, 32 12 Z" fill="none" stroke="#c9a227" strokeWidth="2.5" strokeLinejoin="round" />
              <circle cx="32" cy="30" r="5" fill="#e8c84e" />
              <path d="M32 38 v 8" stroke="#c9a227" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>Sri Sastha Paruthipaal</span>
          </Link>
          <div className="auth-aside-content">
            <h1 className="display-2">The sweet<br /><em style={{ color: "var(--accent-gold-bright)", fontStyle: "italic" }}>of Madurai.</em></h1>
            <p className="lead mt-6">Sign in to save addresses, track your demo orders, and manage subscriptions. This is a frontend simulation — no real credentials are stored.</p>
            <div className="auth-aside-features">
              <div><Check size={14} /> Local demo account only</div>
              <div><Check size={14} /> No real password storage</div>
              <div><Check size={14} /> Data stays in your browser</div>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-main">
        <div className="auth-form-wrap">
          <div className="auth-tabs">
            <button className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setErrors({}); setForgotSent(false); }}>Sign In</button>
            <button className={`auth-tab ${mode === "register" ? "active" : ""}`} onClick={() => { setMode("register"); setErrors({}); setForgotSent(false); }}>Register</button>
          </div>

          {forgotSent ? (
            <div className="auth-success">
              <Check size={48} />
              <h2 className="title-lg mt-4">Check your inbox</h2>
              <p className="mt-2">A demo reset link has been simulated. No email was actually sent.</p>
              <button className="btn btn-ghost mt-6" onClick={() => { setMode("login"); setForgotSent(false); }}>Back to sign in</button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit} noValidate>
              {mode === "register" && (
                <div className="auth-field">
                  <label className="label">Full name</label>
                  <div className="auth-input-wrap"><User size={16} /><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></div>
                  {errors.name && <span className="field-error">{errors.name}</span>}
                </div>
              )}
              <div className="auth-field">
                <label className="label">{mode === "forgot" ? "Email or phone" : "Email or phone"}</label>
                <div className="auth-input-wrap"><Mail size={16} /><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" /></div>
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>
              {mode === "register" && (
                <div className="auth-field">
                  <label className="label">Phone (optional)</label>
                  <div className="auth-input-wrap"><Phone size={16} /><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" /></div>
                  {errors.phone && <span className="field-error">{errors.phone}</span>}
                </div>
              )}
              {mode !== "forgot" && (
                <div className="auth-field">
                  <label className="label">Password</label>
                  <div className="auth-input-wrap">
                    <Lock size={16} />
                    <input className="input" type={showPass ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" />
                    <button type="button" onClick={() => setShowPass(!showPass)} aria-label="Toggle password visibility">{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                  {errors.password && <span className="field-error">{errors.password}</span>}
                </div>
              )}

              {mode === "login" && (
                <div className="auth-row">
                  <label className="auth-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> <span>Remember me</span></label>
                  <button type="button" className="btn btn-text btn-sm" onClick={() => { setMode("forgot"); setErrors({}); }}>Forgot password?</button>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-block btn-lg mt-2">
                {mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"} <ArrowRight size={18} />
              </button>
              <p className="auth-demo-note">Demo authentication — no real credentials are stored or transmitted.</p>
            </form>
          )}
        </div>
      </div>
      <style>{`
        .auth-page { display: grid; grid-template-columns: 1fr 1fr; min-height: 100vh; }
        .auth-aside { position: relative; background: var(--ink-950); overflow: hidden; display: flex; align-items: center; }
        .auth-aside::before { content: ''; position: absolute; inset: 0; background: url("https://images.pexels.com/photos/6460395/pexels-photo-6460395.jpeg?auto=compress&cs=tinysrgb&w=1200") center/cover; opacity: 0.2; }
        .auth-aside::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 70% 30%, var(--accent-gold-glow), transparent 60%); }
        .auth-aside-inner { position: relative; z-index: 2; padding: var(--sp-16); width: 100%; }
        .auth-logo { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-16); }
        .auth-logo span { font-family: var(--font-display); font-size: 1.1rem; color: var(--text); }
        .auth-aside-content { max-width: 420px; }
        .auth-aside-features { margin-top: var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-3); }
        .auth-aside-features div { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--font-sm); color: var(--text-muted); }
        .auth-aside-features svg { color: var(--accent-gold); }
        .auth-main { display: flex; align-items: center; justify-content: center; padding: var(--sp-12); background: var(--bg); }
        .auth-form-wrap { width: 100%; max-width: 420px; }
        .auth-tabs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-8); padding: 4px; border-radius: var(--radius-pill); background: var(--bg-elevated); border: 1px solid var(--border); }
        .auth-tab { flex: 1; padding: var(--sp-3); border-radius: var(--radius-pill); font-size: var(--font-sm); font-weight: 600; color: var(--text-muted); transition: all var(--t-fast); }
        .auth-tab.active { background: var(--accent-gold); color: var(--ink-950); }
        .auth-form, .auth-success { display: flex; flex-direction: column; gap: var(--sp-4); }
        .auth-field { display: flex; flex-direction: column; gap: var(--sp-2); }
        .auth-input-wrap { display: flex; align-items: center; gap: var(--sp-3); padding: 0 var(--sp-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-elevated); }
        .auth-input-wrap .input { border: none; background: none; padding: var(--sp-3) 0; }
        .auth-input-wrap svg { color: var(--text-dim); flex-shrink: 0; }
        .auth-input-wrap button { color: var(--text-dim); padding: 8px; }
        .auth-row { display: flex; justify-content: space-between; align-items: center; }
        .auth-check { display: flex; align-items: center; gap: 8px; font-size: var(--font-sm); color: var(--text-muted); cursor: pointer; }
        .auth-check input { accent-color: var(--accent-gold); }
        .auth-demo-note { font-size: var(--font-xs); color: var(--text-dim); text-align: center; margin-top: var(--sp-2); }
        .auth-success { text-align: center; align-items: center; padding: var(--sp-12) 0; color: var(--accent-gold-bright); }
        .auth-success h2, .auth-success p { color: var(--text); }
        @media (max-width: 800px) { .auth-page { grid-template-columns: 1fr; } .auth-aside { display: none; } }
      `}</style>
    </section>
  );
}
