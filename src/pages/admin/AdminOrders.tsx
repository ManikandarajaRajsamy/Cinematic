import { useMemo, useState } from "react";
import { Search, XCircle, Check, Ban, Plus, Link2, Eye, Phone, Package, MapPin, Bike, Clock, BadgeCheck, PackageCheck, ShoppingBag } from "lucide-react";
import { useApi } from "@/api/client";
import { ops, inr, type AdminOrder } from "@/api/ops";
import { useStore } from "@/store/store";
import { Modal } from "@/components/Modal";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, statusBadge } from "@/data/orderStatus";
import type { OrderStatus } from "@/api/opsServer";
import { errorsFrom } from "./shared";
import { Skeleton, ViewToggle, inBranch, useBranchFilter, useViewMode } from "./ui";
import { AssignSelect } from "./AdminDeliveries";
import { AdminNewOrder, trackingLink } from "./AdminNewOrder";

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];
// the status tiles at the top of the list: tap one to filter
const TILES: { id: string; label: string; icon: typeof Clock; tone: string }[] = [
  { id: "ALL", label: "All orders", icon: ShoppingBag, tone: "t-all" },
  { id: "pending", label: "To confirm", icon: Clock, tone: "t-wait" },
  { id: "confirmed", label: "Confirmed", icon: BadgeCheck, tone: "t-info" },
  { id: "picked_up", label: "Out for delivery", icon: Bike, tone: "t-info" },
  { id: "delivered", label: "Delivered", icon: PackageCheck, tone: "t-done" },
  { id: "cancelled", label: "Cancelled", icon: XCircle, tone: "t-stop" },
];
const itemsLine = (o: AdminOrder) => o.items.filter((i) => !i.plan).map((i) => `${i.size} × ${i.qty}`).join(", ") || o.items.map((i) => `${i.size} × ${i.qty}`).join(", ");
const payText = (o: AdminOrder) => ({ ONLINE: "UPI · to verify", VERIFIED: "Paid · UPI", DUE: "Pay on delivery", COLLECTED: o.job?.collected?.method === "CASH" ? "Paid · cash" : "Paid · QR" } as const)[o.payment_status ?? (o.payment === "cod" ? "DUE" : "ONLINE")];
const payBadge = (o: AdminOrder) => (o.payment_status === "VERIFIED" || o.payment_status === "COLLECTED" ? "badge-success" : o.payment_status === "ONLINE" ? "badge-gold" : "badge-saffron");
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** The order's whole lifecycle, oldest first: placed, confirmed, assigned, picked up, paid, OTP, delivered. */
function OrderHistory({ o }: { o: AdminOrder }) {
  // order steps and delivery steps, merged; the delivery log repeats some order steps, so keep each once
  const seen = new Set<string>();
  const rows = [...(o.history ?? []), ...(o.job?.history ?? [])]
    .sort((a, b) => a.at.localeCompare(b.at))
    .filter((h) => { const k = `${h.at.slice(0, 16)}|${h.action}`; if (seen.has(k)) return false; seen.add(k); return true; });
  if (!rows.length) return null;
  return (
    <div className="oh">
      <h4 className="label">Order history</h4>
      <ol>
        {rows.map((h, i) => (
          <li key={i}><time>{when(h.at)}</time><span>{h.action}{h.note && <em> · {h.note}</em>}</span><small>{h.by}</small></li>
        ))}
      </ol>
      <style>{`
        .asg { list-style: none; display: flex; flex-direction: column; gap: 6px; }
        .asg li { padding-left: 10px; border-left: 2px solid var(--border-strong); color: var(--text-dim); }
        .asg li.now { border-color: var(--accent-gold); color: var(--text); }
        .asg small { font-size: var(--font-xs); color: var(--text-dim); }
        .oh { border-top: 1px solid var(--border); padding-top: var(--sp-4); }
        .oh ol { display: flex; flex-direction: column; margin-top: var(--sp-3); }
        .oh li { display: grid; grid-template-columns: 120px 1fr; gap: 2px 12px; padding: 8px 0 8px 14px; border-left: 2px solid var(--accent-gold); font-size: var(--font-sm); position: relative; }
        .oh li::before { content: ""; position: absolute; left: -5px; top: 13px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent-gold); }
        .oh time { color: var(--text-dim); font-size: var(--font-xs); }
        .oh small { grid-column: 2; color: var(--text-dim); font-size: var(--font-xs); }
        .oh em { color: var(--text-muted); font-style: normal; }
      `}</style>
    </div>
  );
}

