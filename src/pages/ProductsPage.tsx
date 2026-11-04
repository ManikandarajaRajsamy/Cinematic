import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ParcelCards } from "@/components/ParcelCards";
import { useStore } from "@/store/store";
import { useLang } from "@/i18n";
import "./home.css";

/** Product listing: the parcel sizes as cards, then the two main services. */
export function ProductsPage() {
  const { t } = useLang();
  const { products } = useStore();
  return (
    <>
      <section className="section pg-hero">
        <div className="container">
          <p className="pg-crumb"><Link to="/">{t("Home", "முகப்பு")}</Link> / {t("Products", "பொருட்கள்")}</p>
          <h1 className="display-2">{t("Paruthipaal parcels", "பருத்திப்பால் பார்சல்கள்")}</h1>
          <p className="lead mt-4">{t("Cooked fresh every morning, sealed hot and delivered to your door in Madurai district.", "தினமும் காலையில் புதிதாகக் காய்ச்சி, சூடாக அடைத்து, மதுரை மாவட்டத்தில் உங்கள் வீட்டுக்கே டெலிவரி செய்கிறோம்.")}</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="pg-bar"><span>{t(`Showing ${products.length} parcel sizes`, `${products.length} அளவுகள்`)}</span></div>
          <ParcelCards />
        </div>
      </section>
      <section className="section-sm hs-beige">
        <div className="container pg-more">
          <Link to="/events" className="pg-more-card">
            <span className="eyebrow">{t("Weddings, temples, festivals", "திருமணம், கோவில், பண்டிகை")}</span>
            <h2 className="title-lg">{t("Event orders in bulk litres", "விழாக்களுக்கு மொத்த ஆர்டர்")}</h2>
            <span className="text-link">{t("Plan an event order", "விழா ஆர்டர் செய்யுங்கள்")} <ArrowRight size={15} /></span>
          </Link>
          <Link to="/subscriptions" className="pg-more-card">
            <span className="eyebrow">{t("Every morning", "தினமும் காலையில்")}</span>
            <h2 className="title-lg">{t("Daily subscription · 7, 15 or 30 days", "தினசரி சந்தா · 7, 15, 30 நாட்கள்")}</h2>
            <span className="text-link">{t("Start a subscription", "சந்தாவைத் தொடங்குங்கள்")} <ArrowRight size={15} /></span>
          </Link>
        </div>
      </section>
    </>
  );
}
