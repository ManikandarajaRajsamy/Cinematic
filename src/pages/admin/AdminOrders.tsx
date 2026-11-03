import { useMemo, useState } from "react";
import { Search, XCircle, Check, Ban } from "lucide-react";
import { useApi } from "@/api/client";
import { ops, inr, type AdminOrder } from "@/api/ops";
import { useStore } from "@/store/store";
import { Modal } from "@/components/Modal";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, statusBadge } from "@/data/orderStatus";
import type { OrderStatus } from "@/api/opsServer";
import { errorsFrom } from "./shared";
import { Skeleton, inBranch, useBranchFilter } from "./ui";
import { AssignSelect, JobTrack } from "./AdminDeliveries";

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];
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
      {pendingCount > 0 && status !== "pending" && (
        <button className="alert warn" style={{ marginBottom: 14, width: "100%" }} onClick={() => setStatus("pending")}>{pendingCount} order{pendingCount === 1 ? "" : "s"} waiting for confirmation</button>
      )}
      <div className="admin-controls">
        <label className="admin-search"><Search size={16} /><input className="input" placeholder="Search order, customer, mobile or area" aria-label="Search orders" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All orders (history)</option>
          {STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}{s === "pending" ? ` (${pendingCount})` : ""}</option>)}
        </select>
      </div>
      {loading && !data ? <Skeleton rows={5} /> : list.length === 0 ? <div className="card admin-empty">No orders match.</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table rt">
            <thead><tr><th>Order</th><th>Customer</th><th>Delivery</th><th>Total · payment</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.ref} onClick={() => setDetailRef(o.ref)} style={{ cursor: "pointer" }}>
                  <td data-label="Order"><strong>{o.ref}</strong><br /><small style={{ color: "var(--text-dim)" }}>{new Date(o.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small></td>
                  <td data-label="Customer">{o.customer.name}<br /><a href={`tel:+91${o.customer.mobile}`} onClick={(e) => e.stopPropagation()} style={{ color: "var(--green)" }}>{o.customer.mobile}</a></td>
                  <td data-label="Delivery">{o.area || "—"} · {branchName(o.branch_id)}<br /><small style={{ color: "var(--text-dim)" }}>{o.delivery_date ? `${new Date(o.delivery_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${o.delivery_slot ?? ""}` : o.items.every((i) => i.plan) ? "Daily plan" : "—"}</small></td>
                  <td data-label="Total · payment">{inr(o.total)}<br /><small style={{ color: "var(--text-dim)" }}>{o.payment_status ? PAYMENT_STATUS_LABEL[o.payment_status] : o.payment}</small></td>
                  <td data-label="Status">
                    <span className={`badge ${statusBadge(o.status)}`}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
                    {o.job && o.status !== "pending" && <div style={{ marginTop: 6 }}><JobTrack j={o.job} partnerName={names[o.job.id]} badge={false} /></div>}
                  </td>
                  <td data-label="" onClick={(e) => e.stopPropagation()}>
                    <div className="admin-actions">
                      {o.status === "pending" && <>
                        <button className="btn btn-sm btn-primary" onClick={() => setConfirmFor({ o, partner: "" })}><Check size={13} /> Confirm</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setRejectFor({ o, reason: "" })}><Ban size={13} /> Reject</button>
                      </>}
                      {o.job && <AssignSelect j={o.job} onDone={refresh} />}
                      {canCancel(o) && <button className="btn btn-sm btn-ghost" onClick={() => cancel(o)}><XCircle size={13} /> Cancel</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
              <dt>Address</dt><dd>{detail.address ? `${detail.address.line1}, ${detail.address.area} — ${detail.address.pincode}` : "—"}</dd>
              <dt>Deliver on</dt><dd>{detail.delivery_date ? `${detail.delivery_date} · ${detail.delivery_slot ?? ""}` : "—"}</dd>
              <dt>Items</dt><dd>{detail.items.map((i) => `${i.name} ${i.size} × ${i.qty}${i.plan ? ` (${i.planDays}-day plan)` : ""}`).join("; ")}</dd>
              <dt>Subtotal</dt><dd>{inr(detail.subtotal)}</dd>
              {detail.discount > 0 && <><dt>Discounts</dt><dd>– {inr(detail.discount)}</dd></>}
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
