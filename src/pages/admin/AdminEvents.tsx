import { useMemo, useState } from "react";
import { Phone, AlertTriangle, CalendarClock, Inbox, Wallet, Search } from "lucide-react";
import { api, rupees, useApi, type EventRequest } from "@/api/client";
import { SERVICE_OPTIONS } from "@/data/events";
import { useStore } from "@/store/store";
import { errorsFrom } from "./shared";
import { ops } from "@/api/ops";
import { addDays, istDate } from "@/api/opsServer";
import { JobTrack } from "./AdminDeliveries";
import { CountUp, Skeleton, inBranch, rupeeFmt, useBranchFilter } from "./ui";

const BADGE: Record<EventRequest["status"], string> = { NEW: "badge-gold", CONFIRMED: "badge-success", CANCELLED: "badge-error", COMPLETED: "badge-success" };

type Filter = "action" | "upcoming" | "new" | "past" | "cancelled" | "all";
const FILTERS: [Filter, string][] = [["action", "Needs action"], ["upcoming", "Upcoming"], ["new", "New requests"], ["past", "Completed / past"], ["cancelled", "Cancelled"], ["all", "All"]];

type Priority = { level: 0 | 1 | 2 | 3; label: string; cls: string };
const due = (r: EventRequest) => Math.max(0, r.base_amount - (r.advance_paid ?? 0) - (r.balance_collected ?? 0));
const open = (r: EventRequest) => r.status === "NEW" || r.status === "CONFIRMED";

/**
 * How urgently an event needs attention. Lower level comes first:
 * 0 · urgent: today or tomorrow and still not confirmed, or overdue (date passed, not completed)
 * 1 · high: today or tomorrow (confirmed), or a new request within 3 days
 * 2 · normal: a new request to confirm, or confirmed within the week
 * 3 · later: everything else
 */
function priorityOf(r: EventRequest, today: string): Priority {
  if (!open(r)) return { level: 3, label: r.status === "COMPLETED" ? "Done" : "—", cls: "pr-done" };
  const tomorrow = addDays(today, 1);
  if (r.event_date < today) return { level: 0, label: "Overdue", cls: "pr-urgent" };
  if (r.event_date <= tomorrow) return r.status === "NEW" ? { level: 0, label: "Urgent", cls: "pr-urgent" } : { level: 1, label: r.event_date === today ? "Today" : "Tomorrow", cls: "pr-high" };
  if (r.status === "NEW" && r.event_date <= addDays(today, 3)) return { level: 1, label: "Confirm soon", cls: "pr-high" };
  if (r.status === "NEW" || r.event_date <= addDays(today, 7)) return { level: 2, label: r.status === "NEW" ? "To confirm" : "This week", cls: "pr-normal" };
  return { level: 3, label: "Later", cls: "pr-later" };
}

