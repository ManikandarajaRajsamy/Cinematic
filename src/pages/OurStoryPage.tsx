import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

export function OurStoryPage() {
  const r1 = useReveal();
  const r2 = useReveal();
  return (
    <>
      <section className="section-sm" style={{ paddingTop: "var(--sp-32)" }}>
        <div className="container-narrow">
          <div className={`reveal ${r1.inView ? "in" : ""}`} ref={r1.ref as React.RefObject<HTMLDivElement>}>
            <span className="eyebrow">Our Story</span>
            <h1 className="display-1 mt-6">A Madurai kitchen,<br /><em style={{ color: "var(--accent-gold-bright)", fontStyle: "italic" }}>one sweet at a time.</em></h1>
            <p className="lead mt-8" style={{ fontSize: "1.25rem" }}>
              Sri Sastha Paruthipaal began as a single kadai and a single recipe — milk, reduced slow
              and steady, bound with sesame and coconut. The method has not changed. The kitchen has
              only grown to meet the people who keep asking for it.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="story-feature">
            <div className="story-feature-media">
              <img src="https://images.pexels.com/photos/5394518/pexels-photo-5394518.jpeg?auto=compress&cs=tinysrgb&w=1000" alt="Slow cooking" loading="lazy" />
            </div>
            <div className={`story-feature-text reveal ${r2.inView ? "in" : ""}`} ref={r2.ref as React.RefObject<HTMLDivElement>}>
              <span className="eyebrow">The method</span>
              <h2 className="title-xl mt-4">No shortcuts, no haste.</h2>
              <p className="mt-4">Milk is reduced over a steady flame until it thickens to the right consistency — a process measured in hours, not minutes. Freshly ground sesame and coconut are folded in at the end, and the mixture is set to cool. Nothing about it is fast. That is the point.</p>
              <p className="mt-4" style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)" }}>This is a demonstration description. We have not invented specific production claims, certifications, or ingredient ratios.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="story-values">
            <div className="story-value">
              <h3 className="title-md">Small batches</h3>
              <p>Every batch is cooked in quantities we can watch and stir by hand.</p>
            </div>
            <div className="story-value">
              <h3 className="title-md">Real ingredients</h3>
              <p>Sesame, coconut, milk, jaggery. We don't complicate the list.</p>
            </div>
            <div className="story-value">
              <h3 className="title-md">Madurai first</h3>
              <p>We serve our district before we look further. That discipline stays.</p>
            </div>
          </div>
          <div className="text-center mt-12">
            <Link to="/products" className="btn btn-primary btn-lg">See the menu <ArrowRight size={18} /></Link>
          </div>
        </div>
      </section>
      <style>{`
        .story-feature { display: grid; grid-template-columns: 1.1fr 1fr; gap: var(--sp-16); align-items: center; }
        .story-feature-media { aspect-ratio: 5/4; border-radius: var(--radius-xl); overflow: hidden; border: 1px solid var(--border); }
        .story-feature-media img { width: 100%; height: 100%; object-fit: cover; }
        .story-values { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-8); margin-top: var(--sp-16); }
        .story-value { padding: var(--sp-8); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-card); }
        .story-value h3 { color: var(--accent-gold-bright); margin-bottom: var(--sp-2); }
        @media (max-width: 800px) { .story-feature { grid-template-columns: 1fr; } .story-values { grid-template-columns: 1fr; } }
      `}</style>
    </>
  );
}
