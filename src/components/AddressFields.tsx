import { useEffect, useState } from "react";
import { LocateFixed, MapPin, Map } from "lucide-react";
import { MapPicker } from "@/components/MapPicker";
import type { Address } from "@/store/store";
import { api } from "@/api/client";
import type { DeliveryQuote } from "@/api/types";
import { latLngFromMapsLink } from "@/api/branchStatus";

export type AddressInput = Omit<Address, "id">;

export const emptyAddress = (name = "", phone = ""): AddressInput => ({
  label: "", name, phone, line1: "", line2: "", area: "", pincode: "", district: "Madurai", lat: null, lng: null,
});

/** Older saved addresses have no district or pin; fill the gaps so the form can edit them. */
export const toAddressInput = (a: Partial<Address>): AddressInput => ({ ...emptyAddress(), ...a, line2: a.line2 ?? "", district: a.district ?? "", lat: a.lat ?? null, lng: a.lng ?? null });

export function validateAddress(f: AddressInput) {
  const e: Record<string, string> = {};
  if (!f.label.trim()) e.label = "Label required";
  if (!f.name.trim()) e.name = "Name required";
  if (!f.phone.trim()) e.phone = "Phone required";
  if (!f.line1.trim()) e.line1 = "Address line required";
  if (!f.area.trim()) e.area = "Area required";
  if (!/^\d{6}$/.test(f.pincode.trim())) e.pincode = "6-digit pincode";
  if (!f.district.trim()) e.district = "District required";
  if (f.lat == null || f.lng == null) e.location = "Set the map location so we can work out the delivery fee";
  return e;
}

/** Address inputs plus the map location needed for distance-based delivery. */
export function AddressFields({ form, setForm, errors }: { form: AddressInput; setForm: (f: AddressInput) => void; errors: Record<string, string> }) {
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [paste, setPaste] = useState("");
  const [preview, setPreview] = useState<DeliveryQuote | null>(null);
  const [picking, setPicking] = useState(false);
  const set = (k: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const useMyLocation = () => {
    if (!navigator.geolocation) { setLocError("Your browser can't share its location. Paste a Google Maps link instead."); return; }
    setLocating(true); setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); setForm({ ...form, lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) }); },
      () => { setLocating(false); setLocError("Couldn't get your location. Allow location access, or paste a Google Maps link."); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };
  const applyPaste = () => {
    const ll = latLngFromMapsLink(paste);
    if (!ll) { setLocError("That link has no coordinates. In Google Maps, long-press the spot, then copy the numbers or the link."); return; }
    setLocError(""); setPaste("");
    setForm({ ...form, lat: round(ll.lat), lng: round(ll.lng) });
  };

  // live delivery preview for the pin being edited (the server quote, not a browser calculation)
  useEffect(() => {
    if (form.lat == null || form.lng == null) { setPreview(null); return; }
    let live = true;
    api.quote({ lat: form.lat, lng: form.lng, district: form.district }).then((q) => live && setPreview(q)).catch(() => live && setPreview(null));
    return () => { live = false; };
  }, [form.lat, form.lng, form.district]);

  const field = (k: keyof AddressInput, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label className="label" htmlFor={`addr-${k}`}>{label}</label>
      <input id={`addr-${k}`} className="input" value={String(form[k] ?? "")} onChange={set(k)} {...extra} />
      {errors[k] && <span className="field-error">{errors[k]}</span>}
    </div>
  );

  return (
    <>
      <div className="field-row">{field("label", "Label", { placeholder: "Home, Work…" })}{field("pincode", "Pincode", { placeholder: "625001", inputMode: "numeric" })}</div>
      <div className="field-row">{field("name", "Name")}{field("phone", "Phone", { inputMode: "tel" })}</div>
      {field("line1", "Address line 1")}
      {field("line2", "Address line 2 (optional)")}
      <div className="field-row">{field("area", "Area / locality", { placeholder: "e.g. KK Nagar" })}{field("district", "District")}</div>

      <div className="field addr-loc">
        <span className="label">Map location</span>
        <div className="addr-loc-row">
          <button type="button" className="btn btn-sm btn-ghost" onClick={useMyLocation} disabled={locating}><LocateFixed size={14} /> {locating ? "Locating…" : "Use my location"}</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPicking(true)}><Map size={14} /> Pick on map</button>
          {form.lat != null && form.lng != null && <span className="badge badge-success"><MapPin size={12} /> {form.lat}, {form.lng}</span>}
        </div>
        <div className="addr-loc-row">
          <input className="input" aria-label="Paste a Google Maps link or coordinates" placeholder="…or paste a Google Maps link / “9.92, 78.12”" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button type="button" className="btn btn-sm btn-solid" onClick={applyPaste} disabled={!paste.trim()}>Set pin</button>
        </div>
        {(locError || errors.location) && <span className="field-error">{locError || errors.location}</span>}
        {preview && <span className={`addr-quote ${preview.deliverable ? "ok" : "no"}`}>{preview.message}</span>}
      </div>
      <MapPicker open={picking} initial={form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : null}
        onClose={() => setPicking(false)} onPick={(p) => { setForm({ ...form, lat: p.lat, lng: p.lng }); setPicking(false); setLocError(""); }} />
      <style>{`
        .addr-loc { gap: 10px; padding: 14px; border: 1px dashed var(--border-strong); border-radius: var(--radius-sm, 10px); }
        .addr-loc-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .addr-loc-row .input { flex: 1 1 200px; }
        .addr-quote { font-size: var(--font-sm); font-weight: 600; }
        .addr-quote.ok { color: var(--accent-green-bright); }
        .addr-quote.no { color: #e08c70; }
      `}</style>
    </>
  );
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
