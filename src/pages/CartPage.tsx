import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight, Tag, X, Repeat } from "lucide-react";
import { useStore, computeTotals, productById } from "@/store/store";
import { COUPONS } from "@/data/catalog";

export function CartPage() {
  const { state, updateQty, removeFromCart, clearCart, setCoupon, toast } = useStore();
  const navigate = useNavigate();
  const [couponInput, setCouponInput] = useState(state.activeCoupon || "");
  const [confirmClear, setConfirmClear] = useState(false);
  const totals = computeTotals(state.cart, state.activeCoupon);

  if (state.cart.length === 0) {
    return (
      <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
        <div className="container-narrow text-center">
          <div className="empty-hero">
            <ShoppingBag size={56} />
            <h1 className="display-3 mt-6">Your cart is empty</h1>
            <p className="lead mt-4" style={{ marginInline: "auto" }}>Browse the menu and add your favourite sweets — they'll show up here.</p>
            <Link to="/products" className="btn btn-primary btn-lg mt-8">Explore the menu <ArrowRight size={18} /></Link>
          </div>
        </div>
        <style>{`.empty-hero { padding: var(--sp-20) 0; color: var(--text-dim); } .empty-hero svg { opacity: 0.4; }`}</style>
      </section>
    );
  }

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (COUPONS[code]) { setCoupon(code); toast(`Coupon ${code} applied`, "success"); }
    else { toast("Invalid coupon code", "error"); }
  };
  const removeCoupon = () => { setCoupon(undefined); setCouponInput(""); toast("Coupon removed"); };

  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container">
        <div className="sec-head">
          <span className="eyebrow">Cart</span>
          <h1 className="display-2">Your selection</h1>
        </div>
        <div className="cart-layout">
          <div className="cart-items">
            {state.cart.map((line) => {
              const p = productById(line.productId)!;
              const v = p.variants.find((x) => x.id === line.variantId)!;
              const subtotal = v.price * line.qty;
              return (
                <div className="cart-line" key={`${line.productId}-${line.variantId}-${line.subscription}`}>
                  <Link to={`/product/${p.id}`} className="cart-line-img">
                    <img src={p.image} alt={p.name} loading="lazy" />
                  </Link>
                  <div className="cart-line-body">
                    <div className="cart-line-head">
                      <Link to={`/product/${p.id}`}><h3 className="title-md">{p.name}</h3></Link>
                      {line.subscription && <span className="badge badge-gold"><Repeat size={10} /> Subscription</span>}
                    </div>
                    <span className="cart-line-variant">{v.label} · ₹{v.price}</span>
                    <div className="cart-line-controls">
                      <div className="qty">
                        <button onClick={() => updateQty(line.productId, line.variantId, line.qty - 1)} aria-label="Decrease"><Minus size={14} /></button>
                        <span>{line.qty}</span>
                        <button onClick={() => updateQty(line.productId, line.variantId, line.qty + 1)} aria-label="Increase"><Plus size={14} /></button>
                      </div>
                      <span className="cart-line-subtotal">₹{subtotal}</span>
                      <button className="cart-line-remove" onClick={() => removeFromCart(line.productId, line.variantId)} aria-label="Remove">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="cart-actions">
              <Link to="/products" className="btn btn-ghost">Continue shopping</Link>
              <button className="btn btn-text" onClick={() => setConfirmClear(true)}>
                <Trash2 size={14} /> Clear cart
              </button>
            </div>
          </div>

          <aside className="cart-summary glass">
            <h3 className="title-md mb-6">Order summary</h3>
            <div className="coupon-field">
              <Tag size={16} />
              <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Coupon code" aria-label="Coupon code" />
              {state.activeCoupon ? (
                <button className="btn btn-sm btn-ghost" onClick={removeCoupon}><X size={14} /></button>
              ) : (
                <button className="btn btn-sm btn-primary" onClick={applyCoupon}>Apply</button>
              )}
            </div>
            {state.activeCoupon && <p className="coupon-applied">Applied: {COUPONS[state.activeCoupon]?.label}</p>}
            <p className="coupon-hint">Try WELCOME10, FESTIVE50, or MADURAI20</p>

            <div className="summary-rows">
              <div className="summary-row"><span>Subtotal</span><span>₹{totals.subtotal}</span></div>
              {totals.couponDiscount > 0 && <div className="summary-row discount"><span>Coupon discount</span><span>– ₹{totals.couponDiscount}</span></div>}
              {totals.subscriptionDiscount > 0 && <div className="summary-row discount"><span>Subscription discount (15%)</span><span>– ₹{totals.subscriptionDiscount}</span></div>}
              <div className="summary-row"><span>Delivery fee</span><span>₹{totals.deliveryFee}</span></div>
              <div className="divider" style={{ margin: "12px 0" }} />
              <div className="summary-row total"><span>Total</span><span className="price" style={{ fontSize: "1.6rem" }}>₹{totals.total}</span></div>
            </div>
            {totals.hasSubscription && (
              <div className="sub-note">
                <span className="badge badge-success"><span className="dot" /> 15% subscription discount applied to eligible items</span>
              </div>
            )}
            <button className="btn btn-primary btn-block btn-lg mt-6" onClick={() => navigate("/checkout")}>
              Proceed to checkout <ArrowRight size={18} />
            </button>
          </aside>
        </div>
      </div>

      {confirmClear && (
        <div className="modal-backdrop" onClick={() => setConfirmClear(false)}>
          <div className="modal-panel" style={{ maxWidth: 400, padding: 32 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="title-lg mb-4">Clear cart?</h3>
            <p style={{ marginBottom: 24, color: "var(--text-muted)" }}>This will remove all items from your cart.</p>
            <div className="flex gap-3">
              <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button className="btn btn-saffron" onClick={() => { clearCart(); setConfirmClear(false); toast("Cart cleared"); }}>Clear cart</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .cart-layout { display: grid; grid-template-columns: 1fr 380px; gap: var(--sp-8); align-items: start; }
        .cart-items { display: flex; flex-direction: column; gap: var(--sp-4); }
        .cart-line { display: grid; grid-template-columns: 100px 1fr; gap: var(--sp-4); padding: var(--sp-4); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-card); }
        .cart-line-img img { width: 100px; height: 100px; border-radius: var(--radius-sm); object-fit: cover; }
        .cart-line-body { display: flex; flex-direction: column; gap: var(--sp-2); }
        .cart-line-head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
        .cart-line-variant { font-size: var(--font-sm); color: var(--text-dim); }
        .cart-line-controls { display: flex; align-items: center; gap: var(--sp-4); margin-top: auto; flex-wrap: wrap; }
        .cart-line-subtotal { font-family: var(--font-display); font-size: 1.2rem; font-weight: 500; margin-left: auto; }
        .cart-line-remove { color: var(--text-dim); transition: color var(--t-fast); padding: 4px; }
        .cart-line-remove:hover { color: var(--error); }
        .cart-actions { display: flex; justify-content: space-between; align-items: center; margin-top: var(--sp-4); flex-wrap: wrap; gap: var(--sp-3); }
        .cart-summary { padding: var(--sp-8); border-radius: var(--radius-lg); position: sticky; top: calc(var(--nav-h) + 16px); }
        .coupon-field { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); border: 1px solid var(--border); border-radius: var(--radius-pill); background: var(--bg-elevated); }
        .coupon-field input { flex: 1; background: none; border: none; font-size: var(--font-sm); }
        .coupon-applied { font-size: var(--font-xs); color: var(--accent-green-bright); margin-top: 6px; }
        .coupon-hint { font-size: var(--font-xs); color: var(--text-dim); margin-top: 4px; }
        .summary-rows { margin-top: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-2); }
        .summary-row { display: flex; justify-content: space-between; align-items: center; font-size: var(--font-sm); color: var(--text-muted); }
        .summary-row.discount span:last-child { color: var(--accent-green-bright); }
        .summary-row.total { font-size: var(--font-md); color: var(--text); font-weight: 600; }
        .sub-note { margin-top: var(--sp-4); }
        @media (max-width: 800px) { .cart-layout { grid-template-columns: 1fr; } .cart-summary { position: static; } }
      `}</style>
    </section>
  );
}

