import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, PartyPopper, CalendarCheck, Truck, Users, Store } from "lucide-react";
import { BgVideo } from "@/components/BgVideo";
import { ParcelCards } from "@/components/ParcelCards";
import { PlanBuilder } from "@/components/PlanBuilder";
import { BranchDirectory } from "@/components/BranchDirectory";
import { MyPlans } from "@/components/MyPlans";
import { usePublicBranches } from "@/api/client";
import { GOOGLE_REVIEWS_URL, HEALTH_NOTE, INGREDIENTS, REVIEW_QUOTES, REVIEW_TOPICS, SHOP } from "@/data/home";
import { EVENT_RATE_PER_LITRE, EVENT_TYPES, SERVICE_OPTIONS, type ServiceOption } from "@/data/events";
import { upcomingDates } from "@/data/delivery";
import { LOGO_SRC, LOGO_TA_SRC } from "@/components/BrandLogo";
import { useLang } from "@/i18n";
import { useScrollMotion, type MotionConfig } from "@/hooks/useScrollMotion";
import "./home.css";

// Homepage motion (see useScrollMotion): entrances by kind, parallax layers and tilting cards.
//   media: the frame opens while the picture settles · card: rises into focus · text: slides in · split: words rise
const HOME_MOTION: MotionConfig = {
  reveal: [
    [".intro-media, .gl > img, .gl-logo", "rv-media"],
    [".hp, .pb-plan, .pb-form, .pb-sum, .pc, .rvw-card, .bd-row, .gl-q", "rv-card"],
    ["h2.words", "rv-split"],
    [".intro-text > :not(h2), .sub-head > div > :not(h2), .rvw-side > :not(h2), .br-head > :not(h2), .gl-head > div > :not(h2)", "rv-text"],
    [".ev-feat-body > :not(h2), .sub-head > p", "rv-text-r"],
  ],
  // background videos are taller than their frame (see home.css); their shift is capped at that spare height
  parallax: [
    [".intro-owner", -0.06], [".intro-b", 0.12],
    [".her-bg .bg-video", -0.08, 0.035], [".ev-feat-rate", -0.18], [".pc-img img", -0.06, 0.05], [".gl-2", 0.07], [".gl-1", -0.05], [".gl-3", 0.05],
  ],
  tilt: ".hp, .pc, .pb-plan, .rvw-card",
};

/** Homepage-only motion: the hero recedes as you scroll in, and the ingredient ticker runs faster while scrolling. */
function useHeroAndTicker() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hero = document.querySelector<HTMLElement>(".home .hero");
    const heroCopy = document.querySelector<HTMLElement>(".home .hero-copy");
    const heroPanels = document.querySelector<HTMLElement>(".home .hero-panels");
    const ticker = document.querySelector<HTMLElement>(".home .tk-track");
    let lastY = window.scrollY, boost = 0, tickRaf = 0, tickX = 0;
    const heroOut = () => {
      if (!hero || !heroCopy || !heroPanels) return;
      const p = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.9)));
      heroCopy.style.transform = `translate3d(0, ${-p * 90}px, 0) scale(${1 - p * 0.06})`;
      heroCopy.style.opacity = String(1 - p * 1.1);
      heroPanels.style.transform = `translate3d(0, ${-p * 50}px, 0)`;
      heroPanels.style.opacity = String(1 - p * 0.7);
      hero.style.setProperty("--hero-dark", String(p * 0.5));
    };
    let tickerOn = false, half = 0;
    const tick = () => {
      tickRaf = 0;
      if (!ticker || !tickerOn || document.hidden) return;
      half ||= ticker.scrollWidth / 2;
      tickX = (tickX + 0.6 + boost) % half;
      ticker.style.transform = `translate3d(${-tickX}px, 0, 0)`;
      boost *= 0.92;
      tickRaf = requestAnimationFrame(tick);
    };
    // the ticker only runs while it is on screen and the tab is visible
    const tio = new IntersectionObserver(([e]) => { tickerOn = e.isIntersecting; if (tickerOn && !tickRaf) tickRaf = requestAnimationFrame(tick); });
    if (ticker) tio.observe(ticker);
    const onVis = () => { if (!document.hidden && tickerOn && !tickRaf) tickRaf = requestAnimationFrame(tick); };
    document.addEventListener("visibilitychange", onVis);
    // hero styles are written once per frame, not on every scroll event
    let heroRaf = 0;
    const on = () => {
      const y = window.scrollY;
      boost = Math.min(18, boost + Math.abs(y - lastY) * 0.08);
      lastY = y;
      if (!heroRaf && y < window.innerHeight * 1.2 + 200) heroRaf = requestAnimationFrame(() => { heroRaf = 0; heroOut(); });
    };
    heroOut();
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      cancelAnimationFrame(tickRaf); cancelAnimationFrame(heroRaf); tio.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("scroll", on);
      [heroCopy, heroPanels].forEach((el) => { if (el) { el.style.transform = ""; el.style.opacity = ""; } });
    };
  }, []);
}

