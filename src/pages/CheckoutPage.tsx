import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Phone, Package, ShieldCheck } from "lucide-react";
import { Check, MapPin, Plus, Minus, Trash2, Pencil, Wallet, Banknote, ArrowRight, ArrowLeft, Truck, LocateFixed, Map } from "lucide-react";
import { MapPicker } from "@/components/MapPicker";
import { payUpiWithRazorpay, razorpayConfigured } from "@/lib/razorpay";
import { DeliveryRules } from "@/components/DeliveryRules";
import { useStore, computeTotals, productById, lineSubtotal, Address } from "@/store/store";
import { Modal } from "@/components/Modal";
import { AddressFields, emptyAddress, toAddressInput, validateAddress as checkAddress, type AddressInput } from "@/components/AddressFields";
import { useDeliveryQuote } from "@/hooks/useDeliveryQuote";
import { useDeliverySettings } from "@/api/client";

const STEPS = ["Details", "Address", "Summary", "Payment", "Confirm"];
const PAYMENT_OPTIONS = [
  { id: "upi", label: "UPI", icon: Wallet, desc: "GPay, PhonePe, Paytm or any UPI app · secured by Razorpay" },
  { id: "cod", label: "Cash on delivery", icon: Banknote, desc: "Pay in cash or UPI when your order arrives" },
];

