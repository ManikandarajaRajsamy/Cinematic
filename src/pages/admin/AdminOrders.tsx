import { useMemo, useState } from "react";
import { Search, XCircle } from "lucide-react";
import { useApi } from "@/api/client";
import { ops, inr, type AdminOrder } from "@/api/ops";
import { useStore } from "@/store/store";
import { Modal } from "@/components/Modal";
import { errorsFrom } from "./shared";
import { Skeleton, inBranch, useBranchFilter } from "./ui";
import { JobTrack } from "./AdminDeliveries";

const PAY = { upi: "UPI (online)", card: "Card (online)", cod: "Cash on delivery" } as const;

export function AdminOrders({ branchName }: { branchName: (id: string) => string }) {
  const { data, loading, reload } = useApi("admin-orders", ops.orders);
  const jobs = useApi("admin-jobs", ops.jobs);
  const { branch } = useBranchFilter();
  const { toast } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [detail, setDetail] = useState<AdminOrder | null>(null);
  const names = useMemo(() => Object.fromEntries((jobs.data ?? []).map((j) => [j.id, j.partner_name])), [jobs.data]);

  const list = (data ?? []).filter((o) => inBranch(branch, o.branch_id)
    && (status === "ALL" || o.status === status)
    && (!q.trim() || [o.ref, o.customer.name, o.customer.mobile, o.area].some((v) => v.toLowerCase().includes(q.trim().toLowerCase()))));

  const cancel = async (o: AdminOrder) => {
    if (!confirm(`Cancel ${o.ref}?`)) return;
    try { await ops.cancelOrder(o.ref); toast(`${o.ref} cancelled`, "success"); reload(); } catch (e) { toast(errorsFrom(e).message, "error"); }
  };
  return (
    <div className="page-fade">
      <div className="admin-controls">
        <label className="admin-search"><Search size={16} /><input className="input" placeholder="Search order, customer, mobile or area" aria-label="Search orders" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All statuses</option>
          {["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      {loading && !data ? <Skeleton rows={5} /> : list.length === 0 ? <div className="card admin-empty">No orders match.</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table rt">
            <thead><tr><th>Order</th><th>Customer</th><th>Area · branch</th><th>Total</th><th>Payment</th><th>Delivery</th><th></th></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.ref} onClick={() => setDetail(o)} style={{ cursor: "pointer" }}>
                  <td data-label="Order"><strong>{o.ref}</strong><br /><small style={{ color: "var(--text-dim)" }}>{new Date(o.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small></td>
                  <td data-label="Customer">{o.customer.name}<br /><a href={`tel:+91${o.customer.mobile}`} onClick={(e) => e.stopPropagation()} style={{ color: "var(--accent-gold-bright)" }}>{o.customer.mobile}</a></td>
                  <td data-label="Area · branch">{o.area || "—"}<br /><small style={{ color: "var(--text-dim)" }}>{branchName(o.branch_id)}{o.distance_km != null && ` · ${o.distance_km.toFixed(1)} km`}</small></td>
                  <td data-label="Total">{inr(o.total)}</td>
                  <td data-label="Payment">{PAY[o.payment]}</td>
                  <td data-label="Delivery">{o.status === "cancelled" ? <span className="badge badge-error">Cancelled</span> : o.job ? <JobTrack j={o.job} partnerName={names[o.job.id]} /> : <span className="adm-hint" style={{ margin: 0 }}>Daily plan deliveries</span>}</td>
                  <td data-label="">{o.status !== "cancelled" && (!o.job || o.job.status === "READY") && <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); cancel(o); }}><XCircle size={13} /> Cancel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Order ${detail.ref}` : ""} maxWidth={560}>
        {detail && (
          <div className="admin-form">
            <dl className="kv">
              <dt>Customer</dt><dd>{detail.customer.name} · +91 {detail.customer.mobile}</dd>
              <dt>Address</dt><dd>{detail.address ? `${detail.address.line1}, ${detail.address.area} — ${detail.address.pincode}` : "—"}</dd>
              <dt>Items</dt><dd>{detail.items.map((i) => `${i.name} ${i.size} × ${i.qty}${i.plan ? ` (${i.planDays}-day plan)` : ""}`).join("; ")}</dd>
              <dt>Subtotal</dt><dd>{inr(detail.subtotal)}</dd>
              {detail.discount > 0 && <><dt>Discounts</dt><dd>– {inr(detail.discount)}</dd></>}
              <dt>Delivery</dt><dd>{detail.delivery_fee ? inr(detail.delivery_fee) : "Free"}</dd>
              <dt>Total</dt><dd><strong>{inr(detail.total)}</strong> · {PAY[detail.payment]}</dd>
              <dt>Tracking</dt><dd>{detail.job ? <JobTrack j={detail.job} partnerName={names[detail.job.id]} /> : "—"}</dd>
            </dl>
            {detail.job && detail.job.history.length > 0 && (
              <ul style={{ listStyle: "none", fontSize: "var(--font-xs)", color: "var(--text-dim)", display: "flex", flexDirection: "column", gap: 4 }}>
                {detail.job.history.map((h, i) => <li key={i}>{new Date(h.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · {h.action}{h.note && ` (${h.note})`} · {h.by}</li>)}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
