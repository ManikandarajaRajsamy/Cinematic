import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { Modal } from "@/components/Modal";
import { loadGoogleMaps } from "@/lib/googleMaps";

const MADURAI = { lat: 9.9174, lng: 78.1136 }; // Periyar Bus Stand, the main branch

type LatLng = { lat: number; lng: number };
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Drop a pin on a Google map (tap, or drag the marker) or jump to the current location.
 * Falls back to a message when the map can't load; the address form still accepts a pasted link.
 */
export function MapPicker({ open, initial, onClose, onPick }: { open: boolean; initial?: LatLng | null; onClose: () => void; onPick: (p: LatLng) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const [pos, setPos] = useState<LatLng | null>(initial ?? null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setPos(initial ?? null);
    let live = true;
    loadGoogleMaps().then((g) => {
      if (!live || !box.current) return;
      if (!g) { setState("failed"); return; }
      const center = initial ?? MADURAI;
      map.current = new g.maps.Map(box.current, {
        center, zoom: initial ? 17 : 14, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false,
        gestureHandling: "greedy",
      });
      marker.current = new g.maps.Marker({ map: map.current, position: initial ?? undefined, draggable: true, visible: !!initial });
      const place = (ll: google.maps.LatLng) => {
        const p = { lat: round(ll.lat()), lng: round(ll.lng()) };
        marker.current!.setPosition(ll); marker.current!.setVisible(true); setPos(p);
      };
      map.current.addListener("click", (e: google.maps.MapMouseEvent) => e.latLng && place(e.latLng));
      marker.current.addListener("dragend", (e: google.maps.MapMouseEvent) => e.latLng && place(e.latLng));
      setState("ready");
    });
    return () => { live = false; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const useCurrent = () => {
    if (!navigator.geolocation) { setLocErr("This browser can't share its location."); return; }
    setLocating(true); setLocErr("");
    navigator.geolocation.getCurrentPosition((g) => {
      setLocating(false);
      const p = { lat: round(g.coords.latitude), lng: round(g.coords.longitude) };
      setPos(p);
      if (map.current && marker.current) { map.current.panTo(p); map.current.setZoom(17); marker.current.setPosition(p); marker.current.setVisible(true); }
    }, () => { setLocating(false); setLocErr("Couldn't get your location. Allow location access, or tap the map."); }, { enableHighAccuracy: true, timeout: 10_000 });
  };

  return (
    <Modal open={open} onClose={onClose} title="Pick your delivery location" maxWidth={720}>
      <div className="mp">
        <p className="mp-help">Tap the map to drop the pin on your door, or drag the pin to adjust it.</p>
        <div className="mp-map">
          {/* Google owns this element's contents, so React must not render children into it */}
          <div className="mp-canvas" ref={box} />
          {state === "loading" && <span className="mp-msg">Loading map…</span>}
          {state === "failed" && <span className="mp-msg">The map couldn't load. Use your current location, or paste a Google Maps link in the address form.</span>}
        </div>
        <div className="mp-bar">
          <button type="button" className="btn btn-ghost btn-sm" onClick={useCurrent} disabled={locating}><LocateFixed size={14} /> {locating ? "Locating…" : "Use my current location"}</button>
          <span className="mp-pos">{pos ? <><MapPin size={13} /> {pos.lat}, {pos.lng}</> : "No pin yet"}</span>
          <button type="button" className="btn btn-primary btn-sm" disabled={!pos} onClick={() => pos && onPick(pos)}>Use this location</button>
        </div>
        {locErr && <span className="field-error">{locErr}</span>}
      </div>
      <style>{`
        .mp { padding: 16px 32px 28px; display: flex; flex-direction: column; gap: 12px; }
        .mp-help { font-size: var(--font-sm); }
        .mp-map { position: relative; height: min(56vh, 440px); border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-strong); background: var(--bg-elevated); display: grid; place-items: center; }
        .mp-canvas { position: absolute; inset: 0; }
        .mp-msg { position: relative; z-index: 1; padding: 24px; text-align: center; color: var(--text-dim); font-size: var(--font-sm); }
        .mp-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .mp-pos { flex: 1; display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); }
        @media (max-width: 560px) { .mp { padding: 12px 16px 20px; } .mp-bar .btn { flex: 1 1 100%; } }
      `}</style>
    </Modal>
  );
}
