import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bike, Phone, MessageCircle, Navigation, Package, Repeat, PartyPopper, MapPin, Clock, LogOut, Check, X, Undo2, AlertTriangle, Camera, Wallet, Lock, Eye, EyeOff,
} from "lucide-react";
import { ops, partnerSession, currentLocation, inr, type Job, type PartnerJobs, type PartnerView } from "@/api/ops";
import { ApiError } from "@/api/client";
import { Modal } from "@/components/Modal";
import { fileToDataUrl } from "@/pages/admin/shared";

const TYPE: Record<Job["type"], { label: string; icon: typeof Package; cls: string }> = {
  ORDER: { label: "Delivery order", icon: Package, cls: "t-order" },
  SUBSCRIPTION: { label: "Subscription", icon: Repeat, cls: "t-sub" },
  EVENT: { label: "Event order", icon: PartyPopper, cls: "t-event" },
};
const FAIL_REASONS = ["Customer not available", "Wrong address", "Customer refused", "Other"];
const SERVICE_LABEL: Record<string, string> = { PICKUP: "Pickup", DELIVERY: "Delivery", LIVE_COUNTER: "Live counter" };

function PayTag({ j }: { j: Job }) {
  return j.due > 0 ? <span className="dp-pay cod">{j.type === "EVENT" ? "BALANCE" : "COD"} {inr(j.due)}</span> : <span className="dp-pay paid">PAID ONLINE</span>;
}

/* ---------------- sign in ---------------- */
function PartnerLogin({ onIn }: { onIn: () => void }) {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { const r = await ops.partnerLogin(mobile, password); partnerSession.set(r.token); onIn(); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Couldn't sign in."); }
    finally { setBusy(false); }
  };
  return (
    <div className="dp-login">
      <form onSubmit={submit} className="dp-login-card" noValidate>
        <img src="/brand/logo.png" alt="Sri Sastha Paruthipaal" />
        <span className="dp-kicker"><Bike size={14} /> Delivery partner</span>
        <h1>Sign in</h1>
        <label className="dp-label" htmlFor="dp-mobile">Mobile number</label>
        <div className="dp-field"><Phone size={18} /><span>+91</span><input id="dp-mobile" inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} autoComplete="tel-national" /></div>
        <label className="dp-label" htmlFor="dp-pass">Password</label>
        <div className="dp-field"><Lock size={18} /><input id="dp-pass" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        {err && <p className="dp-err" role="alert">{err}</p>}
        <button className="dp-btn primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="dp-fine">Accounts are created by the Super Admin. Forgot your password? Ask the shop.</p>
      </form>
    </div>
  );
}

