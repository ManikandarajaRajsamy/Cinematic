import { Link } from "react-router-dom";
import { ArrowRight, Store, Truck, Users, Check } from "lucide-react";
import { EVENT_RATE_PER_LITRE, SERVICE_OPTIONS, type ServiceOption } from "@/data/events";
import { useLang } from "@/i18n";
import "./home.css";

const PHOTO: Record<ServiceOption, string> = { PICKUP: "/media/closeup.webp", DELIVERY: "/media/pour-poster.jpg", LIVE_COUNTER: "/media/temple-first-m.webp" };
const ICON: Record<ServiceOption, typeof Store> = { PICKUP: Store, DELIVERY: Truck, LIVE_COUNTER: Users };

/** Our paruthipaal for events: the per-litre rate and the three ways we serve it. */
export function ProductsPage() {
  const { t } = useLang();
  const rate = EVENT_RATE_PER_LITRE / 100;
  return (
    <>
      <section className="section pg-hero">
        <div className="container">
          <p className="pg-crumb"><Link to="/">{t("Home", "முகப்பு")}</Link> / {t("Our Paruthipaal", "எங்கள் பருத்திப்பால்")}</p>
          <h1 className="display-2">{t("Paruthipaal for your events", "உங்கள் விழாக்களுக்கு பருத்திப்பால்")}</h1>
          <p className="lead mt-4">{t(
            `Cooked fresh in a copper pot and sweetened with country jaggery, prepared for your wedding, temple function or festival. ₹${rate} per litre.`,
            `செப்புப் பாத்திரத்தில் புதிதாகக் காய்ச்சி, நாட்டு வெல்லம் சேர்த்து, உங்கள் திருமணம், கோவில் விழா, பண்டிகைக்குத் தயாரிக்கிறோம். லிட்டருக்கு ₹${rate}.`,
          )}</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="pg-bar"><span>{t("Choose how we serve it · the final price depends on the option", "சேவையைத் தேர்வு செய்யுங்கள் · விலை சேவையைப் பொறுத்தது")}</span></div>
          <div className="pcs">
            {SERVICE_OPTIONS.map((o) => {
              const Icon = ICON[o.id];
              return (
                <article className="pc" key={o.id}>
                  <div className="pc-img"><img src={PHOTO[o.id]} alt="" decoding="async" /></div>
                  <div className="pc-body">
                    <span className="pc-size"><Icon size={18} /></span>
                    <h3>{t(o.title, o.ta)}</h3>
                    <p className="pc-ta" lang="ta">{o.ta}</p>
                    <p>{o.text}</p>
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--font-sm)" }}>
                      <li><Check size={14} /> {t(`Paruthipaal ₹${rate} per litre`, `லிட்டருக்கு ₹${rate}`)}</li>
                      {o.extras.length ? o.extras.map((x) => <li key={x}><Check size={14} /> {x}</li>) : <li><Check size={14} /> {t("No extra charges", "கூடுதல் கட்டணம் இல்லை")}</li>}
                    </ul>
                    <div className="pc-buy">
                      <strong className="pc-price">₹{rate}<small style={{ fontSize: "0.5em" }}> / {t("litre", "லிட்டர்")}</small></strong>
                    </div>
                    <div className="pc-actions">
                      <Link to={`/events?service=${o.id}#quote`} className="btn btn-primary">{t("Book", "ஆர்டர் செய்யுங்கள்")} <ArrowRight size={15} /></Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <section className="section-sm hs-beige">
        <div className="container pg-more">
          <Link to="/events#quote" className="pg-more-card">
            <span className="eyebrow">{t("Weddings, temples, festivals", "திருமணம், கோவில், பண்டிகை")}</span>
            <h2 className="title-lg">{t("Book your event order online", "ஆன்லைனில் விழா ஆர்டர் செய்யுங்கள்")}</h2>
            <span className="text-link">{t("Plan an event order", "விழா ஆர்டர் செய்யுங்கள்")} <ArrowRight size={15} /></span>
          </Link>
          <Link to="/events#terms" className="pg-more-card">
            <span className="eyebrow">{t("Advance, balance, payment", "முன்பணம், மீதி, கட்டணம்")}</span>
            <h2 className="title-lg">{t("Event order terms", "விழா ஆர்டர் விதிமுறைகள்")}</h2>
            <span className="text-link">{t("Read the terms", "விதிமுறைகளைப் படிக்கவும்")} <ArrowRight size={15} /></span>
          </Link>
        </div>
      </section>
    </>
  );
}
