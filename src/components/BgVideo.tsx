import { useEffect, useRef } from "react";

/**
 * A muted, looping section background video. It only plays while on screen (and the tab is visible), uses the
 * lighter clip on phones, and stays on its poster on phones or for reduced-motion visitors.
 */
export function BgVideo({ src, mobileSrc, poster, className = "" }: { src: string; mobileSrc?: string; poster: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current!;
    const motion = window.matchMedia("(min-width: 761px) and (prefers-reduced-motion: no-preference)");
    let visible = false;
    const sync = () => {
      if (visible && motion.matches && !document.hidden) v.play().catch(() => { /* autoplay blocked: poster stays */ });
      else v.pause();
    };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: "600px 0px" });
    io.observe(v);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;
  return (
    <video ref={ref} className={`bg-video ${className}`} muted playsInline loop preload="none" poster={poster} aria-hidden="true"
      src={phone && mobileSrc ? mobileSrc : src} />
  );
}