/* ---------------- app ---------------- */
export function PartnerPage() {
  const [signedIn, setSignedIn] = useState(() => !!partnerSession.get());
  const [me, setMe] = useState<{ partner: PartnerView; branch: string } | null>(null);
  const [data, setData] = useState<PartnerJobs | null>(null);
  const [tab, setTab] = useState<"available" | "mine" | "history">("available");
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState({ type: "ALL", area: "ALL", slot: "ALL", sort: "slot" as "slot" | "distance" });
  const [collectFor, setCollectFor] = useState<Job | null>(null);
  const [releaseFor, setReleaseFor] = useState<Job | null>(null);
  const [failFor, setFailFor] = useState<Job | null>(null);

  const say = (text: string, kind: "ok" | "err" = "ok") => { setToast({ text, kind }); window.setTimeout(() => setToast(null), 3000); };
  const signOut = () => { partnerSession.clear(); setSignedIn(false); setMe(null); setData(null); };

  const refresh = useCallback(async () => {
    try { setData(await ops.partnerJobs()); }
    catch (x) { if (x instanceof ApiError && x.status === 401) signOut(); }
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    ops.partnerMe().then((r) => setMe({ partner: r.partner, branch: r.branch })).catch(() => signOut());
    refresh();
    // other partners' picks show up quickly: poll, plus instant updates from other tabs on this device
    const t = window.setInterval(refresh, 15_000);
    const on = () => refresh();
    window.addEventListener("ssp-db-changed", on);
    return () => { window.clearInterval(t); window.removeEventListener("ssp-db-changed", on); };
  }, [signedIn, refresh]);

  const act = async (j: Job, fn: () => Promise<unknown>, okText: string) => {
    setBusyId(j.id);
    try { await fn(); say(okText); await refresh(); return true; }
    catch (x) { say(x instanceof ApiError ? x.message : "Something went wrong", "err"); await refresh(); return false; }
    finally { setBusyId(null); }
  };

  const available = useMemo(() => {
    let list = data?.available ?? [];
    if (filter.type !== "ALL") list = list.filter((j) => j.type === filter.type);
    if (filter.area !== "ALL") list = list.filter((j) => j.area === filter.area);
    if (filter.slot !== "ALL") list = list.filter((j) => j.slot === filter.slot);
    return [...list].sort((a, b) => filter.sort === "distance" ? (a.distance_km ?? 99) - (b.distance_km ?? 99) : a.slot_start.localeCompare(b.slot_start));
  }, [data, filter]);
  const areas = [...new Set((data?.available ?? []).map((j) => j.area).filter(Boolean))];
  const slots = [...new Set((data?.available ?? []).map((j) => j.slot))];

  if (!signedIn) return <><PartnerLogin onIn={() => setSignedIn(true)} /><DpStyles /></>;

  const s = data?.summary;
  const online = data?.online ?? me?.partner.online ?? false;
  return (
    <div className="dp">
      <header className="dp-top">
        <div className="dp-who">
          <img src="/brand/logo.png" alt="" />
          <div><strong>{me?.partner.name ?? "…"}</strong><span>{me?.branch}{me?.partner.vehicle && ` · ${me.partner.vehicle}`}</span></div>
          <button className="dp-icon" onClick={signOut} aria-label="Sign out"><LogOut size={20} /></button>
        </div>
        <button className={`dp-online ${online ? "on" : ""}`} role="switch" aria-checked={online}
          onClick={async () => { await ops.partnerOnline(!online); await refresh(); say(online ? "You're offline" : "You're online"); }}>
          <span className="dp-knob" /> {online ? "Online — taking orders" : "Offline — tap to go online"}
        </button>
        <div className="dp-chips">
          <span><b>{s?.picked ?? 0}</b> Picked</span>
          <span><b>{s?.delivered ?? 0}</b> Delivered</span>
          <span><b>{inr(s?.cash_today ?? 0)}</b> Cash today</span>
        </div>
        <div className="dp-cash"><Wallet size={18} /> Cash to hand over <strong>{inr(s?.cash_to_hand_over ?? 0)}</strong></div>
      </header>

      <nav className="dp-tabs" role="tablist">
        {(["available", "mine", "history"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "available" ? `Available (${data?.available.length ?? 0})` : t === "mine" ? `My orders (${data?.mine.length ?? 0})` : "History"}
          </button>
        ))}
      </nav>

      <main className="dp-body">
        {!data && <div className="dp-skel" aria-busy="true"><div /><div /><div /></div>}

        {data && tab === "available" && (
          <>
            {!online && <div className="dp-empty">You're offline. Go online to see and pick orders.</div>}
            {online && (
              <div className="dp-filters">
                <select aria-label="Type" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
                  <option value="ALL">All types</option><option value="ORDER">Delivery orders</option><option value="SUBSCRIPTION">Subscriptions</option><option value="EVENT">Event orders</option>
                </select>
                <select aria-label="Area" value={filter.area} onChange={(e) => setFilter({ ...filter, area: e.target.value })}>
                  <option value="ALL">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}
                </select>
                <select aria-label="Time slot" value={filter.slot} onChange={(e) => setFilter({ ...filter, slot: e.target.value })}>
                  <option value="ALL">All slots</option>{slots.map((a) => <option key={a}>{a}</option>)}
                </select>
                <select aria-label="Sort" value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value as "slot" | "distance" })}>
                  <option value="slot">Sort: time slot</option><option value="distance">Sort: distance</option>
                </select>
              </div>
            )}
            {online && available.length === 0 && <div className="dp-empty">No orders waiting right now. New ones appear here automatically.</div>}
            {online && available.map((j) => {
              const T = TYPE[j.type];
              return (
                <article className="dp-card" key={j.id}>
                  <div className="dp-card-top"><span className={`dp-type ${T.cls}`}><T.icon size={14} /> {T.label}</span><span className="dp-ref">{j.ref.split("#")[0]}</span></div>
                  <div className="dp-meta">
                    <span><MapPin size={15} /> {j.area || "—"}</span>
                    {j.distance_km != null && <span>{j.distance_km.toFixed(1)} km by road</span>}
                    <span><Clock size={15} /> {j.slot}</span>
                  </div>
                  <ul className="dp-items">{j.items.map((i) => <li key={i}>{i}</li>)}</ul>
                  <div className="dp-card-foot"><PayTag j={j} />{j.amount > 0 && <span className="dp-amt">Order {inr(j.amount)}</span>}</div>
                  <button className="dp-btn primary" disabled={busyId === j.id}
                    onClick={async () => { if (await act(j, () => ops.pick(j.id), "Picked — it's in My orders")) setTab("mine"); }}>
                    {busyId === j.id ? "Picking…" : "Pick this order"}
                  </button>
                </article>
              );
            })}
          </>
        )}

        {data && tab === "mine" && (
          <>
            {data.mine.length === 0 && <div className="dp-empty">You have no orders right now. Pick one from Available.</div>}
            {data.mine.map((j) => {
              const T = TYPE[j.type];
              const maps = j.lat != null && j.lng != null
                ? `https://www.google.com/maps/dir/?api=1&destination=${j.lat},${j.lng}`
                : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(j.address)}`;
              return (
                <article className="dp-card mine" key={j.id}>
                  <div className="dp-card-top"><span className={`dp-type ${T.cls}`}><T.icon size={14} /> {T.label}</span><span className="dp-ref">{j.ref.split("#")[0]}</span></div>
                  <h3 className="dp-cust">{j.customer.name}</h3>
                  <div className="dp-contact">
                    <a className="dp-btn ghost" href={`tel:+91${j.customer.mobile}`}><Phone size={18} /> Call</a>
                    <a className="dp-btn ghost" href={`https://wa.me/91${j.customer.mobile}`} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>
                  </div>
                  <p className="dp-addr"><MapPin size={16} /> {j.address}</p>
                  {j.landmark && <p className="dp-note">Landmark: {j.landmark}</p>}
                  <a className="dp-btn ghost wide" href={maps} target="_blank" rel="noreferrer"
                    onClick={() => { if (j.status === "PICKED") ops.start(j.id).then(refresh).catch(() => {}); }}><Navigation size={18} /> Navigate</a>
                  <ul className="dp-items">{j.items.map((i) => <li key={i}>{i}</li>)}</ul>
                  {j.notes && <p className="dp-note">Note: {j.notes}</p>}
                  {j.sub_info && <p className="dp-note strong">Day {j.sub_info.day_no} of {j.sub_info.plan_days}</p>}
                  {j.event_info && (
                    <dl className="dp-event">
                      <div><dt>Occasion</dt><dd>{j.event_info.occasion}</dd></div>
                      <div><dt>Serving</dt><dd>{SERVICE_LABEL[j.event_info.service] ?? j.event_info.service} · {j.event_info.litres} L</dd></div>
                      <div><dt>Time</dt><dd>{j.event_info.time}</dd></div>
                      <div><dt>Venue</dt><dd>{j.event_info.venue}</dd></div>
                      <div><dt>Advance paid</dt><dd>{inr(j.event_info.advance)}</dd></div>
                      <div><dt>Balance to collect</dt><dd className="cod">{inr(j.event_info.balance)}</dd></div>
                    </dl>
                  )}
                  <div className="dp-card-foot"><PayTag j={j} />{j.status === "OUT" && <span className="dp-amt">Out for delivery</span>}</div>
                  {j.status === "PICKED" && <button className="dp-btn ghost wide" disabled={busyId === j.id} onClick={() => act(j, () => ops.start(j.id), "Out for delivery")}><Bike size={18} /> Start delivery</button>}
                  {j.due > 0
                    ? <button className="dp-btn primary" onClick={() => setCollectFor(j)}><Wallet size={18} /> Amount collected &amp; delivered</button>
                    : <button className="dp-btn primary" disabled={busyId === j.id} onClick={async () => act(j, async () => ops.deliver(j.id, { location: await currentLocation() }), "Marked as delivered")}><Check size={18} /> Mark as delivered</button>}
                  <div className="dp-row2">
                    <button className="dp-btn ghost" onClick={() => setReleaseFor(j)}><Undo2 size={16} /> Release order</button>
                    <button className="dp-btn danger" onClick={() => setFailFor(j)}><AlertTriangle size={16} /> Delivery failed</button>
                  </div>
                </article>
              );
            })}
          </>
        )}

        {data && tab === "history" && <History jobs={data.history} />}
      </main>

      {collectFor && <CollectSheet job={collectFor} onClose={() => setCollectFor(null)} onDone={async (p) => {
        const ok = await act(collectFor, async () => ops.deliver(collectFor.id, { ...p, location: await currentLocation() }), "Amount collected & delivered");
        if (ok) setCollectFor(null);
      }} />}
      {releaseFor && <ReasonSheet title="Release order" options={["Vehicle problem", "Too far for me", "Customer asked to reschedule", "Other"]} cta="Release order"
        onClose={() => setReleaseFor(null)} onDone={async (reason) => { if (await act(releaseFor, () => ops.release(releaseFor.id, reason), "Released — back in Available")) setReleaseFor(null); }} />}
      {failFor && <ReasonSheet title="Delivery failed" options={FAIL_REASONS} cta="Mark as failed" photo
        note={failFor.type === "SUBSCRIPTION" ? "For a daily plan, this day is served later: the plan ends one day later." : undefined}
        onClose={() => setFailFor(null)} onDone={async (reason, photo) => { if (await act(failFor, async () => ops.fail(failFor.id, { reason, photo, location: await currentLocation() }), "Marked as failed")) setFailFor(null); }} />}

      {toast && <div className={`dp-toast ${toast.kind}`} role="status">{toast.text}</div>}
      <DpStyles />
    </div>
  );
}

