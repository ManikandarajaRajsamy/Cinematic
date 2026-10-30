import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ops } from "@/api/ops";

/** Anonymous first-party visitor id (no personal data). Created once and kept for a year. */
function visitorId() {
  const m = document.cookie.match(/(?:^|; )ssp_vid=([^;]+)/);
  if (m) return m[1];
  const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
  document.cookie = `ssp_vid=${id}; max-age=${365 * 86400}; path=/; samesite=lax`;
  return id;
}

/** Records a page view on public pages only (never /admin or /partner). See the Privacy Policy. */
export function useVisitTracking() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/partner") || pathname.startsWith("/reset-password")) return;
    ops.trackVisit(visitorId(), pathname).catch(() => {});
  }, [pathname]);
}
