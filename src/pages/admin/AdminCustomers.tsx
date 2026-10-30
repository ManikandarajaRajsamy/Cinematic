import { useState } from "react";
import { Copy, KeyRound, MessageCircle, Search, ShieldAlert } from "lucide-react";
import { request, useApi } from "@/api/client";
import { useStore } from "@/store/store";
import { Modal } from "@/components/Modal";
import { errorsFrom } from "./shared";

interface CustomerRow { mobile: string; name: string; email: string; has_password: boolean; mobile_verified: boolean; source: string; orders: number; created_at: string }
interface ResetLink { token: string; mobile: string; expires_at: string }

const listCustomers = () => request<CustomerRow[]>("GET", "/api/admin/customers");
const linkUrl = (token: string) => `${window.location.origin}/reset-password/${token}`;

/** Customer accounts (by mobile number) and the manual password-reset tool. Passwords are never shown. */
export function AdminCustomers() {
  const { data, loading } = useApi("admin-customers", listCustomers);
  const { toast } = useStore();
  const [query, setQuery] = useState("");
  const [confirmFor, setConfirmFor] = useState<CustomerRow | null>(null);
  const [link, setLink] = useState<ResetLink | null>(null);
  const [busy, setBusy] = useState(false);

  const q = query.replace(/\D/g, "") || query.trim().toLowerCase();
  const rows = (data ?? []).filter((c) => !q || c.mobile.includes(q) || c.name.toLowerCase().includes(q));

  const generate = async () => {
    if (!confirmFor) return;
    setBusy(true);
    try {
      setLink(await request<ResetLink>("POST", "/api/admin/reset-links", { mobile: confirmFor.mobile }));
    } catch (e) { toast(errorsFrom(e).message, "error"); setConfirmFor(null); }
    finally { setBusy(false); }
  };
  const close = () => { setConfirmFor(null); setLink(null); };
  const waUrl = (l: ResetLink, name: string) =>
    `https://wa.me/91${l.mobile}?text=${encodeURIComponent(`Hi ${name || ""}, here is your Sri Sastha Paruthipaal password reset link (valid for 24 hours, one use only): ${linkUrl(l.token)}`)}`;

  return (
    <>
      <div className="admin-controls">
        <label className="admin-search"><Search size={16} /><input className="input" inputMode="tel" placeholder="Search by mobile number or name" aria-label="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      </div>
      {loading && !data ? <div className="card admin-empty">Loading customers…</div> : rows.length === 0 ? (
        <div className="card admin-empty">{data?.length ? "No customer matches." : "No customer accounts yet. They are created by registering or by placing an order."}</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Mobile</th><th>Name</th><th>Email</th><th>Password</th><th>Verified</th><th>Orders</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.mobile}>
                  <td style={{ fontFamily: "monospace", fontWeight: 600 }}>+91 {c.mobile}</td>
                  <td>{c.name || "—"}{c.source === "guest_order" && <><br /><small style={{ color: "var(--text-dim)" }}>from a guest order</small></>}</td>
                  <td>{c.email || "—"}</td>
                  <td>{c.has_password ? <span className="badge badge-success">Set</span> : <span className="badge">Not set</span>}</td>
                  <td>{c.mobile_verified ? "Yes" : "No"}</td>
                  <td>{c.orders}</td>
                  <td>{new Date(c.created_at).toLocaleDateString("en-IN")}</td>
                  <td><button className="btn btn-sm btn-solid" onClick={() => { setLink(null); setConfirmFor(c); }}><KeyRound size={14} /> Generate reset link</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!confirmFor} onClose={close} title={link ? "Reset link ready" : "Generate reset link"} maxWidth={520}>
        {confirmFor && (
          <div className="admin-form">
            {!link ? (
              <>
                <div className="adm-reminder"><ShieldAlert size={18} /><span>Confirm the request came from the customer's registered mobile number <strong>+91 {confirmFor.mobile}</strong>.</span></div>
                <p className="adm-hint">The link works once and expires in 24 hours. Generating it is recorded in the audit log.</p>
                <button className="btn btn-primary btn-block" onClick={generate} disabled={busy}>{busy ? "Generating…" : "I've confirmed — generate link"}</button>
              </>
            ) : (
              <>
                <p className="adm-hint">For {confirmFor.name || "the customer"} (+91 {link.mobile}). Expires {new Date(link.expires_at).toLocaleString("en-IN")}.</p>
                <input className="input" readOnly value={linkUrl(link.token)} aria-label="Reset link" onFocus={(e) => e.currentTarget.select()} />
                <div className="adm-inline">
                  <button className="btn btn-solid" onClick={() => navigator.clipboard.writeText(linkUrl(link.token)).then(() => toast("Link copied", "success"), () => toast("Copy failed — select the link and copy it", "error"))}><Copy size={14} /> Copy link</button>
                  <a className="btn btn-primary" href={waUrl(link, confirmFor.name)} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Send on WhatsApp</a>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
      <style>{`.adm-reminder { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border-bright); background: rgba(255, 122, 24, 0.08); font-size: var(--font-sm); } .adm-reminder svg { color: var(--accent-gold); flex-shrink: 0; margin-top: 2px; }`}</style>
    </>
  );
}
