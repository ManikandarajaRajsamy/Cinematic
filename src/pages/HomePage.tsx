import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Accordion } from "@/components/Accordion";
import { Outlets } from "@/components/Outlets";
import { fillDeliveryText, useDeliverySettings } from "@/api/client";
import { useIstGreeting } from "@/hooks/useIstGreeting";
import { FAQS } from "@/data/catalog";
import {
  BEATS, FLOAT_CARDS, INGREDIENTS, SHOP, HERO_LOCATION, HEALTH_NOTE, REVIEW_QUOTES, REVIEW_TOPICS, GOOGLE_REVIEWS_URL,
} from "@/data/home";
import "./home.css";

gsap.registerPlugin(ScrollTrigger);
// mobile address-bar show/hide should not re-measure every trigger
ScrollTrigger.config({ ignoreMobileResize: true });

const PHONE_MQ = "(max-width: 760px)";
const MOTION_OK = "(prefers-reduced-motion: no-preference)";
const FRAME_COUNT = 100;
// Glass position inside each frame set, so the round crop always keeps it centred.
const FOCAL = { desktop: { x: 0.74, y: 0.58 }, phone: { x: 0.48, y: 0.52 } };
const frameUrl = (phone: boolean, i: number) => `/frames/${phone ? "m" : "g"}${String(i).padStart(3, "0")}.webp`;

const matches = (q: string) => typeof window !== "undefined" && window.matchMedia(q).matches;

/** Splits text into word spans for the word-by-word reveal. */
function Words({ text }: { text: string }) {
  return <>{text.split(" ").map((w, i) => <span className="w" key={i}>{w}</span>)}</>;
}

export function HomePage() {
  const [motion] = useState(() => matches(MOTION_OK));
  return (
    <div className={`home ${motion ? "" : "home-static"}`}>
      <HomeHeader />
      {motion ? <GlassHero /> : <StaticHero />}
      <Ingredients />
      <Outlets />
      <Products />
      <Plans />
      <Reviews />
      <Questions />
      <HomeFooter />
      <SectionReveals enabled={motion} />
    </div>
  );
}

/* ================= Header ================= */
function HomeHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`hh ${scrolled ? "scrolled" : ""}`}>
      <Link to="/" className="hh-brand" aria-label="Sri Sastha Paruthipaal home">
        <img src="/brand/logo.png" alt="" width={40} height={34} />
        <span>Sri Sastha Paruthipaal</span>
      </Link>
      <nav className="hh-links" aria-label="Homepage sections">
        <a href="#outlets">Outlets</a>
        <a href="#ingredients">Ingredients</a>
        <a href="#products">Products</a>
        <a href="#faq">Questions</a>
      </nav>
      <DeliveryChip />
      <Link to="/products" className="pill">Order online <ArrowRight size={15} /></Link>
    </header>
  );
}

function DeliveryChip() {
  const { data: s } = useDeliverySettings();
  if (!s || !(s.free_radius_km > 0)) return null;
  return <span className="hh-chip"><span className="dot" />Free delivery within {s.free_radius_km} km</span>;
}

/* ================= S1: pinned glass hero ================= */
function BeatCopy({ i }: { i: number }) {
  const b = BEATS[i];
  const g = useIstGreeting();
  if (i === 0) {
    const first = BEATS[0];
    return (
      <>
        <p className="hg-tag"><span className="dot" />{HERO_LOCATION.en} · {HERO_LOCATION.since}</p>
        <h1 className="h-display">
          <span className="line hg-greet" key={g.en}><Words text={g.en} /></span>
          <span className="line"><Words text={first.line} /></span>
        </h1>
        <div className="btns">
          <Link to="/products" className="btn-o">Order online <ArrowRight size={15} /></Link>
          <a href="#ingredients" className="btn-g">Why paruthipaal</a>
        </div>
      </>
    );
  }
  return (
    <>
      <h2 className="h-display"><span className="line"><Words text={b.line} /></span>{b.grey && <span className="line grey"><Words text={b.grey} /></span>}</h2>
      {b.points.length > 0 && (
        <ul className="beat-points">{b.points.map((pt) => <li key={pt}><span className="dot w" /><span><Words text={pt} /></span></li>)}</ul>
      )}
    </>
  );
}

