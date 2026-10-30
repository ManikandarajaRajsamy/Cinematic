import { Phone } from "lucide-react";
import { api, rupees, useApi, type EventRequest } from "@/api/client";
import { SERVICE_OPTIONS } from "@/data/events";
import { useStore } from "@/store/store";
import { errorsFrom } from "./shared";
import { ops } from "@/api/ops";
import { JobTrack } from "./AdminDeliveries";

const BADGE: Record<EventRequest["status"], string> = { NEW: "badge-gold", CONFIRMED: "badge-success", CANCELLED: "badge-error", COMPLETED: "badge-success" };

/** Booking requests from the Events page. Amounts are litres × rate; extra charges are agreed on the call. */
export function AdminEvents() {
  const { data, loading } = useApi("admin-event-requests", api.admin.eventRequests);
  const { toast } = useStore();
  const jobs = useApi("admin-jobs", ops.jobs);
  const setStatus = async (r: EventRequest, status: EventRequest["status"]) => {
    if (status === "CANCELLED" && !confirm(`Cancel request ${r.ref}?`)) return;
    let advance: number | undefined;
    if (status === "CONFIRMED") {
      const v = prompt(`Advance received for ${r.ref} (₹). Paruthippaal total ${rupees(r.base_amount)}.`, String((r.advance_paid ?? 0) / 100));
      if (v == null) return;
      advance = Math.round(Number(v) * 100);
      if (!(advance >= 0)) { toast("Enter the advance in rupees", "error"); return; }
    }
    try { await api.admin.setEventStatus(r.id, status, advance); toast(`${r.ref} ${status.toLowerCase()}`, "success"); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
  };
  if (loading && !data) return <div className="card admin-empty">Loading…</div>;
  if (!data?.length) return <div className="card admin-empty">No event booking requests yet. They arrive from the Events page.</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>Ref</th><th>Customer</th><th>Event</th><th>Order</th><th>Paruthippaal</th><th>Advance / balance</th><th>Delivery</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id}>
              <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{r.ref}</td>
              <td>{r.name}<br /><a href={`tel:${r.phone}`} style={{ color: "var(--accent-gold-bright)" }}><Phone size={11} /> {r.phone}</a></td>
              <td>{r.event_type}<br /><small style={{ color: "var(--text-dim)" }}>{r.event_date} · {r.event_time}</small></td>
              <td>{r.litres} L · {SERVICE_OPTIONS.find((s) => s.id === r.service)?.title}{r.venue && <><br /><small style={{ color: "var(--text-dim)" }}>{r.venue}</small></>}{r.notes && <><br /><small style={{ color: "var(--text-dim)" }}>“{r.notes}”</small></>}</td>
              <td>{rupees(r.base_amount)}{r.service !== "PICKUP" && <><br /><small style={{ color: "var(--text-dim)" }}>+ charges on call</small></>}</td>
              <td>{rupees(r.advance_paid ?? 0)} paid<br /><small style={{ color: "var(--text-dim)" }}>{rupees(Math.max(0, r.base_amount - (r.advance_paid ?? 0) - (r.balance_collected ?? 0)))} due{r.balance_collected ? ` · ${rupees(r.balance_collected)} collected` : ""}</small></td>
              <td>{r.service === "PICKUP" ? "Pickup at shop" : <JobTrack j={(jobs.data ?? []).find((j) => j.type === "EVENT" && j.source_id === r.id) ?? null} />}</td>
              <td><span className={`badge ${BADGE[r.status]}`}>{r.status.toLowerCase()}</span></td>
              <td><div className="admin-actions">
                {r.status !== "CONFIRMED" && <button className="btn btn-sm btn-solid" onClick={() => setStatus(r, "CONFIRMED")}>Confirm</button>}
                {r.status !== "CANCELLED" && <button className="btn btn-sm btn-ghost" onClick={() => setStatus(r, "CANCELLED")}>Cancel</button>}
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
