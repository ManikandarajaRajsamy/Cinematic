import { Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowRight, ArrowDown, Star, MapPin, Sparkles, Truck, ChevronRight, Send,
} from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { Accordion } from "@/components/Accordion";
import { useReveal } from "@/hooks/useReveal";
import { useStore } from "@/store/store";
import {
  PRODUCTS, SAMPLE_REVIEWS, FAQS, BRANCHES, MADURAI_AREAS,
} from "@/data/catalog";

function Hero() {
  const r = useReveal();
  return (
    <section className="hero" ref={r.ref as React.RefObject<HTMLDivElement>}>
      <div className="hero-bg">
        <img src="https://images.pexels.com/photos/6460395/pexels-photo-6460395.jpeg?auto=compress&cs=tinysrgb&w=1600" alt="" />
        <div className="hero-veil" />
        <div className="hero-glow" />
      </div>
      <div className="container hero-inner">
        <div className={`hero-content ${r.inView ? "in" : ""}`}>
          <span className="eyebrow">Madurai · Heritage Milk Sweets</span>
          <h1 className="display-1 hero-title">
            Slow-reduced,<br /><em>patiently</em> sweet.
          </h1>
          <p className="lead hero-lead">
            Sri Sastha Paruthipaal is a small Madurai kitchen devoted to one craft —
            milk sweets simmered in small batches, the way they were meant to be.
          </p>
          <div className="hero-ctas">
            <Link to="/products" className="btn btn-primary btn-lg">
              Explore Our Menu <ArrowRight size={18} />
            </Link>
            <Link to="/products" className="btn btn-ghost btn-lg">
              Order Now
            </Link>
          </div>
        </div>
        <div className={`hero-card-stack ${r.inView ? "in" : ""}`}>
          <div className="hero-card-float">
            <img src="https://images.pexels.com/photos/6460370/pexels-photo-6460370.jpeg?auto=compress&cs=tinysrgb&w=600" alt="Paruthipaal close-up" />
          </div>
          <div className="hero-card-float alt">
            <img src="https://images.pexels.com/photos/6460381/pexels-photo-6460381.jpeg?auto=compress&cs=tinysrgb&w=500" alt="Sweet assortment" />
          </div>
        </div>
      </div>
      <div className="hero-scroll-cue" aria-hidden="true">
        <span>Scroll</span>
        <ArrowDown size={16} className="bounce" />
      </div>
      <style>{`
        .hero { position: relative; min-height: 100vh; display: flex; align-items: center; overflow: hidden; }
        .hero-bg { position: absolute; inset: 0; z-index: 0; }
        .hero-bg img { width: 100%; height: 100%; object-fit: cover; opacity: 0.35; }
        .hero-veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(13,11,9,0.7) 0%, rgba(13,11,9,0.5) 40%, var(--bg) 100%); }
        .hero-glow { position: absolute; top: 20%; right: -10%; width: 600px; height: 600px; background: radial-gradient(circle, var(--accent-gold-glow), transparent 65%); filter: blur(40px); }
        .hero-inner { position: relative; z-index: 2; display: grid; grid-template-columns: 1.3fr 1fr; gap: var(--sp-16); align-items: center; width: 100%; padding-top: var(--nav-h); }
        .hero-content { opacity: 0; transform: translateY(40px); transition: opacity 900ms var(--ease), transform 900ms var(--ease); }
        .hero-content.in { opacity: 1; transform: none; }
        .hero-title { margin: var(--sp-6) 0 var(--sp-5); color: var(--ink-50); }
        .hero-title em { font-style: italic; color: var(--accent-gold-bright); font-weight: 300; }
        .hero-lead { max-width: 46ch; }
        .hero-ctas { display: flex; gap: var(--sp-3); margin-top: var(--sp-8); flex-wrap: wrap; }
        .hero-card-stack { position: relative; height: 460px; opacity: 0; transform: translateY(60px); transition: opacity 1000ms var(--ease) 200ms, transform 1000ms var(--ease) 200ms; }
        .hero-card-stack.in { opacity: 1; transform: none; }
        .hero-card-float { position: absolute; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border-strong); box-shadow: var(--shadow-lg); animation: float 7s var(--ease-soft) infinite; }
        .hero-card-float img { width: 100%; height: 100%; object-fit: cover; }
        .hero-card-float { width: 280px; height: 340px; top: 20px; right: 40px; }
        .hero-card-float.alt { width: 200px; height: 240px; top: 240px; right: 240px; animation-delay: -3.5s; z-index: 2; border-color: var(--border-bright); }
        .hero-scroll-cue { position: absolute; bottom: var(--sp-8); left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: var(--font-xs); letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-dim); z-index: 3; }
        .bounce { animation: bounce-soft 2s var(--ease-soft) infinite; }
        @media (max-width: 900px) {
          .hero-inner { grid-template-columns: 1fr; }
          .hero-card-stack { display: none; }
          .hero-title { font-size: clamp(2.4rem, 9vw, 4rem); }
        }
      `}</style>
    </section>
  );
}

