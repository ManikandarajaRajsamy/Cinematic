import { useEffect, useRef } from "react";

/**
 * A muted, looping section background video. It only plays while on screen (and the tab is visible), uses the
 * lighter clip on phones, and stays on its poster for visitors who prefer reduced motion.
 */
export function BgVideo({ src, mobileSrc, poster, className = "" }: { src: string; mobileSrc?: string; poster: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current!;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = false;
    const sync = () => { if (visible && !document.hidden) v.play().catch(() => { /* autoplay blocked: poster stays */ }); else v.pause(); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: "600px 0px" });
    io.observe(v);
    document.addEventListener("visibilitychange", sync);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, []);
  const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;
  return (
    <video ref={ref} className={`bg-video ${className}`} muted playsInline loop preload="auto" poster={poster} aria-hidden="true"
      src={phone && mobileSrc ? mobileSrc : src} />
  );
}