function OrderCard() {
  const g = useIstGreeting();
  return (
    <>
      <div className="oc-top">
        <img src="/brand/logo.png" alt="Sri Sastha Paruthipaal" width={52} height={45} />
      </div>
      <div>
        <p className="oc-hello">{g.en} Thank you for visiting us!</p>
      </div>
      <ul className="oc-list">
        <li><span className="dot" />500 ML · 1 L parcels, delivered hot in Madurai district</li>
        <li><span className="dot" />Daily plans available</li>
        <li><span className="dot" />Bulk orders and live counters for your functions</li>
      </ul>
      <Link to="/products" className="btn-o">Order online <ArrowRight size={15} /></Link>
      <p className="oc-thanks">We'd be happy to serve you.</p>
    </>
  );
}

function GlassHero() {
  const root = useRef<HTMLElement>(null);
  const [phone] = useState(() => matches(PHONE_MQ));

  useEffect(() => {
    const el = root.current!;
    const q = gsap.utils.selector(el);
    const glass = q(".hg-glass")[0] as HTMLElement;
    const frameCanvas = q(".hg-frames")[0] as HTMLCanvasElement;
    const halo = q(".hg-halo")[0] as HTMLCanvasElement;
    const fctx = frameCanvas.getContext("2d");
    const hctx = halo.getContext("2d");
    // phones show the same landscape pour as desktop, cropped around the glass
    const focal = FOCAL.desktop;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const hdpr = 1; // the halo specks look the same at 1x and cost a quarter of the pixels

    /* --- pour frames: first 20 now, the rest while idle --- */
    // A frame counts as ready only after decode(), which runs off the main thread,
    // so drawing it never triggers a synchronous decode.
    const frames: HTMLImageElement[] = [];
    const ready: boolean[] = [];
    let wanted = 0, drawn = -1;
    const load = (i: number) => {
      if (frames[i]) return;
      const img = new Image();
      img.src = frameUrl(false, i);
      frames[i] = img;
      img.decode().then(() => { ready[i] = true; if (Math.abs(i - wanted) < 4) drawFrame(wanted, true); }).catch(() => { /* keep the poster */ });
    };
    const idle = (window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 150))) as (cb: () => void) => number;
    // first 20 frames as soon as the page has loaded and the browser is idle; the poster covers until then
    let preloadId = 0;
    const preload = () => { preloadId = idle(() => { for (let i = 0; i < 20; i++) load(i); }); };
    if (document.readyState === "complete") preload(); else window.addEventListener("load", preload, { once: true });
    let nextFrame = 20, idleId = 0;
    const loadRest = () => {
      for (let n = 0; n < 8 && nextFrame < FRAME_COUNT; n++) load(nextFrame++);
      if (nextFrame < FRAME_COUNT) idleId = idle(loadRest);
    };
    // the rest are fetched once the visitor starts scrolling, so they never compete with first paint
    const afterLoad = () => { idleId = idle(loadRest); };
    window.addEventListener("scroll", afterLoad, { once: true, passive: true });

    function drawFrame(i: number, force = false) {
      wanted = i;
      let k = i;
      while (k > 0 && !ready[k]) k--;
      const img = frames[k];
      if (!fctx || !ready[k] || (k === drawn && !force)) return;
      drawn = k;
      const cw = frameCanvas.width, ch = frameCanvas.height, iw = img.naturalWidth, ih = img.naturalHeight;
      const s = Math.max(cw / iw, ch / ih) * 1.08; // slight overscan so the glass fills the circle
      const w = iw * s, h = ih * s;
      const x = Math.min(0, Math.max(cw - w, cw / 2 - focal.x * w));
      const y = Math.min(0, Math.max(ch - h, ch / 2 - focal.y * h));
      fctx.clearRect(0, 0, cw, ch);
      fctx.drawImage(img, x, y, w, h);
    }

    /* --- particle halo: a slow ring of steam and spice specks, kept outside the glass --- */
    const N = phone ? 300 : 800;
    const parts = Array.from({ length: N }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 1.08 + Math.pow(Math.random(), 1.6) * 0.75, // in glass radii, so it never overlaps the product
      s: (0.4 + Math.random() * 1.4) * (Math.random() < 0.5 ? 1 : 0.6),
      v: 0.00012 + Math.random() * 0.00028,
      o: 0.15 + Math.random() * 0.6,
      warm: Math.random() < 0.22,
      wob: Math.random() * Math.PI * 2,
    }));
    let gx = 0, gy = 0, gr = 0;
    const measure = () => {
      halo.width = Math.round(halo.clientWidth * hdpr);
      halo.height = Math.round(halo.clientHeight * hdpr);
      frameCanvas.width = Math.round(frameCanvas.clientWidth * dpr);
      frameCanvas.height = Math.round(frameCanvas.clientHeight * dpr);
      const hr = halo.getBoundingClientRect(), g = glass.getBoundingClientRect();
      gx = (g.left - hr.left + g.width / 2) * hdpr;
      gy = (g.top - hr.top + g.height / 2) * hdpr;
      gr = (g.width / 2) * hdpr;
      drawFrame(wanted, true);
    };
    let raf = 0, visible = true, last = 0;
    const tick = (t: number) => {
      raf = 0;
      if (!hctx || !visible || document.hidden) return;
      if (t - last < 33) { raf = requestAnimationFrame(tick); return; } // ~30fps is plenty for slow drift
      last = t;
      hctx.clearRect(0, 0, halo.width, halo.height);
      for (const p of parts) {
        const a = p.a + t * p.v;
        const r = gr * (p.r + Math.sin(t * 0.0006 + p.wob) * 0.025);
        hctx.globalAlpha = p.o;
        hctx.fillStyle = p.warm ? "#FF7A18" : "#FAF7F0";
        hctx.fillRect(gx + Math.cos(a) * r, gy + Math.sin(a) * r * 0.92, p.s * hdpr, p.s * hdpr);
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (haloReady && !raf && visible && !document.hidden) raf = requestAnimationFrame(tick); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); });
    io.observe(el);
    document.addEventListener("visibilitychange", start);
    window.addEventListener("resize", measure);

    /* --- scroll timeline --- */
    const ctx = gsap.context(() => {
      const beats = q(".hg-beat");
      const words = beats.map((b) => b.querySelectorAll(".w"));
      const extras = beats.map((b) => b.querySelectorAll(".btns > *"));
      const served = q('[data-card="since"]')[0] as HTMLElement; // the card the hero zooms into
      const order = q(".hg-order")[0] as HTMLElement;
      const stage = q(".hg-stage")[0] as HTMLElement;

      const wordIn = { opacity: 1, y: 0, filter: "blur(0px)", stagger: 0.04, ease: "power3.out" };
      gsap.set(q(".hg-beat .w"), { opacity: 0, y: 20, filter: "blur(6px)" });
      gsap.set(q(".hg-beat .btns > *"), { opacity: 0, y: 20 });
      gsap.set(order, { xPercent: -50, yPercent: -50, opacity: 0 });

      // beat 1 plays in on load
      gsap.to(words[0], { ...wordIn, duration: 0.9, delay: 0.2 });
      gsap.to(extras[0], { opacity: 1, y: 0, duration: 0.9, delay: 0.7, stagger: 0.08, ease: "power3.out" });
      // the glass is visible from the first paint (it is the page's largest image); it only settles in scale
      gsap.fromTo(glass, { scale: 0.96 }, { scale: 1, duration: 1.6, ease: "expo.out" });

      // slow sine drift on every floating card
      q(".hc-card").forEach((c, i) => {
        gsap.to(c, { y: i % 2 ? 12 : -12, rotation: i % 2 ? -1.5 : 1.5, duration: 8 + i * 1.1, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });

      const tl = gsap.timeline();
      tl.to({ f: 0 }, { f: FRAME_COUNT - 1, duration: 7, ease: "none", onUpdate() { drawFrame(Math.round(this.targets()[0].f)); } }, 0);
      // Beat 1 leaves line by line. The intro animates its words and buttons; the scroll-out animates their
      // parents, so a ScrollTrigger refresh can never revert beat 1 to its hidden pre-intro state.
      tl.to(beats[0].querySelectorAll(".hg-tag, .line, .ta, .beat-sub, .btns"), { opacity: 0, y: -20, duration: 0.4, stagger: 0.04 }, 1.7);
      // 4 scroll stops: welcome (0), serve (2.5), benefits (5), then the order card (7.5)
      for (let i = 1; i < BEATS.length; i++) {
        const at = i * 2.5;
        tl.to(words[i], { ...wordIn, duration: 0.4, stagger: 0.03 }, at + 0.1);
        tl.to(words[i], { opacity: 0, y: -20, duration: 0.4, stagger: 0.02 }, at + 1.9);
      }
      // centred behind the glass; drifts gently upward with the scroll (vertical parallax keeps it centred)
      // GSAP owns this element's transform, so the vertical centring (-50%) is set here too
      tl.fromTo(q(".hg-loc"), { yPercent: -50, y: 0 }, { yPercent: -50, y: -40, ease: "none", duration: 10 }, 0);
      // parallax by depth layer
      q(".hc-float").forEach((f) => {
        tl.to(f, { y: -140 * Number((f as HTMLElement).dataset.depth), ease: "none", duration: 8 }, 0);
      });

      // zoom into the "Since 1999" card: the order card grows out of it to the centre
      // measured when the zoom first renders, so it starts from wherever the drifting card is
      let card: { x: number; y: number; scale: number } | null = null;
      const fromCard = () => {
        if (!card) {
          const s = stage.getBoundingClientRect(), c = served.getBoundingClientRect();
          card = { x: c.left + c.width / 2 - (s.left + s.width / 2), y: c.top + c.height / 2 - (s.top + s.height / 2), scale: c.width / order.offsetWidth };
        }
        return card;
      };
      tl.to(q(".hc-float:not([data-card-wrap='since'])"), { opacity: 0, duration: 0.6 }, 7.5)
        .to([glass, halo], { opacity: 0, scale: 0.9, duration: 1.5, ease: "expo.inOut" }, 7.5)
        .fromTo(order,
          { x: () => fromCard().x, y: () => fromCard().y, scale: () => fromCard().scale, opacity: 0 },
          { x: 0, y: 0, scale: 1, opacity: 1, duration: 1.5, ease: "expo.inOut", immediateRender: false }, 7.5)
        .to(served, { opacity: 0, scale: 1.6, duration: 0.6, ease: "expo.inOut" }, 7.5)
        .set({}, {}, 10);

      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: () => "+=" + window.innerHeight * (phone ? 2.5 : 4),
        pin: stage,
        scrub: 1,
        animation: tl,
      });
    }, el);

    measure();
    // the halo is decoration: start it once the page has loaded
    let haloReady = document.readyState === "complete";
    const startHalo = () => { haloReady = true; start(); };
    if (!haloReady) window.addEventListener("load", startHalo, { once: true }); else start();
    return () => {
      ctx.revert();
      io.disconnect();
      cancelAnimationFrame(raf);
      (window.cancelIdleCallback ?? window.clearTimeout)(idleId);
      document.removeEventListener("visibilitychange", start);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", afterLoad);
      window.removeEventListener("load", preload);
      (window.cancelIdleCallback ?? window.clearTimeout)(preloadId);
      window.removeEventListener("load", startHalo);
    };
  }, [phone]);

  return (
    <section ref={root} className="hg" aria-label="Hot paruthipaal, fresh every day">
      <div className="hg-stage">
        <div className="hg-glow" aria-hidden="true" />
        <p className="hg-loc" aria-hidden="true">ALANGANALLUR</p>
        <canvas className="hg-halo" aria-hidden="true" />
        <div className="hg-glass">
          <img src="/media/pour-poster.jpg" alt="" {...{ fetchpriority: "high" }} />
          <canvas className="hg-frames" role="img" aria-label="A glass of hot paruthipaal" />
        </div>
        {FLOAT_CARDS.map((c) => (
          <div key={c.id} className={`hc-float ${c.phone ? "" : "desk-only"}`} data-depth={c.depth} data-card-wrap={c.id}
            style={{ "--x": `${c.x}vmin`, "--y": `${c.y}vmin`, "--mx": `${c.mx}vw`, "--my": `${c.my}vw` } as React.CSSProperties}>
            <div className="hc-card glass-card" data-card={c.id}>
              <span className="kicker"><span className="dot" />{c.label}</span>
              <span className="hc-text">{c.text}</span>
            </div>
          </div>
        ))}
        {BEATS.map((b, i) => (
          <div key={i} className={`hg-beat ${b.side}`}><BeatCopy i={i} /></div>
        ))}
        <div className="hg-order glass-card"><OrderCard /></div>
      </div>
    </section>
  );
}

