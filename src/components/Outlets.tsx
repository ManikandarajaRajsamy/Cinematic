import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Truck } from "lucide-react";
import { PhoneLinks } from "@/components/PhoneLinks";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePublicBranches, type PublicBranch } from "@/api/client";
import { branchStatus, daysText, directionsUrl, hoursText, isOpenToday, numberWord } from "@/api/branchStatus";
import { SHOP } from "@/data/home";

gsap.registerPlugin(ScrollTrigger);

const FILTERS = [
  { id: "all", label: "All" },
  { id: "shop", label: "Shop" },
  { id: "market", label: "Markets" },
  { id: "today", label: "Open today" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const typeTag = (b: PublicBranch) => (b.type === "SHOP" ? "Shop · கடை" : "Market · சந்தை");
const useMedia = (q: string) => {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
};

/** Everything we know about one branch. Only filled-in fields are shown; nothing is guessed. */
function BranchDetails({ b }: { b: PublicBranch }) {
  const hours = hoursText(b);
  const dir = directionsUrl(b);
  return (
    <div className="od">
      <div className="od-photo">
        <img src={b.photo_url || "/media/closeup.webp"} alt="" loading="lazy" className={b.photo_url ? "" : "dim"} />
      </div>
      <div className="od-body">
        <span className="kicker"><span className="dot" />{typeTag(b)}</span>
        <h3 className="od-name">{b.name_en}</h3>
        <p className="ta">{b.name_ta}</p>
        <dl className="od-rows">
          {b.address_en && <div><dt className="kicker">Address</dt><dd>{b.address_en}{b.address_ta && <span className="ta">{b.address_ta}</span>}</dd></div>}
          <div><dt className="kicker">Days</dt><dd>{daysText(b)}</dd></div>
          {hours && <div><dt className="kicker">Hours</dt><dd>{hours}</dd></div>}
        </dl>
        {b.phone && (
          <div className="od-calls">
            <span className="kicker">Call us</span>
            <div className="od-call-row"><PhoneLinks phone={b.phone} className="od-call" /></div>
          </div>
        )}
        <div className="od-actions">
          {b.is_dispatch && <span className="od-badge"><Truck size={13} /> Delivers online orders</span>}
          {dir && <a className="btn-g" href={dir} target="_blank" rel="noreferrer">Get directions <ArrowRight size={15} /></a>}
        </div>
      </div>
    </div>
  );
}

function StatusLine({ b }: { b: PublicBranch }) {
  const s = branchStatus(b, b.holidays);
  return (
    <span className="o-meta">
      {daysText(b)}
      {s && <span className={`o-status ${s.kind}`}><span className="o-dot" />{s.text}</span>}
    </span>
  );
}

export function Outlets() {
  const { data, loading, error } = usePublicBranches();
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<string | null>(null); // phone accordion
  const phone = useMedia("(max-width: 760px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const listRef = useRef<HTMLOListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const all = useMemo(() => data ?? [], [data]);
  const list = useMemo(() => all.filter((b) =>
    filter === "all" ? true : filter === "shop" ? b.type === "SHOP" : filter === "market" ? b.type === "MARKET" : isOpenToday(b, b.holidays),
  ), [all, filter]);
  const current = list[Math.min(active, list.length - 1)];

  useEffect(() => { setActive(0); }, [filter]);

  // desktop: the row crossing the middle of the screen becomes active as you scroll
  useLayoutEffect(() => {
    if (phone || !listRef.current || !list.length) return;
    const rows = Array.from(listRef.current.querySelectorAll<HTMLElement>(".o-row"));
    const triggers = rows.map((row, i) => ScrollTrigger.create({
      trigger: row, start: "top 55%", end: "bottom 55%", onToggle: (self) => self.isActive && setActive(i),
    }));
    ScrollTrigger.refresh(); // the list height changed, so everything below moved
    return () => triggers.forEach((t) => t.kill());
  }, [phone, list]);

  // panel cross-fade when the active branch changes
  useEffect(() => {
    if (reduced || !panelRef.current) return;
    gsap.fromTo(panelRef.current.querySelector(".od"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" });
  }, [current?.id, reduced]);

  const count = all.length;
  return (
    <section id="outlets" className="sec">
      <div className="wrap">
        <p className="kicker reveal"><b>02</b> — Outlets</p>
        <h2 className="h-display reveal">
          <span className="line">{loading && !data ? "Our counters." : `${numberWord(count)} counter${count === 1 ? "" : "s"}.`}</span>
          <span className="line grey">One taste.</span>
        </h2>
        <p className="ta outlets-ta reveal">எங்கள் கிளைகள்</p>

        {error ? (
          <div className="glass-card outlets-error">
            <p>We couldn't load the branch list just now.</p>
            <p className="muted">Our main shop: {SHOP.address} · {SHOP.hours}</p>
          </div>
        ) : (
          <>
            <div className="o-chips" role="group" aria-label="Filter outlets">
              {FILTERS.map((f) => (
                <button key={f.id} className={`o-chip ${filter === f.id ? "on" : ""}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
              ))}
            </div>
            <div className="outlets">
              <ol className="o-list" ref={listRef} aria-busy={loading}>
                {loading && !data && Array.from({ length: 5 }, (_, i) => <li key={i} className="o-row o-skel" aria-hidden="true"><span /><span /></li>)}
                {!loading && list.length === 0 && <li className="o-empty muted">No outlets match this filter.</li>}
                {list.map((b, i) => {
                  const isOn = phone ? open === b.id : i === Math.min(active, list.length - 1);
                  return (
                    <li key={b.id} className={`o-row ${isOn ? "on" : ""}`}
                      onMouseEnter={() => !phone && setActive(i)}>
                      <button className="o-row-btn" aria-expanded={phone ? isOn : undefined} aria-controls={phone ? `od-${b.id}` : undefined}
                        onClick={() => (phone ? setOpen(isOn ? null : b.id) : setActive(i))} onFocus={() => !phone && setActive(i)}>
                        <span className="o-tag kicker">{typeTag(b)}</span>
                        <span className="o-name">{b.name_en}</span>
                        <span className="o-name-ta ta">{b.name_ta}</span>
                        <StatusLine b={b} />
                        {phone && <ChevronDown className="o-chev" size={18} />}
                      </button>
                      {phone && isOn && <div id={`od-${b.id}`} className="o-acc glass-card"><BranchDetails b={b} /></div>}
                    </li>
                  );
                })}
              </ol>
              {!phone && (
                <div className="o-side">
                  <div className="o-panel glass-card" ref={panelRef} aria-live="polite">
                    {current ? <BranchDetails key={current.id} b={current} /> : <div className="od o-skel-panel" />}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
