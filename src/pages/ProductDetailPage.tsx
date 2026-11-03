import { Link, useParams } from "react-router-dom";
import { ParcelOrder } from "@/components/ParcelOrder";
import { useLang } from "@/i18n";

/** A parcel size's own link (/product/:id): the product showcase with that size already chosen. */
export function ProductDetailPage() {
  const { id = "" } = useParams();
  const { t } = useLang();
  return (
    <section className="section">
      <div className="container">
        <p className="mb-8" style={{ fontSize: "var(--font-sm)" }}>
          <Link to="/" className="text-dim">{t("Home", "முகப்பு")}</Link> <span className="text-dim">/</span> <Link to="/products" className="text-dim">{t("Products", "பொருட்கள்")}</Link>
        </p>
        <ParcelOrder initialId={id} />
      </div>
    </section>
  );
}
