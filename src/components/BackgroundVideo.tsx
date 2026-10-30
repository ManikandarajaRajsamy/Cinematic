import { useEffect, useRef, useState } from "react";

const PHONE_MQ = "(max-width: 760px)";
// where the glass sits in each clip, so the cover-crop keeps the product centred
const CLIPS = {
  desktop: { src: "/media/pour-slow.mp4", poster: "/media/pour-poster.jpg", focus: "74% 58%" },
  // phones use the same landscape clip as desktop, cropped around the glass (74% across)
  phone: { src: "/media/pour-slow.mp4", poster: "/media/pour-poster.jpg", focus: "74% 58%" },
};

// pour-slow*.mp4 are already rendered at 0.5x speed with motion-interpolated 60 fps frames
// (see the media build script), so the browser plays it at 1x to get a smooth 0.5x overall.
// Setting playbackRate to 0.5 here would slow it to 0.25x and drop frames.
const PLAYBACK_RATE = 1;

/**
 * One fixed, full-screen, muted background video behind the whole homepage. It never restarts,
 * never changes source and is not tied to scroll: page content simply scrolls over it.
 */
export function BackgroundVideo({ dim = false }: { dim?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE_MQ).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_MQ);
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const clip = phone ? CLIPS.phone : CLIPS.desktop;
  useEffect(() => {
    const v = ref.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const keepRate = () => { if (v.playbackRate !== PLAYBACK_RATE) v.playbackRate = PLAYBACK_RATE; };
    const sync = () => {
      if (reduced || document.hidden) v.pause();
      else v.play().catch(() => { /* autoplay blocked: the poster stays */ });
    };
    v.addEventListener("loadedmetadata", keepRate);
    v.addEventListener("ratechange", keepRate);
    document.addEventListener("visibilitychange", sync);
    keepRate();
    sync();
    return () => {
      v.removeEventListener("loadedmetadata", keepRate);
      v.removeEventListener("ratechange", keepRate);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [clip.src]);
  return (
    <div className={`home-bg ${dim ? "dim" : ""}`} aria-hidden="true">
      {/* The pour clips start after the glass already holds paruthipaal, so no frame shows an empty glass.
          The clip is chosen here rather than with <source media>, which Chrome and Edge ignore for video:
          phones get the same clip, cropped so the glass is in the middle. */}
      <video ref={ref} key={clip.src} muted playsInline loop autoPlay preload="auto" poster={clip.poster} src={clip.src}
        style={{ objectPosition: clip.focus }} />
      <div className="home-bg-overlay" />
    </div>
  );
}