function CollectSheet({ job, onClose, onDone }: { job: Job; onClose: () => void; onDone: (p: { method: "CASH" | "UPI"; amount: number; reason?: string }) => void }) {
  const [method, setMethod] = useState<"CASH" | "UPI" | null>(null);
  const [amount, setAmount] = useState(String(job.due / 100));
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const paise = Math.round(Number(amount) * 100);
  const differs = Number.isFinite(paise) && paise !== job.due;
  const confirm = () => {
    if (!method) { setErr("Choose Cash or UPI."); return; }
    if (!(paise >= 0)) { setErr("Enter the amount received."); return; }
    if (differs && !reason.trim()) { setErr("The amount is different from the amount due. Give a reason."); return; }
    onDone({ method, amount: paise, reason: differs ? reason.trim() : undefined });
  };
  return (
    <Modal open onClose={onClose} title="Collect payment" maxWidth={460}>
      <div className="dp-sheet">
        <div className="dp-due"><span>Amount due</span><strong>{inr(job.due)}</strong></div>
        <div className="dp-seg" role="radiogroup" aria-label="Payment method">
          {(["CASH", "UPI"] as const).map((m) => <button key={m} role="radio" aria-checked={method === m} className={method === m ? "on" : ""} onClick={() => { setMethod(m); setErr(""); }}>{m === "CASH" ? "Cash" : "UPI"}</button>)}
        </div>
        <label className="dp-label" htmlFor="dp-amount">Amount received (₹)</label>
        <input id="dp-amount" className="dp-input big" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        {differs && (<>
          <label className="dp-label" htmlFor="dp-reason">Why is it different?</label>
          <input id="dp-reason" className="dp-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. customer paid ₹50 less, will pay tomorrow" />
        </>)}
        {err && <p className="dp-err">{err}</p>}
        <button className="dp-btn primary" onClick={confirm}><Check size={18} /> Confirm &amp; mark delivered</button>
      </div>
    </Modal>
  );
}

