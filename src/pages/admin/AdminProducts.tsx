import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { api, rupees, useApi } from "@/api/client";
import type { Product } from "@/api/types";
import { useStore } from "@/store/store";
import { Modal } from "@/components/Modal";
import { FieldError, SeedFlag, Toggle, errorsFrom, fileToDataUrl, toPaise, toRupeesInput } from "./shared";

const blank = (sort: number): Product => ({
  id: "", code: "", name_en: "Paruthipaal", name_ta: "பருத்திப்பால்", size_label_en: "", size_label_ta: "", volume_ml: 0,
  description_en: "", description_ta: "", image_url: "", base_price: 0, is_active: true, sell_online: true, sell_in_pos: true,
  plan_eligible: true, max_qty_per_order: 10, sort_order: sort, created_at: "", updated_at: "", updated_by: "",
});

export function AdminProducts() {
  const [view, setView] = useState<"list" | "branch">("list");
  return (
    <>
      <div className="tabs" role="tablist" style={{ marginBottom: 20 }}>
        <button role="tab" aria-selected={view === "list"} className={`tab ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>All products</button>
        <button role="tab" aria-selected={view === "branch"} className={`tab ${view === "branch" ? "active" : ""}`} onClick={() => setView("branch")}>Per branch</button>
      </div>
      {view === "list" ? <ProductList /> : <PerBranch />}
    </>
  );
}

function ProductList() {
  const { data, loading } = useApi("admin-products", api.admin.products);
  const { toast } = useStore();
  const [form, setForm] = useState<Product | null>(null);
  const [price, setPrice] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const isNew = !!form && !form.id;

  const open = (p: Product) => { setErrs({}); setForm(p); setPrice(toRupeesInput(p.base_price)); };
  const save = async () => {
    if (!form) return;
    try {
      await api.admin.saveProduct({ ...form, base_price: toPaise(price) ?? 0 }, isNew);
      toast(isNew ? "Product added" : "Product saved", "success");
      setForm(null);
    } catch (e) { const { fields, message } = errorsFrom(e); setErrs({ ...fields, _: message }); }
  };
  const set = <K extends keyof Product>(k: K, v: Product[K]) => form && setForm({ ...form, [k]: v });
  const txt = (k: keyof Product, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => form && (
    <div className="field">
      <label className="label" htmlFor={`pf-${String(k)}`}>{label}</label>
      <input id={`pf-${String(k)}`} className="input" value={String(form[k] ?? "")} onChange={(e) => set(k, (extra.type === "number" ? Number(e.target.value) : e.target.value) as never)} {...extra} />
      <FieldError msg={errs[k as string]} />
    </div>
  );

  return (
    <>
      <div className="admin-controls">
        <button className="btn btn-primary btn-sm" onClick={() => open(blank((data?.length ?? 0) + 1))}><Plus size={14} /> Add product</button>
      </div>
      {loading && !data ? <div className="card admin-empty">Loading products…</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th></th><th>Code</th><th>Product</th><th>Base price</th><th>Plan price</th><th>Online</th><th>Plan</th><th>Max/order</th><th>Sort</th><th></th></tr></thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id} style={p.is_active ? undefined : { opacity: 0.5 }}>
                  <td>{p.image_url ? <img className="admin-thumb" src={p.image_url} alt="" /> : <div className="admin-thumb" style={{ background: "var(--bg-elevated)" }} />}</td>
                  <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{p.code}</td>
                  <td><strong>{p.name_en} {p.size_label_en}</strong> <SeedFlag by={p.updated_by} />{!p.is_active && <span className="badge"> Inactive</span>}<br /><span lang="ta" style={{ color: "var(--text-dim)" }}>{p.name_ta} {p.size_label_ta}</span></td>
                  <td>{rupees(p.base_price)}</td>
                  <td>{p.plan_price != null ? rupees(p.plan_price) : "—"}</td>
                  <td>{p.sell_online ? "Yes" : "—"}</td><td>{p.plan_eligible ? "Yes" : "—"}</td>
                  <td>{p.max_qty_per_order}</td><td>{p.sort_order}</td>
                  <td><button className="btn btn-sm btn-solid" onClick={() => open(p)}><Pencil size={14} /> Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={isNew ? "Add product" : `Edit ${form?.code}`} maxWidth={680}>
        {form && (
          <div className="admin-form">
            <div className="field-row">{txt("code", "Code", { placeholder: "e.g. PP500" })}{txt("volume_ml", "Volume (ml)", { type: "number", min: 0 })}</div>
            <div className="field-row">{txt("name_en", "Name (English)")}{txt("name_ta", "Name (Tamil)", { lang: "ta" })}</div>
            <div className="field-row">{txt("size_label_en", "Size label (English)", { placeholder: "500 ML" })}{txt("size_label_ta", "Size label (Tamil)", { lang: "ta" })}</div>
            {txt("description_en", "Description (English)")}
            {txt("description_ta", "Description (Tamil)", { lang: "ta" })}
            <div className="field adm-box">
              <span className="label">Photo</span>
              <div className="adm-inline">
                {form.image_url && <img src={form.image_url} alt="Preview" className="adm-preview" />}
                <input type="file" accept="image/*" aria-label="Upload product photo" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  try { set("image_url", await fileToDataUrl(f)); } catch (err) { alert((err as Error).message); }
                }} />
              </div>
              <p className="adm-hint">Use the original product photo only.</p>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="label" htmlFor="pf-price">Base price (₹)</label>
                <input id="pf-price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
                <FieldError msg={errs.base_price} />
              </div>
              {txt("max_qty_per_order", "Max qty per order", { type: "number", min: 1 })}
              {txt("sort_order", "Sort order", { type: "number" })}
            </div>
            <div className="adm-toggles">
              <Toggle label="Active" checked={form.is_active} onChange={(v) => set("is_active", v)} />
              <Toggle label="Sell online" checked={form.sell_online} onChange={(v) => set("sell_online", v)} />
              <Toggle label="Daily plan eligible" checked={form.plan_eligible} onChange={(v) => set("plan_eligible", v)} />
            </div>
            {errs._ && <span className="field-error">{errs._}</span>}
            <button className="btn btn-primary btn-block" onClick={save}>{isNew ? "Add product" : "Save changes"}</button>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Branch-level price override, availability and "sold out today" (resets at midnight IST). */
function PerBranch() {
  const products = useApi("admin-products", api.admin.products);
  const branches = useApi("admin-branches", api.admin.branches);
  const bps = useApi("admin-branch-products", api.admin.branchProducts);
  const [productId, setProductId] = useState("");
  const pid = productId || products.data?.[0]?.id || "";
  const product = products.data?.find((p) => p.id === pid);

  if (!products.data || !branches.data || !bps.data) return <div className="card admin-empty">Loading…</div>;
  return (
    <>
      <div className="admin-controls">
        <select className="select" aria-label="Product" value={pid} onChange={(e) => setProductId(e.target.value)} style={{ maxWidth: 320 }}>
          {products.data.map((p) => <option key={p.id} value={p.id}>{p.name_en} {p.size_label_en}</option>)}
        </select>
        {product && <span className="adm-hint">Base price {rupees(product.base_price)}. Leave the override empty to use it.</span>}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Branch</th><th>Price override (₹)</th><th>Available</th><th>Sold out today</th><th></th></tr></thead>
          <tbody>
            {branches.data.map((b) => {
              const bp = bps.data!.find((x) => x.branch_id === b.id && x.product_id === pid);
              return <BranchProductRow key={`${b.id}-${pid}`} branchId={b.id} branchName={`${b.code} · ${b.name_en}`} productId={pid}
                initial={{ price: toRupeesInput(bp?.price_override), available: bp?.is_available ?? true, soldOut: bp?.sold_out_today ?? false }} />;
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BranchProductRow({ branchId, branchName, productId, initial }: { branchId: string; branchName: string; productId: string; initial: { price: string; available: boolean; soldOut: boolean } }) {
  const { toast } = useStore();
  const [v, setV] = useState(initial);
  const [err, setErr] = useState("");
  useEffect(() => { setV(initial); }, [initial.price, initial.available, initial.soldOut]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = v.price !== initial.price || v.available !== initial.available || v.soldOut !== initial.soldOut;
  const save = async (next = v) => {
    try {
      await api.admin.saveBranchProduct({ branch_id: branchId, product_id: productId, price_override: toPaise(next.price), is_available: next.available, sold_out_today: next.soldOut });
      setErr(""); toast("Saved", "success");
    } catch (e) { setErr(errorsFrom(e).message); }
  };
  return (
    <tr>
      <td>{branchName}</td>
      <td><input className="input" style={{ maxWidth: 120 }} inputMode="decimal" aria-label={`Price override for ${branchName}`} placeholder="—" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} /><FieldError msg={err} /></td>
      <td><input type="checkbox" aria-label={`Available at ${branchName}`} checked={v.available} onChange={(e) => { const n = { ...v, available: e.target.checked }; setV(n); save(n); }} /></td>
      <td><input type="checkbox" aria-label={`Sold out today at ${branchName}`} checked={v.soldOut} onChange={(e) => { const n = { ...v, soldOut: e.target.checked }; setV(n); save(n); }} /></td>
      <td>{dirty && v.price !== initial.price && <button className="btn btn-sm btn-primary" onClick={() => save()}>Save price</button>}</td>
    </tr>
  );
}
