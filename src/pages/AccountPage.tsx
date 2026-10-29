import { useState } from "react";
import { Link } from "react-router-dom";
import {
  User, MapPin, Package, Repeat, LogOut, Pencil, Plus, Trash2, Truck, ArrowRight, Settings,
} from "lucide-react";
import { useStore, Address, DemoOrder } from "@/store/store";
import { Modal } from "@/components/Modal";
import { productById } from "@/data/catalog";

type Tab = "profile" | "addresses" | "orders" | "subscriptions" | "preferences";

export function AccountPage() {
  const { state, logout, updateAddress: updateAddr, addAddress, removeAddress, toast, login } = useStore();
  const [tab, setTab] = useState<Tab>("profile");
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: state.user.name, email: state.user.email, phone: state.user.phone });
  const [addrModal, setAddrModal] = useState<{ open: boolean; edit?: Address }>({ open: false });
  const [addrForm, setAddrForm] = useState<Omit<Address, "id">>({ label: "", name: "", phone: "", line1: "", line2: "", area: "", pincode: "" });
  const [addrErrors, setAddrErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [orderModal, setOrderModal] = useState<DemoOrder | null>(null);

  const TABS: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "addresses", label: "Addresses", icon: MapPin },
    { id: "orders", label: "Orders", icon: Package },
    { id: "subscriptions", label: "Subscriptions", icon: Repeat },
    { id: "preferences", label: "Preferences", icon: Settings },
  ];

  if (!state.user.loggedIn) {
    return (
      <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
        <div className="container-narrow text-center">
          <User size={56} style={{ opacity: 0.3 }} />
          <h1 className="display-3 mt-6">Sign in to view your account</h1>
          <p className="lead mt-4" style={{ marginInline: "auto" }}>This is a demo account area. Sign in with any email to explore it.</p>
          <Link to="/login" className="btn btn-primary btn-lg mt-8">Sign in <ArrowRight size={18} /></Link>
        </div>
      </section>
    );
  }

  const saveProfile = () => {
    login(profileForm.email, profileForm.name);
    toast("Profile updated", "success");
    setEditing(false);
  };

  const saveAddress = () => {
    const e: Record<string, string> = {};
    if (!addrForm.label.trim()) e.label = "Required";
    if (!addrForm.name.trim()) e.name = "Required";
    if (!addrForm.phone.trim()) e.phone = "Required";
    if (!addrForm.line1.trim()) e.line1 = "Required";
    if (!addrForm.area.trim()) e.area = "Required";
    if (!addrForm.pincode.trim()) e.pincode = "Required";
    setAddrErrors(e);
    if (Object.keys(e).length) return;
    if (addrModal.edit) { updateAddr(addrModal.edit.id, addrForm); toast("Address updated", "success"); }
    else { addAddress(addrForm); toast("Address added", "success"); }
    setAddrModal({ open: false });
  };

  const openAddAddr = () => { setAddrForm({ label: "", name: state.user.name, phone: state.user.phone, line1: "", line2: "", area: "", pincode: "" }); setAddrErrors({}); setAddrModal({ open: true }); };
  const openEditAddr = (a: Address) => { setAddrForm({ label: a.label, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, area: a.area, pincode: a.pincode }); setAddrErrors({}); setAddrModal({ open: true, edit: a }); };

  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container">
        <div className="acc-layout">
          <aside className="acc-sidebar">
            <div className="acc-user">
              <div className="acc-avatar">{state.user.name.charAt(0).toUpperCase() || "U"}</div>
              <div>
                <strong>{state.user.name || "Guest"}</strong>
                <span>{state.user.email}</span>
              </div>
            </div>
            <nav className="acc-nav">
              {TABS.map((t) => (
                <button key={t.id} className={`acc-nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)} id={t.id === "orders" ? "orders" : t.id === "addresses" ? "addresses" : undefined}>
                  <t.icon size={18} /> {t.label}
                </button>
              ))}
              <button className="acc-nav-item danger" onClick={logout}><LogOut size={18} /> Sign out</button>
            </nav>
          </aside>

          <div className="acc-content">
            {tab === "profile" && (
              <div className="acc-pane">
                <div className="flex justify-between items-center mb-8">
                  <h1 className="title-xl">Profile overview</h1>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(!editing)}><Pencil size={14} /> {editing ? "Cancel" : "Edit"}</button>
                </div>
                <div className="acc-profile card">
                  {editing ? (
                    <>
                      <div className="field"><label className="label">Name</label><input className="input" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} /></div>
                      <div className="field"><label className="label">Email</label><input className="input" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} /></div>
                      <div className="field"><label className="label">Phone</label><input className="input" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
                      <button className="btn btn-primary" onClick={saveProfile}>Save changes</button>
                    </>
                  ) : (
                    <>
                      <div className="acc-profile-row"><span className="label">Name</span><strong>{state.user.name || "—"}</strong></div>
                      <div className="acc-profile-row"><span className="label">Email</span><strong>{state.user.email || "—"}</strong></div>
                      <div className="acc-profile-row"><span className="label">Phone</span><strong>{state.user.phone || "—"}</strong></div>
                    </>
                  )}
                </div>
              </div>
            )}

            {tab === "addresses" && (
              <div className="acc-pane">
                <div className="flex justify-between items-center mb-8">
                  <h1 className="title-xl">Saved addresses</h1>
                  <button className="btn btn-ghost btn-sm" onClick={openAddAddr}><Plus size={14} /> Add address</button>
                </div>
                {state.addresses.length === 0 ? (
                  <div className="empty-mini"><MapPin size={32} /><p>No saved addresses yet.</p><button className="btn btn-primary btn-sm" onClick={openAddAddr}>Add address</button></div>
                ) : (
                  <div className="addr-grid">
                    {state.addresses.map((a) => (
                      <div className="addr-tile card" key={a.id}>
                        <div className="flex justify-between items-center mb-3">
                          <span className="badge badge-gold">{a.label}</span>
                          <div className="flex gap-1">
                            <button className="nav-icon-btn" style={{ width: 32, height: 32 }} onClick={() => openEditAddr(a)} aria-label="Edit"><Pencil size={14} /></button>
                            <button className="nav-icon-btn" style={{ width: 32, height: 32 }} onClick={() => setDeleteConfirm(a.id)} aria-label="Delete"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <strong>{a.name}</strong>
                        <span className="acc-addr-text">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</span>
                        <span className="acc-addr-text">{a.area} — {a.pincode}</span>
                        <span className="acc-addr-text text-dim">{a.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "orders" && (
              <div className="acc-pane">
                <h1 className="title-xl mb-8">Order history</h1>
                {state.orders.length === 0 ? (
                  <div className="empty-mini"><Package size={32} /><p>No demo orders yet.</p><Link to="/products" className="btn btn-primary btn-sm">Browse menu</Link></div>
                ) : (
                  <div className="acc-orders">
                    {state.orders.map((o) => (
                      <div className="acc-order card card-hover" key={o.id} onClick={() => setOrderModal(o)} role="button">
                        <div className="acc-order-head">
                          <div>
                            <strong>{o.number}</strong>
                            <span>{new Date(o.placedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                          <span className={`badge ${o.status === "delivered" ? "badge-success" : o.status === "cancelled" ? "badge-error" : "badge-gold"}`}>{o.status.replace(/_/g, " ")}</span>
                        </div>
                        <div className="acc-order-items">
                          {o.items.slice(0, 3).map((it, i) => <span key={i}>{it.productName} × {it.qty}</span>)}
                          {o.items.length > 3 && <span>+{o.items.length - 3} more</span>}
                        </div>
                        <div className="acc-order-foot">
                          <span className="price" style={{ fontSize: "1.1rem" }}>₹{o.total}</span>
                          <div className="flex gap-2">
                            <Link to={`/tracking/${o.id}`} className="btn btn-ghost btn-sm" onClick={(e) => e.stopPropagation()}><Truck size={14} /> Track</Link>
                            <button className="btn btn-text btn-sm">Details <ArrowRight size={12} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "subscriptions" && (
              <div className="acc-pane">
                <h1 className="title-xl mb-8">Subscriptions</h1>
                {state.subscriptions.length === 0 ? (
                  <div className="empty-mini"><Repeat size={32} /><p>No active subscriptions.</p><Link to="/subscriptions" className="btn btn-primary btn-sm">Explore plans</Link></div>
                ) : (
                  <div className="acc-subs">
                    {state.subscriptions.map((s) => {
                      const p = productById(s.productId);
                      return (
                        <div className="acc-sub card" key={s.id}>
                          <div className="flex justify-between items-center mb-3">
                            <strong>{p?.name ?? "Product"}</strong>
                            <span className={`badge ${s.status === "active" ? "badge-success" : s.status === "paused" ? "badge-gold" : "badge-error"}`}>{s.status}</span>
                          </div>
                          <span className="acc-addr-text">{s.frequency} · {p?.variants.find((v) => v.id === s.variantId)?.label} × {s.qty}</span>
                          <Link to="/subscriptions" className="btn btn-text btn-sm mt-3">Manage <ArrowRight size={12} /></Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === "preferences" && (
              <div className="acc-pane">
                <h1 className="title-xl mb-8">Preferences</h1>
                <div className="card" style={{ padding: "var(--sp-6)", display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
                  <label className="auth-check" style={{ fontSize: "var(--font-md)" }}><input type="checkbox" defaultChecked /> Email me about new products</label>
                  <label className="auth-check" style={{ fontSize: "var(--font-md)" }}><input type="checkbox" defaultChecked /> Notify me about order updates</label>
                  <label className="auth-check" style={{ fontSize: "var(--font-md)" }}><input type="checkbox" /> Reduce motion (respects system setting)</label>
                  <button className="btn btn-primary mt-2" onClick={() => toast("Preferences saved (demo)", "success")}>Save preferences</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address modal */}
      <Modal open={addrModal.open} onClose={() => setAddrModal({ open: false })} title={addrModal.edit ? "Edit address" : "Add address"} maxWidth={500}>
        <div className="addr-form">
          <div className="field-row">
            <div className="field"><label className="label">Label</label><input className="input" value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })} />{addrErrors.label && <span className="field-error">{addrErrors.label}</span>}</div>
            <div className="field"><label className="label">Pincode</label><input className="input" value={addrForm.pincode} onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })} />{addrErrors.pincode && <span className="field-error">{addrErrors.pincode}</span>}</div>
          </div>
          <div className="field-row">
            <div className="field"><label className="label">Name</label><input className="input" value={addrForm.name} onChange={(e) => setAddrForm({ ...addrForm, name: e.target.value })} />{addrErrors.name && <span className="field-error">{addrErrors.name}</span>}</div>
            <div className="field"><label className="label">Phone</label><input className="input" value={addrForm.phone} onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })} />{addrErrors.phone && <span className="field-error">{addrErrors.phone}</span>}</div>
          </div>
          <div className="field"><label className="label">Address line 1</label><input className="input" value={addrForm.line1} onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })} />{addrErrors.line1 && <span className="field-error">{addrErrors.line1}</span>}</div>
          <div className="field"><label className="label">Address line 2 (optional)</label><input className="input" value={addrForm.line2} onChange={(e) => setAddrForm({ ...addrForm, line2: e.target.value })} /></div>
          <div className="field"><label className="label">Area</label><input className="input" value={addrForm.area} onChange={(e) => setAddrForm({ ...addrForm, area: e.target.value })} placeholder="Tallakulam, Madurai" />{addrErrors.area && <span className="field-error">{addrErrors.area}</span>}</div>
          <button className="btn btn-primary btn-block mt-4" onClick={saveAddress}>{addrModal.edit ? "Update" : "Save address"}</button>
        </div>
      </Modal>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-panel" style={{ maxWidth: 400, padding: 32 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="title-lg mb-4">Delete address?</h3>
            <p style={{ marginBottom: 24, color: "var(--text-muted)" }}>This address will be removed from your saved addresses.</p>
            <div className="flex gap-3">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-saffron" onClick={() => { removeAddress(deleteConfirm); setDeleteConfirm(null); toast("Address deleted"); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Order detail modal */}
      <Modal open={!!orderModal} onClose={() => setOrderModal(null)} title={orderModal ? `Order ${orderModal.number}` : ""} maxWidth={520}>
        {orderModal && (
          <div className="order-modal" style={{ padding: "24px 32px 32px" }}>
            <div className="summary-row mb-4"><span>Status</span><span className="badge badge-gold">{orderModal.status.replace(/_/g, " ")}</span></div>
            <div className="divider" />
            {orderModal.items.map((it, i) => (
              <div className="track-item" key={i} style={{ padding: "8px 0" }}><span>{it.productName} · {it.variantLabel} × {it.qty}</span><span>₹{it.lineTotal}</span></div>
            ))}
            <div className="divider" />
            <div className="summary-row total"><span>Total</span><span className="price">₹{orderModal.total}</span></div>
            {orderModal.address && <p style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)", marginTop: 12 }}>Deliver to: {orderModal.address.line1}, {orderModal.address.area} — {orderModal.address.pincode}</p>}
            <Link to={`/tracking/${orderModal.id}`} className="btn btn-primary btn-block mt-6" onClick={() => setOrderModal(null)}>Track this order</Link>
          </div>
        )}
      </Modal>

      <style>{`
        .acc-layout { display: grid; grid-template-columns: 260px 1fr; gap: var(--sp-8); align-items: start; }
        .acc-sidebar { position: sticky; top: calc(var(--nav-h) + 16px); }
        .acc-user { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-4); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-card); margin-bottom: var(--sp-4); }
        .acc-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--accent-gold); color: var(--ink-950); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 1.4rem; font-weight: 600; flex-shrink: 0; }
        .acc-user div { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
        .acc-user span { font-size: var(--font-xs); color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .acc-nav { display: flex; flex-direction: column; gap: 2px; }
        .acc-nav-item { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-radius: var(--radius-sm); color: var(--text-muted); font-size: var(--font-sm); font-weight: 500; transition: all var(--t-fast); text-align: left; }
        .acc-nav-item:hover { background: var(--bg-glass-light); color: var(--text); }
        .acc-nav-item.active { background: var(--accent-gold-glow); color: var(--accent-gold-bright); }
        .acc-nav-item.danger:hover { color: var(--error); }
        .acc-content { min-height: 400px; }
        .acc-profile { padding: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-4); }
        .acc-profile-row { display: flex; flex-direction: column; gap: 4px; padding-bottom: var(--sp-4); border-bottom: 1px solid var(--border); }
        .acc-profile-row:last-child { border: 0; padding-bottom: 0; }
        .addr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--sp-4); }
        .addr-tile { padding: var(--sp-5); display: flex; flex-direction: column; gap: 4px; }
        .acc-addr-text { font-size: var(--font-sm); color: var(--text-muted); }
        .acc-orders, .acc-subs { display: flex; flex-direction: column; gap: var(--sp-4); }
        .acc-order { padding: var(--sp-5); cursor: pointer; display: flex; flex-direction: column; gap: var(--sp-3); }
        .acc-order-head { display: flex; justify-content: space-between; align-items: center; }
        .acc-order-head span { font-size: var(--font-xs); color: var(--text-dim); }
        .acc-order-items { display: flex; flex-wrap: wrap; gap: var(--sp-3); font-size: var(--font-sm); color: var(--text-muted); }
        .acc-order-foot { display: flex; justify-content: space-between; align-items: center; }
        .acc-sub { padding: var(--sp-5); display: flex; flex-direction: column; gap: 4px; }
        .empty-mini { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-12); color: var(--text-dim); text-align: center; border: 1px dashed var(--border); border-radius: var(--radius-md); }
        .auth-check { display: flex; align-items: center; gap: 10px; color: var(--text-muted); cursor: pointer; }
        .auth-check input { width: 18px; height: 18px; accent-color: var(--accent-gold); }
        .addr-form { display: flex; flex-direction: column; gap: var(--sp-4); padding: 24px 32px 32px; }
        .summary-row { display: flex; justify-content: space-between; font-size: var(--font-sm); color: var(--text-muted); }
        .summary-row.total { color: var(--text); font-weight: 600; }
        .track-item { display: flex; justify-content: space-between; font-size: var(--font-sm); color: var(--text-muted); }
        @media (max-width: 800px) { .acc-layout { grid-template-columns: 1fr; } .acc-sidebar { position: static; } .acc-nav { flex-direction: row; flex-wrap: wrap; } .acc-nav-item { flex: 1; min-width: 100px; justify-content: center; } }
      `}</style>
    </section>
  );
}
