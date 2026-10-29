import { useState } from "react";
import { Shield, Truck, Ban, RefreshCw, Lock, FileText } from "lucide-react";
import { POLICIES } from "@/data/catalog";

const ICONS: Record<string, typeof Shield> = {
  delivery: Truck,
  cancellation: Ban,
  refund: RefreshCw,
  privacy: Lock,
  terms: FileText,
};

export function PoliciesPage() {
  const [active, setActive] = useState(POLICIES[0].id);
  const current = POLICIES.find((p) => p.id === active)!;

  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container">
        <div className="sec-head">
          <span className="eyebrow">Policy Centre</span>
          <h1 className="display-2">Policies</h1>
          <p className="lead">Demonstration policy text. Clearly marked for review — not final legal content.</p>
        </div>

        <div className="policy-layout">
          <aside className="policy-nav">
            {POLICIES.map((p) => {
              const Icon = ICONS[p.id];
              return (
                <button key={p.id} className={`policy-nav-item ${active === p.id ? "active" : ""}`} onClick={() => setActive(p.id)}>
                  <Icon size={16} /> {p.title}
                </button>
              );
            })}
          </aside>
          <div className="policy-content card">
            <h2 className="title-lg mb-6">{current.title}</h2>
            {current.body.map((para, i) => (
              <p key={i} className="policy-para">{para}</p>
            ))}
            <div className="policy-review-note">
              This is placeholder policy text for review. It should not be treated as final legal content.
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .policy-layout { display: grid; grid-template-columns: 240px 1fr; gap: var(--sp-8); align-items: start; }
        .policy-nav { position: sticky; top: calc(var(--nav-h) + 16px); display: flex; flex-direction: column; gap: 2px; }
        .policy-nav-item { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-radius: var(--radius-sm); color: var(--text-muted); font-size: var(--font-sm); font-weight: 500; transition: all var(--t-fast); text-align: left; }
        .policy-nav-item:hover { background: var(--bg-glass-light); color: var(--text); }
        .policy-nav-item.active { background: var(--accent-gold-glow); color: var(--accent-gold-bright); }
        .policy-content { padding: var(--sp-8); }
        .policy-para { line-height: 1.8; margin-bottom: var(--sp-4); color: var(--text-muted); }
        .policy-review-note { margin-top: var(--sp-6); padding: var(--sp-4); border: 1px dashed var(--border-strong); border-radius: var(--radius-sm); font-size: var(--font-xs); color: var(--text-dim); }
        @media (max-width: 800px) { .policy-layout { grid-template-columns: 1fr; } .policy-nav { position: static; flex-direction: row; flex-wrap: wrap; } .policy-nav-item { flex: 1; min-width: 120px; justify-content: center; } }
      `}</style>
    </section>
  );
}
