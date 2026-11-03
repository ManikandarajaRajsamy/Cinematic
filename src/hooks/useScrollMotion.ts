import { useEffect } from "react";

export interface MotionConfig {
  /** [selector, entrance class]: rv-media (frame opens), rv-card (rises into focus), rv-text / rv-text-r (slides in), rv-split (words), rv-line (masked line) */
  reveal: [string, string][];
  /** [selector, speed, max shift as a share of the frame's height] */
  parallax?: [string, number, number?][];
  /** cards that tilt toward the pointer */
  tilt?: string;
}

/**
 * Scroll motion for a page: content reveals as it enters the screen, parallax layers track scrolling, and cards
 * tilt toward the pointer.
 * Content that loads later (from the API) is picked up too. Off for reduced motion; parallax and tilt only on
 * wide screens with a mouse.
 */
export function useScrollMotion(rootSelector: string, config: MotionConfig, key: unknown = null) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.querySelector<HTMLElement>(rootSelector);
    if (!root) return;
    const KINDS = config.reveal;
    const ALL = KINDS.map(([sel]) => sel).join(", ");

    const show = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add("in");
    }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    const items: HTMLElement[] = [];
    const scan = () => root.querySelectorAll<HTMLElement>(ALL).forEach((el) => {
      // one entrance per element: never inside something that already animates as a whole
      if (el.classList.contains("rv") || el.parentElement?.closest(".rv")) return;
      const i = Array.from(el.parentElement?.children ?? []).indexOf(el);
      el.classList.add("rv", KINDS.find(([sel]) => el.matches(sel))![1]);
      el.style.setProperty("--rv-delay", `${Math.min(i, 5) * 110}ms`);
      items.push(el);
      show.observe(el);
    });
    scan();
    // live pages update often (orders, toasts): rescan at most once per frame
    let scanRaf = 0;
    const mo = new MutationObserver(() => { if (!scanRaf) scanRaf = requestAnimationFrame(() => { scanRaf = 0; scan(); collect(); on(); }); });
    mo.observe(root, { childList: true, subtree: true });

    // parallax follows the current scroll position without a second easing loop
    const wide = window.matchMedia("(min-width: 901px)");
    type Layer = { el: HTMLElement; speed: number; cap?: number };
    let layers: Layer[] = [];
    function collect() {
      const known = new Set(layers.map((l) => l.el));
      for (const [sel, speed, cap] of config.parallax ?? []) {
        root!.querySelectorAll<HTMLElement>(sel).forEach((el) => { if (!known.has(el)) layers.push({ el, speed, cap }); });
      }
      layers = layers.filter((l) => l.el.isConnected);
    }
    collect();
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      if (!wide.matches) { layers.forEach((l) => { l.el.style.translate = ""; }); return; }
      // read every position first, then write: no forced layout between layers
      const rects = layers.map((l) => (l.el.parentElement ?? l.el).getBoundingClientRect());
      layers.forEach((l, i) => {
        const r = rects[i];
        if (r.bottom < -200 || r.top > vh + 200) return;
        let target = (r.top + r.height / 2 - vh / 2) * l.speed;
        if (l.cap) target = Math.max(-r.height * l.cap, Math.min(r.height * l.cap, target));
        l.el.style.translate = `0 ${target.toFixed(1)}px`;
      });
    };
    function on() { if (!raf && layers.length) raf = requestAnimationFrame(update); }

    // cards tilt toward the pointer and catch a soft light
    const fine = window.matchMedia("(pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      if (!config.tilt || !fine) return;
      const card = (e.target as HTMLElement).closest<HTMLElement>(config.tilt);
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.classList.add("tilting");
      card.style.setProperty("--rx", `${(0.5 - y) * 7}deg`);
      card.style.setProperty("--ry", `${(x - 0.5) * 9}deg`);
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
    };
    const onLeave = (e: PointerEvent) => {
      if (!config.tilt) return;
      const card = (e.target as HTMLElement).closest?.<HTMLElement>(config.tilt);
      if (card && !card.contains(e.relatedTarget as Node)) { card.classList.remove("tilting"); card.style.removeProperty("--rx"); card.style.removeProperty("--ry"); }
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerout", onLeave);
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      show.disconnect(); mo.disconnect(); cancelAnimationFrame(raf); cancelAnimationFrame(scanRaf);
      root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerout", onLeave);
      window.removeEventListener("scroll", on); window.removeEventListener("resize", on);
      items.forEach((el) => el.classList.remove("rv", "in", "tilting", ...KINDS.map(([, k]) => k)));
      layers.forEach(({ el }) => (el.style.translate = ""));
    };
  }, [rootSelector, key]); // eslint-disable-line react-hooks/exhaustive-deps
}
