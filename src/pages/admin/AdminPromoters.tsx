import { useMemo, useState } from "react";
import { Plus, Pencil, Power, Megaphone, Wallet, Clock, CheckCircle2, Undo2, Copy, Camera, Youtube, PartyPopper, ThumbsUp, MessageCircle, Globe } from "lucide-react";
import { useApi } from "@/api/client";
import { ops, inr, type PromoterView } from "@/api/ops";
import { useStore } from "@/store/store";
import { Modal } from "@/components/Modal";
import { errorsFrom, FieldError } from "./shared";
import { Skeleton } from "./ui";
import { PROMOTER_CHANNELS } from "@/api/promoServer";

/** A small icon for each channel. */
function ChannelIcon({ c }: { c: string }) {
  const I = c === "Instagram" ? Camera : c === "YouTube" ? Youtube : c === "Event management" ? PartyPopper : c === "Facebook" ? ThumbsUp : c === "WhatsApp" ? MessageCircle : Globe;
  return <I size={14} />;
}

const KIND = { REGULAR: "Home delivery", PLAN: "Subscription", EVENT: "Event order" } as const;
const STATUS = {
  PENDING: { label: "Pending", cls: "badge-saffron" },
  EARNED: { label: "Earned", cls: "badge-gold" },
  PAID: { label: "Paid", cls: "badge-success" },
  REVERSED: { label: "Reversed", cls: "badge-error" },
} as const;
type PForm = { id?: string; name: string; mobile: string; code: string; active: boolean; channel: string; brand: string };
const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

/**
 * Promoters and their commissions. Fixed rules: promoter codes give customers 5% off product prices on home delivery
 * and subscriptions (none on events); promoters earn 10% of the product price before the discount on all three.
 * Commission is pending until the order is completed, reversed if it is cancelled, and paid out from here.
 */
