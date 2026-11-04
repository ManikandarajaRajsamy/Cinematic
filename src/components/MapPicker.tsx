import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search, Check, X, ArrowRight } from "lucide-react";
import { Modal } from "@/components/Modal";
import { loadGoogleMaps } from "@/lib/googleMaps";

const MADURAI = { lat: 9.9174, lng: 78.1136 }; // Periyar Bus Stand, the main branch

type LatLng = { lat: number; lng: number };
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Pick the delivery location: the pin stays in the middle and the map moves under it (drag, or tap a spot to
 * centre it), with an address search, a "use my location" button and the address under the pin.
 * Same inputs and result as before: `onPick` receives the pin's coordinates.
 * Search and the address line use Google's Geocoder; if that isn't enabled for the key, the picker still works.
 */
export function MapPicker({ open, initial, onClose, onPick }: { open: boolean; initial?: LatLng | null; onClose: () => void; onPick: (p: LatLng) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const [pos, setPos] = useState<LatLng | null>(initial ?? null);
  const [address, setAddress] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");

  // the address line under the pin (best effort)
  const describe = (p: LatLng) => {
    if (!geocoder.current) return;
    geocoder.current.geocode({ location: p }).then(({ results }) => setAddress(results[0]?.formatted_address ?? "")).catch(() => setAddress(""));
  };

  useEffect(() => {
    if (!open) return;
    setPos(initial ?? null); setAddress(""); setMsg(""); setQuery("");
    let live = true;
    loadGoogleMaps().then((g) => {
      if (!live || !box.current) return;
      if (!g) { setState("failed"); return; }
      const center = initial ?? MADURAI;
      map.current = new g.maps.Map(box.current, {
        center, zoom: initial ? 17 : 15, disableDefaultUI: true, zoomControl: true, clickableIcons: false, gestureHandling: "greedy",
        // zoom sits top-right so it never collides with the "my location" button at the bottom
        zoomControlOptions: { position: g.maps.ControlPosition.RIGHT_TOP },
      });
      geocoder.current = new g.maps.Geocoder();
      // the centre of the map is the pin
      map.current.addListener("dragstart", () => setMoving(true));
      map.current.addListener("idle", () => {
        setMoving(false);
        const c = map.current!.getCenter();
        if (!c) return;
        const p = { lat: round(c.lat()), lng: round(c.lng()) };
        setPos(p);
        describe(p);
      });
      // tapping a spot brings it under the pin
      map.current.addListener("click", (e: google.maps.MapMouseEvent) => e.latLng && map.current!.panTo(e.latLng));
      setState("ready");
    });
    return () => { live = false; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (p: LatLng, zoom = 17) => { setPos(p); if (map.current) { map.current.panTo(p); map.current.setZoom(zoom); } else describe(p); };

  const useCurrent = () => {
    if (!navigator.geolocation) { setMsg("This browser can't share its location."); return; }
    setLocating(true); setMsg("");
    navigator.geolocation.getCurrentPosition((g) => {
      setLocating(false);
      goTo({ lat: round(g.coords.latitude), lng: round(g.coords.longitude) });
    }, () => { setLocating(false); setMsg("Couldn't get your location. Allow location access, or move the map."); }, { enableHighAccuracy: true, timeout: 10_000 });
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !geocoder.current) return;
    setMsg("");
    try {
      const { results } = await geocoder.current.geocode({ address: query, region: "in", bounds: { north: 10.3, south: 9.6, east: 78.5, west: 77.7 } });
      const loc = results[0]?.geometry.location;
      if (loc) goTo({ lat: round(loc.lat()), lng: round(loc.lng()) });
      else setMsg("No place found. Try a street or area name.");
    } catch { setMsg("Search isn't available right now. Move the map to your door instead."); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Delivery location" maxWidth={560}>
      <div className="lp">
        <p className="lp-sub">Search, or move the map so the pin sits on your door.</p>
        {state !== "failed" && (
          <form className="lp-search" onSubmit={search} role="search">
            <Search size={18} className="lp-search-ic" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search street, area or landmark" aria-label="Search for a place" enterKeyHint="search" />
            {query && <button type="button" className="lp-clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
            <button className="lp-go" disabled={!query.trim()} aria-label="Search"><ArrowRight size={18} /></button>
          </form>
        )}
        <div className="lp-map">
          {/* Google owns this element's contents, so React must not render children into it */}
          <div className="lp-canvas" ref={box} />
          {state === "ready" && (
            <>
              <span className={`lp-pin ${moving ? "up" : ""}`} aria-hidden="true"><MapPin size={44} strokeWidth={2} /></span>
              <span className={`lp-shadow ${moving ? "" : "pulse"}`} aria-hidden="true" />
              <span className="lp-hint">{moving ? "Release to set the pin" : "Move the map to place the pin on your door"}</span>
            </>
          )}
          {state === "loading" && <span className="lp-msg">Loading map…</span>}
          {state === "failed" && <span className="lp-msg">The map couldn't load. Use your current location below, or paste a Google Maps link in the address form.</span>}
          <button type="button" className="lp-locate" onClick={useCurrent} disabled={locating} aria-label="Use my current location" title="Use my current location">
            <LocateFixed size={20} className={locating ? "spin" : ""} />
          </button>
        </div>

        <div className={`lp-card ${pos ? "set" : ""}`}>
          <span className="lp-card-icon"><MapPin size={20} /></span>
          <div>
            <small>{pos ? "Deliver to" : "No location yet"}</small>
            <strong>{pos ? (address || "Pinned location") : "Move the map or use your current location"}</strong>
            {pos && <span>{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</span>}
          </div>
        </div>
        {msg && <span className="field-error">{msg}</span>}

        <div className="lp-foot">
          <button type="button" className="btn btn-primary btn-block btn-lg" disabled={!pos} onClick={() => pos && onPick(pos)}><Check size={16} /> Confirm location</button>
        </div>
      </div>
      <style>{`
        .lp { padding: 4px 24px 24px; display: flex; flex-direction: column; gap: 12px; }
        .lp-sub { font-size: 13px; color: var(--text-dim); margin-top: -4px; }
        .lp-search { display: flex; align-items: center; gap: 6px; height: 52px; padding: 0 6px 0 16px; border: 1.5px solid var(--border-strong); border-radius: 999px; background: #fff; transition: border-color 160ms, box-shadow 160ms; }
        .lp-search:focus-within { border-color: var(--green); box-shadow: 0 0 0 4px var(--accent-gold-glow); }
        .lp-search-ic { color: var(--text-dim); flex-shrink: 0; }
        .lp-search input { flex: 1; min-width: 0; height: 100%; padding: 0 4px; border: 0; background: none; font-size: 16px; color: var(--text); }
        .lp-search input::placeholder { color: var(--text-dim); }
        .lp-clear { width: 32px; height: 32px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; color: var(--text-dim); }
        .lp-go { width: 40px; height: 40px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; background: var(--green); color: #fff; transition: opacity 160ms, transform 160ms; }
        .lp-go:disabled { opacity: 0.35; }
        .lp-go:not(:disabled):hover { transform: translateX(2px); }
        .lp-map { position: relative; height: clamp(240px, 44vh, 380px); border-radius: 18px; overflow: hidden; background: var(--bg-sunk); display: grid; place-items: center; box-shadow: inset 0 0 0 1px var(--border); }
        .lp-canvas { position: absolute; inset: 0; }
        .lp-pin { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -100%); color: var(--green); filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.3)); transition: transform 180ms ease; pointer-events: none; }
        .lp-pin svg { fill: var(--gold); }
        .lp-pin.up { transform: translate(-50%, calc(-100% - 12px)); }
        .lp-shadow { position: absolute; left: 50%; top: 50%; width: 14px; height: 6px; margin: -3px 0 0 -7px; border-radius: 50%; background: rgba(0, 0, 0, 0.35); pointer-events: none; }
        .lp-shadow.pulse::after { content: ""; position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; border: 2px solid var(--green); opacity: 0; animation: lpPulse 2s ease-out infinite; }
        @keyframes lpPulse { 0% { transform: scale(0.3); opacity: 0.7; } 100% { transform: scale(1.4); opacity: 0; } }
        .lp-hint { position: absolute; left: 50%; bottom: 16px; top: auto; transform: translateX(-50%); padding: 6px 12px; border-radius: 999px; background: rgba(41, 41, 35, 0.82); color: #fff; font-size: 12px; white-space: nowrap; pointer-events: none; }
        .lp-msg { position: relative; z-index: 1; padding: 24px; text-align: center; color: var(--text-dim); font-size: var(--font-sm); }
        .lp-locate { position: absolute; right: 12px; bottom: 44px; z-index: 2; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; background: #fff; color: var(--green); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2); }
        .lp-card { display: flex; gap: 12px; align-items: center; padding: 14px 16px; border-radius: 14px; background: var(--bg-sunk); border: 1px solid transparent; }
        .lp-card.set { background: #fff; border-color: var(--border); box-shadow: 0 4px 14px rgba(17, 24, 39, 0.06); }
        .lp-card small { font-size: 11.5px; font-weight: 600; color: var(--green); }
        .lp-card-icon { width: 42px; height: 42px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: var(--accent-gold-glow); color: var(--green); }
        .lp-card div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .lp-card strong { font-size: var(--font-sm); line-height: 1.4; }
        .lp-card span { font-size: 12px; color: var(--text-dim); }
        .lp-foot { position: sticky; bottom: 0; padding-top: 4px; background: #fff; }
        @media (max-width: 560px) { .lp { padding: 0 16px 16px; } .lp-hint { font-size: 11px; } }
      `}</style>
    </Modal>
  );
}
