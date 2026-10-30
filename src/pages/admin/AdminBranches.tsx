import { useMemo, useState } from "react";
import { GripVertical, Pencil, Plus, Trash2, Search, ArrowUp, ArrowDown, EyeOff, ExternalLink } from "lucide-react";
import { api, useApi, type AdminBranch } from "@/api/client";
import type { Branch, BranchHoliday } from "@/api/types";
import { DAY_SHORT, daysText, hoursText, isOpenToday, latLngFromMapsLink } from "@/api/branchStatus";
import { useStore } from "@/store/store";
import { Modal } from "@/components/Modal";
import { FieldError, SeedFlag, Toggle, errorsFrom, fileToDataUrl } from "./shared";

type Form = Branch & { holidays: BranchHoliday[] };
const blank = (): Form => ({
  id: "", code: "", name_en: "", name_ta: "", type: "MARKET", address_en: "", address_ta: "", district: "", latitude: null, longitude: null,
  google_maps_url: "", phone: "", open_days: "DAILY", open_time: "", close_time: "", is_active: true, show_on_website: true, is_dispatch: false,
  delivery_radius_km: null, photo_url: "", sort_order: 0, deleted: false, created_at: "", updated_at: "", updated_by: "", holidays: [],
});

export function AdminBranches() {
  const { data, loading, error, reload } = useApi("admin-branches", api.admin.branches);
  const { toast } = useStore();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null); // local order while dragging
  const isNew = !!form && !form.id;

  const rows = useMemo(() => {
    const byId = new Map((data ?? []).map((b) => [b.id, b]));
    const ids = order ?? (data ?? []).map((b) => b.id);
    return ids.map((id) => byId.get(id)!).filter(Boolean);
  }, [data, order]);
  const q = query.toLowerCase();
  const visible = rows.filter((b) => [b.code, b.name_en, b.name_ta].some((v) => v.toLowerCase().includes(q)));

  const saveOrder = async (ids: string[]) => {
    try { await api.admin.reorderBranches(ids); toast("Order saved", "success"); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
    finally { setOrder(null); }
  };
  const move = (id: string, dir: -1 | 1) => {
    const ids = rows.map((b) => b.id); const i = ids.indexOf(id), j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setOrder(ids); saveOrder(ids);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.admin.saveBranch(form, isNew);
      toast(isNew ? "Branch added" : "Branch saved", "success");
      setForm(null); setErrs({});
    } catch (e) {
      const { fields, message } = errorsFrom(e);
      setErrs({ ...fields, _: message });
    } finally { setSaving(false); }
  };
  const remove = async (b: AdminBranch) => {
    const msg = b.has_sales ? `${b.name_en} has sales history, so it will be hidden (not deleted). Continue?` : `Delete ${b.name_en}? This can't be undone.`;
    if (!confirm(msg)) return;
    try { await api.admin.deleteBranch(b.id); toast(b.has_sales ? "Branch hidden" : "Branch deleted", "success"); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
  };

  if (error) return <div className="card admin-empty">{error} <button className="btn btn-sm btn-ghost" onClick={reload}>Retry</button></div>;
  return (
    <>
      <div className="admin-controls">
        <label className="admin-search"><Search size={16} /><input className="input" placeholder="Search code or name" aria-label="Search branches" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <button className="btn btn-primary btn-sm" onClick={() => { setErrs({}); setForm(blank()); }}><Plus size={14} /> Add branch</button>
      </div>
      <p className="adm-hint">Drag rows (or use the arrows) to set the order shown on the website.</p>
      {loading && !data ? <div className="card admin-empty">Loading branches…</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th aria-label="Order"></th><th>Code</th><th>Name</th><th>Type</th><th>Days</th><th>Open today</th><th>Dispatch</th><th>Website</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {visible.map((b) => (
                <tr key={b.id} draggable={!query}
                  onDragStart={() => setDragId(b.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!dragId || dragId === b.id) return;
                    const ids = rows.map((r) => r.id).filter((id) => id !== dragId);
                    ids.splice(ids.indexOf(b.id), 0, dragId);
                    setOrder(ids);
                  }}
                  onDragEnd={() => { if (order) saveOrder(order); setDragId(null); }}
                  className={dragId === b.id ? "dragging" : ""}>
                  <td className="adm-grip">
                    <GripVertical size={16} aria-hidden="true" />
                    <button className="adm-icon" aria-label={`Move ${b.name_en} up`} onClick={() => move(b.id, -1)}><ArrowUp size={13} /></button>
                    <button className="adm-icon" aria-label={`Move ${b.name_en} down`} onClick={() => move(b.id, 1)}><ArrowDown size={13} /></button>
                  </td>
                  <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{b.code}</td>
                  <td><strong>{b.name_en}</strong> <SeedFlag by={b.updated_by} /><br /><span lang="ta" style={{ color: "var(--text-dim)" }}>{b.name_ta}</span></td>
                  <td>{b.type === "SHOP" ? "Shop" : "Market"}</td>
                  <td>{daysText(b)}{hoursText(b) && <><br /><small style={{ color: "var(--text-dim)" }}>{hoursText(b)}</small></>}</td>
                  <td>{isOpenToday(b, b.holidays) ? <span className="badge badge-success">Yes</span> : <span className="badge">No</span>}</td>
                  <td>{b.is_dispatch ? <span className="badge badge-gold">Yes</span> : "—"}</td>
                  <td>{b.show_on_website ? "Shown" : <span className="badge"><EyeOff size={11} /> Hidden</span>}</td>
                  <td>{b.is_active ? "Active" : <span className="badge badge-error">Off</span>}</td>
                  <td><div className="admin-actions">
                    <button className="btn btn-sm btn-solid" onClick={() => { setErrs({}); setForm({ ...b }); }}><Pencil size={14} /> Edit</button>
                    <button className="btn btn-sm btn-ghost" aria-label={`Delete ${b.name_en}`} onClick={() => remove(b)}><Trash2 size={14} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={isNew ? "Add branch" : `Edit ${form?.code}`} maxWidth={720}>
        {form && <BranchForm form={form} setForm={setForm} errs={errs} />}
        {form && (
          <div className="admin-form" style={{ paddingTop: 0 }}>
            {errs._ && <span className="field-error">{errs._}</span>}
            <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>{saving ? "Saving…" : isNew ? "Add branch" : "Save changes"}</button>
          </div>
        )}
      </Modal>
    </>
  );
}

function BranchForm({ form, setForm, errs }: { form: Form; setForm: (f: Form) => void; errs: Record<string, string> }) {
  const [paste, setPaste] = useState("");
  const [pasteErr, setPasteErr] = useState("");
  const [holiday, setHoliday] = useState({ date: "", note: "" });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const txt = (k: keyof Form, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label className="label" htmlFor={`bf-${String(k)}`}>{label}</label>
      <input id={`bf-${String(k)}`} className="input" value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} {...extra} />
      <FieldError msg={errs[k as string]} />
    </div>
  );
  const days = form.open_days === "DAILY" ? [0, 1, 2, 3, 4, 5, 6] : form.open_days;
  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
    set("open_days", next.length === 7 ? "DAILY" : next);
  };
  const applyPaste = () => {
    const ll = latLngFromMapsLink(paste);
    if (!ll) { setPasteErr("No coordinates found in that link"); return; }
    setForm({ ...form, latitude: ll.lat, longitude: ll.lng, google_maps_url: form.google_maps_url || (paste.startsWith("http") ? paste : "") });
    setPaste(""); setPasteErr("");
  };
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div className="admin-form">
      <div className="field-row">
        {txt("code", "Code", { placeholder: "e.g. TPK", style: { textTransform: "uppercase" } })}
        <div className="field">
          <label className="label" htmlFor="bf-type">Type</label>
          <select id="bf-type" className="select" value={form.type} onChange={(e) => set("type", e.target.value as Branch["type"])}>
            <option value="SHOP">Shop</option><option value="MARKET">Market</option>
          </select>
        </div>
      </div>
      <div className="field-row">{txt("name_en", "Name (English)")}{txt("name_ta", "Name (Tamil)", { lang: "ta" })}</div>
      {txt("address_en", "Address (English)", { placeholder: "Leave empty until confirmed" })}
      {txt("address_ta", "Address (Tamil)", { lang: "ta" })}
      <div className="field-row">{txt("district", "District")}{txt("phone", "Phone (separate numbers with commas)", { inputMode: "tel" })}</div>

      <div className="field">
        <span className="label">Open days</span>
        <div className="adm-chips">
          <button type="button" className={`adm-chip ${form.open_days === "DAILY" ? "on" : ""}`} aria-pressed={form.open_days === "DAILY"} onClick={() => set("open_days", form.open_days === "DAILY" ? [] : "DAILY")}>Every day</button>
          {DAY_SHORT.map((d, i) => (
            <button type="button" key={d} className={`adm-chip ${days.includes(i) ? "on" : ""}`} aria-pressed={days.includes(i)} onClick={() => toggleDay(i)}>{d}</button>
          ))}
        </div>
        <FieldError msg={errs.open_days} />
      </div>
      <div className="field-row">
        <div className="field"><label className="label" htmlFor="bf-open">Opens</label><input id="bf-open" type="time" className="input" value={form.open_time} onChange={(e) => set("open_time", e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="bf-close">Closes</label><input id="bf-close" type="time" className="input" value={form.close_time} onChange={(e) => set("close_time", e.target.value)} /></div>
      </div>
      <FieldError msg={errs.hours} />

      <div className="field adm-box">
        <span className="label">Map location</span>
        <p className="adm-hint">No Google Maps key is set, so enter the pin by hand or paste a Google Maps link.</p>
        <div className="field-row">
          <div className="field"><label className="label" htmlFor="bf-lat">Latitude</label><input id="bf-lat" className="input" inputMode="decimal" value={form.latitude ?? ""} onChange={(e) => set("latitude", num(e.target.value))} /></div>
          <div className="field"><label className="label" htmlFor="bf-lng">Longitude</label><input id="bf-lng" className="input" inputMode="decimal" value={form.longitude ?? ""} onChange={(e) => set("longitude", num(e.target.value))} /></div>
        </div>
        <div className="adm-inline">
          <input className="input" aria-label="Paste a Google Maps link" placeholder="Paste a Google Maps link to fill the pin" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button type="button" className="btn btn-sm btn-solid" onClick={applyPaste} disabled={!paste.trim()}>Use link</button>
          {form.latitude != null && form.longitude != null && (
            <a className="btn btn-sm btn-ghost" href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Check pin</a>
          )}
        </div>
        <FieldError msg={pasteErr || errs.location} />
        {txt("google_maps_url", "Google Maps link for “Get directions” (optional)")}
      </div>

      <div className="field adm-box">
        <span className="label">Photo</span>
        <div className="adm-inline">
          {form.photo_url && <img src={form.photo_url} alt="" className="adm-preview" />}
          <input type="file" accept="image/*" aria-label="Upload branch photo" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { set("photo_url", await fileToDataUrl(f)); } catch (err) { alert((err as Error).message); }
          }} />
          {form.photo_url && <button type="button" className="btn btn-sm btn-ghost" onClick={() => set("photo_url", "")}>Remove</button>}
        </div>
      </div>

      <div className="field adm-box">
        <span className="label">Holidays (closed for the day)</span>
        {form.holidays.length === 0 && <p className="adm-hint">No holidays set.</p>}
        {form.holidays.map((h) => (
          <div className="adm-inline" key={h.id || h.date}>
            <span>{h.date}{h.note && ` · ${h.note}`}</span>
            <button type="button" className="btn btn-sm btn-ghost" aria-label={`Remove holiday ${h.date}`} onClick={() => set("holidays", form.holidays.filter((x) => x !== h))}><Trash2 size={13} /></button>
          </div>
        ))}
        <div className="adm-inline">
          <input type="date" className="input" aria-label="Holiday date" value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} />
          <input className="input" aria-label="Holiday note" placeholder="Note (optional)" value={holiday.note} onChange={(e) => setHoliday({ ...holiday, note: e.target.value })} />
          <button type="button" className="btn btn-sm btn-solid" disabled={!holiday.date || form.holidays.some((h) => h.date === holiday.date)}
            onClick={() => { set("holidays", [...form.holidays, { id: "", branch_id: form.id, ...holiday }].sort((a, b) => a.date.localeCompare(b.date))); setHoliday({ date: "", note: "" }); }}>Add</button>
        </div>
      </div>

      <div className="adm-toggles">
        <Toggle label="Active" checked={form.is_active} onChange={(v) => set("is_active", v)} />
        <Toggle label="Show on website" checked={form.show_on_website} onChange={(v) => set("show_on_website", v)} />
        <Toggle label="Dispatch online orders" hint="Needs a map location" checked={form.is_dispatch} onChange={(v) => set("is_dispatch", v)} />
      </div>
      {form.is_dispatch && (
        <div className="field">
          <label className="label" htmlFor="bf-radius">Delivery radius (km), empty = use the global max</label>
          <input id="bf-radius" className="input" inputMode="decimal" value={form.delivery_radius_km ?? ""} onChange={(e) => set("delivery_radius_km", num(e.target.value))} />
        </div>
      )}
    </div>
  );
}
