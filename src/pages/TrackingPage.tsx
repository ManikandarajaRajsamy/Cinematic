import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Package, CheckCircle2, CookingPot, Truck, Home, ChevronRight, ArrowRight, X,
} from "lucide-react";
import { useStore, DemoOrder, OrderStatus } from "@/store/store";

const STATUSES: { id: OrderStatus; label: string; icon: typeof Package; desc: string }[] = [
  { id: "placed", label: "Order placed", icon: Package, desc: "We've received your demo order." },
  { id: "confirmed", label: "Order confirmed", icon: CheckCircle2, desc: "The kitchen has confirmed your order." },
  { id: "preparing", label: "Preparing", icon: CookingPot, desc: "Your sweets are being made fresh." },
  { id: "out_for_delivery", label: "Out for delivery", icon: Truck, desc: "On the way to your address." },
  { id: "delivered", label: "Delivered", icon: Home, desc: "Delivered. Enjoy!" },
];

export function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const { state, advanceStatus, cancelOrder, toast } = useStore();
  const order = state.orders.find((o) => o.id === id) ?? state.orders[0];
  const [selectedId, setSelectedId] = useState(order?.id);

  useEffect(() => { if (order) setSelectedId(order.id); }, [id]);

  const current = state.orders.find((o) => o.id === selectedId) ?? order;
  const statusIndex = current ? STATUSES.findIndex((s) => s.id === current.status) : -1;

  if (!current) {
    return (
      <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
        <div className="container text-center">
          <h1 className="display-3">No orders to track</h1>
          <p className="lead mt-4" style={{ marginInline: "auto" }}>When you place a demo order, its tracking timeline will appear here.</p>
          <Link to="/products" className="btn btn-primary mt-6">Browse the menu</Link>
        </div>
      </section>
    );
  }

  const isCancelled = current.status === "cancelled";
  const isDelivered = current.status === "delivered";

  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container-narrow">
        <div className="sec-head">
          <span className="eyebrow">Order tracking</span>
          <h1 className="display-2">Track your order</h1>
          <p className="lead">A demonstration timeline — not live GPS tracking.</p>
        </div>

        {state.orders.length > 1 && (
          <div className="order-switcher mb-8">
            <label className="label">Select order</label>
            <select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {state.orders.map((o) => (
                <option key={o.id} value={o.id}>{o.number} · {o.items.length} item(s) · ₹{o.total}</option>
              ))}
            </select>
          </div>
        )}

        <div className="track-card glass">
          <div className="track-header">
            <div>
              <span className="label">Order number</span>
              <span className="price" style={{ fontSize: "1.4rem", color: "var(--accent-gold-bright)" }}>{current.number}</span>
            </div>
            {isCancelled ? (
              <span className="badge badge-error"><X size={12} /> Cancelled</span>
            ) : isDelivered ? (
              <span className="badge badge-success"><CheckCircle2 size={12} /> Delivered</span>
            ) : (
              <span className="badge badge-gold"><span className="dot" /> In progress</span>
            )}
          </div>

          {!isCancelled && (
            <div className="track-timeline">
              {STATUSES.map((s, i) => {
                const done = i <= statusIndex;
                const Icon = s.icon;
                return (
                  <div key={s.id} className={`track-node ${done ? "done" : ""} ${i === statusIndex ? "current" : ""}`}>
                    <div className="track-node-marker">
                      <div className="track-dot">{done && <Icon size={16} />}</div>
                      {i < STATUSES.length - 1 && <div className={`track-connector ${i < statusIndex ? "active" : ""}`} />}
                    </div>
                    <div className="track-node-body">
                      <strong>{s.label}</strong>
                      <span>{s.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isCancelled && (
            <div className="track-cancelled">
              <X size={40} />
              <p>This demo order was cancelled. No real payment was processed.</p>
            </div>
          )}

          <div className="divider" />
          <div className="track-items">
            {current.items.map((it, i) => (
              <div className="track-item" key={i}>
                <span>{it.productName} · {it.variantLabel} × {it.qty}</span>
                <span>₹{it.lineTotal}</span>
              </div>
            ))}
            <div className="divider" style={{ margin: "12px 0" }} />
            <div className="summary-row total"><span>Total</span><span className="price" style={{ fontSize: "1.2rem" }}>₹{current.total}</span></div>
          </div>

          <div className="track-controls">
            {!isCancelled && !isDelivered && (
              <button className="btn btn-primary" onClick={() => { advanceStatus(current.id); toast("Status advanced (demo)", "success"); }}>
                Advance status <ChevronRight size={16} />
              </button>
            )}
            {!isCancelled && (
              <button className="btn btn-ghost" onClick={() => { cancelOrder(current.id); toast("Order cancelled (demo)"); }}>
                <X size={14} /> Cancel order
              </button>
            )}
            <Link to="/account#orders" className="btn btn-text ml-auto">Order history <ArrowRight size={14} /></Link>
          </div>
        </div>
      </div>
      <style>{`
        .order-switcher { max-width: 360px; }
        .track-card { padding: var(--sp-8); border-radius: var(--radius-lg); }
        .track-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-8); }
        .track-header div { display: flex; flex-direction: column; gap: 4px; }
        .track-timeline { display: flex; flex-direction: column; gap: 0; position: relative; }
        .track-node { display: grid; grid-template-columns: 40px 1fr; gap: var(--sp-4); padding-bottom: var(--sp-6); position: relative; }
        .track-node-marker { display: flex; flex-direction: column; align-items: center; }
        .track-dot { width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--border); background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; color: var(--text-dim); transition: all var(--t-med); z-index: 1; flex-shrink: 0; }
        .track-node.done .track-dot { border-color: var(--accent-gold); background: var(--accent-gold); color: var(--ink-950); }
        .track-node.current .track-dot { box-shadow: 0 0 0 6px var(--accent-gold-glow); animation: pulseGlow 2.4s var(--ease-soft) infinite; }
        .track-connector { width: 2px; flex: 1; background: var(--border); margin-top: 4px; transition: background var(--t-slow); }
        .track-connector.active { background: var(--accent-gold); }
        .track-node-body { display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }
        .track-node-body strong { font-size: var(--font-md); color: var(--text); }
        .track-node-body span { font-size: var(--font-sm); color: var(--text-dim); }
        .track-node.done .track-node-body strong { color: var(--accent-gold-bright); }
        .track-cancelled { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-12); text-align: center; color: var(--error); }
        .track-items { display: flex; flex-direction: column; gap: var(--sp-2); }
        .track-item { display: flex; justify-content: space-between; font-size: var(--font-sm); color: var(--text-muted); }
        .summary-row { display: flex; justify-content: space-between; }
        .summary-row.total { color: var(--text); font-weight: 600; }
        .track-controls { display: flex; gap: var(--sp-3); margin-top: var(--sp-6); padding-top: var(--sp-6); border-top: 1px solid var(--border); flex-wrap: wrap; align-items: center; }
      `}</style>
    </section>
  );
}
