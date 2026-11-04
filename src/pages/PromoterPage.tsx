import { useState } from "react";
import { Megaphone, Search, ShoppingBag, Repeat, PartyPopper, Wallet, Clock, CheckCircle2, LogOut } from "lucide-react";
import { request, ApiError } from "@/api/client";
import { useStore } from "@/store/store";
import { BrandLogo } from "@/components/BrandLogo";

type Stats = {
  name: string; code: string; brand: string; channel: string;
  counts: { regular: number; plan: number; event: number; total: number; completed: number; cancelled: number };
  commission: { earned: number; paid: number };
  in_progress: number;
  recent: { date: string; kind: "REGULAR" | "PLAN" | "EVENT"; ref: string; status: "PENDING" | "EARNED" | "PAID" | "REVERSED"; amount: number | null }[];
};
const KIND = { REGULAR: { label: "Home delivery", icon: ShoppingBag }, PLAN: { label: "Subscription", icon: Repeat }, EVENT: { label: "Event order", icon: PartyPopper } };
const STATUS = { PENDING: ["Awaiting payment", "pm-pending"], EARNED: ["Earned", "pm-earned"], PAID: ["Paid", "pm-paid"], REVERSED: ["Cancelled", "pm-rev"] } as const;
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Promoters check the orders that came through their code: no account, just their mobile number and code. */
export function PromoterPage() {
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const { clearCart, setCoupon } = useStore();

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(mobile)) { setErr("Enter your 10-digit mobile number."); return; }
    if (!code.trim()) { setErr("Enter your promo code."); return; }
    setBusy(true); setErr("");
    try {
      setStats(await request<Stats>("POST", "/api/promo/stats", { mobile, code }));
      // a promoter signed in on this device: start with an empty cart and no promo applied
      clearCart(); setCoupon(undefined);
    }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Couldn't load your orders. Try again."); }
    finally { setBusy(false); }
  };

  return (
    <section className="pm">
      {/* promoters get only the brand, not the customer menu, cart or account */}
      <header className="pm-bar"><BrandLogo size={44} /></header>
      <div className="pm-in">
        {!stats ? (
          <form className="pm-card pm-login" onSubmit={check} noValidate>
            <span className="pm-ic"><Megaphone size={22} /></span>
            <span className="pm-eyebrow">For our promoters</span>
            <h1>Promoter orders</h1>
            <p className="pm-sub">See how many orders came through your promo code, and your commission.</p>
            <label className="pm-label" htmlFor="pm-mobile">Mobile number</label>
            <div className="pm-field"><span>+91</span><input id="pm-mobile" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit number" /></div>
            <label className="pm-label" htmlFor="pm-code">Your promo code</label>
            <div className="pm-field"><input id="pm-code" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. RAJ5" /></div>
            {err && <p className="pm-err" role="alert">{err}</p>}
            <button className="pm-btn" disabled={busy}><Search size={17} /> {busy ? "Checking…" : "Check my orders"}</button>
            <p className="pm-note">Use the number and code the shop registered for you. Lost your code? Ask the shop.</p>
          </form>
        ) : (
          <div className="pm-dash">
            <div className="pm-head">
              <div>
                <span className="pm-eyebrow"><Megaphone size={14} /> Promoter · {stats.channel}</span>
                <h1>{stats.name}</h1>
                <p className="pm-sub">{stats.brand} · code <b>{stats.code}</b></p>
              </div>
              <button className="pm-ghost" onClick={() => { setStats(null); setCode(""); }}><LogOut size={15} /> Close</button>
            </div>

            <div className="pm-tiles">
              <div className="pm-card pm-tile"><span className="pm-t t1"><ShoppingBag size={18} /></span><div><small>Total orders</small><b>{stats.counts.total}</b></div></div>
              <div className="pm-card pm-tile"><span className="pm-t t2"><CheckCircle2 size={18} /></span><div><small>Paid orders</small><b>{stats.counts.completed}</b></div></div>
              <div className="pm-card pm-tile"><span className="pm-t t3"><Clock size={18} /></span><div><small>Awaiting payment</small><b>{stats.in_progress}</b></div></div>
              <div className="pm-card pm-tile"><span className="pm-t t4"><Wallet size={18} /></span><div><small>Earned · not paid yet</small><b>{rupees(stats.commission.earned)}</b></div></div>
            </div>

            <div className="pm-card pm-split">
              <div><ShoppingBag size={16} /> Home delivery <b>{stats.counts.regular}</b></div>
              <div><Repeat size={16} /> Subscriptions <b>{stats.counts.plan}</b></div>
              <div><PartyPopper size={16} /> Event orders <b>{stats.counts.event}</b></div>
              <div><Wallet size={16} /> Paid to you <b>{rupees(stats.commission.paid)}</b></div>
            </div>

            <div className="pm-card pm-list">
              <h2>Recent orders</h2>
              {stats.recent.length === 0 ? <p className="pm-sub">No orders with your code yet. Share it with your followers!</p> : (
                <ul>
                  {stats.recent.map((r) => {
                    const K = KIND[r.kind];
                    return (
                      <li key={r.ref + r.kind}>
                        <span className="pm-k"><K.icon size={16} /></span>
                        <div><b>{K.label}</b><small>{r.ref} · {day(r.date)}</small></div>
                        <div className="pm-r">{r.amount != null && <b>{rupees(r.amount)}</b>}<span className={`pm-s ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span></div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="pm-note">Your commission amount appears as soon as the customer's payment is received. Orders waiting for payment show only their count and details. Cancelled orders don't earn commission. Customer details are private and not shown here.</p>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .pm { --pa: var(--green); --pa-soft: rgba(0, 91, 79, 0.08); min-height: 100vh; min-height: 100svh; background: var(--cream); color: var(--text, #1E2430); font-family: var(--font-body); padding: 0 16px 48px; }
        .pm-bar { max-width: 880px; margin: 0 auto 28px; padding: 16px 0; display: flex; align-items: center; border-bottom: 1px solid rgba(0, 91, 79, 0.1); }
        .pm-in { max-width: 880px; margin: 0 auto; }
        .pm-card { background: #fff; border: 1px solid rgba(0, 91, 79, 0.1); border-radius: 22px; box-shadow: 0 14px 40px rgba(41, 41, 35, 0.08); }
        .pm-login { max-width: 440px; margin: 0 auto; padding: 32px 28px; align-items: stretch; display: flex; flex-direction: column; gap: 10px; }
        .pm-ic { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; background: var(--pa-soft); color: var(--pa); align-self: flex-start; border-radius: 50%; }
        .pm h1 { font-family: var(--font-display); font-size: 2.1rem; font-weight: 500; line-height: 1.1; letter-spacing: -0.01em; }
        .pm h2 { font-family: var(--font-display); font-size: 1.5rem; font-weight: 500; }
        .pm-sub { color: #6B7280; font-size: 14px; line-height: 1.5; }
        .pm-label { font-size: 13px; font-weight: 600; color: #4B5563; margin-top: 6px; }
        .pm-field { display: flex; align-items: center; gap: 8px; border: 1px solid rgba(0, 91, 79, 0.18); border-radius: 14px; padding: 0 14px; background: #fff; }
        .pm-field:focus-within { border-color: var(--pa); box-shadow: 0 0 0 3px rgba(0, 91, 79, 0.12); }
        .pm-field span { color: #6B7280; font-weight: 600; }
        .pm-field input { flex: 1; min-width: 0; border: 0; outline: 0; padding: 13px 0; font: inherit; font-size: 16px; background: transparent; letter-spacing: 0.02em; }
        .pm-err { color: #D63B3C; font-size: 13px; }
        .pm-btn { margin-top: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; border-radius: 999px; background: var(--pa); color: #fff; font-weight: 600; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; box-shadow: 0 8px 20px rgba(0, 91, 79, 0.22); transition: transform 160ms, background 160ms; }
        .pm-btn:hover { background: #00473E; transform: translateY(-1px); }
        .pm-btn:disabled { opacity: 0.6; }
        .pm-note { font-size: 12px; color: #6B7280; line-height: 1.5; }
        .pm-dash { display: flex; flex-direction: column; gap: 16px; }
        .pm-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .pm-eyebrow { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--pa); }
        .pm-ghost { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border: 1px solid var(--pa); color: var(--pa); border-radius: 999px; background: #fff; font-weight: 600; font-size: 14px; }
        .pm-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .pm-tile { display: flex; align-items: center; gap: 12px; padding: 16px; min-width: 0; }
        .pm-tile small { display: block; font-size: 12px; color: #6B7280; font-weight: 600; }
        .pm-tile b { font-family: var(--font-display); font-size: 1.6rem; font-weight: 600; line-height: 1.1; }
        .pm-t { flex-shrink: 0; width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; }
        .t1 { background: var(--pa-soft); color: var(--pa); } .t2 { background: rgba(40, 199, 111, 0.14); color: #1E9E57; }
        .t3 { background: rgba(255, 159, 67, 0.16); color: #D9770F; } .t4 { background: rgba(255, 122, 24, 0.13); color: #D9620A; }
        .pm-split { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 6px; }
        .pm-split div { display: flex; align-items: center; gap: 8px; padding: 12px; font-size: 14px; color: #4B5563; }
        .pm-split svg { color: var(--pa); flex-shrink: 0; }
        .pm-split b { margin-left: auto; color: #1E2430; }
        .pm-list { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .pm-list ul { list-style: none; padding: 0; display: flex; flex-direction: column; }
        .pm-list li { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid #E9EBEF; }
        .pm-list li > div:first-of-type { flex: 1; min-width: 0; }
        .pm-list li b { display: block; font-size: 14px; }
        .pm-list li small { font-size: 12px; color: #6B7280; }
        .pm-k { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: var(--pa-soft); color: var(--pa); flex-shrink: 0; }
        .pm-r { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .pm-s { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
        .pm-pending { background: rgba(255, 159, 67, 0.16); color: #C9690C; } .pm-earned { background: rgba(40, 199, 111, 0.14); color: #1E9E57; }
        .pm-paid { background: var(--pa-soft); color: var(--pa); } .pm-rev { background: rgba(234, 84, 85, 0.13); color: #D63B3C; }
        @media (max-width: 760px) { .pm-tiles, .pm-split { grid-template-columns: 1fr 1fr; } .pm-split div { padding: 10px; } }
        @media (max-width: 380px) { .pm-tile { padding: 12px; gap: 10px; } .pm-tile b { font-size: 1.1rem; } }
      `}</style>
    </section>
  );
}