export function HomePage() {
  useScrollMotion(".home", HOME_MOTION);
  useHeroAndTicker();
  return (
    <div className="home">
      <Hero />
      <Story />
      <IngredientTicker />
      <EventsFeature />
      <Subscribe />
      <Delivery />
      <Reviews />
      <Branches />
      <Gallery />
    </div>
  );
}

/** A heading whose words rise one by one from behind a mask when it scrolls into view. */
function Split({ text, start = 0 }: { text: string; start?: number }) {
  return <>{text.split(" ").map((w, i) => (
    <Fragment key={i}>{i > 0 && " "}<span className="w"><span style={{ "--i": i + start } as React.CSSProperties}>{w}</span></span></Fragment>
  ))}</>;
}

/** The nine ingredients as an endless band; it runs faster while the page is being scrolled. */
function IngredientTicker() {
  const { t } = useLang();
  const row = INGREDIENTS.map((g) => <span key={g.en} className="tk-item">{t(g.en, g.ta)}<span className="tk-ta" lang="ta">{g.ta}</span></span>);
  return (
    <div className="tk" aria-label={t("Ingredients", "பொருட்கள்")}>
      <div className="tk-track" aria-hidden="true">{row}{row}</div>
      <span className="sr-only">{INGREDIENTS.map((g) => g.en).join(", ")}</span>
    </div>
  );
}

/* 1 · Hero: the landing film, with the two main services as its own panels */
function Hero() {
  const { t } = useLang();
  return (
    <section className="hero" aria-label={t("Tradition in every drop", "ஒவ்வொரு துளியிலும் பாரம்பரியம்")}>
      <div className="hero-shade" />
      <div className="container hero-in">
        <div className="hero-copy">
          <span className="hero-kicker">{t("Sri Sastha Paruthipaal · Madurai · Est. 1999", "ஸ்ரீ சாஸ்தா பருத்திப்பால் · மதுரை · 1999")}</span>
          <h1 className="words in"><Split text={t("Tradition in", "ஒவ்வொரு துளியிலும்")} /> <em><Split text={t("Every Drop.", "பாரம்பரியம்.")} start={3} /></em></h1>
          <p>{t(
            "Hot paruthipaal for your celebrations and your mornings. Cooked fresh in Madurai since 1999.",
            "உங்கள் விழாக்களுக்கும் காலைகளுக்கும் சூடான பருத்திப்பால். 1999 முதல் மதுரையில் புதிதாகக் காய்ச்சப்படுகிறது.",
          )}</p>
        </div>
        <div className="hero-panels">
          <a href="#events" className="hp hp-event">
            <span className="hp-tag"><PartyPopper size={15} /> {t("Event orders", "விழா ஆர்டர்கள்")}</span>
            <h2>{t("Weddings, temple functions & festivals", "திருமணம், கோவில் விழா, பண்டிகை")}</h2>
            <p>{t(`Bulk paruthipaal at ₹${EVENT_RATE_PER_LITRE / 100} a litre · pickup, delivery or a live counter`, `லிட்டருக்கு ₹${EVENT_RATE_PER_LITRE / 100} · கடையில், டெலிவரி அல்லது நேரடி கவுண்டர்`)}</p>
            <span className="btn btn-gold">{t("Plan an event order", "விழா ஆர்டர் செய்")} <ArrowRight size={16} /></span>
          </a>
          <a href="#subscribe" className="hp hp-sub">
            <span className="hp-tag"><CalendarCheck size={15} /> {t("Daily subscription", "தினசரி சந்தா")}</span>
            <h2>{t("Every morning, for 7, 15 or 30 days", "தினமும் காலையில், 7, 15, 30 நாட்கள்")}</h2>
            <p>{t("Pick your start date · pay once by UPI · free delivery", "தொடக்க நாளைத் தேர்வு செய்யுங்கள் · ஒரு முறை UPI · இலவச டெலிவரி")}</p>
            <span className="btn btn-primary">{t("Start a subscription", "சந்தா தொடங்கு")} <ArrowRight size={16} /></span>
          </a>
        </div>
        <Link to="/products" className="hero-third"><Truck size={16} /> {t("Or order a 500 ML or 1 L parcel for home delivery", "அல்லது 500 மி.லி / 1 லி பார்சலை வீட்டுக்கு ஆர்டர் செய்யுங்கள்")} <ArrowRight size={15} /></Link>
      </div>
    </section>
  );
}

