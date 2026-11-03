import { useEffect, useRef } from "react";

/**
 * The landing film behind the homepage hero: muted, looping, cover-cropped around the glass.
 * It only animates on larger screens, pauses when the tab is hidden, and otherwise stays on its poster.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current!;
    const motion = window.matchMedia("(min-width: 761px) and (prefers-reduced-motion: no-preference)");
    const sync = () => {
      if (!motion.matches || document.hidden) v.pause();
      else v.play().catch(() => { /* autoplay blocked: the poster stays */ });
    };
    sync();
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return (
    <video ref={ref} className="hero-video" muted playsInline loop preload="none" poster="/media/pour-poster.jpg" aria-hidden="true">
      <source src="/media/pour-slow.webm" type="video/webm" />
      <source src="/media/pour-slow.mp4" type="video/mp4" />
    </video>
  );
}
