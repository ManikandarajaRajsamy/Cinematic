import { useCallback, useEffect, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { ops, type SubView } from "@/api/ops";
import { ApiError } from "@/api/client";
import { useStore } from "@/store/store";

const fmt = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

/**
 * The customer's daily plans, from the server. Signed in: all plans on the account; guest: plans from orders
 * placed on this device. Pause / resume / cancel follow the same rules as the admin screen.
 */
export function MyPlans({ title = "Your daily plans", emptyText }: { title?: string; emptyText?: string }) {
  const { state, toast } = useStore();
  const refs = state.orders.map((o) => o.number);
  const key = refs.join(",") + state.user.phone;
  const [plans, setPlans] = useState<SubView[] | null>(null);
  const load = useCallback(() => { ops.mySubscriptions(refs).then(setPlans).catch(() => setPlans([])); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const act = async (s: SubView, action: "pause" | "resume" | "cancel") => {
    if (action === "cancel" && !confirm(`Cancel this plan? There's no refund; deliveries continue until ${fmt(s.end_date) || "the end of the current period"}.`)) return;
    try {
      await ops.subscriptionAction(s.id, action, refs);
      toast(action === "pause" ? "Paused from tomorrow — your end date moves forward" : action === "resume" ? "Resumed from tomorrow" : "Plan cancelled", "success");
      load();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't update the plan", "error"); }
  };

  if (!plans) return null;
  if (!plans.length) return emptyText ? <p style={{ color: "var(--text-dim)" }}>{emptyText}</p> : null;
  return (
    <div className="mp-plans">
      {title && <h2 className="title-xl mb-6">{title}</h2>}
      <div className="mp-grid">
        {plans.map((s) => (
          <article className="card mp-card" key={s.id}>
            <div className="mp-top">
              <span className={`badge ${s.status === "ACTIVE" ? "badge-success" : s.status === "PAUSED" ? "badge-gold" : s.status === "CANCELLED" ? "badge-error" : ""}`}>
                {s.status === "CANCELLED" ? `Ends ${fmt(s.end_date)}` : s.status.toLowerCase()}
              </span>
              <span className="badge badge-saffron">{s.plan_days} days · {s.discount_pct}% off</span>
            </div>
            <h3 className="title-md">{s.product_name} {s.size}</h3>
            <p className="mp-sub">{s.qty} a day · {s.delivered} delivered · {s.remaining} remaining</p>
            <div className="mp-bar" aria-hidden="true"><span style={{ width: `${(s.delivered / s.plan_days) * 100}%` }} /></div>
            <p className="mp-sub">{fmt(s.start_date)} → {s.end_date ? fmt(s.end_date) : "on resume"}{s.failed > 0 && ` · ${s.failed} missed day${s.failed > 1 ? "s" : ""} added back`}</p>
            {(s.status === "ACTIVE" || s.status === "PAUSED") && (
              <div className="mp-actions">
                {s.status === "ACTIVE" && <button className="btn btn-ghost btn-sm" onClick={() => act(s, "pause")}><Pause size={14} /> Pause</button>}
                {s.status === "PAUSED" && <button className="btn btn-ghost btn-sm" onClick={() => act(s, "resume")}><Play size={14} /> Resume</button>}
                <button className="btn btn-text btn-sm" onClick={() => act(s, "cancel")}><X size={14} /> Cancel</button>
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="mp-fine">Paused days are delivered after you resume, so your end date moves forward. Cancelling stops the plan at the end of the current period; there are no refunds.</p>
      <style>{`
        .mp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--sp-4); }
        .mp-card { padding: var(--sp-5); display: flex; flex-direction: column; gap: 8px; }
        .mp-top { display: flex; justify-content: space-between; gap: 8px; }
        .mp-sub { font-size: var(--font-sm); color: var(--text-dim); }
        .mp-bar { height: 6px; border-radius: 999px; background: var(--bg-glass-light); overflow: hidden; }
        .mp-bar span { display: block; height: 100%; background: var(--accent-green-bright); border-radius: inherit; transition: width 600ms var(--ease); }
        .mp-actions { display: flex; gap: 8px; margin-top: 4px; }
        .mp-fine { margin-top: var(--sp-4); font-size: var(--font-xs); color: var(--text-dim); }
      `}</style>
    </div>
  );
}