export function CheckoutPage() {
  const { state, products, placeOrder, addAddress, updateAddress, updateQty, removeFromCart, addToCart, toast, planPctFor } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  // a guest gives only name and mobile; a signed-in customer's own details are used (email is never asked)
  const [customer, setCustomer] = useState({ name: state.user.loggedIn ? state.user.name : "", phone: state.user.loggedIn ? state.user.phone : "", email: state.user.loggedIn ? state.user.email : "" });
  const [selectedAddr, setSelectedAddr] = useState<string | undefined>(state.addresses[0]?.id);
  const [addrModal, setAddrModal] = useState<{ open: boolean; edit?: Address }>({ open: false });
  const [addrForm, setAddrForm] = useState<AddressInput>(emptyAddress());
  const [payment, setPayment] = useState("upi");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);
  const [demoPay, setDemoPay] = useState<((ok: boolean) => void) | null>(null);
  const [pickFor, setPickFor] = useState<Address | null>(null); // address being pinned on the map
  const [locatingId, setLocatingId] = useState<string | null>(null);
  const pinAddress = (a: Address, lat: number, lng: number) => {
    updateAddress(a.id, { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 });
    setSelectedAddr(a.id); setErrors({});
    toast("Location saved for " + a.label, "success");
  };
  const locateFor = (a: Address) => {
    if (!navigator.geolocation) { toast("This browser can't share its location. Use Pick on map.", "error"); return; }
    setLocatingId(a.id);
    navigator.geolocation.getCurrentPosition(
      (g) => { setLocatingId(null); pinAddress(a, g.coords.latitude, g.coords.longitude); },
      () => { setLocatingId(null); toast("Couldn't get your location. Allow location access, or use Pick on map.", "error"); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const selected = state.addresses.find((x) => x.id === selectedAddr);
  const base = computeTotals(state.cart, state.activeCoupon, 0, planPctFor);
  const { quote, loading: quoting } = useDeliveryQuote(selected, base.subtotal, base.hasSubscription);
  const { data: settings } = useDeliverySettings();
  // the fee shown is the server's quote; the server prices the order again when it is placed
  const totals = computeTotals(state.cart, state.activeCoupon, quote?.deliverable ? quote.fee / 100 : 0, planPctFor);

  if (state.cart.length === 0 && !placing) {
    return (
      <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
        <div className="container text-center">
          <h1 className="display-3">Nothing to check out</h1>
          <Link to="/products" className="btn btn-primary mt-6">Browse the menu</Link>
        </div>
      </section>
    );
  }

  const validateDetails = () => {
    const e: Record<string, string> = {};
    if (!customer.name.trim()) e.name = "Name is required";
    if (!/^[6-9]\d{9}$/.test(customer.phone)) e.phone = "Enter a valid 10-digit mobile number.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateAddress = () => {
    if (!selected) { setErrors({ address: "Please select a delivery address" }); return false; }
    if (quoting || !quote) { setErrors({ address: "Checking the delivery fee for this address…" }); return false; }
    if (!quote.deliverable) { setErrors({ address: quote.message }); return false; }
    setErrors({});
    return true;
  };

  const saveAddress = () => {
    const e = checkAddress(addrForm);
    if (Object.keys(e).length) { setErrors(e); return; }
    if (addrModal.edit) { updateAddress(addrModal.edit.id, addrForm); toast("Address updated", "success"); }
    else { const a = addAddress(addrForm); setSelectedAddr(a.id); toast("Address added", "success"); }
    setAddrModal({ open: false });
    setErrors({});
  };

  const openAddAddr = () => {
    setAddrForm(emptyAddress(customer.name, customer.phone));
    setAddrModal({ open: true });
  };
  const openEditAddr = (a: Address) => {
    setAddrForm(toAddressInput(a));
    setAddrModal({ open: true, edit: a });
  };

  const next = () => {
    if (step === 0 && !validateDetails()) return;
    if (step === 1 && !validateAddress()) return;
    setStep((s) => Math.min(4, s + 1));
  };

  /** UPI: pay first (Razorpay, or a labelled demo step when no Razorpay key is set), then place the order. */
  const collectUpi = (): Promise<string | null> => {
    if (razorpayConfigured()) {
      return payUpiWithRazorpay({ amountPaise: Math.round(totals.total * 100), name: customer.name, mobile: customer.phone, description: `${state.cart.length} item(s)` });
    }
    return new Promise((resolve) => setDemoPay(() => (ok: boolean) => { setDemoPay(null); resolve(ok ? `demo_${Date.now()}` : null); }));
  };
  const place = async () => {
    if (placing || !selected) return;
    setPlacing(true);
    try {
      if (payment === "upi") {
        const paymentId = await collectUpi();
        if (!paymentId) { toast("Payment cancelled. Your order wasn't placed.", "error"); setPlacing(false); return; }
      }
      const { order, account } = await placeOrder(customer, selected, payment as "upi" | "cod");
      toast(`Order ${order.number} placed!`, "success");
      // replace the checkout in history: the back button cannot return to a finished checkout.
      // claimToken is only present when this order created a new account (offer to set a password).
      navigate("/account#orders", { replace: true, state: { orderId: order.id, claimToken: account.claimToken } });
    } catch (e) {
      toast((e as Error).message, "error");
      setPlacing(false);
    }
  };

  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container-narrow">
        <div className="sec-head center" style={{ alignItems: "center" }}>
          <span className="eyebrow center">Checkout</span>
          <h1 className="display-3">Complete your order</h1>
        </div>

        {!state.user.loggedIn && (
          <p className="co-signin">Already have an account? <Link to="/login?next=/checkout">Sign in</Link> to use your saved addresses.</p>
        )}
        <div className="checkout-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`checkout-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>
              <div className="checkout-step-num">{i < step ? <Check size={16} /> : i + 1}</div>
              <span>{s}</span>
              {i < STEPS.length - 1 && <div className="checkout-step-line" />}
            </div>
          ))}
        </div>

        <div className="checkout-card">
          {step === 0 && (
            <div className="checkout-panel">
              <h2 className="title-lg mb-6">{state.user.loggedIn ? "Your details" : "Your name and mobile"}</h2>
              <div className="field-row">
                <div className="field"><label className="label" htmlFor="co-name">Full name</label><input id="co-name" className="input" autoComplete="name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Your name" />{errors.name && <span className="field-error">{errors.name}</span>}</div>
                <div className="field">
                  <label className="label" htmlFor="co-phone">Mobile number</label>
                  <div className="co-mobile"><span>+91</span>
                    <input id="co-phone" className="input" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={customer.phone} readOnly={state.user.loggedIn}
                      onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="98765 43210" />
                  </div>
                  {errors.phone && <span className="field-error">{errors.phone}</span>}
                </div>
              </div>
              {!state.user.loggedIn && <p className="co-note">We'll use this number for delivery updates. No account needed.</p>}
            </div>
          )}

          {step === 1 && (
            <div className="checkout-panel">
              <div className="flex justify-between items-center mb-6">
                <h2 className="title-lg">Delivery address</h2>
                <button className="btn btn-ghost btn-sm" onClick={openAddAddr}><Plus size={14} /> Add new</button>
              </div>
              <div className="addr-notice"><Truck size={16} /> <span>{settings ? <>Free delivery within <strong>{settings.free_radius_km} km</strong>. We deliver up to {settings.max_radius_km} km in {settings.district_restriction} district.</> : "Checking delivery…"}</span></div>
              {selected && (quoting ? <p className="addr-quote-line">Checking delivery…</p> : quote && <p className={`addr-quote-line ${quote.deliverable ? "ok" : "no"}`}>{quote.message}</p>)}
              {errors.address && errors.address !== quote?.message && <div className="field-error mb-4">{errors.address}</div>}
              {state.addresses.length === 0 ? (
                <div className="empty-mini"><MapPin size={32} /><p>No saved addresses. Add one to continue.</p><button className="btn btn-primary btn-sm" onClick={openAddAddr}>Add address</button></div>
              ) : (
                <div className="addr-list">
                  {state.addresses.map((a) => (
                    <label key={a.id} className={`addr-card ${selectedAddr === a.id ? "selected" : ""}`}>
                      <input type="radio" name="addr" checked={selectedAddr === a.id} onChange={() => { setSelectedAddr(a.id); setErrors({}); }} />
                      <div className="addr-card-body">
                        <div className="flex justify-between items-center">
                          <strong>{a.label}</strong>
                          <button className="btn btn-text btn-sm" onClick={(e) => { e.preventDefault(); openEditAddr(a); }}><Pencil size={12} /> Edit</button>
                        </div>
                        <span>{a.name} · {a.phone}</span>
                        <span className="addr-line">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.area} — {a.pincode}</span>
                        <div className={`addr-pin ${a.lat == null || a.lng == null ? "missing" : ""}`} onClick={(e) => e.preventDefault()}>
                          {a.lat != null && a.lng != null
                            ? <span className="addr-pin-set"><MapPin size={13} /> Location pinned</span>
                            : <span className="addr-pin-need"><MapPin size={13} /> Set the delivery location</span>}
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => locateFor(a)} disabled={locatingId === a.id}>
                            <LocateFixed size={13} /> {locatingId === a.id ? "Locating…" : "Current location"}
                          </button>
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPickFor(a)}>
                            <Map size={13} /> {a.lat != null ? "Change on map" : "Pick on map"}
                          </button>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <details className="addr-rules">
                <summary>How delivery is charged</summary>
                <DeliveryRules compact />
              </details>
            </div>
          )}

          {step === 2 && (
            <div className="checkout-panel">
              <h2 className="title-lg mb-6">Order summary</h2>
              <div className="checkout-items">
                {state.cart.map((line) => {
                  const p = productById(line.productId);
                  const v = p?.variants.find((x) => x.id === line.variantId);
                  if (!p || !v) return null; // catalogue still loading
                  return (
                    <div className="checkout-item" key={`${line.productId}-${line.variantId}-${line.subscription}`}>
                      <img src={p.image} alt="" loading="lazy" />
                      <div className="checkout-item-body">
                        <strong>{p.name}</strong>
                        <span>{v.label} · ₹{v.price} each{line.subscription ? ` · ${line.planDays}-day plan (per day)` : ""}</span>
                        <div className="co-qty" aria-label={`Quantity of ${p.name}`}>
                          <button type="button" aria-label="Decrease" onClick={() => updateQty(line.productId, line.variantId, line.qty - 1)}><Minus size={14} /></button>
                          <span>{line.qty}</span>
                          <button type="button" aria-label="Increase" disabled={line.qty >= (p.maxQty ?? 99)} onClick={() => updateQty(line.productId, line.variantId, line.qty + 1)}><Plus size={14} /></button>
                          <button type="button" className="co-remove" onClick={() => { removeFromCart(line.productId, line.variantId); toast(`${p.name} removed`); }}><Trash2 size={13} /> Remove</button>
                        </div>
                      </div>
                      <span className="checkout-item-price">₹{lineSubtotal(line)}</span>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const more = products.filter((p) => p.variants[0]?.inStock && !state.cart.some((l) => l.productId === p.id && !l.subscription));
                return more.length > 0 && (
                  <div className="co-add">
                    <span className="label">Add to this order</span>
                    <div className="co-add-list">
                      {more.map((p) => (
                        <button type="button" key={p.id} className="co-add-item" onClick={() => { addToCart(p.id, p.variants[0].id, 1); toast(`${p.name} added`, "success"); }}>
                          <img src={p.image} alt="" />
                          <span><strong>{p.name}</strong><small>₹{p.variants[0].price}</small></span>
                          <Plus size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div className="divider" />
              <div className="summary-rows">
                <div className="summary-row"><span>Subtotal</span><span>₹{totals.subtotal}</span></div>
                {totals.couponDiscount > 0 && <div className="summary-row discount"><span>Coupon ({state.activeCoupon})</span><span>– ₹{totals.couponDiscount}</span></div>}
                {totals.subscriptionDiscount > 0 && <div className="summary-row discount"><span>Plan discount</span><span>– ₹{totals.subscriptionDiscount}</span></div>}
                <div className="summary-row"><span>Delivery{quote?.distanceKm != null && ` · ${quote.distanceKm.toFixed(1)} km by road`}</span><span>{quote?.saving ? <><s className="price-strike">₹{quote.baseFee! / 100}</s> </> : null}{totals.deliveryFee === 0 ? "Free" : `₹${totals.deliveryFee}`}</span></div>
                {!!quote?.saving && settings?.discount_above_amount != null && (
                  <div className="summary-row discount"><span>{settings.discount_percent}% off delivery (order above ₹{settings.discount_above_amount / 100})</span><span>– ₹{quote.saving / 100}</span></div>
                )}
                <div className="divider" style={{ margin: "8px 0" }} />
                <div className="summary-row total"><span>Payable amount</span><span className="price" style={{ fontSize: "1.5rem" }}>₹{totals.total}</span></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="checkout-panel">
              <h2 className="title-lg mb-6">Payment method</h2>
              <p className="mb-6" style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)" }}>{razorpayConfigured() ? "UPI payments are processed securely by Razorpay." : "Demo store: UPI opens a demo payment step until Razorpay is connected."}</p>
              <div className="payment-options">
                {PAYMENT_OPTIONS.map((opt) => (
                  <label key={opt.id} className={`pay-option ${payment === opt.id ? "active" : ""}`}>
                    <input type="radio" name="payment" checked={payment === opt.id} onChange={() => setPayment(opt.id)} />
                    <opt.icon size={20} />
                    <div><strong>{opt.label}</strong><span>{opt.desc}</span></div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (() => {
            const pay = PAYMENT_OPTIONS.find((o) => o.id === payment) ?? PAYMENT_OPTIONS[0];
            const items = state.cart.map((l) => ({ l, p: productById(l.productId) })).filter((x) => x.p);
            return (
              <div className="checkout-panel cf">
                <div className="cf-head">
                  <span className="cf-badge"><Check size={14} /> Last step</span>
                  <h2 className="title-xl">Review &amp; place your order</h2>
                  <p>Check the details below. Your paruthipaal is prepared fresh once the order is placed.</p>
                </div>

                <div className="cf-grid">
                  <div className="cf-details">
                    <section className="cf-card">
                      <div className="cf-card-head"><MapPin size={16} /><span>Deliver to</span></div>
                      <strong>{selected?.label}</strong>
                      <p>{selected?.line1}{selected?.line2 ? `, ${selected.line2}` : ""}, {selected?.area} — {selected?.pincode}</p>
                      {quote?.deliverable && <p className="cf-ok"><Truck size={13} /> {quote.message}</p>}
                    </section>
                    <section className="cf-card">
                      <div className="cf-card-head"><Phone size={16} /><span>Contact</span></div>
                      <strong>{customer.name}</strong>
                      <p>{customer.phone}{customer.email && ` · ${customer.email}`}</p>
                    </section>
                    <section className="cf-card">
                      <div className="cf-card-head"><pay.icon size={16} /><span>Payment</span></div>
                      <strong>{pay.label}</strong>
                      <p>{pay.desc}</p>
                    </section>
                    <section className="cf-card">
                      <div className="cf-card-head"><Package size={16} /><span>Items ({items.reduce((n, x) => n + x.l.qty, 0)})</span></div>
                      <ul className="cf-items">
                        {items.map(({ l, p }) => (
                          <li key={`${l.productId}-${l.subscription}`}>
                            <img src={p!.image} alt="" />
                            <span>{p!.name}{l.subscription && <small> · {l.planDays}-day plan</small>}</span>
                            <em>× {l.qty}</em>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>

                  <aside className="cf-receipt">
                    <span className="cf-receipt-title">Bill summary</span>
                    <div className="cf-rows">
                      <div><span>Subtotal</span><span>₹{totals.subtotal}</span></div>
                      {totals.couponDiscount > 0 && <div className="cf-minus"><span>Coupon ({state.activeCoupon})</span><span>– ₹{totals.couponDiscount}</span></div>}
                      {totals.subscriptionDiscount > 0 && <div className="cf-minus"><span>Plan discount</span><span>– ₹{totals.subscriptionDiscount}</span></div>}
                      <div>
                        <span>Delivery{quote?.distanceKm != null && <small> · {quote.distanceKm.toFixed(1)} km</small>}</span>
                        <span>{quote?.saving ? <s>₹{quote.baseFee! / 100}</s> : null} {totals.deliveryFee === 0 ? "Free" : `₹${totals.deliveryFee}`}</span>
                      </div>
                    </div>
                    <div className="cf-total"><span>Total payable</span><strong>₹{totals.total}</strong></div>
                    {(totals.couponDiscount + totals.subscriptionDiscount + (quote?.saving ?? 0) / 100) > 0 && (
                      <p className="cf-saved">You save ₹{totals.couponDiscount + totals.subscriptionDiscount + (quote?.saving ?? 0) / 100} on this order</p>
                    )}
                    <button className="btn btn-primary btn-lg btn-block" onClick={place} disabled={placing}>
                      {placing ? (payment === "upi" ? "Waiting for payment…" : "Placing order…") : <>{payment === "upi" ? "Pay with UPI" : "Place order"} · ₹{totals.total} <ArrowRight size={18} /></>}
                    </button>
                    <p className="cf-fine"><ShieldCheck size={13} /> {payment === "upi" ? (razorpayConfigured() ? "Secured by Razorpay" : "Demo payment: no money is taken") : "Pay when your order arrives"}</p>
                  </aside>
                </div>
              </div>
            );
          })()}

          {step < 4 && <div className="checkout-nav">
            {step > 0 && step < 4 && <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}><ArrowLeft size={16} /> Back</button>}
            {step < 4 && <button className="btn btn-primary ml-auto" onClick={next}>Continue <ArrowRight size={16} /></button>}
          </div>}
        </div>
      </div>

      <Modal open={addrModal.open} onClose={() => { setAddrModal({ open: false }); setErrors({}); }} title={addrModal.edit ? "Edit address" : "Add address"} maxWidth={500}>
        <div className="addr-form">
          <AddressFields form={addrForm} setForm={setAddrForm} errors={errors} />
          <button className="btn btn-primary btn-block mt-4" onClick={saveAddress}>{addrModal.edit ? "Update address" : "Save address"}</button>
        </div>
      </Modal>

      <MapPicker open={!!pickFor} initial={pickFor?.lat != null && pickFor?.lng != null ? { lat: pickFor.lat, lng: pickFor.lng } : null}
        onClose={() => setPickFor(null)} onPick={(p) => { if (pickFor) pinAddress(pickFor, p.lat, p.lng); setPickFor(null); }} />
      <Modal open={!!demoPay} onClose={() => demoPay?.(false)} title="UPI payment (demo)" maxWidth={420}>
        <div className="admin-form" style={{ padding: "16px 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: "var(--font-sm)" }}>Razorpay isn't connected yet, so this demo step stands in for the UPI app. No money is taken.</p>
          <div className="cf-total"><span>Amount</span><strong>₹{totals.total}</strong></div>
          <button className="btn btn-primary btn-block" onClick={() => demoPay?.(true)}>Simulate successful payment</button>
          <button className="btn btn-ghost btn-block" onClick={() => demoPay?.(false)}>Cancel payment</button>
        </div>
      </Modal>
      <style>{`
        .co-signin { text-align: center; font-size: var(--font-sm); color: var(--text-muted); margin: -8px 0 var(--sp-6); }
        .co-signin a { color: var(--accent-gold-bright); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
        .co-mobile { display: flex; align-items: stretch; }
        .co-mobile span { display: grid; place-items: center; padding: 0 12px; border: 1px solid var(--border); border-right: none; border-radius: var(--radius-sm) 0 0 var(--radius-sm); background: var(--bg-glass-light); font-weight: 600; color: var(--text-muted); }
        .co-mobile .input { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
        .co-note { margin-top: var(--sp-3); font-size: var(--font-xs); color: var(--text-dim); }
        .cf { display: flex; flex-direction: column; gap: var(--sp-6); }
        .cf-head { display: flex; flex-direction: column; gap: 8px; }
        .cf-head p { font-size: var(--font-sm); }
        .cf-badge { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-gold-bright); border: 1px solid var(--border-bright); background: rgba(255, 122, 24, 0.08); }
        .cf-grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: var(--sp-5); align-items: start; }
        .cf-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cf-card { padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-glass-light); display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .cf-card:first-child, .cf-card:last-child { grid-column: span 2; }
        .cf-card-head { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 4px; }
        .cf-card-head svg { color: var(--accent-gold); }
        .cf-card strong { font-size: var(--font-md); }
        .cf-card p { font-size: var(--font-sm); line-height: 1.5; overflow-wrap: anywhere; }
        .cf-ok { display: flex; align-items: center; gap: 6px; color: var(--accent-green-bright) !important; font-weight: 600; margin-top: 4px; }
        .cf-items { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .cf-items li { display: flex; align-items: center; gap: 10px; font-size: var(--font-sm); }
        .cf-items img { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; }
        .cf-items span { flex: 1; }
        .cf-items small { color: var(--text-dim); }
        .cf-items em { font-style: normal; font-weight: 600; color: var(--text-muted); }
        .cf-receipt { position: sticky; top: calc(var(--nav-h) + 16px); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--border-bright); background: linear-gradient(160deg, rgba(255, 122, 24, 0.1), rgba(0, 26, 22, 0.55)); display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow-md); }
        .cf-receipt-title { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); }
        .cf-rows { display: flex; flex-direction: column; gap: 10px; font-size: var(--font-sm); }
        .cf-rows > div { display: flex; justify-content: space-between; gap: 12px; }
        .cf-rows small { color: var(--text-dim); }
        .cf-rows s { color: var(--text-dim); margin-right: 4px; }
        .cf-minus span:last-child { color: var(--accent-green-bright); }
        .cf-total { display: flex; justify-content: space-between; align-items: baseline; padding-top: 14px; border-top: 1px dashed var(--border-strong); }
        .cf-total span { font-weight: 600; }
        .cf-total strong { font-family: var(--font-display); font-size: 2.4rem; font-weight: 400; letter-spacing: -0.04em; line-height: 1; color: var(--text); }
        .cf-saved { font-size: var(--font-sm); font-weight: 600; color: var(--accent-green-bright) !important; margin-top: -6px; }
        .cf-fine { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: var(--font-xs); color: var(--text-dim) !important; }
        @media (max-width: 760px) { .cf-grid { grid-template-columns: 1fr; } .cf-details { grid-template-columns: 1fr; } .cf-card:first-child, .cf-card:last-child { grid-column: auto; } .cf-receipt { position: static; } }
        .co-qty { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; }
        .co-qty > button:not(.co-remove) { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--border-strong); transition: background var(--t-fast); }
        .co-qty > button:not(.co-remove):hover:not(:disabled) { background: var(--accent-gold-glow); }
        .co-qty > button:disabled { opacity: 0.35; }
        .co-qty > span { min-width: 28px; text-align: center; font-weight: 600; }
        .co-remove { margin-left: 10px; display: inline-flex; align-items: center; gap: 4px; font-size: var(--font-xs); color: #e08c70; }
        .co-add { margin-top: var(--sp-5); display: flex; flex-direction: column; gap: 10px; }
        .co-add-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; }
        .co-add-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px 8px 8px; border-radius: var(--radius-md); border: 1px dashed var(--border-strong); text-align: left; transition: border-color var(--t-fast), background var(--t-fast); }
        .co-add-item:hover { border-color: var(--accent-gold); background: rgba(255, 122, 24, 0.06); }
        .co-add-item img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; }
        .co-add-item span { flex: 1; display: flex; flex-direction: column; }
        .co-add-item small { color: var(--text-dim); }
        .co-add-item svg { color: var(--accent-gold); }
        .addr-quote-line { margin: 0 0 var(--sp-4); font-weight: 600; font-size: var(--font-sm); }
        .addr-pin { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); cursor: default; }
        .addr-pin > span { display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-xs); font-weight: 600; }
        .addr-pin .btn { justify-content: center; white-space: nowrap; }
        .addr-pin-set { color: var(--accent-green-bright); }
        .addr-pin-need { color: #e08c70; }
        .addr-rules { margin-top: var(--sp-6); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 16px; }
        .addr-rules summary { cursor: pointer; font-weight: 600; font-size: var(--font-sm); color: var(--accent-gold-bright); }
        .addr-rules[open] summary { margin-bottom: 14px; }
        .addr-quote-line.ok { color: var(--accent-green-bright); }
        .addr-quote-line.no { color: #e08c70; }
        .checkout-steps { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: var(--sp-12); flex-wrap: wrap; }
        .checkout-step { display: flex; align-items: center; gap: var(--sp-2); color: var(--text-dim); font-size: var(--font-sm); font-weight: 500; position: relative; padding-right: var(--sp-4); }
        .checkout-step-num { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: var(--font-xs); font-weight: 700; transition: all var(--t-med); }
        .checkout-step.active { color: var(--accent-gold); }
        .checkout-step.active .checkout-step-num { border-color: var(--accent-gold); background: var(--accent-gold-glow); color: var(--accent-gold-bright); }
        .checkout-step.done { color: var(--accent-green-bright); }
        .checkout-step.done .checkout-step-num { background: var(--accent-green); color: var(--ink-950); border-color: var(--accent-green); }
        .checkout-step-line { width: 32px; height: 1px; background: var(--border); margin-left: var(--sp-2); }
        .checkout-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--sp-8); }
        .checkout-panel { min-height: 200px; }
        .checkout-nav { display: flex; justify-content: space-between; margin-top: var(--sp-8); padding-top: var(--sp-6); border-top: 1px solid var(--border); }
        .addr-notice { display: flex; align-items: center; gap: 8px; padding: var(--sp-3) var(--sp-4); border: 1px solid var(--border-bright); border-radius: var(--radius-sm); background: var(--accent-gold-glow); margin-bottom: var(--sp-6); font-size: var(--font-sm); color: var(--text-muted); }
        .addr-list { display: flex; flex-direction: column; gap: var(--sp-3); }
        .addr-card { display: flex; gap: var(--sp-3); padding: var(--sp-4); border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; transition: all var(--t-fast); background: var(--bg-elevated); }
        .addr-card:hover { border-color: var(--border-strong); }
        .addr-card.selected { border-color: var(--accent-gold); background: var(--accent-gold-glow); }
        .addr-card input { margin-top: 3px; accent-color: var(--accent-gold); flex-shrink: 0; width: 18px; height: 18px; }
        .addr-card { align-items: flex-start; }
        .addr-card-body { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .addr-card-body .addr-line { font-size: var(--font-sm); color: var(--text-dim); }
        .empty-mini { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-12); color: var(--text-dim); text-align: center; }
        .checkout-items { display: flex; flex-direction: column; gap: var(--sp-3); }
        .checkout-item { display: grid; grid-template-columns: 56px 1fr auto; gap: var(--sp-3); align-items: center; }
        .checkout-item img { width: 56px; height: 56px; border-radius: var(--radius-xs); object-fit: cover; }
        .checkout-item-body { display: flex; flex-direction: column; }
        .checkout-item-body span { font-size: var(--font-sm); color: var(--text-dim); }
        .checkout-item-price { font-family: var(--font-display); font-weight: 500; }
        .summary-rows { display: flex; flex-direction: column; gap: var(--sp-2); }
        .summary-row { display: flex; justify-content: space-between; font-size: var(--font-sm); color: var(--text-muted); }
        .summary-row.discount span:last-child { color: var(--accent-green-bright); }
        .summary-row.total { font-size: var(--font-md); color: var(--text); font-weight: 600; }
        .payment-options { display: flex; flex-direction: column; gap: var(--sp-3); }
        .pay-option { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-4); border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; transition: all var(--t-fast); background: var(--bg-elevated); }
        .pay-option:hover { border-color: var(--border-strong); }
        .pay-option.active { border-color: var(--accent-gold); background: var(--accent-gold-glow); }
        .pay-option input { accent-color: var(--accent-gold); }
        .pay-option div { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .pay-option span { font-size: var(--font-xs); color: var(--text-dim); }
        .place-summary { padding: var(--sp-6); border-radius: var(--radius-md); display: inline-block; min-width: 300px; }
        .addr-form { display: flex; flex-direction: column; gap: var(--sp-4); padding: 24px 32px 32px; }
        @media (max-width: 700px) {
          .addr-pin { grid-template-columns: 1fr 1fr; }
          .addr-pin > span { grid-column: 1 / -1; }
          .addr-card { padding: var(--sp-4) var(--sp-3); gap: var(--sp-3); }
          .addr-line { overflow-wrap: anywhere; }
          .cf { gap: var(--sp-5); }
          .cf-grid, .cf-details { gap: 10px; width: 100%; }
          .cf-card, .cf-receipt { width: 100%; min-width: 0; padding: 14px; }
          .cf-receipt { box-shadow: none; }
          .cf-total strong { font-size: 2rem; }
          .cf-ok { align-items: flex-start; }
          .cf-ok svg { margin-top: 3px; flex-shrink: 0; }
          .checkout-steps { padding-inline: 6px; }
        }
        /* phones: one row of five numbered steps (only the current step is named), stacked fields, no empty gap */
        @media (max-width: 700px) {
          .checkout-steps { flex-wrap: nowrap; justify-content: space-between; margin-bottom: var(--sp-8); padding-inline: 4px; }
          .checkout-step { flex: 1 1 0; padding-right: 0; gap: 6px; min-width: 0; }
          .checkout-step:last-child { flex: 0 0 auto; }
          .checkout-step span { display: none; }
          .checkout-step.active span { display: inline; font-size: var(--font-xs); white-space: nowrap; }
          .checkout-step-line { flex: 1; width: auto; min-width: 8px; margin: 0 4px; }
          .checkout-step.active .checkout-step-line { display: none; }
          .checkout-card { padding: var(--sp-5) var(--sp-4); }
          .checkout-panel { min-height: 0; }
          .checkout-panel .field-row { flex-direction: column; gap: var(--sp-4); }
          .checkout-panel .field-row > * { min-width: 0; }
          .checkout-nav { margin-top: var(--sp-6); padding-top: var(--sp-4); }
          .checkout-nav .btn { flex: 1; justify-content: center; }
          .checkout-nav .btn + .btn { margin-left: var(--sp-3); }
        }
      `}</style>
    </section>
  );
}