/**
 * Every order and its lifecycle. New orders wait here as "Pending confirmation": the admin checks the
 * details and payment, confirms (optionally assigning a partner at once) or rejects with a reason.
 */
export function AdminOrders({ branchName }: { branchName: (id: string) => string }) {
  const { data, loading, reload } = useApi("admin-orders", ops.orders);
  const jobs = useApi("admin-jobs", ops.jobs);
  const partners = useApi("admin-partners", ops.partners);
  const { branch } = useBranchFilter();
  const { toast } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [detailRef, setDetailRef] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<{ o: AdminOrder; partner: string } | null>(null);
  const [rejectFor, setRejectFor] = useState<{ o: AdminOrder; reason: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useViewMode("orders");

  /** Confirm / reject while pending, cancel until pickup, and the details. */
  const OrderActions = ({ o }: { o: AdminOrder }) => (
    <div className="admin-actions">
      {o.status === "pending" && <>
        <button className="btn btn-sm btn-primary" onClick={() => setConfirmFor({ o, partner: "" })}><Check size={13} /> Confirm</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setRejectFor({ o, reason: "" })}><Ban size={13} /> Reject</button>
      </>}
      {canCancel(o) && <button className="btn btn-sm ot-ic ot-ic-stop" onClick={() => cancel(o)} title="Cancel order" aria-label={`Cancel ${o.ref}`}><XCircle size={15} /></button>}
      <button className="btn btn-sm ot-ic ot-ic-view" onClick={() => setDetailRef(o.ref)} title="Details and history" aria-label={`Details of ${o.ref}`}><Eye size={15} /></button>
    </div>
  );
  const names = useMemo(() => Object.fromEntries((jobs.data ?? []).map((j) => [j.id, j.partner_name])), [jobs.data]);
  const refresh = () => { reload(); jobs.reload(); };
  const detail = (data ?? []).find((o) => o.ref === detailRef) ?? null;

  // Orders lists parcel orders only; daily plans (and confirming them) live under Subscriptions, so nothing is listed twice.
  // An order that bought a parcel and a plan appears here for its parcel.
  const all = (data ?? []).filter((o) => inBranch(branch, o.branch_id) && o.items.some((i) => !i.plan));
  const list = all.filter((o) => (status === "ALL" || o.status === status)
    && (!q.trim() || [o.ref, o.customer.name, o.customer.mobile, o.area].some((v) => v.toLowerCase().includes(q.trim().toLowerCase()))));
  const pendingCount = all.filter((o) => o.status === "pending").length;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok, "success"); refresh(); return true; } catch (e) { toast(errorsFrom(e).message, "error"); return false; }
  };
  const cancel = (o: AdminOrder) => { if (confirm(`Cancel ${o.ref}?`)) run(() => ops.cancelOrder(o.ref), `${o.ref} cancelled`); };
  const canCancel = (o: AdminOrder) => o.status === "confirmed" && (!o.job || o.job.status === "READY" || o.job.status === "ASSIGNED");

  return (
    <div className="page-fade">
      <div className="os-tiles" role="group" aria-label="Filter by status">
        {TILES.map((t) => {
          const n = t.id === "ALL" ? all.length : all.filter((o) => o.status === t.id).length;
          return (
            <button key={t.id} className={`os-tile ${t.tone} ${status === t.id ? "on" : ""}`} aria-pressed={status === t.id} onClick={() => setStatus(t.id)}>
              <span className="os-tile-ic"><t.icon size={18} /></span>
              <span className="os-tile-txt"><strong>{n}</strong><small>{t.label}</small></span>
            </button>
          );
        })}
      </div>
      <div className="os-bar">
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New order</button>
        <ViewToggle mode={view} onChange={setView} />
      </div>
      <div className="admin-controls">
        <label className="admin-search"><Search size={16} /><input className="input" placeholder="Search order, customer, mobile or area" aria-label="Search orders" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All orders (history)</option>
          {STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}{s === "pending" ? ` (${pendingCount})` : ""}</option>)}
        </select>
      </div>
      {loading && !data ? <Skeleton rows={5} /> : list.length === 0 ? <div className="card admin-empty">No orders match.</div> : (
        view === "table" ? (
          <div className="admin-table-wrap ot-wrap">
            <table className="admin-table ot">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Delivery</th><th>Total</th><th>Payment</th><th>Status</th><th>Partner</th><th className="r">Action</th></tr></thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.ref} onClick={() => setDetailRef(o.ref)}>
                    <td><a className="ot-ref" href={`#order-${o.ref}`} onClick={(e) => { e.preventDefault(); setDetailRef(o.ref); }}>{o.ref}</a><small>{when(o.created_at)}</small></td>
                    <td><div className="ot-cust"><span className="og-av">{o.customer.name.charAt(0).toUpperCase()}</span><div><span className="ot-name">{o.customer.name}</span><a className="ot-sub" href={`tel:+91${o.customer.mobile}`} onClick={(e) => e.stopPropagation()}>{o.customer.mobile}</a></div></div></td>
                    <td className="ot-items">{itemsLine(o)}</td>
                    <td><span>{o.area || "—"}</span><small>{branchName(o.branch_id)}</small></td>
                    <td className="ot-num">{inr(o.total)}</td>
                    <td><span className={`badge ${payBadge(o)}`}>{payText(o)}</span></td>
                    <td><span className={`badge dot ${statusBadge(o.status)}`}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>{o.job ? <AssignSelect j={o.job} onDone={refresh} /> : <span className="ot-sub">{o.status === "pending" ? "After confirming" : "—"}</span>}{o.job?.partner_id && o.job.status !== "READY" && o.job.status !== "ASSIGNED" && <small>{names[o.job.id]}</small>}</td>
                    <td className="r" onClick={(e) => e.stopPropagation()}><OrderActions o={o} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="og">
            {list.map((o) => (
              <li key={o.ref} className={`og-card ${o.status === "pending" ? "pending" : ""}`} onClick={() => setDetailRef(o.ref)}>
                <div className="og-top">
                  <div><strong>{o.ref}</strong><small>{when(o.created_at)}</small></div>
                  <span className={`badge dot ${statusBadge(o.status)}`}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
                </div>
                <div className="og-who">
                  <span className="og-av">{o.customer.name.charAt(0).toUpperCase()}</span>
                  <div><strong>{o.customer.name}</strong><a href={`tel:+91${o.customer.mobile}`} onClick={(e) => e.stopPropagation()}><Phone size={12} /> {o.customer.mobile}</a></div>
                </div>
                <ul className="og-facts">
                  <li><Package size={14} /> {itemsLine(o)}</li>
                  <li><MapPin size={14} /> {o.area || "—"} · {branchName(o.branch_id)}</li>
                  {o.job?.partner_id && <li><Bike size={14} /> {names[o.job.id] || "Partner assigned"}</li>}
                </ul>
                <div className="og-money"><strong>{inr(o.total)}</strong><span className={`badge ${payBadge(o)}`}>{payText(o)}</span></div>
                <div className="og-act" onClick={(e) => e.stopPropagation()}>
                  {o.job && (o.job.status === "READY" || o.job.status === "ASSIGNED") && <AssignSelect j={o.job} onDone={refresh} />}
                  <OrderActions o={o} />
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      <OrdersStyles />
      <AdminNewOrder open={creating} onClose={() => setCreating(false)} onCreated={refresh} />

      <Modal open={!!confirmFor} onClose={() => setConfirmFor(null)} title={confirmFor ? `Confirm ${confirmFor.o.ref}` : ""} maxWidth={480}>
        {confirmFor && (
          <div className="admin-form">
            <p>{confirmFor.o.customer.name} · {inr(confirmFor.o.total)} · {confirmFor.o.items.map((i) => `${i.name} ${i.size} × ${i.qty}`).join(", ")}</p>
            {confirmFor.o.payment_status === "ONLINE" && <p className="adm-hint" style={{ margin: 0 }}>Check that the UPI payment of {inr(confirmFor.o.total)} has arrived. Confirming marks the payment as verified.</p>}
            {(
              <div className="field"><label className="label" htmlFor="cf-partner">Delivery partner (optional, you can assign later)</label>
                <select id="cf-partner" className="select" value={confirmFor.partner} onChange={(e) => setConfirmFor({ ...confirmFor, partner: e.target.value })}>
                  <option value="">Assign later</option>
                  {(partners.data ?? []).filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mobile}</option>)}
                </select>
              </div>
            )}
            {confirmFor.o.plans.length > 0 && <p className="adm-hint" style={{ margin: 0 }}>This order also starts a daily plan; this partner gets its plan days too. You can change that under Subscriptions.</p>}
            <button className="btn btn-primary btn-block" onClick={async () => {
              const { o, partner } = confirmFor;
              const ok = await run(async () => {
                await ops.confirmOrder(o.ref, partner || undefined);
                if (partner) for (const pl of o.plans) await ops.assignPlanPartner(pl.id, partner);
              }, `${o.ref} confirmed`);
              if (ok) setConfirmFor(null);
            }}><Check size={14} /> Confirm order</button>
          </div>
        )}
      </Modal>

      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title={rejectFor ? `Reject ${rejectFor.o.ref}` : ""} maxWidth={480}>
        {rejectFor && (
          <div className="admin-form">
            <div className="field"><label className="label" htmlFor="rj-reason">Reason (shown to the customer)</label>
              <textarea id="rj-reason" className="textarea" style={{ minHeight: 90 }} value={rejectFor.reason} onChange={(e) => setRejectFor({ ...rejectFor, reason: e.target.value })} placeholder="e.g. Address is outside our delivery area" /></div>
            <button className="btn btn-ghost btn-block" disabled={!rejectFor.reason.trim()} onClick={async () => { if (await run(() => ops.rejectOrder(rejectFor.o.ref, rejectFor.reason), `${rejectFor.o.ref} rejected`)) setRejectFor(null); }}><Ban size={14} /> Reject order</button>
          </div>
        )}
      </Modal>

      <Modal open={!!detail} onClose={() => setDetailRef(null)} title={detail ? `Order ${detail.ref}` : ""} maxWidth={560}>
        {detail && (
          <div className="admin-form">
            <dl className="kv">
              <dt>Status</dt><dd>{ORDER_STATUS_LABEL[detail.status] ?? detail.status}{detail.reject_reason && ` · ${detail.reject_reason}`}</dd>
              <dt>Customer</dt><dd>{detail.customer.name} · +91 {detail.customer.mobile}</dd>
              {detail.share_token && <><dt>Customer link</dt><dd><button className="btn btn-text btn-sm" onClick={() => navigator.clipboard.writeText(trackingLink(detail.share_token!)).then(() => toast("Link copied", "success"), () => toast(trackingLink(detail.share_token!)))}><Link2 size={13} /> Copy tracking link</button>{detail.created_by && <small style={{ color: "var(--text-dim)" }}> · created by the shop</small>}</dd></>}
              <dt>Address</dt><dd>{detail.address ? `${detail.address.line1}, ${detail.address.area} — ${detail.address.pincode}` : "—"}</dd>
              <dt>Deliver on</dt><dd>{detail.delivery_date ? `${detail.delivery_date} · ${detail.delivery_slot ?? ""}` : "—"}</dd>
              <dt>Items</dt><dd>{detail.items.map((i) => `${i.name} ${i.size} × ${i.qty}${i.plan ? ` (${i.planDays}-day plan)` : ""}`).join("; ")}</dd>
              <dt>Subtotal</dt><dd>{inr(detail.subtotal)}</dd>
              {detail.discount > 0 && <><dt>Discounts</dt><dd>– {inr(detail.discount)}{detail.promo_code && ` (incl. promo ${detail.promo_code}: ${inr(detail.promo_discount ?? 0)})`}</dd></>}
              {detail.promo_code && <><dt>Promoter</dt><dd>Code {detail.promo_code} · commission 10% of product price (see Promoters)</dd></>}
              <dt>Delivery fee</dt><dd>{detail.delivery_fee ? inr(detail.delivery_fee) : "Free"}</dd>
              <dt>Total</dt><dd><strong>{inr(detail.total)}</strong></dd>
              <dt>Payment method</dt><dd>{detail.payment === "cod" ? "Pay on delivery (UPI QR)" : "Online (UPI at checkout)"}</dd>
              <dt>Payable</dt><dd>{inr(detail.total)}</dd>
              <dt>Payment status</dt><dd>{detail.payment_status ? PAYMENT_STATUS_LABEL[detail.payment_status] : "—"}{detail.paid_at && ` · ${when(detail.paid_at)}`}</dd>
              {detail.payment_ref && <><dt>Online txn ref</dt><dd><code>{detail.payment_ref}</code></dd></>}
              {(detail.qr_ref || detail.job?.qr) && <><dt>QR payment</dt><dd>{detail.job?.qr ? `${inr(detail.job.qr.amount)} · ${detail.job.qr.status.toLowerCase()}` : ""}{detail.qr_ref && <> · <code>{detail.qr_ref}</code></>}</dd></>}
              <dt>Delivery partner</dt><dd>{detail.job?.partner_id ? names[detail.job.id] || "Assigned" : "Not assigned"}</dd>
              {(detail.job?.assignments?.length ?? 0) > 0 && <><dt>Assignments</dt><dd>
                <ul className="asg">{detail.job!.assignments!.map((a, i) => (
                  <li key={i} className={a.until ? "" : "now"}><strong>{a.name}</strong> · {a.mobile}<br /><small>{when(a.at)} → {a.until ? when(a.until) : "current"} · by {a.by.replace(/^admin:/, "")}</small></li>
                ))}</ul>
              </dd></>}
              <dt>OTP</dt><dd>{detail.job?.otp_status ? { SENT: "Sent to customer", VERIFIED: `Verified${detail.job.otp_verified_at ? ` · ${when(detail.job.otp_verified_at)}` : ""}`, LOCKED: "Locked after wrong attempts" }[detail.job.otp_status] : "Not issued yet"}</dd>
              <dt>Delivered</dt><dd>{detail.job?.delivered_at ? `${when(detail.job.delivered_at)}${detail.job.delivered_by ? ` by ${detail.job.delivered_by}` : ""}` : "—"}</dd>
            </dl>
            <OrderHistory o={detail} />
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Styles for the orders list: status tiles, toolbar, table and grid. Always rendered with the list. */
function OrdersStyles() {
  return (
    <style>{`
        .vt { display: inline-flex; padding: 3px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-card); margin-left: auto; }
        .vt button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--text-dim); }
        .vt button.on { background: var(--accent-gold-glow); color: var(--accent-gold); }
        .ot-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .ot { min-width: 1080px; }
        .ot tbody tr { cursor: pointer; }
        .ot td { vertical-align: middle; }
        .ot td small { display: block; font-size: 12px; color: var(--text-dim); margin-top: 2px; }
        .ot-ref { font-weight: 700; }
        .ot-name { display: block; font-weight: 600; }
        .ot-sub { font-size: 12px; color: var(--text-dim); }
        .ot-items { max-width: 160px; }
        .ot-num { font-weight: 700; white-space: nowrap; }
        .ot .r { text-align: right; }
        .ot .admin-actions { justify-content: flex-end; flex-wrap: nowrap; }
        .ot-ic { width: 34px; padding: 0 !important; justify-content: center; }
        .ot .assign-select { min-width: 180px; }
        .og { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
        .og-card { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--bg-card); cursor: pointer; transition: box-shadow 160ms, border-color 160ms; }
        .og-card:hover { border-color: var(--border-bright); box-shadow: 0 8px 24px rgba(17, 24, 39, 0.08); }
        .og-card.pending { box-shadow: inset 3px 0 0 #FF9F43; }
        .og-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .og-top > div { display: flex; flex-direction: column; }
        .og-top small { font-size: 12px; color: var(--text-dim); }
        .og-who { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--bg-elevated); }
        .og-av { width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: var(--accent-gold-glow); color: var(--accent-gold); font-weight: 700; }
        .og-who > div { display: flex; flex-direction: column; min-width: 0; }
        .og-who a { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; color: var(--accent-gold); }
        .og-facts { list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-muted); }
        .og-facts li { display: flex; align-items: center; gap: 8px; }
        .og-facts svg { flex-shrink: 0; color: var(--text-dim); }
        .og-money { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px dashed var(--border); }
        .og-money strong { font-size: 1.15rem; }
        .og-act { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .og-act .assign-select { flex: 1 1 100%; min-width: 0; }
        .og-act .admin-actions { flex: 1; justify-content: flex-end; }
        @media (max-width: 700px) { .og { grid-template-columns: 1fr; } .vt { margin-left: 0; } .vt span { display: none; } }
        .os-tiles { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
        .os-tile { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-card); text-align: left; transition: transform 160ms, box-shadow 160ms, border-color 160ms; }
        .os-tile:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(17, 24, 39, 0.08); }
        .os-tile-ic { width: 40px; height: 40px; flex-shrink: 0; border-radius: 10px; display: grid; place-items: center; }
        .os-tile-txt { display: flex; flex-direction: column; min-width: 0; }
        .os-tile strong { font-size: 1.35rem; line-height: 1.1; }
        .os-tile small { font-size: 12px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .t-all .os-tile-ic { background: rgba(91, 95, 239, 0.12); color: #5B5FEF; }
        .t-wait .os-tile-ic { background: rgba(255, 159, 67, 0.16); color: #D9770F; }
        .t-info .os-tile-ic { background: rgba(0, 184, 217, 0.13); color: #0091AD; }
        .t-done .os-tile-ic { background: rgba(40, 199, 111, 0.14); color: #1E9E57; }
        .t-stop .os-tile-ic { background: rgba(234, 84, 85, 0.12); color: #D63B3C; }
        .os-tile.on { border-color: #5B5FEF; box-shadow: 0 0 0 1px #5B5FEF, 0 8px 20px rgba(91, 95, 239, 0.15); }
        .os-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .badge.dot::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .ot-cust { display: flex; align-items: center; gap: 10px; }
        .ot-cust > div { display: flex; flex-direction: column; }
        .ot-ic { width: 34px; height: 34px; min-height: 34px !important; padding: 0 !important; display: inline-grid !important; place-items: center; border-radius: 8px !important; border: 0 !important; }
        .ot-ic-view { background: rgba(91, 95, 239, 0.1); color: #5B5FEF; }
        .ot-ic-view:hover { background: #5B5FEF; color: #fff; }
        .ot-ic-stop { background: rgba(234, 84, 85, 0.1); color: #D63B3C; }
        .ot-ic-stop:hover { background: #EA5455; color: #fff; }
        .ot tbody tr:hover td { background: rgba(91, 95, 239, 0.04); }
        @media (max-width: 1200px) { .os-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 700px) {
          .os-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .os-tile { padding: 10px; gap: 10px; }
          .os-tile-ic { width: 34px; height: 34px; }
          .os-tile strong { font-size: 1.15rem; }
          .os-bar .btn { flex: 1; }
          .vt span { display: inline; }
        }
    `}</style>
  );
}