function Storytelling() {
  const steps = [
    { num: "01", title: "A heritage batch", text: "Our kitchen in Madurai has reduced milk the slow way for decades — a steady flame, a wide kadai, and patience.", img: "https://images.pexels.com/photos/5394518/pexels-photo-5394518.jpeg?auto=compress&cs=tinysrgb&w=800" },
    { num: "02", title: "Sesame and coconut", text: "Freshly ground sesame and coconut meet the reduced milk, thickened until it sets into the dense, fudge-like bite we're known for.", img: "https://images.pexels.com/photos/6460370/pexels-photo-6460370.jpeg?auto=compress&cs=tinysrgb&w=800" },
    { num: "03", title: "Served, then remembered", text: "What begins as a sweet becomes a memory — carried home for festivals, gifted across families, ordered again the next month.", img: "https://images.pexels.com/photos/6460381/pexels-photo-6460381.jpeg?auto=compress&cs=tinysrgb&w=800" },
    { num: "04", title: "From kitchen to doorstep", text: "Order online and we bring it to you within Madurai district — the same sweet, packed to travel.", img: "https://images.pexels.com/photos/6460395/pexels-photo-6460395.jpeg?auto=compress&cs=tinysrgb&w=800" },
  ];
  return (
    <section className="section storytelling" id="story">
      <div className="container">
        <div className="sec-head">
          <span className="eyebrow">The Craft</span>
          <h2 className="display-2">Four steps, repeated<br />for decades.</h2>
        </div>
        <div className="story-steps">
          {steps.map((s, i) => {
            const r = useReveal();
            return (
              <div className={`story-step ${r.inView ? "reveal in" : "reveal"}`} ref={r.ref as React.RefObject<HTMLDivElement>} key={i}>
                <div className="story-step-media">
                  <img src={s.img} alt={s.title} loading="lazy" />
                  <span className="story-step-num">{s.num}</span>
                </div>
                <div className="story-step-body">
                  <h3 className="title-lg">{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        .story-steps { display: flex; flex-direction: column; gap: var(--sp-20); }
        .story-step { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-12); align-items: center; }
        .story-step:nth-child(even) { direction: rtl; }
        .story-step:nth-child(even) > * { direction: ltr; }
        .story-step-media { position: relative; aspect-ratio: 4/3; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border); }
        .story-step-media img { width: 100%; height: 100%; object-fit: cover; transition: transform 1200ms var(--ease); }
        .story-step:hover .story-step-media img { transform: scale(1.05); }
        .story-step-num { position: absolute; top: var(--sp-4); left: var(--sp-4); font-family: var(--font-display); font-size: 2rem; color: var(--accent-gold-bright); text-shadow: 0 2px 12px rgba(0,0,0,0.5); }
        .story-step-body h3 { margin-bottom: var(--sp-3); }
        @media (max-width: 800px) {
          .story-step { grid-template-columns: 1fr; gap: var(--sp-4); }
          .story-step:nth-child(even) { direction: ltr; }
        }
      `}</style>
    </section>
  );
}

function FeaturedProducts() {
  const r = useReveal();
  const featured = PRODUCTS.filter((p) => p.bestseller).concat(PRODUCTS.filter((p) => p.isNew)).slice(0, 4);
  return (
    <section className="section" id="featured">
      <div className="container">
        <div className="sec-head">
          <span className="eyebrow">Featured</span>
          <h2 className="display-2">Our most-loved<br />sweets.</h2>
          <p className="lead">Each card lets you pick a size and add to cart — or tap for the full story.</p>
        </div>
        <div className={`pgrid reveal-stagger ${r.inView ? "in" : ""}`} ref={r.ref as React.RefObject<HTMLDivElement>}>
          {featured.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
        <div className="mt-8 text-center">
          <Link to="/products" className="btn btn-ghost btn-lg">View full menu <ArrowRight size={18} /></Link>
        </div>
      </div>
    </section>
  );
}

function SubscriptionHighlight() {
  const r = useReveal();
  return (
    <section className="section" id="subscription-highlight">
      <div className="container">
        <div className={`sub-hero glass reveal ${r.inView ? "in" : ""}`} ref={r.ref as React.RefObject<HTMLDivElement>}>
          <div className="sub-hero-text">
            <span className="eyebrow">Subscriptions</span>
            <h2 className="display-3 mt-4">Subscribe and save<br /><strong style={{ color: "var(--accent-gold-bright)" }}>15% at checkout.</strong></h2>
            <p className="lead mt-4">
              Pick a favourite sweet, choose how often it should arrive, and we'll calculate your
              subscription discount automatically every time you check out. No free-delivery promise —
              just a clear, consistent saving on eligible orders.
            </p>
            <div className="flex gap-3 mt-6" style={{ flexWrap: "wrap" }}>
              <Link to="/subscriptions" className="btn btn-saffron btn-lg">
                Explore plans <ArrowRight size={18} />
              </Link>
              <Link to="/products" className="btn btn-ghost btn-lg">Browse sweets</Link>
            </div>
          </div>
          <div className="sub-hero-visual">
            <div className="sub-hero-card">
              <span className="badge badge-gold"><Sparkles size={12} /> Subscription</span>
              <div className="sub-hero-price">
                <span className="price-strike price" style={{ fontSize: "1.2rem" }}>₹640</span>
                <span className="price" style={{ fontSize: "3rem", color: "var(--accent-gold-bright)" }}>₹544</span>
                <span className="badge badge-success">15% off at payment</span>
              </div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)" }}>Paruthipaal Classic · 1kg · Monthly</p>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .sub-hero { display: grid; grid-template-columns: 1.2fr 1fr; gap: var(--sp-12); padding: var(--sp-16); border-radius: var(--radius-xl); position: relative; overflow: hidden; }
        .sub-hero::before { content: ''; position: absolute; top: -40%; right: -20%; width: 500px; height: 500px; background: radial-gradient(circle, var(--accent-gold-glow), transparent 65%); filter: blur(30px); }
        .sub-hero-text, .sub-hero-visual { position: relative; z-index: 1; }
        .sub-hero-card { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-8); border: 1px solid var(--border-strong); border-radius: var(--radius-lg); background: var(--bg-card); }
        .sub-hero-price { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; margin: var(--sp-2) 0; }
        @media (max-width: 800px) { .sub-hero { grid-template-columns: 1fr; padding: var(--sp-8); } }
      `}</style>
    </section>
  );
}

function Branches() {
  const r = useReveal();
  return (
    <section className="section" id="branches-preview">
      <div className="container">
        <div className="sec-head">
          <span className="eyebrow">Where to find us</span>
          <h2 className="display-2">Branches &amp; delivery</h2>
          <p className="lead">
            <Truck size={16} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
            Current delivery coverage: <strong style={{ color: "var(--accent-gold-bright)" }}>Madurai district only.</strong>{" "}
            We may expand to other cities in the future.
          </p>
        </div>
        <div className={`branches-grid reveal-stagger ${r.inView ? "in" : ""}`} ref={r.ref as React.RefObject<HTMLDivElement>}>
          {BRANCHES.map((b) => (
            <Link to="/branches" key={b.id} className="branch-card card card-hover">
              <div className="branch-media">
                <img src={b.image} alt={b.name} loading="lazy" />
                <span className="badge badge-gold branch-pin"><MapPin size={12} /> {b.area}</span>
              </div>
              <div className="branch-body">
                <h3 className="title-md">{b.name}</h3>
                <p style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)", marginTop: 6 }}>{b.note}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <style>{`
        .branches-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-6); }
        .branch-card { display: flex; flex-direction: column; }
        .branch-media { position: relative; aspect-ratio: 16/10; overflow: hidden; }
        .branch-media img { width: 100%; height: 100%; object-fit: cover; transition: transform 800ms var(--ease); }
        .branch-card:hover .branch-media img { transform: scale(1.05); }
        .branch-pin { position: absolute; top: var(--sp-3); left: var(--sp-3); background: var(--bg-glass); }
        .branch-body { padding: var(--sp-5); }
        @media (max-width: 800px) { .branches-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function Reviews() {
  const r = useReveal();
  return (
    <section className="section theme-light" id="reviews" style={{ background: "var(--paper-50)" }}>
      <div className="container">
        <div className="sec-head center">
          <span className="eyebrow center">Tasting notes</span>
          <h2 className="display-2" style={{ color: "var(--ink-900)" }}>From our customers.</h2>
          <p className="lead" style={{ maxWidth: "60ch", marginInline: "auto" }}>
            Demonstration reviews shown for layout purposes — not verified customer testimonials.
          </p>
        </div>
        <div className={`reviews-grid reveal-stagger ${r.inView ? "in" : ""}`} ref={r.ref as React.RefObject<HTMLDivElement>}>
          {SAMPLE_REVIEWS.map((rev) => (
            <div className="review-card" key={rev.id}>
              <div className="review-stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} fill={i < rev.rating ? "currentColor" : "none"} strokeWidth={1.5} />
                ))}
              </div>
              <p className="review-text">“{rev.text}”</p>
              <div className="review-meta">
                <strong>{rev.name}</strong>
                <span>{rev.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .reviews-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--sp-6); }
        .review-card { padding: var(--sp-8); background: #fff; border: 1px solid var(--paper-300); border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: var(--sp-3); }
        .review-stars { color: var(--accent-gold-dim); display: flex; gap: 2px; }
        .review-text { font-family: var(--font-display); font-size: 1.15rem; line-height: 1.5; color: var(--ink-800); font-weight: 400; }
        .review-meta { display: flex; justify-content: space-between; align-items: center; margin-top: auto; font-size: var(--font-sm); color: var(--ink-500); }
        .review-meta strong { color: var(--ink-800); }
        @media (max-width: 700px) { .reviews-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function FAQSection() {
  const r = useReveal();
  return (
    <section className="section" id="faq">
      <div className="container-narrow">
        <div className="sec-head center">
          <span className="eyebrow center">Questions</span>
          <h2 className="display-3">Frequently asked.</h2>
        </div>
        <div className={`reveal ${r.inView ? "in" : ""}`} ref={r.ref as React.RefObject<HTMLDivElement>}>
          <Accordion items={FAQS} />
        </div>
      </div>
    </section>
  );
}

function BulkOrder() {
  const { toast } = useStore();
  const [form, setForm] = useState({ name: "", contact: "", requirement: "", quantity: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Please enter your name";
    if (!form.contact.trim()) e.contact = "Phone or email is required";
    if (!form.requirement.trim()) e.requirement = "Tell us what you need";
    if (!form.quantity.trim()) e.quantity = "Approximate quantity helps us respond";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    toast("Bulk enquiry received — this is a demo confirmation.", "success");
    setForm({ name: "", contact: "", requirement: "", quantity: "", message: "" });
  };

  const r = useReveal();
  return (
    <section className="section" id="bulk-order">
      <div className="container">
        <div className={`bulk-split reveal ${r.inView ? "in" : ""}`} ref={r.ref as React.RefObject<HTMLDivElement>}>
          <div className="bulk-text">
            <span className="eyebrow">Bulk &amp; Events</span>
            <h2 className="display-3 mt-4">Planning a large order?</h2>
            <p className="lead mt-4">
              Festival hampers, temple offerings, wedding trays — tell us what you're planning and we'll
              follow up. This form validates locally and shows a demo success message; it does not
              transmit to a real business.
            </p>
            <ul className="bulk-list">
              <li><ChevronRight size={14} /> Festival &amp; corporate hampers</li>
              <li><ChevronRight size={14} /> Temple and community offerings</li>
              <li><ChevronRight size={14} /> Custom assortment trays</li>
            </ul>
          </div>
          <form className="bulk-form card" onSubmit={submit} noValidate>
            <div className="field">
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
            <div className="field">
              <label className="label">Phone or email</label>
              <input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Phone or email" />
              {errors.contact && <span className="field-error">{errors.contact}</span>}
            </div>
            <div className="field-row">
              <div className="field">
                <label className="label">Requirement</label>
                <input className="input" value={form.requirement} onChange={(e) => setForm({ ...form, requirement: e.target.value })} placeholder="e.g. Festival hampers" />
                {errors.requirement && <span className="field-error">{errors.requirement}</span>}
              </div>
              <div className="field">
                <label className="label">Quantity</label>
                <input className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="e.g. 50 boxes" />
                {errors.quantity && <span className="field-error">{errors.quantity}</span>}
              </div>
            </div>
            <div className="field">
              <label className="label">Message</label>
              <textarea className="textarea" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us about your event or requirement" />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg"><Send size={16} /> Submit enquiry</button>
            <p style={{ fontSize: "var(--font-xs)", color: "var(--text-dim)", textAlign: "center" }}>Demo form — no data leaves your browser.</p>
          </form>
        </div>
      </div>
      <style>{`
        .bulk-split { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-16); align-items: start; }
        .bulk-list { margin-top: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-3); color: var(--text-muted); }
        .bulk-list li { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--font-sm); }
        .bulk-list svg { color: var(--accent-gold); }
        .bulk-form { padding: var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-4); }
        @media (max-width: 900px) { .bulk-split { grid-template-columns: 1fr; gap: var(--sp-8); } }
      `}</style>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <Hero />
      <Storytelling />
      <FeaturedProducts />
      <SubscriptionHighlight />
      <Branches />
      <Reviews />
      <FAQSection />
      <BulkOrder />
    </>
  );
}
