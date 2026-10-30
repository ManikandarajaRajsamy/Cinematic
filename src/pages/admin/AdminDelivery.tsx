import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, rupees, useApi } from "@/api/client";
import { discounted, feeForKm } from "@/api/mockServer";
import type { DeliverySettings } from "@/api/types";
import { useStore } from "@/store/store";
import { FieldError, SeedFlag, Toggle, errorsFrom, toPaise, toRupeesInput } from "./shared";

type SlabRow = { upto_km: string; fee: string };

export function AdminDelivery() {
  const { data } = useApi("admin-delivery", api.admin.deliverySettings);
  const { toast } = useStore();
  const [s, setS] = useState<DeliverySettings | null>(null);
  const [slabs, setSlabs] = useState<SlabRow[]>([]);
  const [freeAbove, setFreeAbove] = useState("");
  const [discountAbove, setDiscountAbove] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [test, setTest] = useState("");
  const [testResult, setTestResult] = useState("");

  useEffect(() => {
    if (!data) return;
    setS(data);
    setSlabs(data.slabs.map((x) => ({ upto_km: String(x.upto_km), fee: toRupeesInput(x.fee) })));
    setFreeAbove(toRupeesInput(data.free_above_amount));
    setDiscountAbove(toRupeesInput(data.discount_above_amount));
  }, [data]);
  if (!s) return <div className="card admin-empty">Loading delivery settings…</div>;

  const draft: DeliverySettings = {
    ...s,
    slabs: slabs.map((x) => ({ upto_km: Number(x.upto_km), fee: toPaise(x.fee) ?? 0 })),
    free_above_amount: toPaise(freeAbove),
    discount_above_amount: toPaise(discountAbove),
  };
  const preview = (km: number) => {
    if (km > draft.max_radius_km) return "Not deliverable (pickup offered)";
    const fee = feeForKm(draft, km);
    if (fee === 0) return "Free";
    return draft.discount_above_amount != null && draft.discount_percent > 0
      ? `${rupees(fee)} · above ${rupees(draft.discount_above_amount)}: ${rupees(discounted(fee, draft.discount_percent))}`
      : rupees(fee);
  };
  const set = <K extends keyof DeliverySettings>(k: K, v: DeliverySettings[K]) => setS({ ...s, [k]: v });
  const num = (k: "free_radius_km" | "max_radius_km" | "plan_discount_percent" | "discount_percent", label: string) => (
    <div className="field">
      <label className="label" htmlFor={`ds-${k}`}>{label}</label>
      <input id={`ds-${k}`} className="input" inputMode="decimal" value={String(s[k])} onChange={(e) => set(k, Number(e.target.value))} />
      <FieldError msg={errs[k]} />
    </div>
  );

  const save = async () => {
    try { await api.admin.saveDeliverySettings(draft); setErrs({}); toast("Delivery settings saved", "success"); }
    catch (e) { const { fields, message } = errorsFrom(e); setErrs({ ...fields, _: message }); }
  };
  const runTest = async () => {
    const m = test.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (!m) { setTestResult("Enter coordinates like 9.93, 78.12"); return; }
    const q = await api.quote({ lat: Number(m[1]), lng: Number(m[2]), district: s.district_restriction });
    setTestResult(`${q.message}${q.method ? ` (${q.method})` : ""}`);
  };

  return (
    <div className="admin-two">
      <div className="card admin-form" style={{ padding: 24 }}>
        <h3 className="title-md">Fee rules <SeedFlag by={s.updated_by} /></h3>
        <div className="field-row">{num("free_radius_km", "Free radius (km)")}{num("max_radius_km", "Max delivery radius (km)")}</div>

        <div className="field">
          <span className="label">Distance slabs (must go up, last one reaches the max radius)</span>
          <div className="adm-slab adm-slab-head"><span>Up to (km)</span><span>Fee (₹)</span><span /></div>
          {slabs.map((x, i) => (
            <div className="adm-slab" key={i}>
              <input className="input" inputMode="decimal" aria-label={`Slab ${i + 1} distance`} value={x.upto_km} onChange={(e) => setSlabs(slabs.map((y, j) => (j === i ? { ...y, upto_km: e.target.value } : y)))} />
              <input className="input" inputMode="decimal" aria-label={`Slab ${i + 1} fee`} value={x.fee} onChange={(e) => setSlabs(slabs.map((y, j) => (j === i ? { ...y, fee: e.target.value } : y)))} />
              <button className="btn btn-sm btn-ghost" aria-label={`Remove slab ${i + 1}`} disabled={slabs.length === 1} onClick={() => setSlabs(slabs.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
            </div>
          ))}
          <button className="btn btn-text btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setSlabs([...slabs, { upto_km: "", fee: "" }])}><Plus size={13} /> Add slab</button>
          <FieldError msg={errs.slabs} />
        </div>

        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="ds-method">Distance method</label>
            <select id="ds-method" className="select" value={s.distance_method} onChange={(e) => set("distance_method", e.target.value as DeliverySettings["distance_method"])}>
              <option value="ROAD">Road (Google Routes, driving)</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="ds-free-above">Free above order value (₹, optional)</label>
            <input id="ds-free-above" className="input" inputMode="decimal" placeholder="Not set" value={freeAbove} onChange={(e) => setFreeAbove(e.target.value)} />
            <FieldError msg={errs.free_above_amount} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="ds-disc-above">Discount delivery above order value (₹)</label>
            <input id="ds-disc-above" className="input" inputMode="decimal" placeholder="Not set" value={discountAbove} onChange={(e) => setDiscountAbove(e.target.value)} />
            <FieldError msg={errs.discount_above_amount} />
          </div>
          {num("discount_percent", "Delivery discount (%) · rounded up to ₹1")}
        </div>
        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="ds-phone">Call number when distance fails</label>
            <input id="ds-phone" className="input" inputMode="tel" value={s.support_phone} onChange={(e) => set("support_phone", e.target.value)} />
            <FieldError msg={errs.support_phone} />
          </div>
        </div>
        <Toggle label="Demo fallback when road distance is unavailable" hint="Testing only. Off = customers are asked to call instead of a guessed charge." checked={s.demo_distance_fallback} onChange={(v) => set("demo_distance_fallback", v)} />
        <div className="field-row">
          <div className="field"><label className="label" htmlFor="ds-district">Delivery district</label><input id="ds-district" className="input" value={s.district_restriction} onChange={(e) => set("district_restriction", e.target.value)} /></div>
          {num("plan_discount_percent", "Daily plan discount (%)")}
        </div>
        <Toggle label="Free delivery on daily plans" checked={s.plan_free_delivery} onChange={(v) => set("plan_free_delivery", v)} />
        {errs._ && <span className="field-error">{errs._}</span>}
        <button className="btn btn-primary btn-block" onClick={save}>Save delivery settings</button>
        <p className="adm-hint">Last saved {new Date(s.updated_at).toLocaleString("en-IN")} by {s.updated_by}. Every change is recorded in the audit log.</p>
      </div>

      <div className="card admin-form" style={{ padding: 24 }}>
        <h3 className="title-md">Live preview</h3>
        <ul className="adm-preview-list">
          {[2.4, 3.2, 4.8, 6.5, 9, 11, draft.max_radius_km + 0.5].map((km) => (
            <li key={km}><span>{km} km</span><strong>{preview(km)}</strong></li>
          ))}
        </ul>
        <p className="adm-hint">The preview uses the values on the left before saving. Order value and plan rules are applied at checkout.</p>
        <div className="field">
          <label className="label" htmlFor="ds-test">Test a location (saved settings)</label>
          <div className="adm-inline">
            <input id="ds-test" className="input" placeholder="9.93, 78.12" value={test} onChange={(e) => setTest(e.target.value)} />
            <button className="btn btn-sm btn-solid" onClick={runTest}>Quote</button>
          </div>
          {testResult && <p style={{ fontWeight: 600 }}>{testResult}</p>}
        </div>
      </div>
    </div>
  );
}

export function AdminAudit() {
  const { data } = useApi("admin-audit", api.admin.audit);
  if (!data) return <div className="card admin-empty">Loading…</div>;
  return (
    <>
      {data.audit.length === 0 ? <div className="card admin-empty">No changes recorded yet.</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>Change</th></tr></thead>
            <tbody>
              {data.audit.map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(a.at).toLocaleString("en-IN")}</td>
                  <td>{a.by}</td>
                  <td>{a.entity} {a.entity_id !== "*" && <code>{a.entity_id}</code>} · {a.action}</td>
                  <td><code className="adm-diff">{summarise(a.old, a.new)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.logs.length > 0 && (
        <>
          <h3 className="title-md mt-8">Distance fallbacks</h3>
          <ul className="adm-preview-list">{data.logs.slice(0, 10).map((l, i) => <li key={i}><span>{new Date(l.at).toLocaleString("en-IN")}</span><span>{l.msg}</span></li>)}</ul>
        </>
      )}
    </>
  );
}

function summarise(old: unknown, next: unknown) {
  if (old && typeof old === "object" && !Array.isArray(old) && Object.values(old).every((v) => Array.isArray(v) && v.length === 2)) {
    return Object.entries(old as Record<string, [unknown, unknown]>).map(([k, [a, b]]) => `${k}: ${short(a)} → ${short(b)}`).join("; ") || "no field changes";
  }
  if (old && next && typeof old === "object" && typeof next === "object") {
    const o = old as Record<string, unknown>, n = next as Record<string, unknown>;
    return Object.keys(n).filter((k) => k !== "updated_at" && JSON.stringify(o[k]) !== JSON.stringify(n[k])).map((k) => `${k}: ${short(o[k])} → ${short(n[k])}`).join("; ");
  }
  return `${short(old)} → ${short(next)}`;
}
const short = (v: unknown) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s && s.length > 60 ? s.slice(0, 57) + "…" : String(s); };
