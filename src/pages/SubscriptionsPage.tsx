import { useState } from "react";
import { Link } from "react-router-dom";
import { Repeat, Pause, Play, X, Check, Sparkles, ArrowRight } from "lucide-react";
import { useStore } from "@/store/store";
import { PRODUCTS, productById, SUBSCRIPTION_DISCOUNT } from "@/data/catalog";
import { Modal } from "@/components/Modal";
import { useReveal } from "@/hooks/useReveal";

const PLANS = [
  { id: "monthly", name: "Monthly", frequency: "Monthly", desc: "A delivery every month. Skip or cancel anytime." },
  { id: "fortnightly", name: "Fortnightly", frequency: "Fortnightly", desc: "A delivery every two weeks. Good for regular indulgers." },
];

export function SubscriptionsPage() {
  const { state, subscribe, setSubscriptionStatus, toast, addToCart } = useStore();
  const [setup, setSetup] = useState(false);
  const [plan, setPlan] = useState("monthly");
  const [productId, setProductId] = useState(PRODUCTS[0].id);
  const [variantId, setVariantId] = useState(PRODUCTS[0].variants[0].id);
  const [qty, setQty] = useState(1);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const r = useReveal();

  const product = productById(productId)!;
  const variant = product.variants.find((v) => v.id === variantId)!;
  const subPrice = Math.round(variant.price * (1 - SUBSCRIPTION_DISCOUNT));

  const handleSubscribe = () => {
    subscribe({ name: `${product.name} · ${PLANS.find((p) => p.id === plan)!.name}`, frequency: PLANS.find((p) => p.id === plan)!.frequency, productId, variantId, qty });
    addToCart(productId, variantId, qty, true);
    toast("Subscription started — item added to cart with 15% discount", "success");
    setSetup(false);
  };

  return (
    <>
      <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
        <div className="container">
          <div className="sec-head center" style={{ alignItems: "center" }}>
            <span className="eyebrow center">Subscriptions</span>
            <h1 className="display-1">Subscribe,<br /><em style={{ color: "var(--accent-gold-bright)", fontStyle: "italic" }}>save 15%.</em></h1>
            <p className="lead" style={{ marginInline: "auto", maxWidth: "56ch" }}>
              Pick a favourite sweet, choose a delivery cadence, and your subscription items get
              a <strong style={{ color: "var(--accent-gold-bright)" }}>15% discount calculated at checkout</strong>.
              No free-delivery promise — just a consistent saving on eligible orders.
            </p>
          </div>

          <div className="sub-benefits mt-12">
            {[
              { icon: Sparkles, title: "15% off at payment", text: "Discount applied dynamically to eligible subscription items at checkout — shown before you place an order." },
              { icon: Repeat, title: "Flexible cadence", text: "Monthly or fortnightly. Pause, resume, or cancel your demo subscription from this page." },
              { icon: Check, title: "Same menu, same prices", text: "Subscriptions use the exact same products and prices as the catalogue. No hidden markups." },
            ].map((b, i) => (
              <div className="sub-benefit card" key={i}>
                <b.icon size={24} />
                <h3 className="title-md mt-4">{b.title}</h3>
                <p className="mt-2" style={{ fontSize: "var(--font-sm)" }}>{b.text}</p>
              </div>
            ))}
          </div>
        </div>
        <style>{`
          .sub-benefits { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-6); }
          .sub-benefit { padding: var(--sp-8); color: var(--accent-gold); }
          .sub-benefit h3, .sub-benefit p { color: var(--text); }
          @media (max-width: 800px) { .sub-benefits { grid-template-columns: 1fr; } }
        `}</style>
      </section>

      {/* Active subscriptions */}
      {state.subscriptions.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <h2 className="title-xl mb-8">Your subscriptions</h2>
            <div className={`sub-active-grid reveal-stagger ${r.inView ? "in" : ""}`} ref={r.ref as React.RefObject<HTMLDivElement>}>
              {state.subscriptions.map((s) => {
                const p = productById(s.productId);
                return (
                  <div className="sub-active card" key={s.id}>
                    <div className="flex justify-between items-center mb-3">
                      <span className={`badge ${s.status === "active" ? "badge-success" : s.status === "paused" ? "badge-gold" : "badge-error"}`}>{s.status}</span>
                      <span className="badge badge-saffron">15% off</span>
                    </div>
                    <h3 className="title-md">{p?.name}</h3>
                    <span style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)" }}>{s.frequency} · {p?.variants.find((v) => v.id === s.variantId)?.label} × {s.qty}</span>
                    <div className="flex gap-2 mt-4">
                      {s.status === "active" && <button className="btn btn-ghost btn-sm" onClick={() => { setSubscriptionStatus(s.id, "paused"); toast("Subscription paused"); }}><Pause size={14} /> Pause</button>}
                      {s.status === "paused" && <button className="btn btn-ghost btn-sm" onClick={() => { setSubscriptionStatus(s.id, "active"); toast("Subscription resumed", "success"); }}><Play size={14} /> Resume</button>}
                      {s.status !== "cancelled" && <button className="btn btn-text btn-sm" onClick={() => setConfirmCancel(s.id)}><X size={14} /> Cancel</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <style>{`.sub-active-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--sp-4); } .sub-active { padding: var(--sp-5); }`}</style>
        </section>
      )}

      {/* Available plans */}
      <section className="section" style={{ paddingTop: state.subscriptions.length > 0 ? 0 : "var(--sp-12)" }}>
        <div className="container">
          <h2 className="title-xl mb-8">Start a subscription</h2>
          <div className="sub-plans">
            {PLANS.map((pl) => (
              <div className="sub-plan card card-hover" key={pl.id}>
                <div className="sub-plan-head">
                  <Repeat size={20} />
                  <h3 className="title-md">{pl.name}</h3>
                </div>
                <p style={{ fontSize: "var(--font-sm)", color: "var(--text-muted)" }}>{pl.desc}</p>
                <div className="sub-plan-price">
                  <span className="badge badge-gold">15% off at checkout</span>
                </div>
                <button className="btn btn-primary btn-block" onClick={() => { setPlan(pl.id); setSetup(true); }}>Choose {pl.name}</button>
              </div>
            ))}
          </div>
          <div className="sub-demo-note mt-6">
            All subscription operations on this page are simulated. No real recurring payment is set up.
          </div>
        </div>
        <style>{`
          .sub-plans { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--sp-6); max-width: 720px; }
          .sub-plan { padding: var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-3); }
          .sub-plan-head { display: flex; align-items: center; gap: var(--sp-3); color: var(--accent-gold); }
          .sub-plan-head h3 { color: var(--text); }
          .sub-plan-price { margin: var(--sp-2) 0 var(--sp-4); }
          .sub-demo-note { font-size: var(--font-xs); color: var(--text-dim); text-align: center; }
          @media (max-width: 600px) { .sub-plans { grid-template-columns: 1fr; } }
        `}</style>
      </section>

      <Modal open={setup} onClose={() => setSetup(false)} title="Set up subscription" maxWidth={560}>
        <div className="sub-setup" style={{ padding: "24px 32px 32px" }}>
          <div className="field mb-4">
            <label className="label">Choose a sweet</label>
            <select className="select" value={productId} onChange={(e) => { setProductId(e.target.value); setVariantId(productById(e.target.value)!.variants[0].id); }}>
              {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field mb-4">
            <label className="label">Choose size</label>
            <div className="pcard-variants">
              {product.variants.map((v) => (
                <button key={v.id} className={`pcard-variant ${v.id === variantId ? "selected" : ""}`} onClick={() => setVariantId(v.id)} disabled={!v.inStock} style={!v.inStock ? { opacity: 0.35 } : undefined}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field mb-4">
            <label className="label">Quantity per delivery</label>
            <div className="qty"><button onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}>–</button><span>{qty}</span><button onClick={() => setQty(qty + 1)}>+</button></div>
          </div>
          <div className="sub-price-preview glass" style={{ padding: "var(--sp-4)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="summary-row"><span>Regular price</span><span className="price-strike">₹{variant.price * qty}</span></div>
            <div className="summary-row"><span>Subscription price (15% off)</span><span className="price" style={{ color: "var(--accent-gold-bright)" }}>₹{subPrice * qty}</span></div>
            <div className="summary-row discount"><span>You save</span><span>₹{variant.price * qty - subPrice * qty}</span></div>
          </div>
          <p style={{ fontSize: "var(--font-xs)", color: "var(--text-dim)", marginTop: 12 }}>The discount is applied at checkout for eligible subscription items. We'll add this to your cart now.</p>
          <button className="btn btn-primary btn-block btn-lg mt-4" onClick={handleSubscribe}>Subscribe &amp; add to cart <ArrowRight size={18} /></button>
        </div>
      </Modal>

      {confirmCancel && (
        <div className="modal-backdrop" onClick={() => setConfirmCancel(null)}>
          <div className="modal-panel" style={{ maxWidth: 400, padding: 32 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="title-lg mb-4">Cancel subscription?</h3>
            <p style={{ marginBottom: 24, color: "var(--text-muted)" }}>Your subscription will be cancelled. You can start a new one anytime.</p>
            <div className="flex gap-3">
              <button className="btn btn-ghost" onClick={() => setConfirmCancel(null)}>Keep it</button>
              <button className="btn btn-saffron" onClick={() => { setSubscriptionStatus(confirmCancel, "cancelled"); setConfirmCancel(null); toast("Subscription cancelled"); }}>Cancel subscription</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
