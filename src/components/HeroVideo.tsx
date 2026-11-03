import { useEffect, useRef } from "react";

/**
 * The landing film behind the homepage hero: muted, looping, cover-cropped around the glass.
 * It pauses when the tab is hidden and stays on its poster for visitors who prefer reduced motion.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sync = () => {
      if (reduced || document.hidden) v.pause();
      else v.play().catch(() => { /* autoplay blocked: the poster stays */ });
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return (
    <video ref={ref} className="hero-video" muted playsInline loop autoPlay preload="auto" poster="/media/pour-poster.jpg" aria-hidden="true">
      <source src="/media/pour-slow.webm" type="video/webm" />
      <source src="/media/pour-slow.mp4" type="video/mp4" />
    </video>
  );
}
