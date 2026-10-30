import { useDeliverySettings } from "@/api/client";
import { BrandLogo } from "@/components/BrandLogo";
import { Link } from "react-router-dom";
import { FOOTER_NAV } from "@/data/catalog";
import { useStore } from "@/store/store";

export function Footer() {
  const { data: delivery } = useDeliverySettings();
  const { state } = useStore();
  return (
    <footer className="footer grain">
      <div className="footer-glow" />
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="flex items-center gap-2">
              <BrandLogo size={56} />
            </div>
            <p>Hot paruthipaal, cooked fresh in a copper pot in Madurai since 1999. A frontend demonstration store.</p>
            <div className="mt-4 footer-coverage">
              <span className="dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-gold)" }} />
              {delivery ? `Free delivery within ${delivery.free_radius_km} km of Periyar Bus Stand` : "Delivery in Madurai"}
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
