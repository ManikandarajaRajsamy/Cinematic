import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Minus, Plus, ArrowRight, CalendarDays, Truck, MapPin } from "lucide-react";
import { useDeliverySettings } from "@/api/client";
import { useStore } from "@/store/store";
import { useLang } from "@/i18n";
import { DELIVERY_SLOTS, upcomingDates } from "@/data/delivery";

// Plan lengths the shop offers; each one's discount comes from the delivery settings.
const PLAN_DAYS = [7, 15, 30] as const;
const PLAN_NOTE: Record<number, [string, string]> = {
  7: ["A week of mornings", "ஒரு வாரம்"],
  15: ["Two weeks, our balanced plan", "இரண்டு வாரங்கள்"],
  30: ["A full month", "ஒரு முழு மாதம்"],
};

/**
 * Daily plan set-up: length, parcel size, parcels per day and start date, priced live from the
 * configured product prices and plan discounts. The plan goes into the cart as one line; the
 * delivery address and UPI payment are taken at checkout, and the server prices it again there.
 */
export function PlanBuilder() {
  const { products: all, planPctFor, addToCart, toast } = useStore();
  const { data: settings } = useDeliverySettings();
  const { t } = useLang();
  const navigate = useNavigate();
  const products = all.filter((p) => p.planEligible);
  const dates = upcomingDates(31);
  // "Renew this plan" links here with the finished plan's length, size and quantity
  const [params] = useSearchParams();
  const [days, setDays] = useState<number>(() => (PLAN_DAYS as readonly number[]).includes(Number(params.get("days"))) ? Number(params.get("days")) : 15);
  const [pickedId, setPickedId] = useState(() => all.find((p) => p.planEligible && p.variants[0].label === params.get("size"))?.id ?? "");
  const [qty, setQty] = useState(() => Math.max(1, Math.min(10, Number(params.get("qty")) || 1)));
  const [start, setStart] = useState(dates[1]);
  const [slot, setSlot] = useState(DELIVERY_SLOTS[0]);

  const product = products.find((p) => p.id === pickedId) ?? products.find((p) => p.variants[0].inStock) ?? products[0];
  const variant = product?.variants[0];
  const pct = planPctFor(days);
  const perDay = (variant?.price ?? 0) * qty;
  const subtotal = perDay * days;
  const discount = Math.round((subtotal * pct) / 100);
  const total = subtotal - discount;
  const startLabel = new Date(start + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  const subscribe = () => {
    if (!product || !variant?.inStock) return;
    addToCart(product.id, variant.id, qty, true, days, start, slot);
    toast(`${days}-day plan added · starts ${startLabel}`, "success");
    navigate("/checkout");
  };

  if (!products.length) return <p className="muted">{t("Daily plans will be available shortly.", "தினசரி திட்டங்கள் விரைவில்.")}</p>;

  return (
    <div className="pb">
      <div className="pb-plans" role="radiogroup" aria-label={t("Plan length", "திட்ட காலம்")}>
        {PLAN_DAYS.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={days === d} className={`pb-plan ${days === d ? "on" : ""}`} onClick={() => setDays(d)}>
            <span className="pb-plan-d">{d}</span>
            <span className="pb-plan-u">{t("days", "நாட்கள்")}</span>
            <span className="pb-plan-n">{t(PLAN_NOTE[d][0], PLAN_NOTE[d][1])}</span>
            <span className="pb-plan-off">{planPctFor(d)}% {t("off", "தள்ளுபடி")}</span>
          </button>
        ))}
      </div>

      <div className="pb-grid">
        <div className="pb-form">
          <div className="pb-step">
            <span className="pb-label">{t("Parcel size", "அளவு")}</span>
            <div className="pb-seg" role="radiogroup" aria-label={t("Parcel size", "அளவு")}>
              {products.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={p.id === product?.id} disabled={!p.variants[0].inStock}
                  className={p.id === product?.id ? "on" : ""} onClick={() => { setPickedId(p.id); setQty((q) => Math.min(q, p.maxQty ?? 10)); }}>
                  {p.variants[0].label} · ₹{p.variants[0].price}
                </button>
              ))}
            </div>
          </div>
          <div className="pb-step">
            <span className="pb-label">{t("Parcels per day", "ஒரு நாளைக்குப் பார்சல்கள்")}</span>
            <div className="qty">
              <button type="button" aria-label="Fewer" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}><Minus size={16} /></button>
              <span aria-live="polite">{qty}</span>
              <button type="button" aria-label="More" onClick={() => setQty(Math.min(product?.maxQty ?? 10, qty + 1))} disabled={qty >= (product?.maxQty ?? 10)}><Plus size={16} /></button>
            </div>
          </div>
          <div className="pb-step">
            <label className="pb-label" htmlFor="pb-start">{t("Start date", "தொடக்க நாள்")}</label>
            <input id="pb-start" type="date" className="input pb-date" min={dates[0]} max={dates[dates.length - 1]} value={start}
              onChange={(e) => e.target.value && setStart(e.target.value)} />
          </div>
          <div className="pb-step">
            <span className="pb-label">{t("Delivery time", "டெலிவரி நேரம்")}</span>
            <div className="pb-slots" role="radiogroup" aria-label={t("Delivery time", "டெலிவரி நேரம்")}>
              {DELIVERY_SLOTS.map((x) => <button key={x} type="button" role="radio" aria-checked={slot === x} className={slot === x ? "on" : ""} onClick={() => setSlot(x)}>{x}</button>)}
            </div>
          </div>
          <ul className="pb-delivery">
            <li><CalendarDays size={16} /> {t(`Every day for ${days} days from ${startLabel}, ${slot}`, `${startLabel} முதல் ${days} நாட்கள், தினமும் ${slot}`)}</li>
            <li><Truck size={16} /> {settings?.plan_free_delivery === false ? t("Delivery fee shown at checkout", "டெலிவரி கட்டணம் செக்அவுட்டில் காட்டப்படும்") : t("Free delivery on every plan day", "திட்ட நாட்களில் இலவச டெலிவரி")}</li>
            <li><MapPin size={16} /> {t(`Delivery address and UPI payment at the next step${settings ? ` · ${settings.district_restriction} district` : ""}`, "அடுத்த படியில் முகவரியும் UPI கட்டணமும்")}</li>
          </ul>
        </div>

        <aside className="pb-sum" aria-live="polite">
          <span className="pb-label">{t("Your plan", "உங்கள் திட்டம்")}</span>
          <h3>{days} {t("days", "நாட்கள்")} · {qty} × {variant?.label}</h3>
          <dl>
            <div><dt>₹{variant?.price ?? 0} × {qty} × {days} {t("days", "நாட்கள்")}</dt><dd>₹{subtotal}</dd></div>
            <div className="pb-save"><dt>{t("Plan discount", "திட்ட தள்ளுபடி")} ({pct}%)</dt><dd>−₹{discount}</dd></div>
            <div><dt>{t("Delivery", "டெலிவரி")}</dt><dd>{settings?.plan_free_delivery === false ? t("At checkout", "செக்அவுட்டில்") : t("Free", "இலவசம்")}</dd></div>
          </dl>
          <div className="pb-total"><span>{t("Total, paid once", "மொத்தம் (ஒரே முறை செலுத்துதல்)")}</span><strong>₹{total}</strong></div>
          <p className="pb-perday">₹{Math.round(total / days)} {t("a day", "ஒரு நாளைக்கு")}</p>
          <button className="btn btn-primary btn-lg btn-block" onClick={subscribe} disabled={!variant?.inStock}>{t("Subscribe", "சந்தா பெறுங்கள்")} <ArrowRight size={16} /></button>
        </aside>
      </div>
    </div>
  );
}
