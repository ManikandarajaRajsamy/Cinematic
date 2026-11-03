import { ArrowUpRight, Truck } from "lucide-react";
import { usePublicBranches } from "@/api/client";
import { branchStatus, daysText, directionsUrl, hoursText } from "@/api/branchStatus";
import { PhoneLinks } from "@/components/PhoneLinks";
import { SHOP } from "@/data/home";
import { useLang } from "@/i18n";

/** Every branch from the API as a directory: name, type, days and hours, today's status, phone and directions. */
export function BranchDirectory() {
  const { data, loading, error } = usePublicBranches();
  const { t } = useLang();
  if (error) return <p className="muted">{t("We couldn't load the branch list just now.", "கிளைப் பட்டியலை இப்போது ஏற்ற முடியவில்லை.")} {SHOP.address} · {SHOP.hours}</p>;
  return (
    <ol className="bd" aria-busy={loading}>
      {loading && !data && Array.from({ length: 4 }, (_, i) => <li key={i} className="bd-row"><div className="skeleton" style={{ height: 56, gridColumn: "1 / -1" }} /></li>)}
      {(data ?? []).map((b, i) => {
        const status = branchStatus(b, b.holidays);
        const hours = hoursText(b);
        const dir = directionsUrl(b);
        return (
          <li key={b.id} className="bd-row">
            <span className="bd-num">{String(i + 1).padStart(2, "0")}</span>
            <div className="bd-name">
              <h3>{t(b.name_en, b.name_ta || b.name_en)}</h3>
              <span className="bd-type">
                {b.type === "SHOP" ? t("Shop", "கடை") : t("Market counter", "சந்தை கவுண்டர்")}
                {b.is_dispatch && <><span className="bd-dot" /><Truck size={13} /> {t("Delivers online orders", "ஆன்லைன் ஆர்டர் டெலிவரி")}</>}
              </span>
              {b.address_en && <p>{b.address_en}</p>}
            </div>
            <div className="bd-when">
              <span>{daysText(b)}</span>
              {hours && <span>{hours}</span>}
              {status && <span className={`bd-status ${status.kind}`}>{status.text}</span>}
            </div>
            <div className="bd-act">
              {b.phone && <PhoneLinks phone={b.phone} className="bd-link" />}
              {dir && <a className="bd-link" href={dir} target="_blank" rel="noreferrer">{t("Directions", "வழி")} <ArrowUpRight size={14} /></a>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
