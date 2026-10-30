import { Truck } from "lucide-react";
import { useDeliverySettings, type PublicDeliverySettings } from "@/api/client";
import { discounted } from "@/api/mockServer";

const r = (paise: number) => (paise === 0 ? "Free" : `₹${paise / 100}`);

/** "Free delivery within 3 km · 50% off delivery on orders above ₹200" from live settings. */
export function deliveryBadgeText(s: PublicDeliverySettings) {
  const parts = [`Free delivery within ${s.free_radius_km} km`];
  if (s.discount_above_amount != null && s.discount_percent > 0) parts.push(`${s.discount_percent}% off delivery on orders above ₹${s.discount_above_amount / 100}`);
  return parts.join(" · ");
}

/** The delivery charge table, built from the admin's slabs so every screen shows the same rules. */
export function DeliveryRules({ compact = false }: { compact?: boolean }) {
  const { data: s } = useDeliverySettings();
  if (!s) return null;
  const hasDiscount = s.discount_above_amount != null && s.discount_percent > 0;
  const above = hasDiscount ? `₹${s.discount_above_amount! / 100}` : "";
  const rows = s.slabs.map((slab, i) => {
    const from = i === 0 ? 0 : s.slabs[i - 1].upto_km;
    const isLast = i === s.slabs.length - 1;
    const label = from === 0 ? `Up to ${slab.upto_km} km` : isLast && i > 0 ? `Above ${from} km` : `${from}–${slab.upto_km} km`;
    const base = slab.upto_km <= s.free_radius_km ? 0 : slab.fee;
    return { label, base, half: hasDiscount ? discounted(base, s.discount_percent) : base };
  });
  return (
    <div className={`dr ${compact ? "dr-compact" : ""}`}>
      <div className="dr-badge"><Truck size={14} /> {deliveryBadgeText(s)}</div>
      <div className="dr-table" role="table" aria-label="Delivery charges">
        <div className="dr-row dr-head" role="row">
          <span role="columnheader">Road distance</span>
          <span role="columnheader">Order up to {above || "any value"}</span>
          {hasDiscount && <span role="columnheader">Order above {above} <em>({s.discount_percent}% off)</em></span>}
        </div>
        {rows.map((row) => (
          <div className="dr-row" role="row" key={row.label}>
            <span role="cell">{row.label}</span>
            <span role="cell" className={row.base === 0 ? "free" : ""}>{r(row.base)}</span>
            {hasDiscount && <span role="cell" className={row.half === 0 ? "free" : "half"}>{r(row.half)}</span>}
          </div>
        ))}
      </div>
      {!compact && (
        <p className="dr-note">
          Distance is calculated by road (driving route), not straight line, from the shop or branch your order is prepared at.
          {hasDiscount && ` Orders above ${above} get ${s.discount_percent}% off the delivery charge (rounded up to the nearest rupee).`}{" "}
          We deliver up to {s.max_radius_km} km in {s.district_restriction} district. The exact charge is shown in your cart before you confirm the order.
          Event and bulk orders have separate transportation charges.
        </p>
      )}
      <style>{`
        .dr { display: flex; flex-direction: column; gap: 14px; }
        .dr-badge { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 999px; font-size: var(--font-sm); font-weight: 600; color: var(--accent-gold-bright); background: rgba(255, 122, 24, 0.1); border: 1px solid var(--border-bright); }
        .dr-table { border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-card); }
        .dr-row { display: grid; grid-template-columns: 1.1fr 1fr 1.2fr; gap: 12px; padding: 12px 16px; font-size: var(--font-sm); border-top: 1px solid var(--border); align-items: center; }
        .dr-row > span:not(:first-child) { text-align: right; font-weight: 600; }
        .dr-head { border-top: none; background: var(--bg-glass-light); font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-dim); }
        .dr-head > span:not(:first-child) { font-weight: 500; }
        .dr-head em { font-style: normal; color: var(--accent-gold-bright); }
        .dr-row .free { color: var(--accent-green-bright); }
        .dr-row .half { color: var(--accent-gold-bright); }
        .dr-note { font-size: var(--font-xs); color: var(--text-dim); line-height: 1.6; }
        .dr-compact .dr-row { padding: 9px 12px; }
        @media (max-width: 480px) { .dr-row { grid-template-columns: 1fr 0.8fr 0.9fr; padding: 10px 12px; } .dr-head { font-size: 9.5px; } }
      `}</style>
    </div>
  );
}
