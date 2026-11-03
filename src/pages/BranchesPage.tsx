import { BranchDirectory } from "@/components/BranchDirectory";
import { useLang } from "@/i18n";
import "./home.css";

export function BranchesPage() {
  const { t } = useLang();
  return (
    <>
      <section className="section pg-hero">
        <div className="container">
          <span className="eyebrow">{t("Branches", "கிளைகள்")}</span>
          <h1 className="display-2">{t("Find us in Madurai", "மதுரையில் எங்களைக் காண")}</h1>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <BranchDirectory />
        </div>
      </section>
    </>
  );
}
