import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Check, MapPin, Plus, Pencil, CreditCard, Wallet, Banknote, ArrowRight, ArrowLeft, Truck } from "lucide-react";
import { useStore, computeTotals, productById, Address } from "@/store/store";
import { Modal } from "@/components/Modal";
import { MADURAI_AREAS } from "@/data/catalog";

const STEPS = ["Details", "Address", "Summary", "Payment", "Confirm"];

export function CheckoutPage() {
  const { state, placeOrder, addAddress, updateAddress, toast } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState({ name: state.user.name || "", phone: state.user.phone || "", email: state.user.email || "" });
  const [selectedAddr, setSelectedAddr] = useState<string | undefined>(state.addresses[0]?.id);
  const [addrModal, setAddrModal] = useState<{ open: boolean; edit?: Address }>({ open: false });
  const [addrForm, setAddrForm] = useState<Omit<Address, "id">>({ label: "", name: "", phone: "", line1: "", line2: "", area: "", pincode: "" });
  const [payment, setPayment] = useState("upi");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);

  const totals = computeTotals(state.cart, state.activeCoupon);

  if (state.cart.length === 0 && step < 4) {
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
    if (!customer.phone.trim()) e.phone = "Phone is required";
    else if (!/^[0-9+\-\s]{8,}$/.test(customer.phone)) e.phone = "Enter a valid phone number";
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) e.email = "Enter a valid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateAddress = () => {
    const a = state.addresses.find((x) => x.id === selectedAddr);
    if (!a) { setErrors({ address: "Please select a delivery address" }); return false; }
    const isMadurai = MADURAI_AREAS.some((m) => a.area.toLowerCase().includes(m.toLowerCase())) || /madurai/i.test(a.area + " " + a.pincode);
    if (!isMadurai) { setErrors({ address: "Delivery is available within Madurai district only." }); return false; }
    setErrors({});
    return true;
  };

  const saveAddress = () => {
    const e: Record<string, string> = {};
    if (!addrForm.label.trim()) e.label = "Label required";
    if (!addrForm.name.trim()) e.name = "Name required";
    if (!addrForm.phone.trim()) e.phone = "Phone required";
    if (!addrForm.line1.trim()) e.line1 = "Address line required";
    if (!addrForm.area.trim()) e.area = "Area required";
    if (!addrForm.pincode.trim()) e.pincode = "Pincode required";
    if (Object.keys(e).length) { setErrors(e); return; }
    if (addrModal.edit) { updateAddress(addrModal.edit.id, addrForm); toast("Address updated", "success"); }
    else { const a = addAddress(addrForm); setSelectedAddr(a.id); toast("Address added", "success"); }
    setAddrModal({ open: false });
    setErrors({});
  };

  const openAddAddr = () => {
    setAddrForm({ label: "", name: customer.name, phone: customer.phone, line1: "", line2: "", area: "", pincode: "" });
    setAddrModal({ open: true });
  };
  const openEditAddr = (a: Address) => {
    setAddrForm({ label: a.label, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, area: a.area, pincode: a.pincode });
    setAddrModal({ open: true, edit: a });
  };

  const next = () => {
    if (step === 0 && !validateDetails()) return;
    if (step === 1 && !validateAddress()) return;
    setStep((s) => Math.min(4, s + 1));
  };

  const place = () => {
    if (placing) return;
    setPlacing(true);
    const addr = state.addresses.find((x) => x.id === selectedAddr);
    const order = placeOrder(customer, addr);
    toast("Demo order placed!", "success");
    navigate("/confirmation", { state: { orderId: order.id } });
  };

  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container-narrow">
        <div className="sec-head center" style={{ alignItems: "center" }}>
          <span className="eyebrow center">Checkout</span>
          <h1 className="display-3">Complete your order</h1>
        </div>

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
              <h2 className="title-lg mb-6">Customer details</h2>
              <div className="field-row">
                <div className="field"><label className="label">Full name</label><input className="input" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Your name" />{errors.name && <span className="field-error">{errors.name}</span>}</div>
                <div className="field"><label className="label">Phone</label><input className="input" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Phone number" />{errors.phone && <span className="field-error">{errors.phone}</span>}</div>
              </div>
              <div className="field mt-4"><label className="label">Email (optional)</label><input className="input" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="Email address" />{errors.email && <span className="field-error">{errors.email}</span>}</div>
            </div>
          )}

          {step === 1 && (
            <div className="checkout-panel">
              <div className="flex justify-between items-center mb-6">
                <h2 className="title-lg">Delivery address</h2>
                <button className="btn btn-ghost btn-sm" onClick={openAddAddr}><Plus size={14} /> Add new</button>
              </div>
              <div className="addr-notice"><Truck size={16} /> <span>Delivery available within <strong>Madurai district only</strong>.</span></div>
              {errors.address && <div className="field-error mb-4">{errors.address}</div>}
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
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="checkout-panel">
              <h2 className="title-lg mb-6">Order summary</h2>
              <div className="checkout-items">
                {state.cart.map((line) => {
                  const p = productById(line.productId)!;
                  const v = p.variants.find((x) => x.id === line.variantId)!;
                  return (
                    <div className="checkout-item" key={`${line.productId}-${line.variantId}-${line.subscription}`}>
                      <img src={p.image} alt="" loading="lazy" />
                      <div className="checkout-item-body">
                        <strong>{p.name}</strong>
                        <span>{v.label} × {line.qty}{line.subscription ? " · Subscription" : ""}</span>
                      </div>
                      <span className="checkout-item-price">₹{v.price * line.qty}</span>
                    </div>
                  );
                })}
              </div>
              <div className="divider" />
              <div className="summary-rows">
                <div className="summary-row"><span>Subtotal</span><span>₹{totals.subtotal}</span></div>
                {totals.couponDiscount > 0 && <div className="summary-row discount"><span>Coupon ({state.activeCoupon})</span><span>– ₹{totals.couponDiscount}</span></div>}
                {totals.subscriptionDiscount > 0 && <div className="summary-row discount"><span>Subscription discount (15%)</span><span>– ₹{totals.subscriptionDiscount}</span></div>}
                <div className="summary-row"><span>Delivery fee</span><span>₹{totals.deliveryFee}</span></div>
                <div className="divider" style={{ margin: "8px 0" }} />
                <div className="summary-row total"><span>Payable amount</span><span className="price" style={{ fontSize: "1.5rem" }}>₹{totals.total}</span></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="checkout-panel">
              <h2 className="title-lg mb-6">Payment method</h2>
              <p className="mb-6" style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)" }}>This is a frontend demonstration. No real payment is collected and no payment gateway is connected.</p>
              <div className="payment-options">
                {[
                  { id: "upi", label: "UPI", icon: Wallet, desc: "GPay, PhonePe, Paytm (demo)" },
                  { id: "card", label: "Card", icon: CreditCard, desc: "No card details collected (demo)" },
                  { id: "cod", label: "Cash on delivery", icon: Banknote, desc: "Pay when it arrives (demo)" },
                ].map((opt) => (
                  <label key={opt.id} className={`pay-option ${payment === opt.id ? "active" : ""}`}>
                    <input type="radio" name="payment" checked={payment === opt.id} onChange={() => setPayment(opt.id)} />
                    <opt.icon size={20} />
                    <div><strong>{opt.label}</strong><span>{opt.desc}</span></div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="checkout-panel text-center">
              <h2 className="title-lg mb-4">Place demo order</h2>
              <p className="lead" style={{ marginInline: "auto", marginBottom: 24 }}>Review your details and place the demo order. No real payment will be processed.</p>
              <div className="place-summary glass">
                <div className="summary-row total"><span>Total payable</span><span className="price" style={{ fontSize: "2rem" }}>₹{totals.total}</span></div>
              </div>
              <button className="btn btn-primary btn-lg mt-8" onClick={place} disabled={placing}>
                {placing ? "Placing…" : <>Place demo order <Check size={18} /></>}
              </button>
              <p style={{ fontSize: "var(--font-xs)", color: "var(--text-dim)", marginTop: 12 }}>This creates a local demo order only.</p>
            </div>
          )}

          <div className="checkout-nav">
            {step > 0 && <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}><ArrowLeft size={16} /> Back</button>}
            {step < 4 && <button className="btn btn-primary ml-auto" onClick={next}>Continue <ArrowRight size={16} /></button>}
          </div>
        </div>
      </div>

      <Modal open={addrModal.open} onClose={() => { setAddrModal({ open: false }); setErrors({}); }} title={addrModal.edit ? "Edit address" : "Add address"} maxWidth={500}>
        <div className="addr-form">
          <div className="field-row">
            <div className="field"><label className="label">Label</label><input className="input" value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })} placeholder="Home, Work…" />{errors.label && <span className="field-error">{errors.label}</span>}</div>
            <div className="field"><label className="label">Pincode</label><input className="input" value={addrForm.pincode} onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })} placeholder="625001" />{errors.pincode && <span className="field-error">{errors.pincode}</span>}</div>
          </div>
          <div className="field-row">
            <div className="field"><label className="label">Name</label><input className="input" value={addrForm.name} onChange={(e) => setAddrForm({ ...addrForm, name: e.target.value })} />{errors.name && <span className="field-error">{errors.name}</span>}</div>
            <div className="field"><label className="label">Phone</label><input className="input" value={addrForm.phone} onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })} />{errors.phone && <span className="field-error">{errors.phone}</span>}</div>
          </div>
          <div className="field"><label className="label">Address line 1</label><input className="input" value={addrForm.line1} onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })} />{errors.line1 && <span className="field-error">{errors.line1}</span>}</div>
          <div className="field"><label className="label">Address line 2 (optional)</label><input className="input" value={addrForm.line2} onChange={(e) => setAddrForm({ ...addrForm, line2: e.target.value })} /></div>
          <div className="field"><label className="label">Area / Locality</label><input className="input" value={addrForm.area} onChange={(e) => setAddrForm({ ...addrForm, area: e.target.value })} placeholder="e.g. Tallakulam, Madurai" />{errors.area && <span className="field-error">{errors.area}</span>}</div>
          <button className="btn btn-primary btn-block mt-4" onClick={saveAddress}>{addrModal.edit ? "Update address" : "Save address"}</button>
        </div>
      </Modal>

      <style>{`
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
        .addr-card input { margin-top: 4px; accent-color: var(--accent-gold); }
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
        @media (max-width: 700px) { .checkout-steps { font-size: 0; gap: var(--sp-4); } .checkout-step span { display: none; } .checkout-step.active span { display: inline; font-size: var(--font-xs); } .checkout-card { padding: var(--sp-4); } }
      `}</style>
    </section>
  );
}
