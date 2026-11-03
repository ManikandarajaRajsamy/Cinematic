import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Loader2, XCircle, ShieldCheck, RotateCcw } from "lucide-react";
import { ops, inr, type Job } from "@/api/ops";
import { ApiError } from "@/api/client";
import { Modal } from "@/components/Modal";

// The shop's UPI id for collect-on-delivery. Unset, the QR carries an id no UPI app accepts, so nothing can be paid by mistake.
const UPI_VPA = (import.meta.env.VITE_UPI_VPA as string | undefined) || "SET-VITE_UPI_VPA";
const DEMO_GATEWAY = !import.meta.env.VITE_UPI_VPA;

/** UPI intent for one payment request: payee, exact amount and the request id as the transaction reference. */
const upiUri = (j: Job) =>
  `upi://pay?${new URLSearchParams({ pa: UPI_VPA, pn: "Sri Sastha Paruthipaal", am: (j.qr!.amount / 100).toFixed(2), cu: "INR", tr: j.qr!.id, tn: `Order ${j.ref}` })}`;

const STATUS = {
  WAITING: { label: "Waiting for payment", icon: Loader2, cls: "wait" },
  PROCESSING: { label: "Payment processing", icon: Loader2, cls: "wait" },
  PAID: { label: "Payment successful", icon: CheckCircle2, cls: "ok" },
  FAILED: { label: "Payment failed", icon: XCircle, cls: "fail" },
} as const;

/**
 * Collect payment: shows an order-specific UPI QR for the exact amount due and polls the server, which only
 * marks it paid on the gateway's verification. Closes itself once paid.
 */
