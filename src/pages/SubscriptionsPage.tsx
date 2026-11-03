import { PlanBuilder } from "@/components/PlanBuilder";
import { MyPlans } from "@/components/MyPlans";
import { useStore } from "@/store/store";
import { useLang } from "@/i18n";
import "./home.css";

export function SubscriptionsPage() {
  const { planDiscountPercent } = useStore();
  const { t } = useLang();
  return (
    <>
      <section className="section pg-hero">
        <div className="container sub-head">
          <div>
            <span className="eyebrow">{t("Daily subscription", "தினசரி சந்தா")}</span>
            <h1 className="display-2">{t(`Every morning, at your door. Up to ${planDiscountPercent}% off.`, `தினமும் காலையில், உங்கள் வீட்டுக்கே. ${planDiscountPercent}% வரை தள்ளுபடி.`)}</h1>
          </div>
          <p className="lead">{t(
            "Choose 7, 15 or 30 days, the parcel size, how many you need each day and when to start. You pay once by UPI at checkout, and plan deliveries are free.",
            "7, 15 அல்லது 30 நாட்கள், அளவு, ஒரு நாளைக்கு எத்தனை, எப்போது தொடங்க வேண்டும் என்பதைத் தேர்வு செய்யுங்கள். செக்அவுட்டில் ஒரு முறை UPI-ல் செலுத்துங்கள்.",
          )}</p>
        </div>
      </section>
      <section id="plan" className="section hs-beige" style={{ paddingTop: "var(--sp-16)" }}>
        <div className="container">
          <PlanBuilder />
          <div className="sub-mine"><MyPlans /></div>
        </div>
      </section>
    </>
  );
}
