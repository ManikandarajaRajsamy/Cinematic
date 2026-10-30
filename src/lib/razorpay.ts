// UPI payments through Razorpay Checkout. Needs VITE_RAZORPAY_KEY_ID in .env.local (the public Key ID only).
// For live payments the server must create the Razorpay order and verify the payment signature; this
// front end passes the payment id along with the order so the server can do that.

const KEY = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
export const razorpayConfigured = () => !!KEY;

interface RazorpayResponse { razorpay_payment_id: string; razorpay_order_id?: string; razorpay_signature?: string }
type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, fn: (r: unknown) => void) => void };

let loading: Promise<RazorpayCtor | null> | null = null;
function loadCheckout(): Promise<RazorpayCtor | null> {
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const w = window as unknown as { Razorpay?: RazorpayCtor };
    if (w.Razorpay) return resolve(w.Razorpay);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(w.Razorpay ?? null);
    s.onerror = () => { loading = null; resolve(null); };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Opens Razorpay with UPI. Resolves with the payment id, or null if the customer closed it.
 * Throws if Razorpay can't load or the payment fails.
 */
export async function payUpiWithRazorpay(p: { amountPaise: number; name: string; mobile: string; description: string; orderId?: string }): Promise<string | null> {
  if (!KEY) throw new Error("Razorpay is not configured");
  const Razorpay = await loadCheckout();
  if (!Razorpay) throw new Error("Couldn't load the payment page. Check your connection and try again.");
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: KEY,
      amount: p.amountPaise,
      currency: "INR",
      name: "Sri Sastha Paruthipaal",
      description: p.description,
      order_id: p.orderId, // created by the server when one is connected
      prefill: { name: p.name, contact: `+91${p.mobile}` },
      method: { upi: true, card: false, netbanking: false, wallet: false, emi: false, paylater: false },
      theme: { color: "#FF7A18" },
      handler: (r: RazorpayResponse) => resolve(r.razorpay_payment_id),
      modal: { ondismiss: () => resolve(null) },
    });
    rzp.on("payment.failed", (r) => reject(new Error((r as { error?: { description?: string } }).error?.description ?? "Payment failed")));
    rzp.open();
  });
}
