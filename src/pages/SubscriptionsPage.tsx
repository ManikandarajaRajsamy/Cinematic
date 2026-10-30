import { useState } from "react";
import { Repeat, Check, Sparkles, ArrowRight, Minus, Plus, Truck, CalendarDays } from "lucide-react";
import { useDeliverySettings } from "@/api/client";
import { useStore, productById } from "@/store/store";
import { MyPlans } from "@/components/MyPlans";
import { Modal } from "@/components/Modal";

// Daily plan lengths offered by the shop.
const PLANS = [
  { id: "7", days: 7, name: "7 days", frequency: "Daily · 7 days", desc: "A week of hot paruthipaal at your door, every morning." },
  { id: "15", days: 15, name: "15 days", frequency: "Daily · 15 days", desc: "Two weeks of fresh parcels. Our most balanced plan." },
  { id: "30", days: 30, name: "30 days", frequency: "Daily · 30 days", desc: "A full month, delivered fresh every day." },
];

export function SubscriptionsPage() {
  const { products: allProducts, planDiscountPercent, planPctFor, toast, addToCart } = useStore();
  const products = allProducts.filter((p) => p.planEligible);
  const [setup, setSetup] = useState(false);
  const [plan, setPlan] = useState("15");
  const { data: delivery } = useDeliverySettings();
  const [pickedId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("std");
  const productId = pickedId || products[0]?.id || "";
  const [qty, setQty] = useState(1);

  const product = productById(productId);
  const variant = product?.variants.find((v) => v.id === variantId) ?? product?.variants[0];
  const planDays = PLANS.find((p) => p.id === plan)!.days;
  const pct = planPctFor(planDays); // 7 days 5%, 15 days 10%, 30 days 15%
  const subPrice = variant ? Math.round((variant.price * (100 - pct)) / 100) : 0;

  const handleSubscribe = () => {
    if (!product || !variant) return;
    // the whole plan is one cart line (qty a day × days); the plan starts once the order is placed
    addToCart(productId, variantId, qty, true, planDays);
    toast(`${planDays}-day plan added to your cart · ${pct}% off`, "success");
    setSetup(false);
  };

  return (
    <>
      <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
        <div className="container">
          <div className="sec-head center" style={{ alignItems: "center" }}>
            <span className="eyebrow center">Subscriptions</span>
            <h1 className="display-1">Subscribe,<br /><em style={{ color: "var(--accent-gold-bright)", fontStyle: "italic" }}>save up to {planDiscountPercent}%.</em></h1>
            <p className="lead" style={{ marginInline: "auto", maxWidth: "56ch" }}>
              Pick your parcel size and the days you want it, and every plan parcel gets
              a discount of <strong style={{ color: "var(--accent-gold-bright)" }}>5% for 7 days, 10% for 15 days and 15% for 30 days</strong>, calculated at checkout.
              Fresh, hot paruthipaal at your door.
            </p>
          </div>

          <div className="sub-benefits mt-12">
            {[
              { icon: Sparkles, title: "Up to 15% off at payment", text: "Discount applied dynamically to eligible subscription items at checkout — shown before you place an order." },
              { icon: Repeat, title: "7, 15 or 30 days", text: "Choose how long your daily plan runs. Paid once online by UPI, delivered free every day." },
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
      <section className="section" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className="container"><MyPlans /></div>
      </section>

      {/* Available plans */}
      <section className="section">
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
                  <span className="badge badge-gold">{planPctFor(pl.days)}% off at checkout</span>
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
          .sub-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-6); max-width: 1000px; }
          @media (max-width: 900px) { .sub-plans { grid-template-columns: 1fr; } }
          .sub-plan { padding: var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-3); }
          .sub-plan-head { display: flex; align-items: center; gap: var(--sp-3); color: var(--accent-gold); }
          .sub-plan-head h3 { color: var(--text); }
          .sub-plan-price { margin: var(--sp-2) 0 var(--sp-4); }
          .sub-demo-note { font-size: var(--font-xs); color: var(--text-dim); text-align: center; }
          @media (max-width: 600px) { .sub-plans { grid-template-columns: 1fr; } }
        `}</style>
      </section>

      <Modal open={setup} onClose={() => setSetup(false)} maxWidth={620}>
        <div className="sp">
          <div className="sp-head">
            <span className="eyebrow"><Repeat size={13} /> Daily plan · தினசரி திட்டம்</span>
            <h3 className="sp-title">Start your daily plan</h3>
            <p>Hot paruthipaal at your door every morning. 5% off for 7 days, 10% for 15 days, 15% for 30 days.</p>
          </div>

          <div className="sp-step">
            <span className="sp-label"><b>1</b> Parcel size</span>
            <div className="sp-parcels" role="radiogroup" aria-label="Parcel size">
              {products.map((p) => {
                const v = p.variants[0];
                const on = p.id === productId;
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={on} disabled={!v.inStock}
                    className={`sp-parcel ${on ? "on" : ""}`} onClick={() => { setProductId(p.id); setVariantId(v.id); setQty((q) => Math.min(q, p.maxQty ?? 99)); }}>
                    <img src={p.image} alt="" />
                    <span className="sp-parcel-size">{v.label}</span>
                    <span className="sp-parcel-price"><s>₹{v.price}</s> ₹{Math.round((v.price * (100 - pct)) / 100)}<small>/day</small></span>
                    {!v.inStock && <span className="sp-parcel-out">Sold out today</span>}
                    {on && <Check size={16} className="sp-tick" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sp-step">
            <span className="sp-label"><b>2</b> Plan length</span>
            <div className="sp-lengths" role="radiogroup" aria-label="Plan length">
              {PLANS.map((pl) => (
                <button key={pl.id} type="button" role="radio" aria-checked={plan === pl.id} className={`sp-length ${plan === pl.id ? "on" : ""}`} onClick={() => setPlan(pl.id)}>
                  <strong>{pl.days}</strong><span>days</span><em>{planPctFor(pl.days)}% off</em>
                </button>
              ))}
            </div>
          </div>

          <div className="sp-step">
            <span className="sp-label"><b>3</b> Parcels per day</span>
            <div className="sp-qty">
              <button type="button" aria-label="Fewer" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}><Minus size={18} /></button>
              <span aria-live="polite"><strong>{qty}</strong> × {variant?.label ?? ""}</span>
              <button type="button" aria-label="More" onClick={() => setQty(Math.min(product?.maxQty ?? 99, qty + 1))} disabled={qty >= (product?.maxQty ?? 99)}><Plus size={18} /></button>
            </div>
          </div>

          {(() => {
            const days = planDays;
            const regular = (variant?.price ?? 0) * qty;
            const perDay = subPrice * qty;
            return (
              <div className="sp-summary">
                <div className="sp-sum-main">
                  <div>
                    <span className="sp-label">Per day</span>
                    <div className="sp-price"><s>₹{regular}</s><strong>₹{perDay}</strong></div>
                  </div>
                  <div className="sp-save">
                    <span>You save</span>
                    <strong>₹{(regular - perDay) * days}</strong>
                    <small>over {days} days</small>
                  </div>
                </div>
                <ul className="sp-perks">
                  <li><CalendarDays size={14} /> {days} days · {qty} × {variant?.label ?? ""} each morning</li>
                  <li><Truck size={14} /> Free delivery on plan orders</li>
                  <li><Sparkles size={14} /> {pct}% off for a {days}-day plan</li>
                </ul>
              </div>
            );
          })()}

          <button className="btn btn-primary btn-block btn-lg" onClick={handleSubscribe} disabled={!product || !variant?.inStock}>Add {planDays}-day plan to cart · ₹{subPrice * qty * planDays} <ArrowRight size={18} /></button>
          <p className="sp-fine">The plan is paid once online by UPI at checkout and starts the day you order. Delivery is always free on plans.</p>
        </div>
        <style>{`
          .sp { padding: 30px 32px 30px; display: flex; flex-direction: column; gap: 22px; }
          .sp-head { display: flex; flex-direction: column; gap: 8px; padding-right: 40px; }
          .sp-head .eyebrow { display: inline-flex; align-items: center; gap: 6px; }
          .sp-title { font-family: var(--font-display); font-size: 2rem; font-weight: 400; letter-spacing: -0.035em; line-height: 1.05; }
          .sp-head p { font-size: var(--font-sm); }
          .sp-step { display: flex; flex-direction: column; gap: 10px; }
          .sp-label { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); }
          .sp-label b { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-weight: 500; font-size: 10px; letter-spacing: 0; color: #1d0c00; background: var(--accent-gold); }
          .sp-parcels { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
          .sp-parcel { position: relative; display: grid; grid-template-columns: 56px 1fr; grid-template-rows: auto auto; column-gap: 12px; align-items: center; text-align: left; padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-glass-light); transition: border-color var(--t-fast), background var(--t-fast), transform var(--t-fast); }
          .sp-parcel:hover:not(:disabled) { transform: translateY(-2px); }
          .sp-parcel img { grid-row: span 2; width: 56px; height: 56px; border-radius: 10px; object-fit: cover; object-position: 74% 58%; }
          .sp-parcel-size { font-family: var(--font-display); font-size: 1.3rem; letter-spacing: -0.02em; }
          .sp-parcel-price { font-size: var(--font-sm); color: var(--accent-gold-bright); font-weight: 600; }
          .sp-parcel-price s { color: var(--text-dim); font-weight: 400; margin-right: 4px; }
          .sp-parcel-price small { color: var(--text-dim); font-weight: 400; }
          .sp-parcel-out { grid-column: 2; font-size: 11px; color: #e08c70; }
          .sp-parcel.on { border-color: var(--accent-gold); background: rgba(255, 122, 24, 0.08); box-shadow: inset 0 0 0 1px var(--accent-gold); }
          .sp-tick { position: absolute; top: 8px; right: 8px; color: var(--accent-gold); }
          .sp-lengths { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .sp-length { display: flex; align-items: baseline; justify-content: center; gap: 6px; padding: 14px 8px; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-glass-light); transition: all var(--t-fast); }
          .sp-length strong { font-family: var(--font-display); font-size: 1.8rem; font-weight: 400; letter-spacing: -0.03em; line-height: 1; }
          .sp-length span { font-size: var(--font-sm); color: var(--text-muted); }
          .sp-length { flex-wrap: wrap; }
          .sp-length em { flex-basis: 100%; text-align: center; font-style: normal; font-size: 11px; color: var(--accent-gold-bright); }
          .sp-length.on { border-color: var(--accent-gold); background: rgba(255, 122, 24, 0.08); box-shadow: inset 0 0 0 1px var(--accent-gold); }
          .sp-length.on strong { color: var(--accent-gold-bright); }
          .sp-qty { display: grid; grid-template-columns: 52px 1fr 52px; align-items: center; border: 1px solid var(--border-strong); border-radius: var(--radius-md); overflow: hidden; }
          .sp-qty button { height: 52px; display: grid; place-items: center; background: var(--bg-glass-light); transition: background var(--t-fast); }
          .sp-qty button:hover:not(:disabled) { background: var(--accent-gold-glow); }
          .sp-qty button:disabled { opacity: 0.35; }
          .sp-qty span { text-align: center; color: var(--text-muted); }
          .sp-qty strong { font-family: var(--font-display); font-size: 1.6rem; font-weight: 400; color: var(--text); margin-right: 4px; }
          .sp-summary { border-radius: var(--radius-lg); padding: 18px 20px; background: linear-gradient(150deg, rgba(255, 122, 24, 0.12), rgba(0, 26, 22, 0.5)); border: 1px solid var(--border-bright); display: flex; flex-direction: column; gap: 14px; }
          .sp-sum-main { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
          .sp-price { display: flex; align-items: baseline; gap: 10px; margin-top: 4px; }
          .sp-price s { color: var(--text-dim); font-size: var(--font-md); }
          .sp-price strong { font-family: var(--font-display); font-size: 2.4rem; font-weight: 400; letter-spacing: -0.04em; line-height: 1; color: var(--text); }
          .sp-save { text-align: right; display: flex; flex-direction: column; }
          .sp-save span { font-size: var(--font-xs); color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.12em; font-family: var(--font-mono); }
          .sp-save strong { font-family: var(--font-display); font-size: 1.9rem; font-weight: 500; letter-spacing: -0.03em; color: var(--accent-gold-bright); line-height: 1.1; }
          .sp-save small { font-size: var(--font-xs); color: var(--text-dim); }
          .sp-perks { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 16px; padding-top: 12px; border-top: 1px solid var(--border); }
          .sp-perks li { display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-sm); color: var(--text-muted); }
          .sp-perks svg { color: var(--accent-gold); }
          .sp-fine { font-size: var(--font-xs); color: var(--text-dim); text-align: center; margin-top: -8px; }
          @media (max-width: 520px) { .sp { padding: 24px 18px; } .sp-title { font-size: 1.6rem; } .sp-sum-main { flex-direction: column; align-items: flex-start; } .sp-save { text-align: left; } }
        `}</style>
      </Modal>

    </>
  );
}
