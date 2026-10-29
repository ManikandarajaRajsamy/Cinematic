import { Link } from "react-router-dom";
import { FOOTER_NAV } from "@/data/catalog";
import { useStore } from "@/store/store";

export function Footer() {
  const { state } = useStore();
  return (
    <footer className="footer grain">
      <div className="footer-glow" />
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="flex items-center gap-2">
              <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
                <rect width="64" height="64" rx="14" fill="var(--ink-900)" stroke="var(--border-strong)" />
                <path d="M32 12 C 24 16, 20 24, 20 32 C 20 42, 28 50, 32 52 C 36 50, 44 42, 44 32 C 44 24, 40 16, 32 12 Z" fill="none" stroke="#c9a227" strokeWidth="2.5" strokeLinejoin="round" />
                <circle cx="32" cy="30" r="5" fill="#e8c84e" />
                <path d="M32 38 v 8" stroke="#c9a227" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span className="logo-text">
                <span className="logo-line1">Sri Sastha</span>
                <span className="logo-line2">Paruthipaal</span>
              </span>
            </div>
            <p>Heritage milk sweets from Madurai, crafted in small batches. A frontend demonstration store.</p>
            <div className="mt-4 footer-coverage">
              <span className="dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-gold)" }} />
              Delivery: Madurai district only
            </div>
          </div>
          {FOOTER_NAV.map((col) => (
            <div className="footer-col" key={col.title}>
              <h6>{col.title}</h6>
              {col.links.map((l) => (
                <Link key={l.to} to={l.to}>{l.label}</Link>
              ))}
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Sri Sastha Paruthipaal. All rights reserved. Demonstration website.</span>
          <span>Signed in: {state.user.loggedIn ? state.user.name || state.user.email : "Guest"}</span>
        </div>
      </div>
      <style>{`
        .logo-text { display: flex; flex-direction: column; line-height: 1; }
        .logo-line1 { font-family: var(--font-display); font-size: 15px; font-weight: 500; color: var(--text); }
        .logo-line2 { font-family: var(--font-body); font-size: 10px; font-weight: 600; letter-spacing: 0.28em; text-transform: uppercase; color: var(--accent-gold); margin-top: 3px; }
      `}</style>
    </footer>
  );
}
