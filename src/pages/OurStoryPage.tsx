import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

// The proprietor's photo. Save it as public/media/owner.jpg; until then a monogram is shown.
const OWNER_PHOTO = "/media/owner.jpg";

function OwnerPortrait() {
  const [missing, setMissing] = useState(false);
  return (
    <figure className="os-portrait">
      {missing ? (
        <div className="os-monogram" aria-label="K. Rajsamy"><span>KR</span></div>
      ) : (
        <img src={OWNER_PHOTO} alt="Mr. K. Rajsamy, proprietor of Sri Sastha Paruthipaal" onError={() => setMissing(true)} />
      )}
      <figcaption>
        <span className="eyebrow">Proprietor</span>
        <strong>K. Rajsamy</strong>
      </figcaption>
    </figure>
  );
}

export function OurStoryPage() {
  const r1 = useReveal();
  const r2 = useReveal();
  return (
    <section className="section os" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container">
        <div className={`os-grid reveal ${r1.inView ? "in" : ""}`} ref={r1.ref as React.RefObject<HTMLDivElement>}>
          <OwnerPortrait />
          <div className="os-text">
            <span className="eyebrow">Our Story · Since 1999</span>
            <h1 className="display-2 mt-4">From a roadside stall,<br /><span className="os-grey">with your support</span></h1>
            <p className="lead mt-8">
              We began in 1999 with a small roadside stall. Fifteen years ago, with your support, we came to Nethaji Road
              near Periyar Bus Stand. Today our mobile outlets serve selected areas in Madurai and Dindigul district.
            </p>
            <p className="mt-6">
              This journey has been led by Mr. K. Rajsamy, who has protected the quality and tradition of this recipe ever
              since. Ten people work alongside him today, many of them with us from the very beginning.
            </p>
            <p className="mt-6">
              If you have not yet tried our paruthi paal, we invite you to do so. It would be our pleasure to serve you.
            </p>
            <div className="os-actions mt-8">
              <Link to="/products" className="btn btn-primary btn-lg">Order now <ArrowRight size={18} /></Link>
              <Link to="/branches" className="btn btn-ghost btn-lg">Find an outlet</Link>
            </div>
          </div>
        </div>

        <dl className={`os-facts reveal ${r2.inView ? "in" : ""}`} ref={r2.ref as React.RefObject<HTMLDListElement>}>
          <div className="card"><dt className="eyebrow">Since</dt><dd>1999</dd></div>
          <div className="card"><dt className="eyebrow">Proprietor</dt><dd>K. Rajsamy</dd></div>
          <div className="card"><dt className="eyebrow">Registered</dt><dd>Sri Sastha Cotton Seed Milk</dd></div>
          <div className="card"><dt className="eyebrow"><BadgeCheck size={13} /> FSSAI</dt><dd className="os-mono">22426574000578</dd></div>
        </dl>
      </div>
      <style>{`
        .os-grid { display: grid; grid-template-columns: minmax(260px, 0.8fr) 1.2fr; gap: var(--sp-16); align-items: center; }
        .os-portrait { margin: 0; position: relative; border-radius: var(--radius-xl); overflow: hidden; border: 1px solid var(--border-strong); aspect-ratio: 4 / 5; background: var(--bg-card); box-shadow: var(--shadow-lg); }
        .os-portrait::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 55%, rgba(0, 26, 22, 0.92)); pointer-events: none; }
        .os-portrait img { width: 100%; height: 100%; object-fit: cover; }
        .os-portrait figcaption { position: absolute; left: var(--sp-6); bottom: var(--sp-6); z-index: 1; display: flex; flex-direction: column; gap: 4px; }
        .os-portrait figcaption strong { font-family: var(--font-display); font-size: 1.8rem; font-weight: 500; letter-spacing: -0.03em; }
        .os-monogram { width: 100%; height: 100%; display: grid; place-items: center; background: radial-gradient(circle at 50% 40%, rgba(255, 122, 24, 0.18), transparent 60%), var(--bg-card); }
        .os-monogram span { font-family: var(--font-display); font-size: clamp(5rem, 12vw, 9rem); font-weight: 300; letter-spacing: -0.06em; color: rgba(250, 247, 240, 0.25); }
        .os-grey { color: var(--text-dim); }
        .os-text p:not(.lead) { font-size: var(--font-md); line-height: 1.75; }
        .os-actions { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
        .os-facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4); margin-top: var(--sp-20); }
        .os-facts > div { padding: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-3); }
        .os-facts dt { display: inline-flex; align-items: center; gap: 6px; margin: 0; }
        .os-facts dd { font-family: var(--font-display); font-size: 1.35rem; letter-spacing: -0.02em; line-height: 1.2; color: var(--text); }
        .os-facts dd.os-mono { font-family: var(--font-mono); font-size: 1.1rem; letter-spacing: 0.04em; color: var(--accent-gold-bright); }
        @media (max-width: 900px) { .os-grid { grid-template-columns: 1fr; gap: var(--sp-10); } .os-portrait { max-width: 420px; } .os-facts { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 520px) { .os-facts { grid-template-columns: 1fr; } .os-actions .btn { width: 100%; } }
      `}</style>
    </section>
  );
}
