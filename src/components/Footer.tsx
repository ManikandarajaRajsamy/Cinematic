import { Link } from "react-router-dom";
import { MapPin, Phone, MessageCircle, Star, Clock } from "lucide-react";
import { useDeliverySettings, usePublicBranches } from "@/api/client";
import { BrandLogo } from "@/components/BrandLogo";
import { GOOGLE_REVIEWS_URL, SHOP } from "@/data/home";
import { NAV_ITEMS, useLang } from "@/i18n";

const SERVICES = [
  { to: "/products", en: "Home delivery", ta: "வீட்டு டெலிவரி" },
  { to: "/events", en: "Event orders", ta: "விழா ஆர்டர்கள்" },
  { to: "/subscriptions", en: "Daily subscription", ta: "தினசரி சந்தா" },
  { to: "/tracking", en: "Track an order", ta: "ஆர்டர் நிலை" },
];

export function Footer() {
  const { t } = useLang();
  const { data: delivery } = useDeliverySettings();
  const { data: branches } = usePublicBranches();
  const phone = delivery?.support_phone;
  return (
    <footer className="ftr">
      <div className="container">
        <div className="ftr-top">
          <div className="ftr-brand">
            <BrandLogo size={84} withName={false} />
            <p className="ftr-quote">{t("Tradition in every drop.", "ஒவ்வொரு துளியிலும் பாரம்பரியம்.")}</p>
            <p>{t("Hot paruthipaal, cooked fresh in Madurai since 1999.", "1999 முதல் மதுரையில் தினமும் புதிதாகக் காய்ச்சப்படும் சூடான பருத்திப்பால்.")}</p>
            <div className="ftr-social">
              {phone && <a href={`https://wa.me/91${phone}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
              {phone && <a href={`tel:${phone}`} aria-label="Call us"><Phone size={18} /></a>}
              <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer" aria-label="Google reviews"><Star size={18} /></a>
            </div>
          </div>
          <nav className="ftr-col" aria-label="Footer">
            <h6>{t("Explore", "மேலும் அறிய")}</h6>
            {NAV_ITEMS.filter((n) => n.to !== "/").map((n) => <Link key={n.to} to={n.to}>{t(n.en, n.ta)}</Link>)}
          </nav>
          <div className="ftr-col">
            <h6>{t("Services", "சேவைகள்")}</h6>
            {SERVICES.map((s) => <Link key={s.to} to={s.to}>{t(s.en, s.ta)}</Link>)}
            <Link to="/account">{t("My account", "என் கணக்கு")}</Link>
          </div>
          <div className="ftr-col">
            <h6>{t("Branches", "கிளைகள்")}</h6>
            {(branches ?? []).slice(0, 7).map((b) => <Link key={b.id} to="/branches">{t(b.name_en, b.name_ta || b.name_en)}</Link>)}
          </div>
          <div className="ftr-col ftr-contact">
            <h6>{t("Visit & contact", "தொடர்புக்கு")}</h6>
            <p><MapPin size={15} /> {SHOP.address}</p>
            <p><Clock size={15} /> {SHOP.hours}</p>
            {phone && <p><Phone size={15} /> <a href={`tel:${phone}`}>{phone}</a></p>}
          </div>
        </div>
        <div className="ftr-bottom">
          <span>© {new Date().getFullYear()} Sri Sastha Paruthipaal · Madurai</span>
          <span className="ftr-legal">
            <Link to="/policies#terms">{t("Terms", "விதிமுறைகள்")}</Link>
            <Link to="/policies#privacy">{t("Privacy", "தனியுரிமை")}</Link>
            <Link to="/policies#delivery">{t("Delivery", "டெலிவரி")}</Link>
            <Link to="/policies#refund">{t("Refunds", "பணம் திரும்பப் பெறுதல்")}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
