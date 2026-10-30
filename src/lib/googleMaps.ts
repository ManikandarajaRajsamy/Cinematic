/// <reference types="google.maps" />
// Loads the Google Maps JavaScript API once, with the browser key from .env.local (VITE_GOOGLE_MAPS_KEY).
// The key must be restricted to the site's domains in Google Cloud. Resolves to null when there is no key
// or the API cannot load (e.g. the key is not allowed on this domain), so callers can fall back.

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
let loading: Promise<typeof google | null> | null = null;
// Set after Google refuses a Routes request (e.g. the API is not enabled for the key), so the
// session does not keep sending failing requests; the caller treats the distance as unavailable.
let routesRefused = false;

export const hasMapsKey = () => !!KEY;

export function loadGoogleMaps(): Promise<typeof google | null> {
  if (!KEY) return Promise.resolve(null);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    if (window.google?.maps?.Map) { resolve(window.google); return; }
    const cb = "__sspMapsReady";
    const timer = window.setTimeout(() => resolve(null), 12_000);
    (window as unknown as Record<string, () => void>)[cb] = () => { window.clearTimeout(timer); resolve(window.google ?? null); };
    // Google calls this when the key is rejected for the current domain
    (window as unknown as Record<string, () => void>).gm_authFailure = () => { window.clearTimeout(timer); resolve(null); };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => { window.clearTimeout(timer); resolve(null); };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Driving distance in km between two points with Google's Routes route matrix (travel mode = driving).
 * Returns null when the lookup fails, so the caller can ask the customer to call instead of guessing.
 */
export async function drivingDistanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<number | null> {
  if (routesRefused) return null;
  const g = await loadGoogleMaps();
  if (!g) return null;
  try {
    // RouteMatrix is newer than the installed type definitions, so it is typed loosely here
    const { RouteMatrix } = (await g.maps.importLibrary("routes")) as unknown as {
      RouteMatrix: { computeRouteMatrix(req: object): Promise<{ matrix: { rows: { items: { distanceMeters?: number; condition?: string }[] }[] } }> };
    };
    const { matrix } = await RouteMatrix.computeRouteMatrix({
      origins: [from], destinations: [to], travelMode: "DRIVING", fields: ["distanceMeters", "condition"],
    });
    const item = matrix.rows[0]?.items[0];
    return item?.distanceMeters != null && item.condition !== "ROUTE_NOT_FOUND" ? item.distanceMeters / 1000 : null;
  } catch (e) {
    if (/403|PERMISSION|not enabled|API_KEY|denied/i.test(String((e as Error)?.message ?? e))) routesRefused = true;
    return null;
  }
}