function ReasonSheet({ title, options, cta, photo, note, onClose, onDone }: { title: string; options: string[]; cta: string; photo?: boolean; note?: string; onClose: () => void; onDone: (reason: string, photo?: string) => void }) {
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [img, setImg] = useState<string | undefined>();
  const [err, setErr] = useState("");
  const reason = choice === "Other" ? other.trim() : choice;
  return (
    <Modal open onClose={onClose} title={title} maxWidth={460}>
      <div className="dp-sheet">
        <div className="dp-reasons" role="radiogroup">
          {options.map((o) => <button key={o} role="radio" aria-checked={choice === o} className={choice === o ? "on" : ""} onClick={() => { setChoice(o); setErr(""); }}>{o}</button>)}
        </div>
        {choice === "Other" && <input className="dp-input" aria-label="Reason" placeholder="Describe the reason" value={other} onChange={(e) => setOther(e.target.value)} />}
        {photo && (
          <label className="dp-btn ghost wide dp-photo">
            <Camera size={18} /> {img ? "Photo added — change" : "Add a photo (optional)"}
            <input type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImg(await fileToDataUrl(f, 800)); }} />
          </label>
        )}
        {img && <img src={img} alt="" className="dp-photo-prev" />}
        {note && <p className="dp-fine">{note}</p>}
        {err && <p className="dp-err">{err}</p>}
        <button className="dp-btn primary" onClick={() => (reason ? onDone(reason, img) : setErr("Choose a reason."))}>{cta}</button>
        <button className="dp-btn ghost" onClick={onClose}><X size={16} /> Cancel</button>
      </div>
    </Modal>
  );
}

