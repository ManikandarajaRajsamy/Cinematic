import { useEffect, useState } from "react";

export interface Greeting { ta: string; en: string }

/** Greeting by India time (Asia/Kolkata), whatever the visitor's device clock zone is. */
export function istGreeting(now = new Date()): Greeting {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(now)) % 24;
  if (h >= 5 && h < 12) return { ta: "காலை வணக்கம்!", en: "Good morning!" };
  if (h >= 12 && h < 16) return { ta: "மதிய வணக்கம்!", en: "Good afternoon!" };
  if (h >= 16 && h < 21) return { ta: "மாலை வணக்கம்!", en: "Good evening!" };
  return { ta: "வணக்கம்!", en: "Welcome!" };
}

/** Re-checks every 30 seconds, so the greeting changes without a reload when a boundary passes. */
export function useIstGreeting() {
  const [g, setG] = useState(istGreeting);
  useEffect(() => {
    const t = window.setInterval(() => setG((prev) => { const next = istGreeting(); return next.en === prev.en ? prev : next; }), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return g;
}
