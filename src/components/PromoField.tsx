import { useState } from "react";
import { Tag, X } from "lucide-react";
import { api } from "@/api/client";
import { useStore } from "@/store/store";
import { COUPONS } from "@/data/catalog";

/**
 * Promo code box for the cart and checkout (plans go straight to checkout, so it is offered there too).
 * Shop coupons and promoters' codes are both checked with the server; once applied, the code itself is not shown.
 */
export function PromoField() {
  const { state, setCoupon, toast } = useStore();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    const code = input.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    try {
      const r = await api.checkPromo(code);
      if (!r.valid) { toast("Invalid promo code", "error"); return; }
      setCoupon(r.code, r.kind === "promoter" ? r.value : undefined);
      setInput("");
      toast(r.kind === "promoter" ? `Promo applied · ${r.value}% off product prices` : "Promo applied", "success");
    } catch { toast("Couldn't check the code. Please try again.", "error"); }
    finally { setBusy(false); }
  };
  const remove = () => { setCoupon(undefined); setInput(""); toast("Promo removed"); };
  return (
    <div className="promo-box">
      <div className="coupon-field">
        <Tag size={16} />
        <input value={state.activeCoupon ? "" : input} onChange={(e) => setInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
          placeholder={state.activeCoupon ? "Promo applied" : "Promo code"} aria-label="Promo code" disabled={!!state.activeCoupon} />
        {state.activeCoupon
          ? <button type="button" className="btn btn-sm btn-ghost" onClick={remove} aria-label="Remove promo"><X size={14} /></button>
          : <button type="button" className="btn btn-sm btn-primary" onClick={apply} disabled={busy}>Apply</button>}
      </div>
      {state.activeCoupon && <p className="coupon-applied">Promo applied · {state.promoPct ? `${state.promoPct}% off product prices` : COUPONS[state.activeCoupon]?.label}</p>}
      <style>{`
        .promo-box { min-width: 0; }
        .coupon-field { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); border: 1px solid var(--border); border-radius: var(--radius-pill); background: var(--bg-elevated); min-width: 0; }
        .coupon-field input { flex: 1; min-width: 0; background: none; border: none; outline: none; font-size: 16px; }
        .coupon-applied { font-size: var(--font-xs); color: var(--accent-green-bright); margin-top: 6px; }
      `}</style>
    </div>
  );
}