function History({ jobs }: { jobs: Job[] }) {
  const [range, setRange] = useState<"today" | "week" | "month">("today");
  const start = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (range === "week") d.setDate(d.getDate() - 6);
    if (range === "month") d.setDate(1);
    return d.getTime();
  }, [range]);
  const list = jobs.filter((j) => new Date(j.delivered_at ?? j.failed_at ?? 0).getTime() >= start)
    .sort((a, b) => (b.delivered_at ?? b.failed_at ?? "").localeCompare(a.delivered_at ?? a.failed_at ?? ""));
  const sum = (m: "CASH" | "UPI") => list.filter((j) => j.collected?.method === m).reduce((n, j) => n + j.collected!.amount, 0);
  return (
    <>
      <div className="dp-seg" role="tablist">
        {(["today", "week", "month"] as const).map((r) => <button key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>{r === "today" ? "Today" : r === "week" ? "This week" : "This month"}</button>)}
      </div>
      <div className="dp-stats">
        <div><b>{list.filter((j) => j.status === "DELIVERED").length}</b><span>Delivered</span></div>
        <div><b>{list.filter((j) => j.status === "FAILED").length}</b><span>Failed</span></div>
        <div><b>{inr(sum("CASH"))}</b><span>Cash collected</span></div>
        <div><b>{inr(sum("UPI"))}</b><span>UPI collected</span></div>
      </div>
      {list.length === 0 && <div className="dp-empty">Nothing here yet.</div>}
      {list.map((j) => (
        <article className="dp-card slim" key={j.id}>
          <div className="dp-card-top"><span className={`dp-type ${TYPE[j.type].cls}`}>{TYPE[j.type].label}</span><span className={`dp-status ${j.status === "DELIVERED" ? "ok" : "bad"}`}>{j.status === "DELIVERED" ? "Delivered" : `Failed · ${j.fail_reason}`}</span></div>
          <div className="dp-meta"><span>{j.ref.split("#")[0]}</span><span><MapPin size={14} /> {j.area}</span><span>{new Date(j.delivered_at ?? j.failed_at!).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span></div>
          {j.collected && <p className="dp-note">{j.collected.method === "CASH" ? "Cash" : "UPI"} {inr(j.collected.amount)}{j.collected.reason && ` · ${j.collected.reason}`}</p>}
        </article>
      ))}
    </>
  );
}

