import { useState } from "react";
import { ArrowUpRight, Clock, MapPin, Phone, Store, Tent, Truck } from "lucide-react";
import { usePublicBranches } from "@/api/client";
import { branchStatus, daysText, directionsUrl, hoursText } from "@/api/branchStatus";
import { SHOP } from "@/data/home";
import { useLang } from "@/i18n";

type Filter = "ALL" | "SHOP" | "COUNTER";

/** Every branch from the API as a card grid: type and live status, name, address, hours, call and directions. */
export function BranchDirectory() {
  const { data, loading, error } = usePublicBranches();
  const { t } = useLang();
  const [filter, setFilter] = useState<Filter>("ALL");
  if (error) return <p className="muted">{t("We couldn't load the branch list just now.", "கிளைப் பட்டியலை இப்போது ஏற்ற முடியவில்லை.")} {SHOP.address} · {SHOP.hours}</p>;
  const all = data ?? [];
  const list = all.filter((b) => filter === "ALL" || (filter === "SHOP" ? b.type === "SHOP" : b.type !== "SHOP"));
  const counts = { ALL: all.length, SHOP: all.filter((b) => b.type === "SHOP").length, COUNTER: all.filter((b) => b.type !== "SHOP").length };
  // most branches share the same numbers: show those once at the top, and on a card only when it has its own
  const phonesOf = (p?: string | null) => (p ?? "").split(/[,/]/).map((n) => n.trim()).filter(Boolean);
  const freq = new Map<string, number>();
  all.forEach((b) => { const k = phonesOf(b.phone).join(","); if (k) freq.set(k, (freq.get(k) ?? 0) + 1); });
  const shared = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
  const common = shared && shared[1] > 1 ? shared[0] : "";
  const FILTERS: [Filter, string, string][] = [["ALL", "All", "அனைத்தும்"], ["SHOP", "Shops", "கடைகள்"], ["COUNTER", "Market counters", "சந்தைக் கவுண்டர்கள்"]];

  return (
    <div className="bx">
      {all.length > 0 && (
        <div className="bx-head">
        <div className="bx-filters" role="tablist" aria-label={t("Branch type", "கிளை வகை")}>
          {FILTERS.map(([id, en, ta]) => counts[id] > 0 && (
            <button key={id} role="tab" aria-selected={filter === id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>
              {t(en, ta)} <span>{counts[id]}</span>
            </button>
          ))}
        </div>
        {common && (
          <div className="bx-call">
            <span>{t("Call any branch", "எந்தக் கிளைக்கும் அழைக்க")}</span>
            {common.split(",").map((n) => <a key={n} className="bx-btn" href={`tel:${n.replace(/[^\d+]/g, "")}`}><Phone size={14} /> {n}</a>)}
          </div>
        )}
        </div>
      )}
      <ul className="bx-grid" aria-busy={loading}>
        {loading && !data && Array.from({ length: 4 }, (_, i) => <li key={i} className="bx-card"><div className="skeleton" style={{ height: 180 }} /></li>)}
        {list.map((b) => {
          const status = branchStatus(b, b.holidays);
          const hours = hoursText(b);
          const dir = directionsUrl(b);
          const own = phonesOf(b.phone);
          const phones = own.join(",") === common ? [] : own;
          const shop = b.type === "SHOP";
          return (
            <li key={b.id} className={`bx-card ${shop ? "main" : ""}`}>
              <div className="bx-top">
                <span className="bx-type">{shop ? <Store size={13} /> : <Tent size={13} />} {shop ? t("Shop", "கடை") : t("Market counter", "சந்தைக் கவுண்டர்")}</span>
                {status && <span className={`bx-status ${status.kind}`}>{status.text}</span>}
              </div>
              <h3>{t(b.name_en, b.name_ta || b.name_en)}</h3>
              {b.address_en && <p className="bx-line"><MapPin size={15} /> {b.address_en}</p>}
              <p className="bx-line"><Clock size={15} /> {daysText(b)}{hours && ` · ${hours}`}</p>
              {b.is_dispatch && <p className="bx-line bx-note"><Truck size={15} /> {t("Event deliveries go out from here", "விழா டெலிவரி இங்கிருந்து")}</p>}
              <div className="bx-act">
                {phones.map((n) => <a key={n} className="bx-btn" href={`tel:${n.replace(/[^\d+]/g, "")}`}><Phone size={14} /> {n}</a>)}
                {dir && <a className="bx-btn solid" href={dir} target="_blank" rel="noreferrer">{t("Directions", "வழிகாட்டி")} <ArrowUpRight size={14} /></a>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