function StaticHero() {
  return (
    <section className="hg-static" aria-label="Hot paruthipaal, fresh every day">
      <div className="hg-static-glass">
        <img src="/media/closeup.webp" alt="A glass of hot paruthipaal" />
      </div>
      {BEATS.map((b, i) => <div key={i} className="hg-static-beat"><BeatCopy i={i} /></div>)}
      <div className="hg-order-static glass-card"><OrderCard /></div>
    </section>
  );
}

/* ================= S2: bento ================= */
function Ingredients() {
  return (
    <section id="ingredients" className="sec">
      <div className="wrap">
        <p className="kicker reveal"><b>01</b> — Ingredients</p>
        <h2 className="h-display reveal"><span className="line">Nine ingredients.</span><span className="line grey">Nothing else.</span></h2>
        <div className="bento">
          <figure className="glass-card b-photo">
            <div className="b-photo-img"><img src="/media/closeup.webp" alt="Our paruthipaal, as served" loading="lazy" /></div>
            <figcaption className="kicker"><span className="dot" />Our paruthipaal, as served</figcaption>
          </figure>
          {INGREDIENTS.map((g, i) => (
            <div className="glass-card b-ing" key={g.en}>
              <span className="kicker"><b>{String(i + 1).padStart(2, "0")}</b></span>
              <h3>{g.en}</h3>
              <p className="ta">{g.ta}</p>
              <p className="muted">{g.note}</p>
            </div>
          ))}
          <div className="glass-card b-num"><strong>9</strong><span className="kicker">ingredients</span></div>
          <div className="glass-card b-num b-wide"><strong>1999</strong><span className="kicker">serving since</span></div>
        </div>
        <p className="footnote">{HEALTH_NOTE}</p>
      </div>
    </section>
  );
}

