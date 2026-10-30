import { useState } from "react";
import { Mail, MapPin, Send, Gift, Phone } from "lucide-react";
import { useStore } from "@/store/store";

interface Form { name: string; email: string; phone: string; topic: string; message: string }
const EMPTY: Form = { name: "", email: "", phone: "", topic: "order", message: "" };

const REFERRAL_STEPS = [
  "Send us your name and mobile number using this form.",
  "Share the customer's details, or ask them to mention your name when they call us.",
  "Once their order is confirmed, you get a referral bonus.",
];
const REFERRAL_PLACEHOLDER = "Share your mobile number and the details of the order you are referring: customer name, contact number, event date and number of guests (if known).";

export function ContactPage() {
  const { toast } = useStore();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [sent, setSent] = useState(false);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Please enter your name.";
    const referral = form.topic === "referral";
    // referrals need a mobile number (that is how the bonus is arranged); email is optional for them
    if (referral && !/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, "").slice(-10))) next.phone = "Enter your 10-digit mobile number.";
    if ((!referral || form.email) && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.message.trim().length < 10) next.message = "Message should be at least 10 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSent(true);
    setForm(EMPTY);
    toast(form.topic === "referral" ? "Referral received — we'll contact you about the bonus." : "Message sent — we'll get back to you soon.", "success");
  };

  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container contact-grid">
        <div>
          <span className="eyebrow">Contact</span>
          <h1 className="display-2">We'd love to hear from you</h1>
          <p className="lead" style={{ marginTop: 16 }}>Questions about an order, a subscription, or an event booking? Send us a note.</p>
          <div className="contact-info">
            <span className="badge"><MapPin size={12} /> Madurai district</span>
            <span className="badge"><Mail size={12} /> Replies within 1–2 business days</span>
          </div>
        </div>

        <form className="card contact-form" onSubmit={submit} noValidate>
          {sent && <p className="badge badge-gold">Thanks! Your message was received (demo only).</p>}
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="c-name">Name</label>
              <input id="c-name" className="input" value={form.name} onChange={set("name")} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
            <div className="field">
              <label className="label" htmlFor="c-email">Email</label>
              <input id="c-email" type="email" className="input" value={form.email} onChange={set("email")} />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="c-topic">Topic</label>
            <select id="c-topic" className="select" value={form.topic} onChange={set("topic")}>
              <option value="order">Order &amp; delivery</option>
              <option value="subscription">Subscriptions</option>
              <option value="events">Events &amp; bulk orders</option>
              <option value="referral">Refer &amp; Earn</option>
              <option value="other">Something else</option>
            </select>
          </div>
          {form.topic === "referral" && (
            <div className="refer-note" role="note">
              <div className="refer-head"><Gift size={18} /><strong>Refer &amp; Earn with Sri Sastha Paruthipaal</strong></div>
              <p>Know someone planning a wedding, function, pooja, temple festival or office event? Recommend us and earn a referral bonus.</p>
              <span className="refer-label">How it works</span>
              <ol>{REFERRAL_STEPS.map((s, i) => <li key={i}><span>{i + 1}</span>{s}</li>)}</ol>
              <p className="refer-who">Anyone can refer: friends, family, regular customers, event managers or hall owners.</p>
              <p className="refer-fine">Bonus details will be shared when we contact you.</p>
            </div>
          )}
          {form.topic === "referral" && (
            <div className="field">
              <label className="label" htmlFor="c-phone"><Phone size={12} /> Your mobile number</label>
              <input id="c-phone" className="input" inputMode="tel" value={form.phone} onChange={set("phone")} />
              {errors.phone && <span className="field-error">{errors.phone}</span>}
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="c-msg">Message</label>
            <textarea id="c-msg" className="textarea" value={form.message} onChange={set("message")}
              placeholder={form.topic === "referral" ? REFERRAL_PLACEHOLDER : undefined} />
            {errors.message && <span className="field-error">{errors.message}</span>}
          </div>
          <button className="btn btn-primary btn-block" type="submit"><Send size={16} /> Send message</button>
        </form>
      </div>
      <style>{`
        .refer-note { padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-bright); background: linear-gradient(150deg, rgba(255, 122, 24, 0.12), rgba(0, 26, 22, 0.4)); display: flex; flex-direction: column; gap: 10px; animation: fadeInUp 400ms var(--ease); }
        .refer-head { display: flex; align-items: center; gap: 10px; color: var(--accent-gold-bright); }
        .refer-head strong { font-family: var(--font-display); font-size: 1.15rem; font-weight: 500; color: var(--text); }
        .refer-note p { font-size: var(--font-sm); }
        .refer-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); }
        .refer-note ol { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .refer-note li { display: flex; gap: 10px; align-items: flex-start; font-size: var(--font-sm); color: var(--text-muted); }
        .refer-note li span { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; font-family: var(--font-mono); font-size: 11px; color: #1d0c00; background: var(--accent-gold); }
        .refer-who { color: var(--text) !important; }
        .refer-fine { font-size: var(--font-xs) !important; color: var(--text-dim) !important; }
        .contact-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: var(--sp-12); align-items: start; }
        .contact-info { display: flex; flex-wrap: wrap; gap: var(--sp-3); margin-top: var(--sp-6); }
        .contact-form { padding: var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-5); }
        @media (max-width: 800px) { .contact-grid { grid-template-columns: 1fr; } .contact-form { padding: var(--sp-5); } }
      `}</style>
    </section>
  );
}
