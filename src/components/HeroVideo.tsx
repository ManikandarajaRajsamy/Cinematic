import { useEffect, useRef } from "react";

/**
 * The landing film behind the homepage hero: muted, looping, cover-cropped around the glass.
 * It uses a portrait crop on mobile, pauses for reduced motion or hidden tabs, and falls back to a poster.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current!;
    const mobile = window.matchMedia("(max-width: 760px)");
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const sync = () => {
      const source = mobile.matches ? "/media/pour-slow-m.mp4" : "/media/pour-slow.mp4";
      v.poster = mobile.matches ? "/media/pour-poster-m.jpg" : "/media/pour-poster.jpg";
      if (v.getAttribute("src") !== source) {
        v.src = source;
        v.load();
      }
      if (!motion.matches || document.hidden) {
        v.pause();
        return;
      }
      v.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "NotAllowedError") return;
        console.error("Could not play the homepage background video.", error);
      });
    };
    sync();
    mobile.addEventListener("change", sync);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      mobile.removeEventListener("change", sync);
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return (
    <video ref={ref} className="hero-video" autoPlay muted playsInline loop preload="none" poster="/media/pour-poster.jpg" aria-hidden="true" />
  );
}