export function AdminPromoters() {
  const promoters = useApi("admin-promoters", ops.promoters);
  const comms = useApi("admin-commissions", ops.commissions);
  const { toast } = useStore();
  const [view, setView] = useState<"promoters" | "commissions">("promoters");
  const [form, setForm] = useState<PForm | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("ALL");
  const [who, setWho] = useState("ALL");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const reload = () => { promoters.reload(); comms.reload(); };

  const open = (p?: PromoterView) => { setErrs({}); setForm(p ? { id: p.id, name: p.name, mobile: p.mobile, code: p.code, active: p.active, channel: p.channel ?? "", brand: p.brand ?? "" } : { name: "", mobile: "", code: "", active: true, channel: "", brand: "" }); };
  const save = async () => {
    if (!form) return;
    try {
      const { id, ...rest } = form;
      await ops.savePromoter(rest, id);
      toast(id ? "Promoter updated" : "Promoter added", "success"); setForm(null); reload();
    } catch (e) { const { fields, message } = errorsFrom(e); setErrs({ ...fields, _: message }); }
  };
  const toggle = async (p: PromoterView) => {
    if (p.active && !confirm(`Deactivate ${p.name}? Their code ${p.code} stops working.`)) return;
    try { await ops.savePromoter({ name: p.name, mobile: p.mobile, code: p.code, channel: p.channel, brand: p.brand, active: !p.active }, p.id); toast(p.active ? "Deactivated" : "Activated", "success"); reload(); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
  };

  const all = comms.data ?? [];
  const list = useMemo(() => all.filter((c) => (status === "ALL" || c.status === status) && (who === "ALL" || c.promoter_id === who)), [all, status, who]);
  const payable = list.filter((c) => c.status === "EARNED");
  const sum = (st: string) => all.filter((c) => c.status === st).reduce((n, c) => n + c.amount, 0);
  const pay = async () => {
    const ids = [...picked].filter((id) => payable.some((c) => c.id === id));
    if (!ids.length) return;
    const total = all.filter((c) => ids.includes(c.id)).reduce((n, c) => n + c.amount, 0);
    if (!confirm(`Mark ${ids.length} commission${ids.length > 1 ? "s" : ""} (${inr(total)}) as paid to the promoter?`)) return;
    try { const r = await ops.payCommissions(ids); toast(`${r.paid} marked as paid`, "success"); setPicked(new Set()); reload(); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
  };

  return (
    <div className="page-fade pm">
      <div className="pm-rules">
        <Megaphone size={18} />
        <p><b>Rules:</b> customers get <b>5% off product prices</b> with a promoter's code on home delivery and subscriptions (no discount on events). Promoters earn <b>10% of the product price</b> before the discount on all three. Delivery, taxes and fees are never included. Commission is paid only after the order is completed.</p>
      </div>

      <div className="pm-tiles">
        <div className="pm-tile t-wait"><span><Clock size={20} /></span><div><small>Pending (order not completed)</small><strong>{inr(sum("PENDING"))}</strong></div></div>
        <div className="pm-tile t-all"><span><Wallet size={20} /></span><div><small>Earned, to pay</small><strong>{inr(sum("EARNED"))}</strong></div></div>
        <div className="pm-tile t-done"><span><CheckCircle2 size={20} /></span><div><small>Paid out</small><strong>{inr(sum("PAID"))}</strong></div></div>
        <div className="pm-tile t-stop"><span><Undo2 size={20} /></span><div><small>Reversed</small><strong>{inr(sum("REVERSED"))}</strong></div></div>
      </div>

      <div className="pm-bar">
        <div className="vt" role="tablist">
          <button role="tab" aria-selected={view === "promoters"} className={view === "promoters" ? "on" : ""} onClick={() => setView("promoters")}>Promoters</button>
          <button role="tab" aria-selected={view === "commissions"} className={view === "commissions" ? "on" : ""} onClick={() => setView("commissions")}>Commission report</button>
        </div>
        {view === "promoters" && <button className="btn btn-primary" onClick={() => open()}><Plus size={16} /> Add promoter</button>}
      </div>

      {view === "promoters" ? (
        promoters.loading && !promoters.data ? <Skeleton rows={3} /> : !(promoters.data ?? []).length ? (
          <div className="card admin-empty">No promoters yet. Add one to give them a promo code.</div>
        ) : (
          <ul className="pm-grid">
            {(promoters.data ?? []).map((p) => (
              <li key={p.id} className={`pm-card ${p.active ? "" : "off"}`}>
                <div className="pm-who">
                  <span className="pm-av">{p.name.charAt(0).toUpperCase()}</span>
                  <div><strong>{p.brand || p.name}</strong><small>{p.brand ? `${p.name} · ` : ""}+91 {p.mobile}</small></div>
                  <span className={`badge dot ${p.active ? "badge-success" : "badge-error"}`}>{p.active ? "Active" : "Inactive"}</span>
                </div>
                {p.channel && <span className="pm-chan"><ChannelIcon c={p.channel} /> {p.channel}</span>}
                <button className="pm-code" onClick={() => navigator.clipboard.writeText(p.code).then(() => toast(`Code ${p.code} copied`, "success"), () => {})} title="Copy code">
                  <span>Promo code</span><b>{p.code}</b><Copy size={14} />
                </button>
                <dl className="pm-stats">
                  <div><dt>Orders</dt><dd>{p.totals.orders}</dd></div>
                  <div><dt>Pending</dt><dd>{inr(p.totals.pending)}</dd></div>
                  <div><dt>To pay</dt><dd>{inr(p.totals.earned)}</dd></div>
                  <div><dt>Paid</dt><dd>{inr(p.totals.paid)}</dd></div>
                </dl>
                <div className="admin-actions" style={{ justifyContent: "flex-start" }}>
                  <button className="btn btn-sm btn-solid" onClick={() => open(p)}><Pencil size={13} /> Edit</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => toggle(p)}><Power size={13} /> {p.active ? "Deactivate" : "Activate"}</button>
                  {p.totals.earned > 0 && <button className="btn btn-sm btn-ghost" onClick={() => { setView("commissions"); setWho(p.id); setStatus("EARNED"); }}><Wallet size={13} /> Pay out</button>}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <div className="admin-controls">
            <select className="select" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPicked(new Set()); }}>
              <option value="ALL">All statuses</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="select" aria-label="Promoter" value={who} onChange={(e) => { setWho(e.target.value); setPicked(new Set()); }}>
              <option value="ALL">All promoters</option>{(promoters.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.code}</option>)}
            </select>
            <button className="btn btn-primary" disabled={![...picked].some((id) => payable.some((c) => c.id === id))} onClick={pay}><Wallet size={15} /> Mark selected as paid</button>
          </div>
          {comms.loading && !comms.data ? <Skeleton rows={4} /> : list.length === 0 ? <div className="card admin-empty">No commissions match.</div> : (
            <div className="admin-table-wrap ot-wrap">
              <table className="admin-table pm-table">
                <thead><tr>
                  <th><input type="checkbox" aria-label="Select all earned" checked={payable.length > 0 && payable.every((c) => picked.has(c.id))} onChange={(e) => setPicked(e.target.checked ? new Set(payable.map((c) => c.id)) : new Set())} disabled={!payable.length} /></th>
                  <th>Order</th><th>Promoter</th><th>Type</th><th>Customer</th><th>Product price</th><th>Customer discount</th><th>Commission</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td><input type="checkbox" aria-label={`Select ${c.ref}`} disabled={c.status !== "EARNED"} checked={picked.has(c.id)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(c.id); else n.delete(c.id); setPicked(n); }} /></td>
                      <td><b>{c.ref}</b><small>{when(c.created_at)}</small></td>
                      <td>{c.promoter_name}<small>{c.promoter_brand || c.code}</small></td>
                      <td>{KIND[c.kind]}</td>
                      <td>{c.customer}</td>
                      <td>{inr(c.base)}</td>
                      <td>{c.discount ? `−${inr(c.discount)} (5%)` : "No discount"}</td>
                      <td><b>{inr(c.amount)}</b><small>10%</small></td>
                      <td><span className={`badge dot ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span><small>{c.status === "PAID" ? `paid ${when(c.paid_at)}` : c.status === "EARNED" ? `earned ${when(c.earned_at)}` : c.status === "REVERSED" ? c.note : "order not completed yet"}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Edit promoter" : "Add promoter"} maxWidth={500}>
        {form && (
          <div className="admin-form">
            <span className="label">Channel</span>
            <div className="pm-chans" role="radiogroup" aria-label="Channel">
              {PROMOTER_CHANNELS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={form.channel === c} className={`pm-chan-opt ${form.channel === c ? "on" : ""}`} onClick={() => setForm({ ...form, channel: c })}><ChannelIcon c={c} /> {c}</button>
              ))}
            </div>
            <FieldError msg={errs.channel} />
            <div className="field"><label className="label" htmlFor="pm-brand">Brand name</label><input id="pm-brand" className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder={form.channel === "Event management" ? "e.g. Royal Events Madurai" : "e.g. Madurai Food Diaries (page or channel name)"} /><FieldError msg={errs.brand} /></div>
            <div className="field"><label className="label" htmlFor="pm-name">Contact person</label><input id="pm-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><FieldError msg={errs.name} /></div>
            <div className="field-row">
              <div className="field"><label className="label" htmlFor="pm-mobile">Mobile</label><input id="pm-mobile" className="input" inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })} /><FieldError msg={errs.mobile} /></div>
              <div className="field"><label className="label" htmlFor="pm-code">Promo code</label><input id="pm-code" className="input" value={form.code} maxLength={16} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="e.g. RAJ5" /><FieldError msg={errs.code} /></div>
            </div>
            <label className="adm-inline" style={{ gap: 8 }}><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active (the code works)</label>
            {errs._ && <span className="field-error">{errs._}</span>}
            <button className="btn btn-primary btn-block" onClick={save}>{form.id ? "Save" : "Add promoter"}</button>
          </div>
        )}
      </Modal>

      <style>{`
        .pm-rules { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border-radius: 12px; background: var(--accent-gold-glow); color: var(--text); font-size: 13px; margin-bottom: 16px; }
        .pm-rules svg { color: var(--accent-gold); flex-shrink: 0; margin-top: 2px; }
        .pm-rules p { color: var(--text-muted); }
        .pm-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
        .pm-tile { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-card); }
        .pm-tile > span { width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center; }
        .pm-tile > div { display: flex; flex-direction: column; min-width: 0; }
        .pm-tile small { font-size: 12px; color: var(--text-dim); }
        .pm-tile strong { font-size: 1.25rem; }
        .t-all > span { background: rgba(91, 95, 239, 0.12); color: #5B5FEF; }
        .t-wait > span { background: rgba(255, 159, 67, 0.16); color: #D9770F; }
        .t-done > span { background: rgba(40, 199, 111, 0.14); color: #1E9E57; }
        .t-stop > span { background: rgba(234, 84, 85, 0.12); color: #D63B3C; }
        .pm-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .pm-bar .vt { margin-left: 0; }
        .pm-grid { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
        .pm-card { display: flex; flex-direction: column; gap: 14px; padding: 16px; border-radius: 14px; border: 1px solid var(--border); background: var(--bg-card); }
        .pm-card.off { opacity: 0.6; }
        .pm-who { display: flex; align-items: center; gap: 12px; }
        .pm-who > div { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .pm-who small { font-size: 12.5px; color: var(--text-dim); }
        .pm-av { width: 42px; height: 42px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: var(--accent-gold-glow); color: var(--accent-gold); font-weight: 700; }
        .pm-chan { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: var(--bg-elevated); font-size: 12px; font-weight: 600; color: var(--text-muted); }
        .pm-chans { display: flex; flex-wrap: wrap; gap: 8px; }
        .pm-chan-opt { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border-strong); font-size: 13px; font-weight: 600; color: var(--text-muted); }
        .pm-chan-opt.on { border-color: var(--accent-gold); background: var(--accent-gold-glow); color: var(--accent-gold); }
        .pm-code { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1.5px dashed var(--accent-gold); background: var(--accent-gold-glow); text-align: left; }
        .pm-code span { font-size: 12px; color: var(--text-dim); }
        .pm-code b { flex: 1; font-size: 1.1rem; letter-spacing: 0.08em; color: var(--accent-gold); }
        .pm-code svg { color: var(--accent-gold); }
        .pm-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
        .pm-stats div { padding: 8px; border-radius: 10px; background: var(--bg-elevated); display: flex; flex-direction: column; }
        .pm-stats dt { font-size: 11px; color: var(--text-dim); }
        .pm-stats dd { font-weight: 700; font-size: 13px; }
        .pm-table { min-width: 980px; }
        .pm-table td small { display: block; font-size: 11.5px; color: var(--text-dim); margin-top: 2px; }
        .pm-table input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent-gold); }
        @media (max-width: 1000px) { .pm-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 600px) { .pm-tiles { gap: 8px; } .pm-tile { padding: 10px; } .pm-tile > span { width: 34px; height: 34px; } .pm-tile strong { font-size: 1.05rem; } .pm-bar .btn { flex: 1; } }
      `}</style>
    </div>
  );
}