/* ================= S4: products ================= */
function Products() {
  const { data: settings } = useDeliverySettings();
  return (
    <section id="products" className="sec">
      <div className="wrap">
        <p className="kicker reveal"><b>03</b> — Order</p>
        <h2 className="h-display reveal"><span className="line">At your home.</span><span className="line grey">Or at your function.</span></h2>
        <div className="two-cards">
          <article className="glass-card pcard2">
            <span className="kicker"><span className="dot" />Parcels · 500 ML and 1 L</span>
            <h3>Sealed hot and delivered in Madurai.{settings && ` Free within ${settings.free_radius_km} km of Periyar Bus Stand.`}</h3>
            <ul className="ticks">
              <li><Check size={16} />Delivered hot</li><li><Check size={16} />Pick a time slot</li><li><Check size={16} />Pay online or cash on delivery</li>
            </ul>
            <Link to="/products" className="btn-o">Order online <ArrowRight size={15} /></Link>
          </article>
          <article className="glass-card pcard2">
            <span className="kicker"><span className="dot" />Functions &amp; bulk</span>
            <h3>Weddings, festivals and offices. Bulk orders and live counters.</h3>
            <ul className="ticks">
              <li><Check size={16} />Pick your date</li><li><Check size={16} />Bulk delivery or live counter</li><li><Check size={16} />Small advance to book</li>
            </ul>
            <Link to="/events" className="btn-g">Book for a function <ArrowRight size={15} /></Link>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ================= S5: three ways ================= */
function Plans() {
  return (
    <section className="sec">
      <div className="wrap">
        <p className="kicker reveal"><b>04</b> — Three ways</p>
        <h2 className="h-display reveal"><span className="line">Start your day hot.</span><span className="line grey">Your way.</span></h2>
        <div className="plans">
          <article className="glass-card plan">
            <span className="kicker">Parcel</span><h3>500 ML parcel</h3><p className="muted">Good for two glasses.</p>
            <Link to="/products" className="btn-g">See in shop <ArrowRight size={15} /></Link>
          </article>
          <article className="glass-card plan plan-hi">
            <span className="tag">Saves 15%</span>
            <span className="kicker">Subscription</span><h3>Daily plan</h3>
            <p className="muted">Fresh at your door on the days you choose.</p>
            <ul className="ticks"><li><Check size={16} />7, 15 or 30 days</li><li><Check size={16} />15% off every parcel</li></ul>
            <Link to="/subscriptions" className="btn-o">Start a plan <ArrowRight size={15} /></Link>
          </article>
          <article className="glass-card plan">
            <span className="kicker">Parcel</span><h3>1 L parcel</h3><p className="muted">For the family.</p>
            <Link to="/products" className="btn-g">See in shop <ArrowRight size={15} /></Link>
          </article>
        </div>
        <p className="visit-bar glass-card">Visiting Madurai? Have it hot at our shop near Periyar Bus Stand · open daily 6:30 am – 8:30 pm</p>
      </div>
    </section>
  );
}

/* ================= S6: reviews ================= */
function Reviews() {
  const rating = Number(SHOP.rating);
  // two staggered columns: odd and even reviews, so the right side reads like a moving wall
  const cols = [REVIEW_QUOTES.filter((_, i) => i % 2 === 0), REVIEW_QUOTES.filter((_, i) => i % 2 === 1)];
  return (
    <section id="reviews" className="sec">
      <div className="wrap rv">
        <div className="rv-side">
          <p className="kicker reveal"><b>05</b> — What people say</p>
          <h2 className="h-display reveal"><span className="line">Loved in Madurai.</span><span className="line grey">Glass after glass.</span></h2>
          <div className="rv-score reveal">
            <strong>{SHOP.rating}</strong>
            <div>
              <span className="rv-stars" aria-label={`${SHOP.rating} out of 5 stars`}>
                <span className="rv-stars-bg">★★★★★</span>
                <span className="rv-stars-fill" style={{ width: `${(rating / 5) * 100}%` }}>★★★★★</span>
              </span>
              <span className="muted">{SHOP.reviewCount} Google reviews</span>
            </div>
          </div>
          <p className="kicker rv-topics-label reveal">Reviewers mention</p>
          <ul className="rv-topics reveal">
            {REVIEW_TOPICS.map(([topic, n]) => <li key={topic}>{topic} <b>{n}</b></li>)}
          </ul>
          <a className="text-link reveal" href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer">Read all reviews on Google <ArrowRight size={15} /></a>
        </div>
        <div className="rv-wall">
          {cols.map((col, c) => (
            <div className="rv-col" key={c}>
              {col.map((r) => (
                <blockquote className="glass-card rv-card" key={r.name}>
                  <span className="rv-mark" aria-hidden="true">“</span>
                  <p>{r.text}</p>
                  <footer>
                    <span className="rv-avatar" aria-hidden="true">{r.name[0]}</span>
                    <span className="rv-who">
                      <strong>{r.name}</strong>
                      <span className="kicker">{r.localGuide ? "Local Guide · " : ""}Google review</span>
                    </span>
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

/* ================= S7: questions ================= */
function Questions() {
  const { data: settings } = useDeliverySettings();
  const faqs = FAQS.map((f) => ({ q: f.q, a: fillDeliveryText(f.a, settings) }));
  return (
    <section id="faq" className="sec">
      <div className="wrap faq">
        <div>
          <p className="kicker reveal"><b>06</b> — Questions</p>
          <h2 className="h-display reveal"><span className="line">Questions.</span><span className="line grey">Answered.</span></h2>
        </div>
        <Accordion items={faqs} />
      </div>
    </section>
  );
}

/* ================= S8: footer ================= */
function HomeFooter() {
  return (
    <footer className="hf">
      <div className="wrap hf-top">
        <div className="hf-brand">
          <img src="/brand/logo.png" alt="Sri Sastha Paruthipaal logo" width={56} height={48} />
          <p className="muted">Hot, traditional paruthipaal, made fresh in Madurai since 1999.</p>
          <Link to="/products" className="pill">Order online <ArrowRight size={15} /></Link>
        </div>
        <nav className="hf-cols" aria-label="Footer">
          <div><span className="kicker">Order</span><Link to="/products">Shop</Link><Link to="/subscriptions">Daily plan</Link><Link to="/tracking">Track order</Link></div>
          <div><span className="kicker">Visit</span><p className="muted">{SHOP.address}</p><p className="muted">{SHOP.hours}</p></div>
          <div><span className="kicker">Help</span><a href="#faq">FAQ</a><Link to="/contact">Contact</Link><Link to="/contact">WhatsApp</Link></div>
          <div><span className="kicker">Policies</span><Link to="/policies#terms">Terms</Link><Link to="/policies#privacy">Privacy</Link><Link to="/policies#delivery">Shipping</Link><Link to="/policies#refund">Refunds</Link><Link to="/policies#cancellation">Cancellation</Link></div>
        </nav>
      </div>
      <p className="hf-copy">© 2026 Sri Sastha Paruthipaal · Madurai</p>
    </footer>
  );
}

/* ================= Section reveals (S2–S8) ================= */
function SectionReveals({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    // Everything here is below the fold, so it is set up after the page has loaded and is idle,
    // keeping ScrollTrigger's measuring work out of the first paint.
    const ctx = gsap.context(() => {});
    const setup = () => ctx.add(() => {
      // the short pin goes first so every trigger below it is measured with the pin spacing included
      ScrollTrigger.create({ trigger: "#products", start: "top top", end: "+=40%", pin: true });
      gsap.fromTo(".two-cards > *", { opacity: 0, y: 40, scale: 0.96 }, {
        opacity: 1, y: 0, scale: 1, stagger: 0.15, ease: "power3.out",
        scrollTrigger: { trigger: ".two-cards", start: "top 85%", end: "top 35%", scrub: 1 },
      });
      gsap.utils.toArray<HTMLElement>(".home .reveal").forEach((el) =>
        gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" } }));
      ScrollTrigger.batch(".bento > *, .plans > *", {
        start: "top 90%", once: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.06, ease: "power3.out" }),
      });
      gsap.set(".bento > *, .plans > *", { opacity: 0 });
      // reviews: each card rises out of a soft blur as it enters; the two columns drift at different speeds
      gsap.set(".rv-card", { opacity: 0, y: 48, filter: "blur(8px)" });
      ScrollTrigger.batch(".rv-card", {
        start: "top 92%", once: true,
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.1, stagger: 0.1, ease: "power3.out" }),
      });
      if (!window.matchMedia("(max-width: 900px)").matches) {
        gsap.fromTo(".rv-col:nth-child(2)", { y: 80 }, { y: -80, ease: "none", scrollTrigger: { trigger: ".rv-wall", start: "top bottom", end: "bottom top", scrub: 1 } });
      }
      gsap.fromTo(".b-photo-img img", { scale: 1 }, { scale: 1.06, ease: "none", scrollTrigger: { trigger: ".b-photo", start: "top bottom", end: "bottom top", scrub: 1 } });
    });
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
    let id = 0;
    const schedule = () => { id = idle(setup, { timeout: 1500 }); };
    if (document.readyState === "complete") schedule(); else window.addEventListener("load", schedule, { once: true });
    return () => { window.removeEventListener("load", schedule); (window.cancelIdleCallback ?? window.clearTimeout)(id); ctx.revert(); };
  }, [enabled]);
  return null;
}
