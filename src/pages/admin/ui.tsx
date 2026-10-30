import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  Chart, ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler, Legend, LineController, LineElement,
  LinearScale, PointElement, Tooltip, type ChartConfiguration,
} from "chart.js";

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip);

export const BRAND = { orange: "#FF8A2B", green: "#2FB37A", gold: "#E0A32E", cream: "#FAF7F0", grey: "#9FB5AC", red: "#FF6B5A", line: "rgba(250,247,240,0.10)" };
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const rupeeFmt = (rupees: number) => "₹" + Math.round(rupees).toLocaleString("en-IN");

/* ---------- branch filter shared by the dashboard and lists ---------- */
export const BranchFilterCtx = createContext<{ branch: string; setBranch: (b: string) => void }>({ branch: "ALL", setBranch: () => {} });
export const useBranchFilter = () => useContext(BranchFilterCtx);
export const inBranch = (branch: string, id?: string | null) => branch === "ALL" || id === branch;

/* ---------- numbers that count up on first show ---------- */
export function CountUp({ value, format = (n: number) => Math.round(n).toLocaleString("en-IN") }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reducedMotion()) { setShown(value); return; }
    const start = performance.now(), a = from.current, dur = 700;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

/* ---------- Chart.js wrapper in brand colours, ₹ in Indian format ---------- */
export function ChartBox({ config, height = 240, label }: { config: ChartConfiguration; height?: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    Chart.defaults.color = BRAND.grey;
    Chart.defaults.font.family = "'Hind Madurai', system-ui, sans-serif";
    Chart.defaults.borderColor = BRAND.line;
    const cfg = { ...config, options: { responsive: true, maintainAspectRatio: false, animation: reducedMotion() ? false : { duration: 700 }, ...config.options } } as ChartConfiguration;
    chart.current?.destroy();
    chart.current = new Chart(ref.current, cfg);
    return () => { chart.current?.destroy(); chart.current = null; };
  }, [config]);
  return <div className="ch-box" style={{ height }}><canvas ref={ref} role="img" aria-label={label} /></div>;
}