export function QrPayment({ job, onClose, onPaid }: { job: Job; onClose: () => void; onPaid: () => void }) {
  const [j, setJ] = useState<Job | null>(null);
  const [img, setImg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    ops.openQr(job.id).then(setJ).catch((x) => setErr(x instanceof ApiError ? x.message : "Couldn't create the payment QR."));
  }, [job.id]);
  useEffect(() => {
    if (!j?.qr) return;
    QRCode.toDataURL(upiUri(j), { width: 280, margin: 1, color: { dark: "#292923", light: "#FFFFFF" } }).then(setImg);
  }, [j?.qr?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // poll the server for the gateway's verdict
  useEffect(() => {
    if (!j?.qr || j.qr.status === "PAID") return;
    const t = window.setInterval(() => { ops.qrStatus(job.id).then(setJ).catch(() => {}); }, 3000);
    return () => window.clearInterval(t);
  }, [j?.qr?.id, j?.qr?.status, job.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (j?.qr?.status !== "PAID") return;
    const t = window.setTimeout(onPaid, 1200);
    return () => window.clearTimeout(t);
  }, [j?.qr?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const st = j?.qr ? STATUS[j.qr.status] : null;
  return (
    <Modal open onClose={onClose} title="Collect payment" maxWidth={420}>
      <div className="qrp">
        {err ? <p className="field-error">{err}</p> : !j?.qr ? <div className="skeleton" style={{ height: 300 }} /> : (
          <>
            <dl className="qrp-meta">
              <div><dt>Order</dt><dd>{j.ref}</dd></div>
              <div><dt>Customer</dt><dd>{j.customer.name}</dd></div>
            </dl>
            <div className="qrp-amount"><span>Amount to pay</span><strong>{inr(j.qr.amount)}</strong></div>
            <div className="qrp-code">{img ? <img src={img} alt={`UPI QR code for ${inr(j.qr.amount)}`} /> : <div className="skeleton" style={{ width: 240, height: 240 }} />}</div>
            <p className="qrp-help">Ask the customer to scan this code with any UPI app (GPay, PhonePe, Paytm) and pay {inr(j.qr.amount)}. The amount is fixed for this order. Don't accept a screenshot: wait for the status below to turn green.</p>
            {st && <p className={`qrp-status ${st.cls}`}><st.icon size={18} className={st.cls === "wait" ? "spin" : ""} /> {st.label}</p>}
            {j.qr.status === "FAILED" && <button className="btn btn-ghost btn-block" onClick={() => { setJ(null); setImg(""); ops.openQr(job.id).then(setJ).catch(() => {}); }}><RotateCcw size={14} /> New payment QR</button>}
            {DEMO_GATEWAY && j.qr.status !== "PAID" && (
              <div className="qrp-demo">
                <span>Demo: no payment gateway connected</span>
                <button type="button" onClick={() => ops.gatewayWebhook(j.qr!.id, "PAID").then(() => ops.qrStatus(job.id).then(setJ))}>Simulate gateway: paid</button>
                <button type="button" onClick={() => ops.gatewayWebhook(j.qr!.id, "FAILED").then(() => ops.qrStatus(job.id).then(setJ))}>failed</button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/** Verify OTP & complete delivery: the customer reads out their 6-digit OTP; the server checks it. */
export function OtpDelivery({ job, onClose, onDone }: { job: Job; onClose: () => void; onDone: () => void }) {
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState<{ text: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState("");
  const locked = err?.code === "OTP_LOCKED" || err?.code === "OTP_EXPIRED" || err?.code === "OTP_MISSING" || job.otp_status === "LOCKED";

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { setErr({ text: "Enter the 6-digit OTP." }); return; }
    setBusy(true); setErr(null);
    try { await ops.completeDelivery(job.id, otp); setDone(true); window.setTimeout(onDone, 1500); }
    catch (x) { setErr(x instanceof ApiError ? { text: x.message, code: x.code } : { text: "Something went wrong" }); setOtp(""); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    try { await ops.resendOtp(job.id); setErr(null); setNote("A new OTP was sent to the customer's registered mobile."); }
    catch (x) { setErr({ text: x instanceof ApiError ? x.message : "Couldn't send a new OTP." }); }
  };

  return (
    <Modal open onClose={onClose} title={done ? "" : "Confirm customer delivery"} maxWidth={420}>
      <div className="qrp">
        {done ? (
          <div className="qrp-done"><CheckCircle2 size={48} /><h3 className="title-lg">Delivery successful</h3><p>{job.ref} is marked as delivered.</p></div>
        ) : (
          <form onSubmit={verify} className="qrp-otp" noValidate>
            <p>Ask the customer to share their delivery verification OTP. They see it on their order or subscription page.</p>
            <p className="qrp-meta-line"><ShieldCheck size={15} /> {job.ref} · {job.customer.name}</p>
            <label className="label" htmlFor="otp-in">Enter 6-digit OTP</label>
            <input id="otp-in" className="input qrp-otp-in" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} disabled={locked}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus />
            {err && <span className="field-error" role="alert">{err.text}</span>}
            {note && !err && <span className="qrp-note">{note}</span>}
            {locked
              ? <button type="button" className="btn btn-primary btn-block" onClick={resend}><RotateCcw size={14} /> Send a new OTP to the customer</button>
              : <button className="btn btn-primary btn-block" disabled={busy || otp.length !== 6}>{busy ? "Verifying…" : err ? "Retry OTP" : "Verify & complete delivery"}</button>}
            {!locked && <button type="button" className="btn btn-text" onClick={resend}>Customer didn't get it? Send a new OTP</button>}
          </form>
        )}
      </div>
    </Modal>
  );
}

export const doorPaymentStyles = `
  .qrp { padding: var(--sp-6) var(--sp-8) var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-4); }
  .qrp-meta { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); font-size: var(--font-sm); }
  .qrp-meta dt { font-size: var(--font-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); }
  .qrp-meta dd { font-weight: 600; }
  .qrp-amount { display: flex; justify-content: space-between; align-items: baseline; padding: var(--sp-4); border-radius: var(--radius-md); background: var(--bg-sunk); }
  .qrp-amount span { font-size: var(--font-sm); color: var(--text-muted); }
  .qrp-amount strong { font-family: var(--font-display); font-size: 2.4rem; line-height: 1; }
  .qrp-code { display: grid; place-items: center; padding: var(--sp-3); border: 1px solid var(--border); border-radius: var(--radius-md); background: #fff; }
  .qrp-code img { width: 240px; height: 240px; image-rendering: pixelated; }
  .qrp-help { font-size: var(--font-sm); }
  .qrp-status { display: flex; align-items: center; gap: 8px; justify-content: center; padding: 12px; border-radius: var(--radius-md); font-weight: 700; }
  .qrp-status.wait { background: var(--bg-sunk); color: var(--text-muted); }
  .qrp-status.ok { background: var(--accent-gold-glow); color: var(--accent-gold-bright); }
  .qrp-status.fail { background: rgba(168, 67, 43, 0.1); color: var(--error); }
  .spin { animation: spin 1s linear infinite; }
  .qrp-demo { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; padding: 10px; border: 1px dashed var(--border-strong); border-radius: var(--radius-md); font-size: var(--font-xs); color: var(--text-dim); }
  .qrp-demo button { text-decoration: underline; color: var(--text-muted); }
  .qrp-otp { display: flex; flex-direction: column; gap: var(--sp-3); }
  .qrp-meta-line { display: flex; align-items: center; gap: 6px; font-size: var(--font-sm); font-weight: 600; color: var(--text); }
  .qrp-otp-in { font-size: 1.8rem; letter-spacing: 0.5em; text-align: center; font-weight: 700; }
  .qrp-note { font-size: var(--font-sm); color: var(--accent-gold); }
  .qrp-done { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding: var(--sp-6) 0; }
  .qrp-done svg { color: var(--accent-gold); }
  @media (max-width: 480px) { .qrp { padding: var(--sp-5); } }
`;
