import { useState } from "react";
import { Phone, Store, Truck, Users, Check, CalendarDays, ArrowRight, Minus, Plus, ReceiptText, Wallet, Clock, PhoneCall, PencilLine, Flame, BadgeIndianRupee } from "lucide-react";
import { api, rupees, ApiError, type EventRequest } from "@/api/client";
import { EVENT_PHONE, EVENT_RATE_PER_LITRE, EVENT_TERMS, EVENT_TYPES, SERVICE_OPTIONS, type ServiceOption } from "@/data/events";
import { nowIST } from "@/api/mockServer";

const SERVICE_ICON: Record<ServiceOption, typeof Store> = { PICKUP: Store, DELIVERY: Truck, LIVE_COUNTER: Users };
const TERM_ICON = [BadgeIndianRupee, Truck, Wallet, ReceiptText, Wallet, Flame, PhoneCall, PencilLine];
const QUICK_LITRES = [5, 10, 25, 50, 100];

function tomorrowIST() {
  const [y, m, d] = nowIST().date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return t.toISOString().slice(0, 10);
}

export function EventsPage() {
  const [litres, setLitres] = useState(10);
  const [service, setService] = useState<ServiceOption>("PICKUP");
  const [form, setForm] = useState({ name: "", phone: "", event_type: EVENT_TYPES[0], event_date: "", event_time: "", venue: "", notes: "" });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<EventRequest | null>(null);

  const option = SERVICE_OPTIONS.find((s) => s.id === service)!;
  const base = Math.round(litres * EVENT_RATE_PER_LITRE);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const changeLitres = (v: number) => setLitres(Math.max(1, Math.min(2000, Math.round(v * 2) / 2 || 1)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) { setErrors({ agree: "Please accept the event order terms" }); return; }
    setSending(true);
    try {
      setDone(await api.requestEvent({ ...form, service, litres }));
      setErrors({});
    } catch (x) {
      setErrors(x instanceof ApiError ? { ...(x.fields ?? {}), _: x.message } : { _: "Something went wrong. Please call us." });
    } finally { setSending(false); }
  };

  return (
    <div className="ev">
      {/* hero */}
      <section className="section-sm ev-hero" style={{ paddingTop: "var(--sp-32)" }}>
        <div className="container">
          <span className="eyebrow">Events &amp; functions</span>
          <h1 className="display-2 mt-4">Paruthippaal for your function.<br /><span className="ev-grey">Hot, fresh, on time.</span></h1>
          <p className="lead mt-6">Weddings, temple functions, festivals and offices. Work out a quote below, then send us a booking request. We call you to confirm.</p>
          <div className="ev-hero-actions mt-8">
            <a href="#quote" className="btn btn-primary btn-lg">Get a quote <ArrowRight size={18} /></a>
            <a href={`tel:${EVENT_PHONE}`} className="btn btn-ghost btn-lg"><Phone size={16} /> Call {EVENT_PHONE}</a>
          </div>
          <div className="ev-rate card">
            <span className="eyebrow">Rate</span>
            <strong>₹{EVENT_RATE_PER_LITRE / 100}</strong>
            <span>per litre</span>
          </div>
        </div>
      </section>

      {/* quote + booking */}
      <section id="quote" className="section-sm">
        <div className="container ev-grid">
          <div className="ev-calc card">
            <div className="ev-card-head"><span className="ev-step">1</span><div><h2 className="title-lg">Quotation</h2><p>Choose the quantity and how you want it served.</p></div></div>

            <div className="field">
              <span className="label">Quantity (litres)</span>
              <div className="ev-qty">
                <button type="button" aria-label="Less" onClick={() => changeLitres(litres - (litres > 10 ? 5 : 1))}><Minus size={18} /></button>
                <input aria-label="Litres" inputMode="decimal" value={litres} onChange={(e) => changeLitres(Number(e.target.value))} />
                <button type="button" aria-label="More" onClick={() => changeLitres(litres + (litres >= 10 ? 5 : 1))}><Plus size={18} /></button>
              </div>
              <div className="ev-quick">
                {QUICK_LITRES.map((q) => <button type="button" key={q} className={litres === q ? "on" : ""} onClick={() => setLitres(q)}>{q} L</button>)}
              </div>
            </div>

            <div className="field">
              <span className="label">Service option</span>
              <div className="ev-options" role="radiogroup" aria-label="Service option">
                {SERVICE_OPTIONS.map((s) => {
                  const Icon = SERVICE_ICON[s.id];
                  return (
                    <button type="button" role="radio" aria-checked={service === s.id} key={s.id} className={`ev-option ${service === s.id ? "on" : ""}`} onClick={() => setService(s.id)}>
                      <Icon size={20} />
                      <strong>{s.title}</strong>
                      <span lang="ta">{s.ta}</span>
                      <small>{s.text}</small>
                      <em>{s.extras.length ? s.extras.join(" + ") : "No extra charges"}</em>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ev-breakdown">
              <div><span>Paruthippaal · {litres} L × ₹{EVENT_RATE_PER_LITRE / 100}</span><strong>{rupees(base)}</strong></div>
              {option.extras.map((x) => <div key={x} className="ev-tbc"><span>{x}</span><span>Confirmed on call</span></div>)}
              <div className="ev-total">
                <span>{option.extras.length ? "Estimate" : "Total"}</span>
                <strong>{rupees(base)}{option.extras.length > 0 && <small> + charges</small>}</strong>
              </div>
              <p className="ev-note"><Wallet size={14} /> Advance at booking confirms the order · balance on the event date · Cash / UPI</p>
            </div>
          </div>

          <div className="ev-book card">
            {done ? (
              <div className="ev-done">
                <div className="ev-done-icon"><Check size={30} /></div>
                <h2 className="title-lg">Request received</h2>
                <p>Reference <strong className="ev-ref">{done.ref}</strong></p>
                <dl className="ev-summary">
                  <div><dt>Event</dt><dd>{done.event_type} · {new Date(done.event_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {done.event_time}</dd></div>
                  <div><dt>Order</dt><dd>{done.litres} L · {SERVICE_OPTIONS.find((s) => s.id === done.service)!.title}</dd></div>
                  <div><dt>Paruthippaal</dt><dd>{rupees(done.base_amount)}{done.service !== "PICKUP" && " + charges confirmed on call"}</dd></div>
                  {done.venue && <div><dt>Venue</dt><dd>{done.venue}</dd></div>}
                </dl>
                <p className="ev-next">We will call you to confirm the order and the advance. We will also contact you a day before the event to confirm the time and details.</p>
                <div className="ev-hero-actions">
                  <a href={`tel:${EVENT_PHONE}`} className="btn btn-primary"><Phone size={16} /> Call {EVENT_PHONE}</a>
                  <button className="btn btn-ghost" onClick={() => { setDone(null); setAgree(false); }}>New request</button>
                </div>
                <p className="ev-demo">Demo: the request is saved in this browser and shown in Admin → Events.</p>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="ev-card-head"><span className="ev-step">2</span><div><h2 className="title-lg">Booking request</h2><p>{litres} L · {option.title} · {rupees(base)}{option.extras.length > 0 && " + charges"}</p></div></div>
                <div className="field-row">
                  <div className="field"><label className="label" htmlFor="ev-name">Your name</label><input id="ev-name" className="input" value={form.name} onChange={set("name")} />{errors.name && <span className="field-error">{errors.name}</span>}</div>
                  <div className="field"><label className="label" htmlFor="ev-phone">Mobile</label><input id="ev-phone" className="input" inputMode="tel" value={form.phone} onChange={set("phone")} />{errors.phone && <span className="field-error">{errors.phone}</span>}</div>
                </div>
                <div className="field mt-4"><label className="label" htmlFor="ev-type">Event type</label>
                  <select id="ev-type" className="select" value={form.event_type} onChange={set("event_type")}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                </div>
                <div className="field-row mt-4">
                  <div className="field"><label className="label" htmlFor="ev-date"><CalendarDays size={12} /> Event date</label><input id="ev-date" type="date" className="input" min={tomorrowIST()} value={form.event_date} onChange={set("event_date")} />{errors.event_date && <span className="field-error">{errors.event_date}</span>}</div>
                  <div className="field"><label className="label" htmlFor="ev-time"><Clock size={12} /> Time needed</label><input id="ev-time" type="time" className="input" value={form.event_time} onChange={set("event_time")} />{errors.event_time && <span className="field-error">{errors.event_time}</span>}</div>
                </div>
                {service !== "PICKUP" && (
                  <div className="field mt-4"><label className="label" htmlFor="ev-venue">Venue address</label><textarea id="ev-venue" className="textarea" style={{ minHeight: 80 }} value={form.venue} onChange={set("venue")} />{errors.venue && <span className="field-error">{errors.venue}</span>}</div>
                )}
                <div className="field mt-4"><label className="label" htmlFor="ev-notes">Notes (optional)</label><textarea id="ev-notes" className="textarea" style={{ minHeight: 80 }} value={form.notes} onChange={set("notes")} placeholder="Number of guests, serving time, anything we should know" /></div>
                <label className="ev-agree mt-4">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>I have read the <a href="#terms">event order terms</a>, including the advance at booking.</span>
                </label>
                {errors.agree && <span className="field-error">{errors.agree}</span>}
                {errors._ && <p className="field-error mt-4">{errors._}</p>}
                <button className="btn btn-primary btn-block btn-lg mt-6" type="submit" disabled={sending}>{sending ? "Sending…" : <>Send booking request <ArrowRight size={18} /></>}</button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* terms */}
      <section id="terms" className="section">
        <div className="container">
          <span className="eyebrow">Event order terms</span>
          <h2 className="display-3 mt-4">Simple, clear terms.</h2>
          <ol className="ev-terms">
            {EVENT_TERMS.map((t, i) => {
              const Icon = TERM_ICON[i] ?? Check;
              return (
                <li key={t.title} className="card">
                  <span className="ev-term-n">{String(i + 1).padStart(2, "0")}</span>
                  <Icon size={22} className="ev-term-icon" />
                  <h3>{t.title}</h3>
                  {i === 1 ? (
                    <div className="ev-term-opts">
                      <p>Please choose one when booking; the final price depends on the option.</p>
                      {SERVICE_OPTIONS.map((s) => <p key={s.id}><strong>{s.title}</strong> — {s.text} {s.extras.length ? `${s.extras.join(" and ")} apply.` : "No extra charges."}</p>)}
                    </div>
                  ) : <p>{t.text}</p>}
                </li>
              );
            })}
          </ol>
          <div className="ev-thanks card">
            <div>
              <strong>Thank you for choosing Sri Sastha Paruthipaal!</strong>
              <span>For any changes or queries, please call us.</span>
            </div>
            <a href={`tel:${EVENT_PHONE}`} className="btn btn-primary btn-lg"><Phone size={16} /> {EVENT_PHONE}</a>
          </div>
        </div>
      </section>

      <style>{`
        .ev-grey { color: var(--text-dim); }
        .ev-hero .container { position: relative; }
        .ev-hero .lead { max-width: 60ch; }
        .ev-hero-actions { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
        .ev-rate { position: absolute; right: var(--sp-6); top: 0; padding: var(--sp-6) var(--sp-8); display: flex; flex-direction: column; align-items: center; gap: 2px; border-color: var(--border-bright); }
        .ev-rate strong { font-family: var(--font-display); font-size: 3.4rem; font-weight: 400; letter-spacing: -0.04em; line-height: 1; color: var(--accent-gold-bright); }
        .ev-rate span:last-child { color: var(--text-muted); font-size: var(--font-sm); }
        .ev-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: var(--sp-6); align-items: start; }
        .ev-calc, .ev-book { padding: var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-6); }
        .ev-book form { display: flex; flex-direction: column; }
        .ev-card-head { display: flex; gap: var(--sp-4); align-items: flex-start; margin-bottom: var(--sp-2); }
        .ev-card-head p { font-size: var(--font-sm); margin-top: 4px; }
        .ev-step { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; font-family: var(--font-mono); font-size: 13px; color: #1d0c00; background: var(--accent-gold); }
        .ev-qty { display: grid; grid-template-columns: 52px 1fr 52px; border: 1px solid var(--border-strong); border-radius: var(--radius-md); overflow: hidden; }
        .ev-qty button { display: grid; place-items: center; background: var(--bg-glass-light); transition: background var(--t-fast); }
        .ev-qty button:hover { background: var(--accent-gold-glow); }
        .ev-qty input { text-align: center; font-family: var(--font-display); font-size: 2rem; letter-spacing: -0.03em; padding: 10px 0; background: transparent; }
        .ev-quick { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .ev-quick button { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--border); font-size: var(--font-sm); transition: all var(--t-fast); }
        .ev-quick button.on, .ev-quick button:hover { border-color: var(--border-bright); color: var(--accent-gold-bright); }
        .ev-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .ev-option { text-align: left; padding: var(--sp-4); border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-glass-light); display: flex; flex-direction: column; gap: 4px; transition: border-color var(--t-fast), background var(--t-fast), transform var(--t-fast); }
        .ev-option svg { color: var(--accent-gold); margin-bottom: 6px; }
        .ev-option strong { font-size: var(--font-md); }
        .ev-option span { font-size: 12px; color: var(--text-dim); }
        .ev-option small { font-size: 13px; color: var(--text-muted); line-height: 1.4; }
        .ev-option em { font-style: normal; font-size: 11px; font-family: var(--font-mono); letter-spacing: 0.04em; color: var(--accent-gold-bright); margin-top: 4px; }
        .ev-option:hover { transform: translateY(-2px); }
        .ev-option.on { border-color: var(--accent-gold); background: rgba(255, 122, 24, 0.08); box-shadow: 0 0 0 1px var(--accent-gold) inset; }
        .ev-breakdown { border-top: 1px dashed var(--border-strong); padding-top: var(--sp-5); display: flex; flex-direction: column; gap: 10px; }
        .ev-breakdown > div { display: flex; justify-content: space-between; gap: 12px; font-size: var(--font-sm); }
        .ev-tbc span:last-child { color: var(--text-dim); font-style: italic; }
        .ev-total { padding-top: 12px; border-top: 1px solid var(--border); align-items: baseline; }
        .ev-total span { font-size: var(--font-md); color: var(--text); }
        .ev-total strong { font-family: var(--font-display); font-size: 2.2rem; font-weight: 400; letter-spacing: -0.03em; color: var(--accent-gold-bright); }
        .ev-total small { font-size: var(--font-sm); color: var(--text-dim); font-family: var(--font-body); }
        .ev-note { display: flex; gap: 8px; align-items: center; font-size: var(--font-xs); color: var(--text-dim); }
        .ev-agree { display: flex; gap: 10px; align-items: flex-start; font-size: var(--font-sm); color: var(--text-muted); cursor: pointer; }
        .ev-agree input { margin-top: 4px; accent-color: var(--accent-gold); }
        .ev-agree a { color: var(--accent-gold-bright); text-decoration: underline; }
        .ev-done { display: flex; flex-direction: column; gap: var(--sp-4); }
        .ev-done-icon { width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; background: rgba(46, 156, 126, 0.2); color: var(--accent-green-bright); animation: scaleIn 500ms var(--ease-spring); }
        .ev-ref { font-family: var(--font-mono); color: var(--accent-gold-bright); letter-spacing: 0.06em; }
        .ev-summary { display: flex; flex-direction: column; border-top: 1px solid var(--border); }
        .ev-summary > div { display: grid; grid-template-columns: 110px 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: var(--font-sm); }
        .ev-summary dt { color: var(--text-dim); }
        .ev-next { font-size: var(--font-sm); }
        .ev-demo { font-size: var(--font-xs); color: var(--text-dim); }
        .ev-terms { list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4); margin-top: var(--sp-10); }
        .ev-terms li { position: relative; padding: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-2); overflow: hidden; }
        .ev-terms li:nth-child(2) { grid-column: span 2; grid-row: span 2; }
        .ev-term-n { position: absolute; top: 10px; right: 16px; font-family: var(--font-display); font-size: 3rem; letter-spacing: -0.05em; color: rgba(250, 247, 240, 0.07); }
        .ev-term-icon { color: var(--accent-gold); }
        .ev-terms h3 { font-size: var(--font-lg); }
        .ev-terms p { font-size: var(--font-sm); line-height: 1.6; }
        .ev-term-opts { display: flex; flex-direction: column; gap: 10px; }
        .ev-term-opts strong { color: var(--accent-gold-bright); }
        .ev-thanks { margin-top: var(--sp-8); padding: var(--sp-6) var(--sp-8); display: flex; justify-content: space-between; align-items: center; gap: var(--sp-4); flex-wrap: wrap; border-color: var(--border-bright); }
        .ev-thanks div { display: flex; flex-direction: column; gap: 4px; }
        .ev-thanks strong { font-family: var(--font-display); font-size: var(--font-lg); font-weight: 500; }
        .ev-thanks span { color: var(--text-muted); font-size: var(--font-sm); }
        @media (max-width: 1000px) { .ev-grid { grid-template-columns: 1fr; } .ev-terms { grid-template-columns: repeat(2, 1fr); } .ev-rate { position: static; margin-top: var(--sp-8); align-items: flex-start; width: fit-content; } }
        @media (max-width: 600px) {
          .ev-calc, .ev-book { padding: var(--sp-5); }
          .ev-options { grid-template-columns: 1fr; }
          .ev-terms { grid-template-columns: 1fr; }
          .ev-terms li:nth-child(2) { grid-column: auto; grid-row: auto; }
          .ev-hero-actions .btn { width: 100%; }
        }
      `}</style>
    </div>
  );
}
