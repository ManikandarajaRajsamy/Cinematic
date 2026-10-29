import { useState } from "react";
import { Search, Calendar, MapPin, Users, Send, X, Check } from "lucide-react";
import { DEMO_EVENTS, DemoEvent } from "@/data/catalog";
import { Modal } from "@/components/Modal";
import { useStore } from "@/store/store";
import { useReveal } from "@/hooks/useReveal";

const CATS = [
  { id: "all", label: "All" },
  { id: "festival", label: "Festivals" },
  { id: "pop-up", label: "Pop-ups" },
  { id: "tasting", label: "Tastings" },
  { id: "workshop", label: "Workshops" },
];

export function EventsPage() {
  const { toast } = useStore();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [selected, setSelected] = useState<DemoEvent | null>(null);
  const [regForm, setRegForm] = useState({ name: "", email: "", phone: "", guests: "1" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registered, setRegistered] = useState(false);
  const r = useReveal();

  const filtered = DEMO_EVENTS.filter((e) =>
    (cat === "all" || e.category === cat) &&
    (!query || e.title.toLowerCase().includes(query.toLowerCase()))
  );

  const register = (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!regForm.name.trim()) err.name = "Name required";
    if (!regForm.email.trim()) err.email = "Email required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regForm.email)) err.email = "Valid email required";
    if (!regForm.phone.trim()) err.phone = "Phone required";
    setErrors(err);
    if (Object.keys(err).length) return;
    setRegistered(true);
    toast("Registration confirmed (demo)", "success");
  };

  const openEvent = (ev: DemoEvent) => { setSelected(ev); setRegForm({ name: "", email: "", phone: "", guests: "1" }); setErrors({}); setRegistered(false); };

  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container">
        <div className="sec-head center" style={{ alignItems: "center" }}>
          <span className="eyebrow center">Events</span>
          <h1 className="display-2">Festivals, tastings,<br />and workshops.</h1>
          <p className="lead" style={{ marginInline: "auto" }}>Demonstration event listings. Registrations are simulated — no data leaves your browser.</p>
        </div>

        <div className="events-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events…" />
            {query && <button onClick={() => setQuery("")}><X size={16} /></button>}
          </div>
          <div className="tabs">
            {CATS.map((c) => <button key={c.id} className={`tab ${cat === c.id ? "active" : ""}`} onClick={() => setCat(c.id)}>{c.label}</button>)}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state"><Calendar size={48} /><h3>No events found</h3><p>Try a different search or filter.</p></div>
        ) : (
          <div className={`events-grid reveal-stagger ${r.inView ? "in" : ""}`} ref={r.ref as React.RefObject<HTMLDivElement>}>
            {filtered.map((ev) => (
              <article className="event-card card card-hover" key={ev.id} onClick={() => openEvent(ev)} role="button">
                <div className="event-media">
                  <img src={ev.image} alt={ev.title} loading="lazy" />
                  <span className="badge badge-gold event-cat">{ev.category}</span>
                </div>
                <div className="event-body">
                  <div className="event-date"><Calendar size={14} /> {new Date(ev.date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}</div>
                  <h3 className="title-md mt-2">{ev.title}</h3>
                  <div className="event-loc"><MapPin size={14} /> {ev.location}</div>
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)", marginTop: 8 }}>{ev.description.slice(0, 80)}…</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title} maxWidth={580}>
        {selected && (
          <div style={{ padding: "0 32px 32px" }}>
            <img src={selected.image} alt={selected.title} style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: "var(--radius-md)", marginBottom: 20 }} />
            <div className="flex gap-4 mb-4" style={{ fontSize: "var(--font-sm)", color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(selected.date).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}</span>
              <span className="flex items-center gap-1"><MapPin size={14} /> {selected.location}</span>
            </div>
            <p style={{ marginBottom: 24, lineHeight: 1.7 }}>{selected.description}</p>

            {registered ? (
              <div className="reg-success"><Check size={40} /><h3>Registered!</h3><p>You're registered for <strong>{selected.title}</strong>. This is a demo confirmation — no email was sent.</p></div>
            ) : (
              <form onSubmit={register} className="reg-form" noValidate>
                <h3 className="title-md mb-4">Register for this event</h3>
                <div className="field mb-4"><label className="label">Name</label><input className="input" value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} />{errors.name && <span className="field-error">{errors.name}</span>}</div>
                <div className="field-row mb-4">
                  <div className="field"><label className="label">Email</label><input className="input" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} />{errors.email && <span className="field-error">{errors.email}</span>}</div>
                  <div className="field"><label className="label">Phone</label><input className="input" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} />{errors.phone && <span className="field-error">{errors.phone}</span>}</div>
                </div>
                <div className="field mb-4"><label className="label">Number of guests</label><input className="input" type="number" min="1" value={regForm.guests} onChange={(e) => setRegForm({ ...regForm, guests: e.target.value })} /></div>
                <button type="submit" className="btn btn-primary btn-block btn-lg"><Send size={16} /> Register</button>
                <p style={{ fontSize: "var(--font-xs)", color: "var(--text-dim)", textAlign: "center", marginTop: 8 }}>Demo registration — no data leaves your browser.</p>
              </form>
            )}
          </div>
        )}
      </Modal>

      <style>{`
        .events-toolbar { display: flex; flex-direction: column; gap: var(--sp-4); margin-bottom: var(--sp-8); }
        .events-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--sp-6); }
        .event-card { cursor: pointer; display: flex; flex-direction: column; }
        .event-media { position: relative; aspect-ratio: 16/10; overflow: hidden; }
        .event-media img { width: 100%; height: 100%; object-fit: cover; transition: transform 800ms var(--ease); }
        .event-card:hover .event-media img { transform: scale(1.05); }
        .event-cat { position: absolute; top: var(--sp-3); left: var(--sp-3); }
        .event-body { padding: var(--sp-5); }
        .event-date, .event-loc { display: flex; align-items: center; gap: 6px; font-size: var(--font-xs); color: var(--text-dim); }
        .reg-form { display: flex; flex-direction: column; }
        .reg-success { text-align: center; padding: var(--sp-8); color: var(--accent-green-bright); }
        .reg-success h3, .reg-success p { color: var(--text); margin-top: 8px; }
        .search-field { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--border); border-radius: var(--radius-pill); background: var(--bg-elevated); max-width: 420px; }
        .search-field input { flex: 1; background: none; border: none; color: var(--text); }
        .empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-20); text-align: center; color: var(--text-dim); border: 1px dashed var(--border); border-radius: var(--radius-lg); }
      `}</style>
    </section>
  );
}