/* 2 · Event orders: priority one, with a quick planner that carries over to the booking form */
const SERVICE_ICON: Record<ServiceOption, typeof Store> = { PICKUP: Store, DELIVERY: Truck, LIVE_COUNTER: Users };
function EventsFeature() {
  const { t } = useLang();
  const navigate = useNavigate();
  const dates = upcomingDates(2);
  const [plan, setPlan] = useState({ type: EVENT_TYPES[0], date: "", litres: 25, venue: "", service: "DELIVERY" as ServiceOption });
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams({ type: plan.type, litres: String(plan.litres), service: plan.service, ...(plan.date && { date: plan.date }), ...(plan.venue && { venue: plan.venue }) });
    navigate(`/events?${q}#quote`);
  };
  return (
    <section id="events" className="hs ev-feat">
      <div className="container ev-feat-in">
        <div className="ev-feat-media">
          <div className="ev-feat-frame" role="img" aria-label={t("Madurai temple", "மதுரை கோவில்")}>
            <img className="ev-feat-poster" src="/media/temple-first-m.webp" alt="" aria-hidden="true" />
            <BgVideo src="/media/temple-slow-m.mp4" poster="/media/temple-first-m.webp" />
          </div>
          <div className="ev-feat-rate"><strong>₹{EVENT_RATE_PER_LITRE / 100}</strong><span>{t("per litre", "ஒரு லிட்டர்")}</span></div>
        </div>
        <div className="ev-feat-body">
          <span className="eyebrow">{t("Event orders · our speciality", "விழா ஆர்டர்கள்")}</span>
          <h2 className="display-3 words"><Split text={t("Serve hot paruthipaal at your next celebration.", "உங்கள் அடுத்த விழாவில் சூடான பருத்திப்பால்.")} /></h2>
          <p className="lead">{t(
            "Weddings, temple functions, festivals and office events. Tell us the date, how many litres and where, and we prepare it fresh for the day. A small advance confirms the booking.",
            "திருமணம், கோவில் விழா, பண்டிகை, அலுவலக நிகழ்வுகள். தேதி, லிட்டர், இடம் சொல்லுங்கள்; அன்றைக்கே புதிதாகத் தயாரிக்கிறோம்.",
          )}</p>
          <form className="ev-plan" onSubmit={go}>
            <div className="field"><label className="label" htmlFor="ep-type">{t("Occasion", "நிகழ்வு")}</label>
              <select id="ep-type" className="select" value={plan.type} onChange={(e) => setPlan({ ...plan, type: e.target.value })}>{EVENT_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="ep-date">{t("Event date", "தேதி")}</label>
              <input id="ep-date" type="date" className="input" min={dates[1]} value={plan.date} onChange={(e) => setPlan({ ...plan, date: e.target.value })} /></div>
            <div className="field"><label className="label" htmlFor="ep-litres">{t("Quantity (litres)", "அளவு (லிட்டர்)")}</label>
              <input id="ep-litres" type="number" min={1} max={2000} className="input" value={plan.litres} onChange={(e) => setPlan({ ...plan, litres: Math.max(1, Math.min(2000, Number(e.target.value) || 1)) })} /></div>
            <div className="field"><label className="label" htmlFor="ep-venue">{t("Venue", "இடம்")}</label>
              <input id="ep-venue" className="input" value={plan.venue} placeholder={t("Hall or area", "மண்டபம் / பகுதி")} onChange={(e) => setPlan({ ...plan, venue: e.target.value })} /></div>
            <div className="ev-plan-svc" role="radiogroup" aria-label={t("Service", "சேவை")}>
              {SERVICE_OPTIONS.map((o) => {
                const Icon = SERVICE_ICON[o.id];
                return <button type="button" role="radio" aria-checked={plan.service === o.id} key={o.id} className={plan.service === o.id ? "on" : ""} onClick={() => setPlan({ ...plan, service: o.id })}><Icon size={16} /> {t(o.title, o.ta)}</button>;
              })}
            </div>
            <div className="ev-plan-foot">
              <span>{t("From", "குறைந்தது")} <strong>₹{((plan.litres * EVENT_RATE_PER_LITRE) / 100).toLocaleString("en-IN")}</strong>{plan.service !== "PICKUP" && t(" + charges", " + கட்டணம்")}</span>
              <button className="btn btn-primary btn-lg">{t("Plan an event order", "விழா ஆர்டர் செய்")} <ArrowRight size={16} /></button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

/* 4 · Home delivery: the secondary offer */
function Delivery() {
  const { t } = useLang();
  return (
    <section id="product" className="hs hs-white">
      <div className="container">
        <div className="sub-head">
          <div>
            <span className="eyebrow">{t("Home delivery", "வீட்டு டெலிவரி")}</span>
            <h2 className="display-3 words"><Split text={t("A parcel for today, or any day this week.", "இன்றைக்கோ, இந்த வாரத்தில் எந்த நாளுக்கோ ஒரு பார்சல்.")} /></h2>
          </div>
          <p className="lead">{t("Choose the delivery day and a time window at checkout. Sealed hot, delivered in Madurai district.", "செக்அவுட்டில் நாளும் நேரமும் தேர்வு செய்யுங்கள். மதுரை மாவட்டத்தில் டெலிவரி.")}</p>
        </div>
        <ParcelCards />
      </div>
    </section>
  );
}

/* 2 · Our story: welcome, the founder and our journey, in one section over the temple film */
function Story() {
  const { t } = useLang();
  const { data: branches } = usePublicBranches();
  return (
    <section id="story" className="hs story">
      <div className="her-bg" aria-hidden="true">
        <BgVideo src="/media/temple-slow-m.mp4" poster="/media/temple-first-m.webp" />
      </div>
      <div className="container intro">
        <div className="intro-media">
          <OwnerPortrait />
          <img className="intro-b" src="/media/pour-mid.webp" alt={t("Paruthipaal being poured into a glass", "டம்ளரில் ஊற்றப்படும் பருத்திப்பால்")} decoding="async" />
        </div>
        <div className="intro-text">
          <span className="eyebrow">{t("Vanakkam · Our story", "வணக்கம் · எங்கள் கதை")}</span>
          <h2 className="display-3 words"><Split text={t("Thank you for visiting us. It is our honour to serve you a Madurai tradition.", "வருகைக்கு நன்றி. மதுரையின் பாரம்பரியத்தை உங்களுக்குப் பரிமாறுவதில் பெருமை கொள்கிறோம்.")} /></h2>
          <p className="lead">{t(
            "With your kind support, Sri Sastha Paruthipaal has served Madurai since 1999. We humbly began as a small roadside stall, and today we warmly welcome you at our shop on Netaji Road, near Periyar Bus Stand, and at our market counters.",
            "உங்கள் அன்பான ஆதரவுடன், 1999 முதல் ஸ்ரீ சாஸ்தா பருத்திப்பால் மதுரையில் சேவை செய்து வருகிறது. ஒரு சிறிய சாலையோரக் கடையாகத் தொடங்கிய நாங்கள், இன்று பெரியார் பேருந்து நிலையம் அருகே நேதாஜி சாலையில் உள்ள எங்கள் கடையிலும் சந்தைக் கவுண்டர்களிலும் உங்களை அன்புடன் வரவேற்கிறோம்.",
          )}</p>
          <p>{t(
            "Mr. K. Rajsamy has guided us from the very first day, carefully protecting the quality and the recipe. Ten people work alongside him today, many of them with us from the beginning. We prepare only paruthipaal, freshly cooked each morning in a copper pot and sweetened with country jaggery, and it is always our pleasure to serve you.",
            "முதல் நாள் முதல் திரு. கே. ராஜ்சாமி அவர்கள் தரத்தையும் செய்முறையையும் கவனமாகக் காத்து எங்களை வழிநடத்துகிறார். இன்று பத்து பேர் அவருடன் பணியாற்றுகின்றனர்; அவர்களில் பலர் தொடக்கம் முதலே எங்களுடன் உள்ளனர். தினமும் காலையில் செப்புப் பாத்திரத்தில் காய்ச்சி, நாட்டு வெல்லம் சேர்த்த பருத்திப்பாலை உங்களுக்குப் பரிமாறுவது எங்கள் மகிழ்ச்சி.",
          )}</p>
          <ul className="her-steps">
            <li><b>1999</b>{t("A small roadside stall", "சிறிய சாலையோரக் கடை")}</li>
            <li><b>{t("Netaji Rd", "நேதாஜி சாலை")}</b>{t("Our shop near Periyar Bus Stand", "பெரியார் பேருந்து நிலையம் அருகே")}</li>
            <li><b>{t("Today", "இன்று")}</b>{t(`${branches?.length ?? "Our"} shop and counters · ${SHOP.rating}★ from ${SHOP.reviewCount} reviews`, `${branches?.length ?? ""} கடை, கவுண்டர்கள் · ${SHOP.rating}★`)}</li>
          </ul>
          <Link to="/our-story" className="btn btn-gold">{t("Read our full story", "எங்கள் முழு கதை")} <ArrowRight size={16} /></Link>
        </div>
      </div>
    </section>
  );
}

// The proprietor's own photo (public/media/owner.jpg, also used on Our Story). Until it is added, the brand
// roundel, which carries the founder's photograph, is shown unaltered in its place.
const OWNER_PHOTO = "/media/owner.jpg";
function OwnerPortrait() {
  const { t, lang } = useLang();
  const [missing, setMissing] = useState(false);
  return (
    <figure className={`intro-a intro-owner ${missing ? "logo" : ""}`}>
      {missing
        ? <img src={lang === "ta" ? LOGO_TA_SRC : LOGO_SRC} alt={t("Sri Sastha Paruthipaal roundel with the founder's photograph", "நிறுவனரின் புகைப்படத்துடன் ஸ்ரீ சாஸ்தா சின்னம்")} />
        : <img src={OWNER_PHOTO} alt={t("Mr. K. Rajsamy, proprietor of Sri Sastha Paruthipaal", "திரு. கே. ராஜ்சாமி, உரிமையாளர்")} onError={() => setMissing(true)} />}
      <figcaption><strong>{t("Mr. K. Rajsamy", "திரு. கே. ராஜ்சாமி")}</strong><span>{t("Proprietor · serving you since 1999", "உரிமையாளர் · 1999 முதல்")}</span></figcaption>
    </figure>
  );
}

/* 3 · Subscription */
function Subscribe() {
  const { t } = useLang();
  return (
    <section id="subscribe" className="hs hs-beige">
      <div className="container">
        <div className="sub-head">
          <div>
            <span className="eyebrow">{t("Daily subscription", "தினசரி சந்தா")}</span>
            <h2 className="display-3 words"><Split text={t("Start a subscription. Wake up to it every morning.", "சந்தா தொடங்குங்கள். தினமும் காலையில் உங்கள் வீட்டுக்கே.")} /></h2>
          </div>
          <p className="lead">{t("Choose 7, 15 or 30 days, the parcel size, how many each day and your start date. Pay once by UPI; we deliver every morning.", "7, 15, 30 நாட்கள், அளவு, ஒரு நாளைக்கு எத்தனை, தொடக்க நாள். ஒரு முறை UPI-ல் செலுத்துங்கள்.")}</p>
        </div>
        <PlanBuilder />
        <div className="sub-mine"><MyPlans /></div>
      </div>
    </section>
  );
}


/* Customer reviews: genuine Google reviews, quoted as written */
function Reviews() {
  const { t } = useLang();
  const rating = Number(SHOP.rating);
  const wall = useRef<HTMLDivElement>(null);
  // Gentle parallax on wide screens: as the section scrolls past, the two review columns drift in opposite
  // directions. Phones get a swipeable row instead; reduced-motion visitors get a still wall.
  useEffect(() => {
    const el = wall.current;
    if (!el) return;
    const mq = window.matchMedia("(min-width: 901px) and (prefers-reduced-motion: no-preference)");
    const cols = Array.from(el.querySelectorAll<HTMLElement>(".rvw-col"));
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!mq.matches) { cols.forEach((c) => (c.style.transform = "")); return; }
      const r = el.getBoundingClientRect();
      // -1 when the wall enters at the bottom, +1 when it leaves at the top
      const p = Math.max(-1, Math.min(1, 1 - (r.top + r.height / 2) / (window.innerHeight / 2)));
      cols[0].style.transform = `translate3d(0, ${p * -40}px, 0)`;
      cols[1].style.transform = `translate3d(0, ${p * 60 + 60}px, 0)`;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    mq.addEventListener("change", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); mq.removeEventListener("change", on); };
  }, []);
  return (
    <section id="reviews" className="hs hs-white">
      <div className="container rvw">
        <div className="rvw-side">
          <span className="eyebrow">{t("Customer reviews", "வாடிக்கையாளர் கருத்துகள்")}</span>
          <h2 className="display-3 words"><Split text={t("Loved in Madurai, glass after glass.", "மதுரையின் விருப்பம், டம்ளர் டம்ளராக.")} /></h2>
          <div className="rvw-score">
            <strong>{SHOP.rating}</strong>
            <div>
              <span className="rvw-stars" aria-label={`${SHOP.rating} out of 5 stars`}>
                <span className="rvw-stars-bg">★★★★★</span>
                <span className="rvw-stars-fill" style={{ width: `${(rating / 5) * 100}%` }}>★★★★★</span>
              </span>
              <span className="rvw-count">{SHOP.reviewCount} {t("Google reviews", "கூகுள் மதிப்புரைகள்")}</span>
            </div>
          </div>
          <ul className="rvw-topics" aria-label={t("Reviewers mention", "குறிப்பிடப்பட்டவை")}>
            {REVIEW_TOPICS.slice(0, 6).map(([topic, n]) => <li key={topic}>{topic} <b>{n}</b></li>)}
          </ul>
          <a className="text-link" href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer">{t("Read all reviews on Google", "அனைத்து மதிப்புரைகளும் கூகுளில்")} <ArrowUpRight size={15} /></a>
        </div>
        <div className="rvw-list" ref={wall}>
          {[0, 1].map((c) => (
            <div className="rvw-col" key={c}>
              {REVIEW_QUOTES.filter((_, i) => i % 2 === c).map((r) => (
                <blockquote className="rvw-card" key={r.name}>
                  <span className="rvw-q-stars" aria-hidden="true">★★★★★</span>
                  <p>“{r.text}”</p>
                  <footer>
                    <span className="rvw-avatar" aria-hidden="true">{r.name[0]}</span>
                    <span><strong>{r.name}</strong><small>{r.localGuide ? "Local Guide · " : ""}Google review</small></span>
                  </footer>
                </blockquote>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* 7 · Branches */
function Branches() {
  const { t } = useLang();
  return (
    <section id="branches" className="hs">
      <div className="container br">
        <div className="br-head">
          <span className="eyebrow">{t("Find us", "எங்களைக் காண")}</span>
          <h2 className="display-3 words"><Split text={t("Our shop and market counters", "எங்கள் கடை மற்றும் சந்தைக் கவுண்டர்கள்")} /></h2>
          <p className="lead">{SHOP.address}</p>
          <Link to="/branches" className="text-link">{t("Branches and delivery area", "கிளைகள் மற்றும் டெலிவரி பகுதி")} <ArrowRight size={15} /></Link>
        </div>
        <BranchDirectory />
      </div>
    </section>
  );
}

/* 8 · Gallery: our own photographs, with what Google reviewers say */
function Gallery() {
  const { t } = useLang();
  const [q1, q2] = REVIEW_QUOTES;
  return (
    <section id="gallery" className="hs hs-white">
      <div className="container">
        <div className="gl-head">
          <div>
            <span className="eyebrow">{t("From our counter", "எங்கள் கவுண்டரிலிருந்து")}</span>
            <h2 className="display-3 words"><Split text={t("Fresh from our copper pot, every morning.", "தினமும் காலையில், எங்கள் செப்புப் பாத்திரத்திலிருந்து.")} /></h2>
          </div>
        </div>
        <div className="gl">
          <img className="gl-1" src="/media/closeup.webp" alt={t("Hot paruthipaal in a glass", "டம்ளரில் சூடான பருத்திப்பால்")} decoding="async" />
          <blockquote className="gl-q"><p>“{q1.text}”</p><footer>{q1.name} · Google</footer></blockquote>
          <img className="gl-2" src="/media/pour-poster.jpg" alt={t("Paruthipaal being poured", "ஊற்றப்படும் பருத்திப்பால்")} decoding="async" />
          <div className="gl-logo"><img src={LOGO_TA_SRC} alt="ஸ்ரீ சாஸ்தா பருத்திப்பால்" decoding="async" /></div>
          <img className="gl-3" src="/media/temple-first-m.webp" alt={t("Madurai", "மதுரை")} decoding="async" />
          <blockquote className="gl-q gl-q2"><p>“{q2.text}”</p><footer>{q2.name} · Google</footer></blockquote>
        </div>
        <p className="gl-note">{HEALTH_NOTE}</p>
      </div>
    </section>
  );
}
