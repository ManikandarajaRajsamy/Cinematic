import { MapPin, Truck, Clock, Navigation } from "lucide-react";
import { PhoneLinks } from "@/components/PhoneLinks";
import { DeliveryRules } from "@/components/DeliveryRules";
import { usePublicBranches, useDeliverySettings } from "@/api/client";
import { branchStatus, daysText, directionsUrl, hoursText } from "@/api/branchStatus";
import { useReveal } from "@/hooks/useReveal";

export function BranchesPage() {
  const r = useReveal();
  const { data: branches = [], loading, error } = usePublicBranches();
  const { data: settings } = useDeliverySettings();
  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container">
        <div className="sec-head center" style={{ alignItems: "center" }}>
          <span className="eyebrow center">Branches &amp; Delivery</span>
          <h1 className="display-2">Find us in Madurai</h1>
          {settings && (
            <p className="lead" style={{ marginInline: "auto" }}>
              <Truck size={16} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
              <strong style={{ color: "var(--accent-gold-bright)" }}>Free delivery within {settings.free_radius_km} km</strong> of our dispatch branch.
              We deliver up to {settings.max_radius_km} km in {settings.district_restriction} district; the fee for your address is shown at checkout.
            </p>
          )}
        </div>

        {loading && <p className="lead" style={{ textAlign: "center" }}>Loading branches…</p>}
        {error && <p className="lead" style={{ textAlign: "center" }}>We couldn't load the branch list. Visit our main shop near Periyar Bus Stand, Madurai.</p>}

        <div className="branches-rules card"><h2 className="title-lg">Delivery charges</h2><DeliveryRules /></div>

        <div className={`branches-grid-page reveal-stagger ${r.inView ? "in" : ""}`} ref={r.ref as React.RefObject<HTMLDivElement>}>
          {branches.map((b) => {
            const status = branchStatus(b, b.holidays);
            const hours = hoursText(b);
            const dir = directionsUrl(b);
            return (
              <div className="branch-page-card card card-hover" key={b.id}>
                <div className="branch-page-media">
                  <img src={b.photo_url || "/media/closeup.webp"} alt="" loading="lazy" style={b.photo_url ? undefined : { opacity: 0.45 }} />
                  <span className="badge badge-gold branch-page-pin"><MapPin size={12} /> {b.type === "SHOP" ? "Shop" : "Market"}</span>
                </div>
                <div className="branch-page-body">
                  <h3 className="title-md">{b.name_en}</h3>
                  <p lang="ta" style={{ fontSize: "var(--font-sm)", color: "var(--text-muted)" }}>{b.name_ta}</p>
                  {b.address_en && <p style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)", marginTop: 8 }}>{b.address_en}</p>}
                  <div className="branch-page-meta">
                    <span className="badge"><Clock size={12} /> {daysText(b)}{hours && ` · ${hours}`}</span>
                    {status && <span className={`badge ${status.kind === "open" ? "badge-success" : status.kind === "later" ? "badge-gold" : ""}`}>{status.text}</span>}
                    {b.is_dispatch && <span className="badge badge-saffron"><Truck size={12} /> Delivers online orders</span>}
                  </div>
                  <div className="branch-page-meta">
                    {b.phone && <PhoneLinks phone={b.phone} className="btn btn-sm btn-ghost" />}
                    {dir && <a className="btn btn-sm btn-ghost" href={dir} target="_blank" rel="noreferrer"><Navigation size={14} /> Get directions</a>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        .branches-rules { padding: var(--sp-6); margin-bottom: var(--sp-10); display: flex; flex-direction: column; gap: var(--sp-4); max-width: 820px; margin-inline: auto; }
        .branches-grid-page { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-6); }
        .branch-page-card { display: flex; flex-direction: column; }
        .branch-page-media { position: relative; aspect-ratio: 16/10; overflow: hidden; background: var(--bg-elevated); }
        .branch-page-media img { width: 100%; height: 100%; object-fit: cover; transition: transform 800ms var(--ease); }
        .branch-page-card:hover .branch-page-media img { transform: scale(1.05); }
        .branch-page-pin { position: absolute; top: var(--sp-3); left: var(--sp-3); background: var(--bg-glass); }
        .branch-page-body { padding: var(--sp-5); }
        .branch-page-meta { margin-top: var(--sp-3); display: flex; flex-wrap: wrap; gap: var(--sp-2); }
        @media (max-width: 1000px) { .branches-grid-page { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .branches-grid-page { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
