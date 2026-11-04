import { useEffect, useRef } from "react";

const EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/**
 * Signs a staff or partner session out after `minutes` without any activity, so an unattended
 * phone or shop computer doesn't stay signed in. Activity in another tab of the same app counts too.
 */
export function useIdleSignOut(enabled: boolean, minutes: number, onIdle: () => void, key: string) {
  const cb = useRef(onIdle);
  cb.current = onIdle;
  useEffect(() => {
    if (!enabled) return;
    const store = `ssp-active-${key}`;
    const limit = minutes * 60_000;
    const touch = () => { try { localStorage.setItem(store, String(Date.now())); } catch { /* ignore */ } };
    const last = () => { try { return Number(localStorage.getItem(store)) || Date.now(); } catch { return Date.now(); } };
    touch();
    let throttle = 0;
    const onActivity = () => { const t = Date.now(); if (t - throttle > 15_000) { throttle = t; touch(); } };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    // checked on a timer and when the tab comes back, since timers sleep on a locked phone
    const check = () => { if (Date.now() - last() > limit) cb.current(); };
    const timer = window.setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled, minutes, key]);
}
