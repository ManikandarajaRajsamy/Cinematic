import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { CheckCircle2, Package, MapPin, Clock, ArrowRight, Truck } from "lucide-react";
import { useStore, DemoOrder } from "@/store/store";

export function ConfirmationPage() {
  const { state } = useStore();
  const loc = useLocation() as { state?: { orderId?: string } };
  const orderId = loc.state?.orderId;
  const order = state.orders.find((o) => o.id === orderId) ?? state.orders[0];

  useEffect(() => { if (!order) { /* will redirect via Link */ } }, [order]);

  if (!order) {
    return (
      <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
        <div className="container text-center">
          <h1 className="display-3">No recent order</h1>
          <p className="lead mt-4" style={{ marginInline: "auto" }}>You haven't placed a demo order yet.</p>
          <Link to="/products" className="btn btn-primary mt-6">Browse the menu</Link>
        </div>
      </section>
    );
  }

  const eta = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { weekday: "long", month: "short", day: "numeric" });

  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container-narrow">
        <div className="confirm-hero">
          <div className="confirm-check">
            <CheckCircle2 size={72} />
          </div>
          <span className="eyebrow center mt-6">Demonstration order placed</span>
          <h1 className="display-2 mt-4 text-center">Thank you, {order.customer.name}!</h1>
          <p className="lead text-center mt-4" style={{ marginInline: "auto" }}>
            Your demo order has been created locally. No real payment was processed and no business order was submitted.
          </p>
        </div>

        <div className="confirm-card glass">
          <div className="confirm-number">
            <span className="label">Demo order number</span>
            <span className="price" style={{ fontSize: "2rem", color: "var(--accent-gold-bright)" }}>{order.number}</span>
          </div>
          <div className="confirm-eta">
            <Clock size={16} /> <span>Illustrative delivery estimate: <strong>{eta}</strong></span>
          </div>

          <div className="divider" />

          <h3 className="title-md mb-4">Order items</h3>
          <div className="confirm-items">
            {order.items.map((it, i) => (
              <div className="confirm-item" key={i}>
                <div className="confirm-item-body">
                  <strong>{it.productName}</strong>
                  <span>{it.variantLabel} × {it.qty}{it.subscription ? " · Subscription" : ""}</span>
                </div>
                <span className="confirm-item-price">₹{it.lineTotal}</span>
              </div>
            ))}
          </div>

          <div className="divider" />
          <div className="confirm-totals">
            <div className="summary-row"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
            {order.couponDiscount > 0 && <div className="summary-row discount"><span>Coupon discount</span><span>– ₹{order.couponDiscount}</span></div>}
            {order.subscriptionDiscount > 0 && <div className="summary-row discount"><span>Subscription discount (15%)</span><span>– ₹{order.subscriptionDiscount}</span></div>}
            <div className="summary-row"><span>Delivery{order.delivery && ` · ${order.delivery.distance_km.toFixed(1)} km`}</span><span>{order.deliveryFee === 0 ? "Free" : `₹${order.deliveryFee}`}</span></div>
            <div className="summary-row total"><span>Total</span><span className="price" style={{ fontSize: "1.5rem" }}>₹{order.total}</span></div>
          </div>

          {order.address && (
            <>
              <div className="divider" />
              <div className="confirm-addr">
                <MapPin size={16} />
                <div>
                  <strong>{order.address.label}</strong>
                  <span>{order.address.line1}, {order.address.area} — {order.address.pincode}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="confirm-actions">
          <Link to={`/tracking/${order.id}`} className="btn btn-primary btn-lg"><Truck size={18} /> Track this order</Link>
          <Link to="/products" className="btn btn-ghost btn-lg">Continue shopping <ArrowRight size={18} /></Link>
        </div>
      </div>
      <style>{`
        .confirm-hero { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: var(--sp-12); }
        .confirm-check { width: 110px; height: 110px; border-radius: 50%; background: var(--accent-gold-glow); display: flex; align-items: center; justify-content: center; color: var(--accent-gold-bright); animation: scaleIn 600ms var(--ease-spring); border: 2px solid var(--accent-gold); }
        .confirm-card { padding: var(--sp-8); border-radius: var(--radius-lg); }
        .confirm-number { display: flex; flex-direction: column; gap: 4px; }
        .confirm-eta { display: flex; align-items: center; gap: 8px; margin-top: var(--sp-4); font-size: var(--font-sm); color: var(--text-muted); }
        .confirm-items { display: flex; flex-direction: column; gap: var(--sp-3); }
        .confirm-item { display: flex; justify-content: space-between; align-items: center; }
        .confirm-item-body { display: flex; flex-direction: column; }
        .confirm-item-body span { font-size: var(--font-sm); color: var(--text-dim); }
        .confirm-item-price { font-family: var(--font-display); font-weight: 500; }
        .confirm-totals { display: flex; flex-direction: column; gap: var(--sp-2); }
        .summary-row { display: flex; justify-content: space-between; font-size: var(--font-sm); color: var(--text-muted); }
        .summary-row.discount span:last-child { color: var(--accent-green-bright); }
        .summary-row.total { font-size: var(--font-md); color: var(--text); font-weight: 600; }
        .confirm-addr { display: flex; gap: var(--sp-3); align-items: flex-start; color: var(--text-muted); }
        .confirm-addr div { display: flex; flex-direction: column; gap: 2px; }
        .confirm-addr span { font-size: var(--font-sm); }
        .confirm-actions { display: flex; gap: var(--sp-3); justify-content: center; margin-top: var(--sp-8); flex-wrap: wrap; }
      `}</style>
    </section>
  );
}
