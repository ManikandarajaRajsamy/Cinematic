import { useEffect, useMemo, useState } from "react";
import type { ChartConfiguration } from "chart.js";
import { useApi } from "@/api/client";
import { ops, inr, type DashboardData } from "@/api/ops";
import { addDays, istDate } from "@/api/opsServer";
import { BRAND, ChartBox, CountUp, Skeleton, inBranch, rupeeFmt, useBranchFilter } from "./ui";

type Period = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
const PERIODS: [Period, string][] = [["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["month", "This month"], ["custom", "Custom"]];
const dayOf = (iso: string) => istDate(new Date(iso));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;
const listDays = (from: string, to: string) => Array.from({ length: Math.max(1, daysBetween(from, to)) }, (_, i) => addDays(from, i));
const short = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const tooltipRupees = { callbacks: { label: (c: { dataset: { label?: string }; parsed: { y?: number; x?: number } | number }) => `${c.dataset.label ?? ""}: ${rupeeFmt(typeof c.parsed === "number" ? c.parsed : (c.parsed.y ?? c.parsed.x ?? 0))}` } };

function range(p: Period, today: string, custom: { from: string; to: string }): [string, string] {
  if (p === "today") return [today, today];
  if (p === "yesterday") return [addDays(today, -1), addDays(today, -1)];
  if (p === "7d") return [addDays(today, -6), today];
  if (p === "30d") return [addDays(today, -29), today];
  if (p === "month") return [today.slice(0, 8) + "01", today];
  return [custom.from || today, custom.to || today];
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev && !now) return <span className="delta flat">—</span>;
  if (!prev) return <span className="delta up">▲ new</span>;
  const pct = Math.round(((now - prev) / prev) * 100);
  return <span className={`delta ${pct > 0 ? "up" : pct < 0 ? "down" : "flat"}`}>{pct > 0 ? "▲" : pct < 0 ? "▼" : "•"} {Math.abs(pct)}% vs previous</span>;
}

export function AdminDashboard() {
  const { data, loading, reload } = useApi("admin-dashboard", ops.dashboard);
  useEffect(() => { const t = window.setInterval(reload, 30_000); return () => window.clearInterval(t); }, [reload]);
  const { branch } = useBranchFilter();
  const [period, setPeriod] = useState<Period>("7d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  if (loading && !data) return <><Skeleton rows={2} h={110} /><Skeleton rows={2} h={260} /></>;
  if (!data) return <div className="card admin-empty">Couldn't load the dashboard.</div>;
  return <DashboardBody data={data} branch={branch} period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} />;
}

function DashboardBody({ data, branch, period, setPeriod, custom, setCustom }: {
  data: DashboardData; branch: string; period: Period; setPeriod: (p: Period) => void; custom: { from: string; to: string }; setCustom: (c: { from: string; to: string }) => void;
}) {
  const today = data.today;
  const [from, to] = range(period, today, custom);
  const len = daysBetween(from, to);
  const [pFrom, pTo] = [addDays(from, -len), addDays(from, -1)];
  const inR = (d: string, a: string, b: string) => d >= a && d <= b;
  const bname = (id: string) => data.branches.find((b) => b.id === id)?.name ?? id;

  const m = useMemo(() => {
    const orders = data.orders.filter((o) => o.status !== "cancelled" && inBranch(branch, o.branch_id));
    const subs = data.subs.filter((s) => inBranch(branch, s.branch_id));
    const events = data.events.filter((e) => inBranch(branch, e.branch_id ?? "br-main"));
    const jobs = data.jobs.filter((j) => inBranch(branch, j.branch_id));
    const oIn = (a: string, b: string) => orders.filter((o) => inR(o.date, a, b));
    const sales = (list: typeof orders) => list.reduce((n, o) => n + o.total, 0);
    const vis = (a: string, b: string) => data.visits.filter((v) => inR(dayOf(v.at), a, b));
    const cur = oIn(from, to), prev = oIn(pFrom, pTo);
    const visitsCur = vis(from, to), visitsPrev = vis(pFrom, pTo);
    const uniq = (v: typeof visitsCur) => new Set(v.map((x) => x.vid)).size;
    const newCust = (a: string, b: string) => data.customers.filter((c) => inR(dayOf(c.created_at), a, b)).length;
    const weekEnd = addDays(today, 6);
    const activeSubs = subs.filter((s) => s.status === "ACTIVE");
    const upcomingEvents = events.filter((e) => e.event_date >= today && (e.status === "NEW" || e.status === "CONFIRMED"));
    const cashIn = jobs.filter((j) => j.collected?.method === "CASH").reduce((n, j) => n + j.collected!.amount, 0);
    const partnerIds = new Set(data.partners.filter((p) => inBranch(branch, p.branch_id)).map((p) => p.id));
    const handed = data.handovers.filter((h) => partnerIds.has(h.partner_id)).reduce((n, h) => n + h.amount, 0);
    const done = jobs.filter((j) => j.status === "DELIVERED" && inR(j.date, from, to));
    const failedJ = jobs.filter((j) => j.status === "FAILED" && inR(j.date, from, to));
    const graceMin = (t: string) => (t === "SUBSCRIPTION" ? 120 : t === "EVENT" ? 30 : 0);
    const onTime = done.filter((j) => new Date(j.delivered_at!).getTime() <= new Date(j.slot_start).getTime() + graceMin(j.type) * 60_000).length;
    const durations = done.filter((j) => j.picked_at).map((j) => (new Date(j.delivered_at!).getTime() - new Date(j.picked_at!).getTime()) / 60_000);
    return {
      orders, subs, events, jobs, cur, prev, visitsCur, visitsPrev,
      kpi: {
        visitors: [uniq(visitsCur), uniq(visitsPrev)], views: [visitsCur.length, visitsPrev.length],
        customers: data.customers.length, newCustomers: [newCust(from, to), newCust(pFrom, pTo)],
        todayOrders: orders.filter((o) => o.date === today).length, periodOrders: [cur.length, prev.length],
        sales: [sales(cur), sales(prev)], online: sales(cur.filter((o) => o.payment !== "cod")), cod: sales(cur.filter((o) => o.payment === "cod")),
        activeSubs: activeSubs.length, newSubs: subs.filter((s) => inR(dayOf(s.created_at), from, to)).length,
        endingWeek: subs.filter((s) => s.status !== "COMPLETED" && s.end_date && s.end_date >= today && s.end_date <= weekEnd).length,
        eventsUpcoming: upcomingEvents.length, eventsValue: upcomingEvents.reduce((n, e) => n + e.base_amount, 0),
        codPending: Math.max(0, cashIn - handed),
      },
      perf: {
        onTimePct: done.length ? Math.round((onTime / done.length) * 100) : 0,
        failedPct: done.length + failedJ.length ? Math.round((failedJ.length / (done.length + failedJ.length)) * 100) : 0,
        avgMin: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
        perPartner: data.partners.filter((p) => partnerIds.has(p.id)).map((p) => [p.name, done.filter((j) => j.partner_id === p.id).length] as [string, number]),
      },
    };
  }, [data, branch, from, to, pFrom, pTo, today]);

  const days = listDays(from, to);
  const charts = useMemo(() => {
    const byDay = (list: typeof m.cur, pred: (o: (typeof m.cur)[number]) => boolean) => days.map((d) => list.filter((o) => o.date === d && pred(o)).reduce((n, o) => n + o.total, 0) / 100);
    const salesTrend: ChartConfiguration = {
      type: "line",
      data: { labels: days.map(short), datasets: [
        { label: "Online", data: byDay(m.cur, (o) => o.payment !== "cod"), borderColor: BRAND.green, backgroundColor: "rgba(47,179,122,0.18)", fill: true, tension: 0.35 },
        { label: "COD", data: byDay(m.cur, (o) => o.payment === "cod"), borderColor: BRAND.orange, backgroundColor: "rgba(255,138,43,0.15)", fill: true, tension: 0.35 },
      ] },
      options: { plugins: { tooltip: tooltipRupees, legend: { position: "bottom" } }, scales: { y: { ticks: { callback: (v) => rupeeFmt(Number(v)) } } } },
    };
    const delivery = m.cur.filter((o) => o.items.some((i) => !i.plan)).length;
    const subsNew = m.subs.filter((s) => inR(dayOf(s.created_at), from, to)).length;
    const eventsNew = m.events.filter((e) => inR(dayOf(e.created_at), from, to)).length;
    const byType = {
      type: "doughnut",
      data: { labels: ["Delivery", "Subscription", "Event"], datasets: [{ data: [delivery, subsNew, eventsNew], backgroundColor: [BRAND.orange, BRAND.green, BRAND.gold], borderColor: "#00241F", borderWidth: 3 }] },
      options: { cutout: "62%", plugins: { legend: { position: "bottom" } } },
    } as ChartConfiguration;
    const branchIds = [...new Set(m.cur.map((o) => o.branch_id))];
    const byBranch: ChartConfiguration = {
      type: "bar",
      data: { labels: branchIds.map((id) => data.branches.find((b) => b.id === id)?.name ?? id), datasets: [{ label: "Sales", data: branchIds.map((id) => m.cur.filter((o) => o.branch_id === id).reduce((n, o) => n + o.total, 0) / 100), backgroundColor: BRAND.orange, borderRadius: 6 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: tooltipRupees }, scales: { x: { ticks: { callback: (v) => rupeeFmt(Number(v)) } } } },
    };
    const hours = Array.from({ length: 24 }, (_, h) => m.cur.filter((o) => Number(new Date(o.created_at).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })) === h).length);
    const byHour: ChartConfiguration = {
      type: "bar",
      data: { labels: hours.map((_, h) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`), datasets: [{ label: "Orders", data: hours, backgroundColor: BRAND.gold, borderRadius: 4 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { precision: 0 } } } },
    };
    const visitorsByDay = days.map((d) => new Set(m.visitsCur.filter((v) => dayOf(v.at) === d).map((v) => v.vid)).size);
    const ordersByDay = days.map((d) => m.cur.filter((o) => o.date === d).length);
    const visitors: ChartConfiguration = {
      type: "line",
      data: { labels: days.map(short), datasets: [
        { label: "Visitors", data: visitorsByDay, borderColor: BRAND.cream, backgroundColor: "rgba(250,247,240,0.1)", tension: 0.35, fill: true },
        { label: "Orders", data: ordersByDay, borderColor: BRAND.orange, tension: 0.35 },
      ] },
      options: { plugins: { legend: { position: "bottom" } }, scales: { y: { ticks: { precision: 0 } } } },
    };
    const plans = [7, 15, 30].map((n) => m.subs.filter((s) => s.plan_days === n && s.status !== "COMPLETED").length);
    const subsPlan = {
      type: "doughnut",
      data: { labels: ["7 days", "15 days", "30 days"], datasets: [{ data: plans, backgroundColor: [BRAND.gold, BRAND.orange, BRAND.green], borderColor: "#00241F", borderWidth: 3 }] },
      options: { cutout: "62%", plugins: { legend: { position: "bottom" } } },
    } as ChartConfiguration;
    const areaCount = new Map<string, number>();
    m.cur.forEach((o) => o.area && areaCount.set(o.area, (areaCount.get(o.area) ?? 0) + 1));
    const topAreas = [...areaCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const areas: ChartConfiguration = {
      type: "bar",
      data: { labels: topAreas.map((a) => a[0]), datasets: [{ label: "Orders", data: topAreas.map((a) => a[1]), backgroundColor: BRAND.green, borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { precision: 0 } } } },
    };
    const perPartner: ChartConfiguration = {
      type: "bar",
      data: { labels: m.perf.perPartner.map((p) => p[0]), datasets: [{ label: "Deliveries", data: m.perf.perPartner.map((p) => p[1]), backgroundColor: BRAND.orange, borderRadius: 6 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { ticks: { precision: 0 } } } },
    };
    return { salesTrend, byType, byBranch, byHour, visitors, subsPlan, areas, perPartner, conv: m.visitsCur.length ? Math.round((m.cur.length / Math.max(1, new Set(m.visitsCur.map((v) => v.vid)).size)) * 1000) / 10 : 0 };
  }, [m, days.join(","), from, to, data.branches]); // eslint-disable-line react-hooks/exhaustive-deps

  const k = m.kpi;
  const upcoming = m.events.filter((e) => e.event_date >= today && e.event_date <= addDays(today, 14) && e.status !== "CANCELLED").sort((a, b) => a.event_date.localeCompare(b.event_date));
  const ending = m.subs.filter((s) => s.status !== "COMPLETED" && s.end_date && s.end_date >= today && s.end_date <= addDays(today, 3));
  const recent = [...m.orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
  const top = (() => {
    const map = new Map<string, { name: string; mobile: string; orders: number; spend: number }>();
    m.orders.forEach((o) => { const c = map.get(o.customer.mobile) ?? { name: o.customer.name, mobile: o.customer.mobile, orders: 0, spend: 0 }; c.orders++; c.spend += o.total; map.set(o.customer.mobile, c); });
    return [...map.values()].sort((a, b) => b.spend - a.spend).slice(0, 8);
  })();

  return (
    <div className="page-fade" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="chips">
        {PERIODS.map(([p, l]) => <button key={p} className={`chip ${period === p ? "on" : ""}`} onClick={() => setPeriod(p)}>{l}</button>)}
        {period === "custom" && (
          <span className="adm-inline">
            <input type="date" className="input" aria-label="From" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <input type="date" className="input" aria-label="To" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </span>
        )}
        <span className="adm-hint" style={{ margin: "0 0 0 auto", alignSelf: "center" }}>{short(from)}{from !== to && ` – ${short(to)}`} · {branch === "ALL" ? "All branches" : bname(branch)}</span>
      </div>

      <div className="kpis">
        <div className="card kpi"><span className="label">Website visitors</span><strong><CountUp value={k.visitors[0]} /></strong><small><CountUp value={k.views[0]} /> page views</small><Delta now={k.visitors[0]} prev={k.visitors[1]} /></div>
        <div className="card kpi"><span className="label">Customers</span><strong><CountUp value={k.customers} /></strong><small><CountUp value={k.newCustomers[0]} /> new in period</small><Delta now={k.newCustomers[0]} prev={k.newCustomers[1]} /></div>
        <div className="card kpi"><span className="label">Today's orders</span><strong><CountUp value={k.todayOrders} /></strong><small><CountUp value={k.periodOrders[0]} /> in period</small><Delta now={k.periodOrders[0]} prev={k.periodOrders[1]} /></div>
        <div className="card kpi"><span className="label">Total sales</span><strong><CountUp value={k.sales[0] / 100} format={rupeeFmt} /></strong><small>Online {inr(k.online)} · COD {inr(k.cod)}</small><Delta now={k.sales[0]} prev={k.sales[1]} /></div>
        <div className="card kpi"><span className="label">Active subscribers</span><strong><CountUp value={k.activeSubs} /></strong><small>{k.newSubs} new · {k.endingWeek} ending this week</small></div>
        <div className="card kpi"><span className="label">Event orders</span><strong><CountUp value={k.eventsUpcoming} /></strong><small>upcoming · {inr(k.eventsValue)} booked</small></div>
        <div className="card kpi"><span className="label">COD pending handover</span><strong><CountUp value={k.codPending / 100} format={rupeeFmt} /></strong><small>cash with delivery partners</small></div>
      </div>

      <div className="chart-grid">
        <div className="card chart-card wide"><h3>Sales trend <small>Online vs COD</small></h3><ChartBox config={charts.salesTrend} label="Sales trend by day" height={260} /></div>
        <div className="card chart-card"><h3>Orders by type</h3><ChartBox config={charts.byType} label="Orders by type" /></div>
        <div className="card chart-card"><h3>Sales by branch</h3><ChartBox config={charts.byBranch} label="Sales by branch" /></div>
        <div className="card chart-card"><h3>Orders by hour <small>peak times</small></h3><ChartBox config={charts.byHour} label="Orders by hour of the day" /></div>
        <div className="card chart-card"><h3>Visitors vs orders <small>conversion {charts.conv}%</small></h3><ChartBox config={charts.visitors} label="Website visitors and orders by day" /></div>
        <div className="card chart-card"><h3>Subscriptions by plan <small>{m.subs.filter((s) => s.status === "ACTIVE").length} active · {m.subs.filter((s) => s.status === "PAUSED").length} paused · {k.endingWeek} ending</small></h3><ChartBox config={charts.subsPlan} label="Subscriptions by plan length" /></div>
        <div className="card chart-card"><h3>Top areas by orders</h3><ChartBox config={charts.areas} label="Top areas by orders" /></div>
        <div className="card chart-card wide">
          <h3>Delivery performance <small>{m.perf.onTimePct}% on time · {m.perf.failedPct}% failed · {m.perf.avgMin} min average (pick → delivered)</small></h3>
          <ChartBox config={charts.perPartner} label="Deliveries per partner" height={Math.max(140, m.perf.perPartner.length * 36)} />
        </div>
      </div>

      <div className="chart-grid">
        <div className="card chart-card">
          <h3>Upcoming event orders <small>next 14 days</small></h3>
          {upcoming.length === 0 ? <p className="adm-hint">None.</p> : (
            <table className="admin-table rt"><thead><tr><th>Date</th><th>Customer</th><th>Occasion</th><th>Litres</th><th>Serving</th><th>Advance</th><th>Balance</th><th>Status</th></tr></thead>
              <tbody>{upcoming.map((e) => (
                <tr key={e.id}><td data-label="Date">{short(e.event_date)}</td><td data-label="Customer">{e.name}</td><td data-label="Occasion">{e.event_type}</td><td data-label="Litres">{e.litres}</td>
                  <td data-label="Serving">{e.service.replace("_", " ").toLowerCase()}</td><td data-label="Advance">{inr(e.advance_paid ?? 0)}</td>
                  <td data-label="Balance">{inr(Math.max(0, e.base_amount - (e.advance_paid ?? 0) - (e.balance_collected ?? 0)))}</td><td data-label="Status">{e.status.toLowerCase()}</td></tr>
              ))}</tbody></table>
          )}
        </div>
        <div className="card chart-card">
          <h3>Subscribers ending in 3 days <small>renewal calls</small></h3>
          {ending.length === 0 ? <p className="adm-hint">None.</p> : (
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {ending.map((s) => <li key={s.id} className="adm-inline" style={{ justifyContent: "space-between" }}><span><strong>{s.customer.name}</strong> · {s.plan_days}-day · ends {short(s.end_date!)}</span><a className="btn btn-sm btn-ghost" href={`tel:+91${s.customer.mobile}`}>Call {s.customer.mobile}</a></li>)}
            </ul>
          )}
        </div>
        <div className="card chart-card">
          <h3>Recent orders <small>live</small></h3>
          {recent.length === 0 ? <p className="adm-hint">No orders yet.</p> : (
            <table className="admin-table rt"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
              <tbody>{recent.map((o) => <tr key={o.ref}><td data-label="Order">{o.ref}</td><td data-label="Customer">{o.customer.name}</td><td data-label="Total">{inr(o.total)}</td><td data-label="Payment">{o.payment === "cod" ? "COD" : "Online"}</td><td data-label="Status">{o.status.replace(/_/g, " ")}</td></tr>)}</tbody></table>
          )}
        </div>
        <div className="card chart-card">
          <h3>Top customers <small>by spend</small></h3>
          {top.length === 0 ? <p className="adm-hint">No customers yet.</p> : (
            <table className="admin-table rt"><thead><tr><th>Customer</th><th>Mobile</th><th>Orders</th><th>Spend</th></tr></thead>
              <tbody>{top.map((c) => <tr key={c.mobile}><td data-label="Customer">{c.name}</td><td data-label="Mobile">{c.mobile}</td><td data-label="Orders">{c.orders}</td><td data-label="Spend">{inr(c.spend)}</td></tr>)}</tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}