/* ---------- drawer ---------- */
export function Drawer({ open, onClose, title, children, width = 560 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="dr-back" onClick={onClose}>
      <aside className="dr-panel" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header><h3>{title}</h3><button onClick={onClose} aria-label="Close"><X size={18} /></button></header>
        <div className="dr-body">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

export const Skeleton = ({ rows = 4, h = 64 }: { rows?: number; h?: number }) => (
  <div className="sk" aria-busy="true">{Array.from({ length: rows }, (_, i) => <div key={i} style={{ height: h }} />)}</div>
);

/** Shared admin styles for the new screens (drawer, skeleton, responsive tables, KPI cards, boards). */
export function AdminUiStyles() {
  return (
    <style>{`
      .dr-back { position: fixed; inset: 0; z-index: 200; background: rgba(0, 10, 8, 0.6); backdrop-filter: blur(4px); animation: dr-fade 250ms ease; }
      .dr-panel { position: absolute; top: 0; right: 0; bottom: 0; width: 100%; background: #00241F; border-left: 1px solid var(--border-strong); display: flex; flex-direction: column; animation: dr-slide 280ms cubic-bezier(0.22, 1, 0.36, 1); box-shadow: -20px 0 60px rgba(0,0,0,0.5); }
      .dr-panel header { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid var(--border); }
      .dr-panel header h3 { font-family: var(--font-display); font-size: 1.4rem; font-weight: 500; }
      .dr-panel header button { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--border-strong); }
      .dr-body { overflow-y: auto; padding: 20px 22px 32px; display: flex; flex-direction: column; gap: 18px; }
      @keyframes dr-fade { from { opacity: 0; } }
      @keyframes dr-slide { from { transform: translateX(40px); opacity: 0; } }
      .sk div { border-radius: 14px; background: linear-gradient(90deg, rgba(250,247,240,0.04), rgba(250,247,240,0.09), rgba(250,247,240,0.04)); background-size: 200% 100%; margin-bottom: 10px; animation: sk 1.2s linear infinite; }
      @keyframes sk { to { background-position: -200% 0; } }
      .ch-box { position: relative; width: 100%; }
      .kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
      .kpi { padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; animation: dr-fade 300ms ease both; }
      .kpi .label { font-size: 10.5px; }
      .kpi strong { font-family: var(--font-display); font-size: 1.9rem; font-weight: 400; letter-spacing: -0.03em; line-height: 1.05; }
      .kpi small { font-size: var(--font-xs); color: var(--text-dim); }
      .delta { font-size: var(--font-xs); font-weight: 700; }
      .delta.up { color: #5FD3AE; } .delta.down { color: #FF8A70; } .delta.flat { color: var(--text-dim); }
      .chart-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
      .chart-card { padding: 18px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .chart-card h3 { font-size: var(--font-md); font-weight: 600; display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
      .chart-card h3 small { font-size: var(--font-xs); color: var(--text-dim); font-weight: 500; }
      .chart-card.wide { grid-column: 1 / -1; }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .chip { display: inline-flex; gap: 6px; align-items: center; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--border-strong); font-size: var(--font-sm); background: var(--bg-glass-light); transition: all 200ms; }
      .chip b { font-family: var(--font-mono); color: var(--accent-gold-bright); }
      .chip.on { border-color: var(--accent-gold); background: rgba(255,122,24,0.12); }
      .board { display: grid; grid-template-columns: repeat(4, minmax(220px, 1fr)); gap: 12px; overflow-x: auto; }
      .board-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
      .board-col > h4 { display: flex; justify-content: space-between; font-size: var(--font-sm); font-weight: 700; padding: 8px 10px; border-radius: 10px; background: var(--bg-glass-light); }
      .board-card svg, .admin-table td svg, .kv svg, .chips svg { display: inline-block; vertical-align: -2px; }
      .board-card > span { display: block; }
      @media (max-width: 700px) {
        .admin-head { align-items: stretch; }
        .admin-head .admin-actions { flex-wrap: wrap; width: 100%; }
        .admin-head .adm-branch { flex: 1 1 100%; }
        .admin-head .adm-branch .select { min-width: 0; width: 100%; }
      }
      .board-card { padding: 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-card); font-size: var(--font-sm); display: flex; flex-direction: column; gap: 4px; animation: dr-fade 300ms ease both; }
      .alerts { display: flex; flex-direction: column; gap: 8px; }
      .alert { display: flex; gap: 10px; align-items: flex-start; padding: 10px 14px; border-radius: 12px; font-size: var(--font-sm); border: 1px solid rgba(255,138,112,0.5); background: rgba(176,73,47,0.14); }
      .alert.warn { border-color: rgba(224,163,46,0.5); background: rgba(224,163,46,0.1); }
      .cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
      .cal-day { padding: 6px 4px; border-radius: 8px; font-size: 11px; text-align: center; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px; }
      .cal-day b { font-size: 13px; }
      .cal-day.DELIVERED { background: rgba(47,179,122,0.18); border-color: rgba(47,179,122,0.5); }
      .cal-day.FAILED { background: rgba(255,107,90,0.16); border-color: rgba(255,107,90,0.5); }
      .cal-day.PAUSED { background: rgba(224,163,46,0.14); border-color: rgba(224,163,46,0.45); }
      .cal-day.UPCOMING { background: var(--bg-glass-light); }
      .cal-day.NOT_RECORDED { opacity: 0.6; }
      .kv { display: grid; grid-template-columns: 140px 1fr; gap: 6px 12px; font-size: var(--font-sm); }
      .kv dt { color: var(--text-dim); }
      .page-fade { animation: dr-fade 250ms ease both; }
      /* tables become cards on phones */
      @media (max-width: 700px) {
        .rt thead { display: none; }
        .rt, .rt tbody, .rt tr, .rt td { display: block; width: 100%; }
        .rt tr { border: 1px solid var(--border); border-radius: 14px; padding: 10px 12px; margin-bottom: 10px; background: var(--bg-card); }
        .rt td { border: none !important; padding: 5px 0 !important; display: grid; grid-template-columns: 110px 1fr; gap: 8px; }
        .rt td::before { content: attr(data-label); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); padding-top: 2px; }
        .rt td[data-label=""]::before { content: none; }
        .rt td[data-label=""] { grid-template-columns: 1fr; }
        .admin-table-wrap:has(.rt) { border: none; overflow: visible; }
        .chart-grid { grid-template-columns: 1fr; }
        .board { grid-template-columns: repeat(4, 80%); }
      }
      @media (max-width: 1000px) and (min-width: 701px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 700px) { .kpis { grid-template-columns: 1fr; } }
      @media (prefers-reduced-motion: reduce) { .dr-back, .dr-panel, .kpi, .board-card, .page-fade, .sk div { animation: none !important; } }
    `}</style>
  );
}