const dayLabel = (d: string, today: string) => {
  if (d === today) return "Today";
  if (d === addDays(today, 1)) return "Tomorrow";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

/** Event orders are the shop's main business: the screen sorts them by urgency so the next thing to do is on top. */
export function AdminEvents() {
  const { data, loading, reload } = useApi("admin-event-requests", api.admin.eventRequests);
  const { toast } = useStore();
  const jobs = useApi("admin-jobs", ops.jobs);
  const { branch } = useBranchFilter();
  const [filter, setFilter] = useState<Filter>("action");
  const [q, setQ] = useState("");
  const today = istDate(new Date());

  const setStatus = async (r: EventRequest, status: EventRequest["status"]) => {
    if (status === "CANCELLED" && !confirm(`Cancel request ${r.ref}?`)) return;
    if (status === "COMPLETED" && !confirm(`Mark ${r.ref} as completed? Balance due ${rupees(due(r))}.`)) return;
    let advance: number | undefined;
    if (status === "CONFIRMED") {
      const v = prompt(`Advance received for ${r.ref} (₹). Paruthippaal total ${rupees(r.base_amount)}.`, String((r.advance_paid ?? 0) / 100));
      if (v == null) return;
      advance = Math.round(Number(v) * 100);
      if (!(advance >= 0)) { toast("Enter the advance in rupees", "error"); return; }
    }
    try { await api.admin.setEventStatus(r.id, status, advance); toast(`${r.ref} ${status.toLowerCase()}`, "success"); reload(); }
    catch (e) { toast(errorsFrom(e).message, "error"); }
  };

  const rows = useMemo(() => {
    const list = (data ?? []).filter((r) => inBranch(branch, r.branch_id ?? "br-main")).map((r) => ({ r, p: priorityOf(r, today) }));
    return list.sort((a, b) => a.p.level - b.p.level || (open(a.r) && open(b.r) ? a.r.event_date.localeCompare(b.r.event_date) : b.r.event_date.localeCompare(a.r.event_date)) || a.r.event_time.localeCompare(b.r.event_time));
  }, [data, branch, today]);

  const stats = useMemo(() => {
    const live = rows.filter(({ r }) => open(r));
    return {
      urgent: live.filter(({ p }) => p.level === 0).length,
      soon: live.filter(({ r }) => r.event_date >= today && r.event_date <= addDays(today, 1)).length,
      fresh: live.filter(({ r }) => r.status === "NEW").length,
      week: live.filter(({ r }) => r.event_date >= today && r.event_date <= addDays(today, 7)),
      dueTotal: live.reduce((n, { r }) => n + due(r), 0),
    };
  }, [rows, today]);

  if (loading && !data) return <Skeleton rows={4} h={72} />;

  const needle = q.trim().toLowerCase();
  const shown = rows.filter(({ r, p }) => {
    if (needle && ![r.ref, r.name, r.phone, r.venue, r.event_type].some((x) => x?.toLowerCase().includes(needle))) return false;
    if (filter === "action") return open(r) && p.level <= 2;
    if (filter === "upcoming") return open(r) && r.event_date >= today;
    if (filter === "new") return r.status === "NEW";
    if (filter === "past") return r.status === "COMPLETED" || (r.status !== "CANCELLED" && r.event_date < today);
    if (filter === "cancelled") return r.status === "CANCELLED";
    return true;
  });

  return (
    <div className="page-fade" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="kpis">
        <button className={`card kpi ev-kpi ${stats.urgent ? "hot" : ""}`} onClick={() => setFilter("action")}><span className="label"><AlertTriangle size={14} /> Urgent</span><strong><CountUp value={stats.urgent} /></strong><small>overdue, or within a day and not confirmed</small></button>
        <button className="card kpi ev-kpi" onClick={() => setFilter("upcoming")}><span className="label"><CalendarClock size={14} /> Today & tomorrow</span><strong><CountUp value={stats.soon} /></strong><small>{stats.week.length} this week · {stats.week.reduce((n, { r }) => n + r.litres, 0)} L</small></button>
        <button className="card kpi ev-kpi" onClick={() => setFilter("new")}><span className="label"><Inbox size={14} /> New requests</span><strong><CountUp value={stats.fresh} /></strong><small>call the customer and confirm</small></button>
        <div className="card kpi ev-kpi"><span className="label"><Wallet size={14} /> Balance to collect</span><strong><CountUp value={stats.dueTotal / 100} format={rupeeFmt} /></strong><small>on open event orders</small></div>
      </div>

      <div className="ev-bar">
        <div className="chips">
          {FILTERS.map(([id, label]) => <button key={id} className={`chip ${filter === id ? "on" : ""}`} onClick={() => setFilter(id)}>{label}</button>)}
        </div>
        <label className="ev-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ref, name, phone, venue…" aria-label="Search event orders" /></label>
      </div>

      {!shown.length ? (
        <div className="card admin-empty">{data?.length ? "Nothing here. Try another filter." : "No event booking requests yet. They arrive from the Events page."}</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Priority</th><th>Event date</th><th>Customer</th><th>Order</th><th>Paruthippaal</th><th>Advance / balance</th><th>Delivery</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {shown.map(({ r, p }) => (
                <tr key={r.id} className={p.level === 0 && open(r) ? "ev-row-urgent" : ""}>
                  <td><span className={`ev-pr ${p.cls}`}>{p.label}</span><br /><small style={{ fontFamily: "monospace", color: "var(--text-dim)" }}>{r.ref}</small></td>
                  <td><b>{dayLabel(r.event_date, today)}</b><br /><small style={{ color: "var(--text-dim)" }}>{r.event_date} · {r.event_time}</small></td>
                  <td>{r.name}<br /><a href={`tel:${r.phone}`} style={{ color: "var(--accent-gold-bright)" }}><Phone size={11} /> {r.phone}</a></td>
                  <td>{r.event_type} · <b>{r.litres} L</b><br /><small style={{ color: "var(--text-dim)" }}>{SERVICE_OPTIONS.find((s) => s.id === r.service)?.title}{r.venue && ` · ${r.venue}`}</small>{r.notes && <><br /><small style={{ color: "var(--text-dim)" }}>“{r.notes}”</small></>}</td>
                  <td>{rupees(r.base_amount)}{r.service !== "PICKUP" && <><br /><small style={{ color: "var(--text-dim)" }}>+ charges on call</small></>}</td>
                  <td>{rupees(r.advance_paid ?? 0)} paid<br /><small style={{ color: "var(--text-dim)" }}>{rupees(due(r))} due{r.balance_collected ? ` · ${rupees(r.balance_collected)} collected` : ""}</small></td>
                  <td>{r.service === "PICKUP" ? "Pickup at shop" : <JobTrack j={(jobs.data ?? []).find((j) => j.type === "EVENT" && j.source_id === r.id) ?? null} />}</td>
                  <td><span className={`badge ${BADGE[r.status]}`}>{r.status.toLowerCase()}</span></td>
                  <td><div className="admin-actions">
                    {r.status === "NEW" && <button className="btn btn-sm btn-solid" onClick={() => setStatus(r, "CONFIRMED")}>Confirm</button>}
                    {r.status === "CONFIRMED" && <button className="btn btn-sm btn-ghost" onClick={() => setStatus(r, "CONFIRMED")}>Edit advance</button>}
                    {r.status === "CONFIRMED" && r.event_date <= today && <button className="btn btn-sm btn-solid" onClick={() => setStatus(r, "COMPLETED")}>Completed</button>}
                    {open(r) && <button className="btn btn-sm btn-ghost" onClick={() => setStatus(r, "CANCELLED")}>Cancel</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <style>{`
        .ev-kpi { text-align: left; font: inherit; cursor: pointer; }
        div.ev-kpi { cursor: default; }
        .ev-kpi .label { display: inline-flex; align-items: center; gap: 6px; }
        .ev-kpi.hot { border: 1.5px solid #EA5455; }
        .ev-kpi.hot strong { color: #EA5455; }
        .ev-bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
        .ev-search { display: flex; align-items: center; gap: 8px; padding: 0 12px; min-height: 38px; border: 1px solid var(--border-strong); border-radius: 10px; background: var(--white, #fff); min-width: min(280px, 100%); }
        .ev-search input { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; font: inherit; }
        .ev-pr { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
        .pr-urgent { background: rgba(234, 84, 85, 0.14); color: #EA5455; }
        .pr-high { background: rgba(255, 159, 67, 0.16); color: #D97706; }
        .pr-normal { background: rgba(91, 95, 239, 0.12); color: #5B5FEF; }
        .pr-later, .pr-done { background: rgba(107, 114, 128, 0.12); color: #6B7280; }
        .ev-row-urgent td:first-child { box-shadow: inset 3px 0 0 #EA5455; }
      `}</style>
    </div>
  );
}
