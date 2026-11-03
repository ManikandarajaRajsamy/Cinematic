import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingBag, ArrowRight } from "lucide-react";
import { useStore } from "@/store/store";
import type { Product } from "@/data/catalog";
import { useLang } from "@/i18n";

// photography per size, used when the admin hasn't set a product image
const PHOTO: Record<string, string> = { "500 ML": "/media/closeup.webp", "1 L": "/media/pour-poster.jpg" };
const SERVES: Record<string, [string, string]> = {
  "500 ML": ["Good for two glasses", "இரண்டு டம்ளருக்கு"],
  "1 L": ["For the family", "குடும்பத்துக்கு"],
};

function ParcelCard({ p }: { p: Product }) {
  const { addToCart, toast } = useStore();
  const { t } = useLang();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const v = p.variants[0];
  const max = p.maxQty ?? 10;
  const photo = p.image && p.image !== "/media/closeup.webp" ? p.image : PHOTO[v.label] ?? p.image;
  const serves = SERVES[v.label];
  const add = (checkout: boolean) => {
    addToCart(p.id, v.id, qty);
    if (checkout) navigate("/checkout");
    else toast(`${qty} × ${p.name} added to your cart`, "success");
  };
  return (
    <article className="pc">
      <div className="pc-img">
        <img src={photo} alt={p.name} decoding="async" />
        {!v.inStock && <span className="pc-flag">{t("Sold out today", "இன்று தீர்ந்தது")}</span>}
      </div>
      <div className="pc-body">
        <span className="pc-size">{v.label}</span>
        <h3>{t("Paruthipaal", "பருத்திப்பால்")} <span>{v.label}</span></h3>
        <p className="pc-ta" lang="ta">{p.tagline}</p>
        <p>{serves ? t(serves[0], serves[1]) + ". " : ""}{p.description}</p>
        <div className="pc-buy">
          <strong className="pc-price">₹{v.price}</strong>
          <div className="qty" aria-label={t("Quantity", "எண்ணிக்கை")}>
            <button type="button" aria-label="Fewer" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}><Minus size={15} /></button>
            <span aria-live="polite">{qty}</span>
            <button type="button" aria-label="More" onClick={() => setQty(Math.min(max, qty + 1))} disabled={qty >= max}><Plus size={15} /></button>
          </div>
        </div>
        <div className="pc-actions">
          <button className="btn btn-ghost" onClick={() => add(false)} disabled={!v.inStock}><ShoppingBag size={15} /> {t("Add to cart", "கூடையில் சேர்")}</button>
          <button className="btn btn-primary" onClick={() => add(true)} disabled={!v.inStock}>{t("Order now", "ஆர்டர்")} <ArrowRight size={15} /></button>
        </div>
      </div>
    </article>
  );
}

/** The parcel sizes as product cards, styled like the service cards. Sizes and prices come from the API. */
export function ParcelCards() {
  const { products, productsLoading, productsError } = useStore();
  const { t } = useLang();
  if (productsLoading) return <div className="pcs"><div className="skeleton" style={{ height: 520 }} /><div className="skeleton" style={{ height: 520 }} /></div>;
  if (productsError || !products.length) return <p className="field-error">{t("We couldn't load today's menu. Please refresh in a moment.", "இன்றைய பட்டியலை ஏற்ற முடியவில்லை.")}</p>;
  return <div className="pcs">{products.map((p) => <ParcelCard key={p.id} p={p} />)}</div>;
}
