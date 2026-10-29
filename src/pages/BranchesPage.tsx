import { MapPin, Truck, Clock } from "lucide-react";
import { BRANCHES } from "@/data/catalog";
import { useReveal } from "@/hooks/useReveal";

export function BranchesPage() {
  const r = useReveal();
  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container">
        <div className="sec-head center" style={{ alignItems: "center" }}>
          <span className="eyebrow center">Branches &amp; Delivery</span>
          <h1 className="display-2">Find us in Madurai</h1>
          <p className="lead" style={{ marginInline: "auto" }}>
            <Truck size={16} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
            Current delivery coverage: <strong style={{ color: "var(--accent-gold-bright)" }}>Madurai district only.</strong> We may expand to other cities in the future.
          </p>
        </div>

        <div className={`branches-grid-page reveal-stagger ${r.inView ? "in" : ""}`} ref={r.ref as React.RefObject<HTMLDivElement>}>
          {BRANCHES.map((b) => (
            <div className="branch-page-card card card-hover" key={b.id}>
              <div className="branch-page-media">
                <img src={b.image} alt={b.name} loading="lazy" />
                <span className="badge badge-gold branch-page-pin"><MapPin size={12} /> {b.area}</span>
              </div>
              <div className="branch-page-body">
                <h3 className="title-md">{b.name}</h3>
                <p style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)", marginTop: 8 }}>{b.note}</p>
                <div className="branch-page-meta">
                  <span className="badge"><Clock size={12} /> Visit during business hours</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="branch-coverage mt-16">
          <h2 className="title-xl mb-4">Delivery coverage</h2>
          <p className="lead">We deliver within the Madurai district only. During checkout, the address you select is checked against the district to confirm eligibility.</p>
          <p style={{ marginTop: 16, fontSize: "var(--font-sm)", color: "var(--text-dim)" }}>
            We have not listed specific street addresses, phone numbers, or opening hours, as these details are not verified for this prototype. Visit any branch in person for current timings.
          </p>
        </div>
      </div>
      <style>{`
        .branches-grid-page { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-6); }
        .branch-page-card { display: flex; flex-direction: column; }
        .branch-page-media { position: relative; aspect-ratio: 16/10; overflow: hidden; }
        .branch-page-media img { width: 100%; height: 100%; object-fit: cover; transition: transform 800ms var(--ease); }
        .branch-page-card:hover .branch-page-media img { transform: scale(1.05); }
        .branch-page-pin { position: absolute; top: var(--sp-3); left: var(--sp-3); background: var(--bg-glass); }
        .branch-page-body { padding: var(--sp-5); }
        .branch-page-meta { margin-top: var(--sp-3); }
        @media (max-width: 800px) { .branches-grid-page { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
