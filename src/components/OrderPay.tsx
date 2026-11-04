import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, CreditCard, Loader2, CheckCircle2, QrCode, ShieldCheck } from "lucide-react";
import { ops, inr, type CustomerOrderView } from "@/api/ops";
import { ApiError } from "@/api/client";
import { payUpiWithRazorpay, razorpayConfigured } from "@/lib/razorpay";
import { DEMO_GATEWAY, upiPayUri } from "@/components/DoorPayment";
import { useStore } from "@/store/store";

/**
 * Pay an unpaid order online from the order page or the shop's link: a UPI app (GPay, PhonePe, Paytm…) through a
 * payment request for the exact total, or Razorpay. The order turns "paid" only when the server has the gateway's
 * confirmation; the admin and the delivery partner see it straight away.
 */
export function OrderPay({ order, refs, onPaid }: { order: CustomerOrderView; refs: string[]; onPaid: () => void }) {
  const { toast } = useStore();
  const [req, setReq] = useState<{ id: string; amount: number } | null>(null);
  const [status, setStatus] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const phone = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  const start = async () => {
    setBusy(true); setErr("");
    try { const r = await ops.payStart(order.ref, refs); setReq(r); setStatus(r.status); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Couldn't start the payment."); }
    finally { setBusy(false); }
  };
  // the UPI code for scanning on a computer
  useEffect(() => {
    if (!req || phone) return;
    QRCode.toDataURL(upiPayUri(req.id, req.amount, `Order ${order.ref}`), { width: 220, margin: 1 }).then(setQr);
  }, [req, phone, order.ref]);
  // wait for the gateway's confirmation
  useEffect(() => {
    if (!req || status === "PAID") return;
    const t = window.setInterval(() => {
      ops.payStatus(order.ref, req.id, refs).then((r) => { if (r.status) setStatus(r.status); }).catch(() => {});
    }, 3000);
    return () => window.clearInterval(t);
  }, [req, status, order.ref]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (status === "PAID") { toast("Payment received. Thank you!", "success"); onPaid(); } }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const razorpay = async () => {
    setErr("");
    try {
      const id = await payUpiWithRazorpay({ amountPaise: order.total, name: "", mobile: "", description: `Order ${order.ref}` });
      if (!id) return;
      await ops.payRazorpay(order.ref, id, refs);
      setStatus("PAID");
    } catch (e) { setErr(e instanceof Error ? e.message : "Payment failed."); }
  };

  if (status === "PAID") return <div className="card op op-done"><CheckCircle2 size={22} /><div><strong>Payment received</strong><p>{inr(order.total)} paid online. Nothing to pay at the door.</p></div></div>;

  return (
    <div className="card op">
      <div className="op-head">
        <div><span className="label">Pay online now</span><strong>{inr(order.total)}</strong></div>
        <span className="op-safe"><ShieldCheck size={14} /> Secure</span>
      </div>
      <p className="op-sub">Pay now with GPay, PhonePe, Paytm or any UPI app, or pay the delivery partner when your order arrives.</p>
      {!req ? (
        <div className="op-btns">
          <button className="btn btn-primary" onClick={start} disabled={busy}><Smartphone size={16} /> {busy ? "Please wait…" : "Pay with UPI app"}</button>
          {razorpayConfigured() && <button className="btn btn-ghost" onClick={razorpay}><CreditCard size={16} /> Pay with Razorpay</button>}
        </div>
      ) : (
        <div className="op-pay">
          {phone
            ? <a className="btn btn-primary btn-block" href={upiPayUri(req.id, req.amount, `Order ${order.ref}`)}><Smartphone size={16} /> Open UPI app · {inr(req.amount)}</a>
            : <div className="op-qr">{qr ? <img src={qr} alt={`UPI QR code for ${inr(req.amount)}`} /> : <div className="skeleton" style={{ width: 200, height: 200 }} />}<span><QrCode size={14} /> Scan with any UPI app on your phone</span></div>}
          <p className={`op-status ${status === "FAILED" ? "bad" : ""}`}>
            {status === "FAILED" ? "The payment didn't go through. Please try again." : <><Loader2 size={15} className="spin" /> Waiting for payment confirmation…</>}
          </p>
          {status === "FAILED" && <button className="btn btn-ghost btn-sm" onClick={start}>Try again</button>}
          {DEMO_GATEWAY && status !== "FAILED" && (
            <div className="op-demo">Demo: no payment gateway connected ·
              <button onClick={() => ops.gatewayWebhook(req.id, "PAID").then(() => setStatus("PAID"))}>simulate paid</button>
              <button onClick={() => ops.gatewayWebhook(req.id, "FAILED").then(() => setStatus("FAILED"))}>failed</button>
            </div>
          )}
        </div>
      )}
      {err && <span className="field-error">{err}</span>}
      <style>{`
        .op { padding: var(--sp-5); display: flex; flex-direction: column; gap: 12px; border-radius: 18px; border-color: var(--green); background: linear-gradient(180deg, var(--accent-gold-glow), #fff 70%); }
        .op-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .op-head > div { display: flex; flex-direction: column; }
        .op-head strong { font-family: var(--font-display); font-size: 2rem; line-height: 1.05; }
        .op-safe { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--green); }
        .op-sub { font-size: 13px; }
        .op-btns { display: flex; flex-wrap: wrap; gap: 8px; }
        .op-btns .btn { flex: 1 1 180px; }
        .op-pay { display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .op-qr { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; border-radius: 14px; background: #fff; border: 1px solid var(--border); }
        .op-qr img { width: 200px; height: 200px; image-rendering: pixelated; }
        .op-qr span { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-dim); }
        .op-status { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--text-muted); }
        .op-status.bad { color: var(--error); }
        .op-demo { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; font-size: 12px; color: var(--text-dim); }
        .op-demo button { text-decoration: underline; color: var(--text-muted); }
        .op-done { flex-direction: row; align-items: center; gap: 12px; color: var(--green); }
        .op-done p { font-size: 13px; }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
