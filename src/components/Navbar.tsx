import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ShoppingBag, User, Search, Menu, X } from "lucide-react";
import { useStore } from "@/store/store";
import { PRODUCTS } from "@/data/catalog";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/our-story", label: "Our Story" },
  { to: "/products", label: "Products" },
  { to: "/subscriptions", label: "Subscriptions" },
  { to: "/branches", label: "Branches" },
  { to: "/events", label: "Events" },
  { to: "/contact", label: "Contact" },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Sri Sastha Paruthipaal home">
      <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="var(--ink-900)" stroke="var(--border-strong)" />
        <path d="M32 12 C 24 16, 20 24, 20 32 C 20 42, 28 50, 32 52 C 36 50, 44 42, 44 32 C 44 24, 40 16, 32 12 Z" fill="none" stroke="#c9a227" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="32" cy="30" r="5" fill="#e8c84e" />
        <path d="M32 38 v 8" stroke="#c9a227" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="logo-text">
        <span className="logo-line1">Sri Sastha</span>
        <span className="logo-line2">Paruthipaal</span>
      </span>
      <style>{`
        .logo-text { display: flex; flex-direction: column; line-height: 1; }
        .logo-line1 { font-family: var(--font-display); font-size: 13px; font-weight: 500; color: var(--text); letter-spacing: 0.02em; }
        .logo-line2 { font-family: var(--font-body); font-size: 10px; font-weight: 600; letter-spacing: 0.28em; text-transform: uppercase; color: var(--accent-gold); margin-top: 3px; }
      `}</style>
    </Link>
  );
}

export function Navbar() {
  const { cartCount, state } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const loc = useLocation();

  useEffect(() => { setMobileOpen(false); setSearchOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const results = query.trim() ? PRODUCTS.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5) : [];

  return (
    <>
      <header className={`nav-bar ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-inner">
          <Logo />
          <nav className="nav-desktop" aria-label="Primary">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            <button className="nav-icon-btn" aria-label="Search" onClick={() => setSearchOpen((s) => !s)}>
              <Search size={18} />
            </button>
            <Link to="/account" className="nav-icon-btn" aria-label="Account">
              <User size={18} />
            </Link>
            <Link to="/cart" className="nav-icon-btn cart-btn" aria-label={`Cart with ${cartCount} items`}>
              <ShoppingBag size={18} />
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </Link>
            <button className="nav-icon-btn mobile-only" aria-label="Menu" onClick={() => setMobileOpen(true)}>
              <Menu size={20} />
            </button>
          </div>
        </div>
        {searchOpen && (
          <div className="nav-search" role="search">
            <div className="container">
              <div className="nav-search-field">
                <Search size={18} />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search sweets, gift boxes…" aria-label="Search products" />
                <button onClick={() => { setSearchOpen(false); setQuery(""); }} aria-label="Close search"><X size={18} /></button>
              </div>
              {results.length > 0 && (
                <ul className="nav-search-results">
                  {results.map((p) => (
                    <li key={p.id}>
                      <Link to={`/product/${p.id}`}>
                        <img src={p.image} alt="" loading="lazy" />
                        <span>{p.name}</span>
                        <span className="text-dim">₹{p.variants[0].price}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </header>

      {mobileOpen && (
        <div className="mobile-nav">
          <div className="drawer-backdrop" onClick={() => setMobileOpen(false)} />
          <div className="drawer drawer-left">
            <div className="drawer-head">
              <Logo />
              <button className="modal-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
            </div>
            <nav className="drawer-nav" aria-label="Mobile primary">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === "/"}
                  className={({ isActive }) => `drawer-link ${isActive ? "active" : ""}`}>
                  {n.label}
                </NavLink>
              ))}
              <div className="divider" style={{ margin: "16px 0" }} />
              <NavLink to="/account" className="drawer-link">Account</NavLink>
              <NavLink to="/cart" className="drawer-link">Cart {cartCount > 0 && `(${cartCount})`}</NavLink>
              <NavLink to="/admin" className="drawer-link">Admin Demo</NavLink>
            </nav>
            <div className="drawer-foot">
              {state.user.loggedIn ? <span>Signed in as {state.user.name || state.user.email}</span> : <span>Browse as guest — sign in to save demo data</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
