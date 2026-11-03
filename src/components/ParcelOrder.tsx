import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingBag, ArrowRight } from "lucide-react";
import { useStore } from "@/store/store";
import { useLang } from "@/i18n";
import { INGREDIENTS } from "@/data/home";

// how each parcel size is usually shared; sizes and prices themselves come from the API
const SERVES: Record<string, [string, string]> = {
  "500 ML": ["Good for two glasses", "இரண்டு டம்ளருக்கு"],
  "1 L": ["For the family", "குடும்பத்துக்கு"],
};

/** The one product, presented as a feature: photo, story, the two parcel sizes, quantity and both order actions. */
export function ParcelOrder({ heading = true, initialId = "" }: { heading?: boolean; initialId?: string }) {
  const { products, productsLoading, productsError, addToCart, toast } = useStore();
  const { t } = useLang();
  const navigate = useNavigate();
  const [pickedId, setPickedId] = useState(initialId);
  const [qty, setQty] = useState(1);
  const product = products.find((p) => p.id === pickedId) ?? products.find((p) => p.variants[0].inStock) ?? products[0];
  const variant = product?.variants[0];
  const max = product?.maxQty ?? 10;

  const add = (thenCheckout: boolean) => {
    if (!product || !variant?.inStock) return;
    addToCart(product.id, variant.id, qty);
    if (thenCheckout) navigate("/checkout");
    else toast(`${qty} × ${product.name} added to your cart`, "success");
  };

  return (
    <div className="po">
      <figure className="po-media">
        <img src="/media/closeup.webp" alt={t("A glass of hot paruthipaal", "ஒரு டம்ளர் சூடான பருத்திப்பால்")} decoding="async" />
        <figcaption><span>{t("Cooked fresh every morning", "தினமும் காலையில் புதிதாக")}</span></figcaption>
      </figure>
      <div className="po-body">
        {heading && <span className="eyebrow">{t("Our only product", "எங்கள் ஒரே பொருள்")}</span>}
        <h2 className="po-name">{t("Paruthipaal", "பருத்திப்பால்")}<span lang="ta">{t("பருத்திப்பால்", "Paruthipaal")}</span></h2>
        <p className="po-desc">{product?.description || t("Hot paruthipaal, cooked fresh in a copper pot and sealed hot.", "செப்புப் பாத்திரத்தில் புதிதாகக் காய்ச்சி, சூடாக அடைக்கப்பட்ட பருத்திப்பால்.")}</p>
        <p className="po-ing">{INGREDIENTS.map((i) => t(i.en, i.ta)).join(" · ")}</p>

        {productsLoading ? (
          <div className="po-sizes"><div className="skeleton po-skel" /><div className="skeleton po-skel" /></div>
        ) : productsError || !product ? (
          <p className="field-error">{t("We couldn't load today's menu. Please refresh in a moment.", "இன்றைய பட்டியலை ஏற்ற முடியவில்லை. சிறிது நேரத்தில் மீண்டும் முயலவும்.")}</p>
        ) : (
          <>
            <div className="po-sizes" role="radiogroup" aria-label={t("Parcel size", "அளவு")}>
              {products.map((p) => {
                const v = p.variants[0];
                const on = p.id === product.id;
                const serves = SERVES[v.label];
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={on} disabled={!v.inStock}
                    className={`po-size ${on ? "on" : ""}`} onClick={() => { setPickedId(p.id); setQty((q) => Math.min(q, p.maxQty ?? 10)); }}>
                    <span className="po-size-l">{v.label}</span>
                    <span className="po-size-p">₹{v.price}</span>
                    <span className="po-size-s">{!v.inStock ? t("Sold out today", "இன்று தீர்ந்தது") : serves ? t(serves[0], serves[1]) : p.tagline}</span>
                  </button>
                );
              })}
            </div>
            <div className="po-buy">
              <div className="qty" aria-label={t("Quantity", "எண்ணிக்கை")}>
                <button type="button" aria-label="Fewer" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}><Minus size={16} /></button>
                <span aria-live="polite">{qty}</span>
                <button type="button" aria-label="More" onClick={() => setQty(Math.min(max, qty + 1))} disabled={qty >= max}><Plus size={16} /></button>
              </div>
              <div className="po-total"><span>{t("Total", "மொத்தம்")}</span><strong>₹{(variant?.price ?? 0) * qty}</strong></div>
            </div>
            <div className="po-actions">
              <button className="btn btn-ghost btn-lg" onClick={() => add(false)} disabled={!variant?.inStock}><ShoppingBag size={16} /> {t("Add to cart", "கூடையில் சேர்")}</button>
              <button className="btn btn-primary btn-lg" onClick={() => add(true)} disabled={!variant?.inStock}>{t("Order now", "இப்போதே ஆர்டர்")} <ArrowRight size={16} /></button>
            </div>
            <p className="po-fine">{t("Delivered hot in Madurai district. The delivery fee for your address is shown at checkout.", "மதுரை மாவட்டத்தில் சூடாக டெலிவரி. உங்கள் முகவரிக்கான கட்டணம் செக்அவுட்டில் காட்டப்படும்.")}</p>
          </>
        )}
      </div>
    </div>
  );
}