function DpStyles() {
  return (
    <style>{`
      .dp, .dp-login { min-height: 100vh; min-height: 100svh; background: #00140F; color: #FFFFFF; font-family: var(--font-body); position: relative; z-index: 1; }
      .dp { max-width: 720px; margin: 0 auto; padding-bottom: 40px; }
      .dp-login { display: grid; place-items: center; padding: 20px; }
      .dp-login-card { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 12px; padding: 28px 22px; border-radius: 20px; background: #002A22; border: 1px solid rgba(255,255,255,0.14); }
      .dp-login-card img { width: 72px; align-self: center; }
      .dp-login-card h1 { font-family: var(--font-display); font-size: 2rem; font-weight: 500; }
      .dp-kicker { display: inline-flex; gap: 6px; align-items: center; color: #FF9A4D; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; }
      .dp-label { font-size: 14px; font-weight: 700; color: #DCE8E3; margin-top: 4px; }
      .dp-field { display: flex; align-items: center; gap: 10px; padding: 0 14px; min-height: 56px; border-radius: 14px; border: 2px solid rgba(255,255,255,0.22); background: #001F19; }
      .dp-field:focus-within { border-color: #FF8A2B; }
      .dp-field input { flex: 1; min-width: 0; background: none; border: none; color: #fff; font-size: 18px; padding: 14px 0; }
      .dp-field span { font-weight: 700; color: #DCE8E3; }
      .dp-err { color: #FFB4A0; font-weight: 600; font-size: 15px; }
      .dp-fine { font-size: 13px; color: #BFD1CA; }
      .dp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 56px; padding: 0 18px; border-radius: 14px; font-size: 17px; font-weight: 700; width: 100%; transition: transform 150ms, filter 150ms; }
      .dp-btn:active { transform: scale(0.98); }
      .dp-btn:disabled { opacity: 0.5; }
      .dp-btn.primary { background: #FF8A2B; color: #1A0A00; }
      .dp-btn.ghost { background: transparent; border: 2px solid rgba(255,255,255,0.35); color: #fff; }
      .dp-btn.danger { background: transparent; border: 2px solid #FF8A70; color: #FFB4A0; }
      .dp-btn.wide { width: 100%; }
      .dp-top { position: sticky; top: 0; z-index: 5; padding: 14px 14px 12px; background: #001F19; border-bottom: 1px solid rgba(255,255,255,0.14); display: flex; flex-direction: column; gap: 10px; }
      .dp-who { display: flex; align-items: center; gap: 10px; }
      .dp-who img { width: 40px; }
      .dp-who div { flex: 1; display: flex; flex-direction: column; }
      .dp-who strong { font-size: 18px; }
      .dp-who span { font-size: 13px; color: #BFD1CA; }
      .dp-icon { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); color: #fff; }
      .dp-online { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 14px; border-radius: 14px; font-weight: 700; font-size: 16px; background: #3A2A2A; color: #FFD7CC; border: 2px solid #FF8A70; text-align: left; }
      .dp-online.on { background: #0F4A33; color: #CFFFE6; border-color: #2FB37A; }
      .dp-knob { width: 44px; height: 26px; border-radius: 999px; background: rgba(255,255,255,0.25); position: relative; flex-shrink: 0; }
      .dp-knob::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 200ms; }
      .dp-online.on .dp-knob { background: #2FB37A; }
      .dp-online.on .dp-knob::after { transform: translateX(18px); }
      .dp-chips { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .dp-chips span { display: flex; flex-direction: column; align-items: center; padding: 8px 4px; border-radius: 12px; background: #002A22; font-size: 12px; color: #BFD1CA; }
      .dp-chips b { font-size: 18px; color: #fff; }
      .dp-cash { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; background: rgba(255,138,43,0.14); border: 1px solid #FF8A2B; font-weight: 600; }
      .dp-cash strong { margin-left: auto; font-size: 20px; color: #FFB066; }
      .dp-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 10px 14px; position: sticky; top: 0; }
      .dp-tabs button { min-height: 48px; border-radius: 12px; font-weight: 700; font-size: 15px; color: #DCE8E3; background: #002A22; border: 1px solid rgba(255,255,255,0.12); }
      .dp-tabs button.on { background: #FFFFFF; color: #00140F; }
      .dp-body { padding: 4px 14px; display: flex; flex-direction: column; gap: 12px; }
      .dp-filters { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .dp-filters select { min-height: 48px; border-radius: 12px; background: #002A22; color: #fff; border: 1px solid rgba(255,255,255,0.22); padding: 0 12px; font-size: 15px; }
      .dp-card { padding: 16px; border-radius: 18px; background: #002A22; border: 1px solid rgba(255,255,255,0.14); display: flex; flex-direction: column; gap: 10px; animation: dp-in 250ms ease both; }
      .dp-card.mine { border-color: #FF8A2B; }
      .dp-card.slim { gap: 6px; }
      @keyframes dp-in { from { opacity: 0; transform: translateY(8px); } }
      .dp-card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .dp-type { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; font-size: 13px; font-weight: 700; }
      .t-order { background: #FFE2C7; color: #4A2300; }
      .t-sub { background: #CFF5E2; color: #0B3D2A; }
      .t-event { background: #F7E2A8; color: #3E2D00; }
      .dp-ref { font-family: var(--font-mono); font-size: 13px; color: #BFD1CA; }
      .dp-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 15px; color: #DCE8E3; }
      .dp-meta span { display: inline-flex; align-items: center; gap: 5px; }
      .dp-items { list-style: none; font-size: 16px; font-weight: 600; }
      .dp-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .dp-pay { padding: 6px 12px; border-radius: 10px; font-weight: 800; font-size: 14px; letter-spacing: 0.02em; }
      .dp-pay.paid { background: #2FB37A; color: #00140F; }
      .dp-pay.cod { background: #FF8A2B; color: #1A0A00; }
      .dp-amt { font-size: 14px; color: #BFD1CA; }
      .dp-cust { font-size: 22px; font-family: var(--font-display); font-weight: 500; }
      .dp-contact, .dp-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .dp-addr { display: flex; gap: 8px; font-size: 16px; line-height: 1.45; color: #fff; }
      .dp-addr svg { flex-shrink: 0; margin-top: 3px; color: #FF8A2B; }
      .dp-note { font-size: 15px; color: #DCE8E3; }
      .dp-note.strong { font-weight: 700; color: #CFFFE6; }
      .dp-event { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; border-radius: 12px; background: #001F19; }
      .dp-event dt { font-size: 12px; color: #BFD1CA; }
      .dp-event dd { font-size: 15px; font-weight: 600; }
      .dp-event dd.cod { color: #FFB066; }
      .dp-empty { padding: 28px 16px; text-align: center; border-radius: 16px; border: 1px dashed rgba(255,255,255,0.25); color: #DCE8E3; font-size: 16px; }
      .dp-skel div { height: 140px; border-radius: 18px; background: #002A22; margin-bottom: 12px; animation: dp-pulse 1.2s ease-in-out infinite; }
      @keyframes dp-pulse { 50% { opacity: 0.5; } }
      .dp-seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6px; }
      .dp-seg button { min-height: 52px; border-radius: 12px; font-weight: 700; font-size: 16px; background: #001F19; color: #fff; border: 2px solid rgba(255,255,255,0.25); }
      .dp-seg button.on { background: #FFFFFF; color: #00140F; border-color: #fff; }
      .dp-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .dp-stats div { padding: 14px; border-radius: 14px; background: #002A22; display: flex; flex-direction: column; gap: 2px; }
      .dp-stats b { font-size: 22px; }
      .dp-stats span { font-size: 13px; color: #BFD1CA; }
      .dp-status { font-size: 13px; font-weight: 700; }
      .dp-status.ok { color: #7FE3B2; } .dp-status.bad { color: #FFB4A0; }
      .dp-sheet { padding: 12px 24px 24px; display: flex; flex-direction: column; gap: 12px; }
      .dp-due { display: flex; justify-content: space-between; align-items: baseline; padding: 14px; border-radius: 14px; background: rgba(255,138,43,0.14); border: 1px solid #FF8A2B; }
      .dp-due strong { font-size: 28px; color: #FFB066; }
      .dp-input { min-height: 52px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.25); background: #001F19; color: #fff; padding: 0 14px; font-size: 17px; }
      .dp-input.big { font-size: 24px; font-weight: 700; }
      .dp-reasons { display: flex; flex-direction: column; gap: 8px; }
      .dp-reasons button { min-height: 52px; border-radius: 12px; text-align: left; padding: 0 16px; font-size: 16px; font-weight: 600; color: #fff; background: #001F19; border: 2px solid rgba(255,255,255,0.22); }
      .dp-reasons button.on { border-color: #FF8A2B; background: rgba(255,138,43,0.14); }
      .dp-photo { cursor: pointer; }
      .dp-photo-prev { width: 100%; max-height: 180px; object-fit: cover; border-radius: 12px; }
      .dp-toast { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 100; padding: 14px 20px; border-radius: 14px; font-weight: 700; font-size: 16px; background: #CFFFE6; color: #00140F; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: calc(100vw - 32px); }
      .dp-toast.err { background: #FFD7CC; color: #3A0A00; }
      @media (min-width: 900px) {
        .dp { max-width: 1100px; }
        .dp-top { display: grid; grid-template-columns: 1.2fr 1fr; align-items: center; }
        .dp-chips { grid-column: 1; } .dp-cash { grid-column: 2; }
        .dp-body { display: grid; grid-template-columns: repeat(2, 1fr); align-items: start; }
        .dp-body > .dp-filters, .dp-body > .dp-empty, .dp-body > .dp-seg, .dp-body > .dp-stats, .dp-body > .dp-skel { grid-column: 1 / -1; }
        .dp-filters { grid-template-columns: repeat(4, 1fr); }
        .dp-stats { grid-template-columns: repeat(4, 1fr); }
      }
      @media (prefers-reduced-motion: reduce) { .dp-card, .dp-skel div { animation: none; } }
    `}</style>
  );
}

