import { useState } from "react";
import { Minus, Plus, Copy, MessageCircle, Smartphone, Check, ExternalLink, MapPin } from "lucide-react";
import { useApi } from "@/api/client";
import { ops, inr, type ServerOrder } from "@/api/ops";
import { useStore } from "@/store/store";
import { Modal } from "@/components/Modal";
import { MapPicker } from "@/components/MapPicker";
import { api } from "@/api/client";
import { latLngFromMapsLink } from "@/api/branchStatus";
import type { DeliveryQuote } from "@/api/types";
import { errorsFrom, FieldError } from "./shared";

/** The link the customer opens to follow the order: no sign-in, no mobile number in the URL. */
export const trackingLink = (token: string) => `${window.location.origin}/t/${token}`;

/**
 * The shop places an order for a customer (by phone or at the counter): customer, delivery location, products
 * and payment. The server prices it like a website order (delivery fee by distance), confirms it, and returns a
 * private tracking link to share with the customer.
 */
export function AdminNewOrder({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { products, toast } = useStore();
  const partners = useApi("admin-partners", ops.partners);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  // required: name, mobile and the map location; the written address is optional
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [paste, setPaste] = useState("");
  const [fee, setFee] = useState<DeliveryQuote | null>(null);
  const [extra, setExtra] = useState({ line1: "", landmark: "", area: "", pincode: "", instructions: "" });
  const setLocation = (p: { lat: number; lng: number }) => {
    setLoc(p); setFee(null); setPicking(false);
    api.quote({ lat: p.lat, lng: p.lng, district: "Madurai" }).then(setFee).catch(() => setFee(null));
  };
  const usePaste = () => {
    const ll = latLngFromMapsLink(paste);
    if (ll) { setLocation(ll); setPaste(""); setErrs({ ...errs, location: "" }); }
    else setErrs({ ...errs, location: "That link has no map location. Use Pick on map instead." });
  };
  const [qty, setQty] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<"cash" | "qr" | "paid">("cash");
  const [payRef, setPayRef] = useState("");
  const [partner, setPartner] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ order: ServerOrder; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const subtotal = products.reduce((n, p) => n + (qty[p.id] ?? 0) * p.variants[0].price, 0);
  const reset = () => {
    setName(""); setMobile(""); setLoc(null); setFee(null); setPaste(""); setExtra({ line1: "", landmark: "", area: "", pincode: "", instructions: "" }); setQty({}); setPayment("cash"); setPayRef(""); setPartner("");
    setErrs({}); setDone(null); setCopied(false);
  };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    const need: Record<string, string> = {};
    if (!name.trim()) need.name = "Enter the customer's name";
    if (mobile.length !== 10) need.mobile = "Enter a 10-digit mobile number";
    if (!loc) need.location = "Set the delivery location";
    if (Object.keys(need).length) { setErrs(need); return; }
    setBusy(true); setErrs({});
    try {
      const r = await ops.createOrderFor({
        customer: { name, mobile },
        address: { ...extra, district: "Madurai", lat: loc?.lat ?? null, lng: loc?.lng ?? null },
        lines: Object.entries(qty).filter(([, n]) => n > 0).map(([productId, n]) => ({ productId, qty: n })),
        payment, payment_ref: payRef || undefined, partner_id: partner || undefined,
      });
      setDone({ order: r.order, link: trackingLink(r.share_token) });
      toast(`${r.order.ref} created`, "success");
      onCreated();
    } catch (e) {
      const { fields, message } = errorsFrom(e);
      setErrs({ ...fields, _: message });
    } finally { setBusy(false); }
  };

  const shareText = done ? `Vanakkam ${done.order.customer.name}! Your Sri Sastha Paruthipaal order ${done.order.ref} (${inr(done.order.total)}) is confirmed. Track it here: ${done.link}` : "";
  const copy = async () => { try { await navigator.clipboard.writeText(done!.link); setCopied(true); } catch { toast("Copy failed. Select the link and copy it.", "error"); } };

  return (
    <Modal open={open} onClose={close} title={done ? "Order created" : "New order for a customer"} maxWidth={640}>
      {done ? (
        <div className="admin-form no">
          <div className="no-done"><span><Check size={22} /></span><div><strong>{done.order.ref} · {inr(done.order.total)}</strong><p>Confirmed for {done.order.customer.name} (+91 {done.order.customer.mobile}). {done.order.payment === "cod" ? "Payment is collected on delivery (cash or UPI QR)." : "Marked as paid."}</p></div></div>
          <label className="label" htmlFor="no-link">Customer's tracking link</label>
          <div className="no-link"><input id="no-link" className="input" readOnly value={done.link} onFocus={(e) => e.target.select()} /><button className="btn btn-primary btn-sm" onClick={copy}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button></div>
          <div className="no-share">
            <a className="btn btn-ghost btn-sm" href={`https://wa.me/91${done.order.customer.mobile}?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>
            <a className="btn btn-ghost btn-sm" href={`sms:+91${done.order.customer.mobile}?body=${encodeURIComponent(shareText)}`}><Smartphone size={14} /> SMS</a>
            <a className="btn btn-ghost btn-sm" href={done.link} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>
          </div>
          <p className="adm-hint" style={{ margin: 0 }}>The link opens this order's tracking page without signing in. The customer can also track it with the order ID and their mobile number.</p>
          <button className="btn btn-solid btn-block" onClick={reset}>Create another order</button>
        </div>
      ) : (
        <div className="admin-form no">
          <h4 className="no-h">Customer</h4>
          <div className="field-row">
            <div className="field"><label className="label" htmlFor="no-name">Name <i className="req">*</i></label><input id="no-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /><FieldError msg={errs.name} /></div>
            <div className="field"><label className="label" htmlFor="no-mob">Mobile <i className="req">*</i></label><input id="no-mob" className="input" inputMode="numeric" maxLength={10} placeholder="10-digit number" value={mobile} onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); }} /><FieldError msg={errs.mobile} /></div>
          </div>

          <h4 className="no-h">Delivery location <i className="req">*</i></h4>
          <div className={`no-loc ${loc ? "set" : ""} ${errs.location ? "bad" : ""}`}>
            {loc ? (
              <div className="no-loc-set">
                <span className="no-loc-ic"><MapPin size={18} /></span>
                <div><strong>Location set</strong><span>{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</span>
                  {fee && <span className={fee.deliverable ? "ok" : "no"}>{fee.message}</span>}</div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}>Change</button>
              </div>
            ) : (
              <>
                <button type="button" className="btn btn-primary btn-block" onClick={() => setPicking(true)}><MapPin size={16} /> Pick on map</button>
                <div className="no-or"><span>or paste a Google Maps link</span></div>
                <div className="no-paste">
                  <input className="input" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="https://maps.app.goo.gl/… or 9.92, 78.11" />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={usePaste} disabled={!paste.trim()}>Use</button>
                </div>
              </>
            )}
          </div>
          <FieldError msg={errs.location} />
          <details className="no-more">
            <summary>Add address details (optional)</summary>
            <div className="field"><label className="label" htmlFor="no-l1">House number and street</label><input id="no-l1" className="input" value={extra.line1} onChange={(e) => setExtra({ ...extra, line1: e.target.value })} /></div>
            <div className="field-row">
              <div className="field"><label className="label" htmlFor="no-area">Area</label><input id="no-area" className="input" value={extra.area} onChange={(e) => setExtra({ ...extra, area: e.target.value })} placeholder="e.g. KK Nagar" /></div>
              <div className="field"><label className="label" htmlFor="no-pin">Pincode</label><input id="no-pin" className="input" inputMode="numeric" maxLength={6} value={extra.pincode} onChange={(e) => setExtra({ ...extra, pincode: e.target.value.replace(/\D/g, "") })} /><FieldError msg={errs.pincode} /></div>
            </div>
            <div className="field"><label className="label" htmlFor="no-lm">Landmark</label><input id="no-lm" className="input" value={extra.landmark} onChange={(e) => setExtra({ ...extra, landmark: e.target.value })} placeholder="e.g. opposite the temple" /></div>
            <div className="field"><label className="label" htmlFor="no-ins">Delivery instructions</label><input id="no-ins" className="input" value={extra.instructions} onChange={(e) => setExtra({ ...extra, instructions: e.target.value })} placeholder="e.g. call before coming" /></div>
          </details>
          <MapPicker open={picking} initial={loc} onClose={() => setPicking(false)} onPick={setLocation} />

          <h4 className="no-h">Products</h4>
          <ul className="no-items">
            {products.map((p) => {
              const v = p.variants[0], n = qty[p.id] ?? 0;
              return (
                <li key={p.id} className={n ? "on" : ""}>
                  <div><strong>{p.name}</strong><span>{inr(v.price * 100)}{!v.inStock && " · sold out today"}</span></div>
                  <div className="qty">
                    <button type="button" aria-label={`Fewer ${p.name}`} onClick={() => setQty({ ...qty, [p.id]: Math.max(0, n - 1) })} disabled={!n}><Minus size={14} /></button>
                    <span>{n}</span>
                    <button type="button" aria-label={`More ${p.name}`} onClick={() => setQty({ ...qty, [p.id]: Math.min(p.maxQty ?? 10, n + 1) })} disabled={!v.inStock || n >= (p.maxQty ?? 10)}><Plus size={14} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
          <FieldError msg={errs.lines} />
          <p className="adm-hint" style={{ margin: 0 }}>Items {inr(subtotal * 100)} · the delivery fee is worked out from the location when the order is created.</p>

          <h4 className="no-h">Payment</h4>
          <div className="adm-chips">
            <button type="button" className={`adm-chip ${payment === "cash" ? "on" : ""}`} onClick={() => setPayment("cash")}>Cash on delivery</button>
            <button type="button" className={`adm-chip ${payment === "qr" ? "on" : ""}`} onClick={() => setPayment("qr")}>UPI QR on delivery</button>
            <button type="button" className={`adm-chip ${payment === "paid" ? "on" : ""}`} onClick={() => setPayment("paid")}>Already paid</button>
          </div>
          {payment === "paid" && <div className="field"><label className="label" htmlFor="no-ref">Payment reference (UPI transaction ID)</label><input id="no-ref" className="input" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Optional" /></div>}

          <div className="field"><label className="label" htmlFor="no-partner">Delivery partner (optional)</label>
            <select id="no-partner" className="select" value={partner} onChange={(e) => setPartner(e.target.value)}>
              <option value="">Assign later</option>
              {(partners.data ?? []).filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mobile}</option>)}
            </select>
          </div>

          {errs._ && <span className="field-error">{errs._}</span>}
          <button className="btn btn-primary btn-block btn-lg" onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create order & get link"}</button>
        </div>
      )}
      <style>{`
        .req { font-style: normal; color: var(--error); }
        .no-loc { padding: 14px; border: 1.5px dashed var(--border-strong); border-radius: 12px; display: flex; flex-direction: column; gap: 10px; }
        .no-loc.set { border-style: solid; border-color: var(--accent-gold); background: var(--accent-gold-glow); }
        .no-loc.bad { border-color: var(--error); }
        .no-loc-set { display: flex; align-items: center; gap: 12px; }
        .no-loc-set > div { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; color: var(--text-dim); }
        .no-loc-set strong { font-size: 14px; color: var(--text); }
        .no-loc-set .ok { color: #1E9E57; font-weight: 600; } .no-loc-set .no { color: var(--error); font-weight: 600; }
        .no-loc-ic { width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: var(--accent-gold); color: #fff; }
        .no-or { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--text-dim); }
        .no-or::before, .no-or::after { content: ""; flex: 1; height: 1px; background: var(--border); }
        .no-paste { display: flex; gap: 8px; }
        .no-paste .input { flex: 1; min-width: 0; }
        .no-more { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; }
        .no-more summary { cursor: pointer; font-size: 13.5px; font-weight: 600; color: var(--accent-gold); }
        .no-more[open] { display: flex; flex-direction: column; gap: 12px; }
        .no-more[open] summary { margin-bottom: 4px; }
        .no-h { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--green-deep); margin-top: 6px; }
        .no-items { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .no-items li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 12px; }
        .no-items li.on { border-color: var(--green); background: var(--accent-gold-glow); }
        .no-items li div:first-child { display: flex; flex-direction: column; }
        .no-items span { font-size: 12px; color: var(--text-dim); }
        .no-done { display: flex; gap: 14px; align-items: flex-start; padding: 14px; border-radius: 14px; background: var(--accent-gold-glow); }
        .no-done > span { width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: var(--green); color: #fff; }
        .no-done p { font-size: var(--font-sm); }
        .no-link { display: flex; gap: 8px; }
        .no-link .input { font-size: 14px; }
        .no-share { display: flex; flex-wrap: wrap; gap: 8px; }
      `}</style>
    </Modal>
  );
}
