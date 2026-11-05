import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { PartyPopper, User, Menu, X, Phone, PackageSearch } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useDeliverySettings } from "@/api/client";
import { useStore } from "@/store/store";
import { NAV_ITEMS, NAV_PRIMARY, useLang } from "@/i18n";
import { SHOP } from "@/data/home";

function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button className={lang === "en" ? "on" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
      <span aria-hidden="true">/</span>
      <button className={lang === "ta" ? "on" : ""} aria-pressed={lang === "ta"} onClick={() => setLang("ta")} lang="ta">தமிழ்</button>
    </div>
  );
}

/** One header for every screen. Over the homepage video it starts transparent and turns cream once you scroll. */
export function Navbar() {
  const { state } = useStore();
  const { data: delivery } = useDeliverySettings();
  const { t } = useLang();
  const { pathname, hash } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const overVideo = pathname === "/" && !scrolled;

  useEffect(() => { setOpen(false); }, [pathname, hash]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const phone = delivery?.support_phone;
  const isActive = (to: string) => (to.includes("#") ? false : to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <>
      <header className={`hdr ${overVideo ? "hdr-clear" : ""}`}>
        <div className="hdr-strip">
          <div className="hdr-strip-in">
            <span>{t("Madurai · Since 1999", "மதுரை · 1999 முதல்")}<span className="hdr-sep" />{SHOP.hours}</span>
            <div className="hdr-strip-r">
              <Link to="/tracking" className="hdr-phone"><PackageSearch size={13} /> {t("Track order", "ஆர்டர் நிலை")}</Link>
              {phone && <a href={`tel:${phone}`} className="hdr-phone"><Phone size={13} /> {phone}</a>}
              <LangSwitch />
            </div>
          </div>
        </div>
        <div className="hdr-main">
          <Link to="/" className="hdr-logo" aria-label="Sri Sastha Paruthipaal home"><BrandLogo size={58} /></Link>
          <nav className="hdr-nav" aria-label="Primary">
            {NAV_PRIMARY.map((n) => (
              <NavLink key={n.to} to={n.to} className={() => `hdr-link ${isActive(n.to) ? "on" : ""}`}>{t(n.en, n.ta)}</NavLink>
            ))}
          </nav>
          <div className="hdr-icons">
            <Link to="/tracking" className="hdr-icon" aria-label={t("Track your order", "ஆர்டர் நிலை")} title={t("Track your order", "ஆர்டர் நிலை")}><PackageSearch size={19} /></Link>
            <Link to={state.user.loggedIn ? "/account" : "/login"} className="hdr-icon" aria-label={t("Account", "கணக்கு")}><User size={19} /></Link>
            <Link to="/events#quote" className="btn btn-primary btn-sm hdr-book"><PartyPopper size={15} /> {t("Book event", "விழா ஆர்டர்")}</Link>
            <button className="hdr-icon hdr-burger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={22} /></button>
          </div>
        </div>
      </header>

      {open && (
        <div className="mnav">
          <div className="drawer-backdrop" onClick={() => setOpen(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="mnav-head">
              <BrandLogo size={48} />
              <button className="modal-close" style={{ position: "static" }} onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
            </div>
            <nav className="mnav-links" aria-label="Mobile primary">
              {NAV_PRIMARY.map((n) => (
                <Link key={n.to} to={n.to} className={`mnav-link ${isActive(n.to) ? "on" : ""}`}>{t(n.en, n.ta)}</Link>
              ))}
              <span className="mnav-more">{t("More", "மேலும்")}</span>
              {NAV_ITEMS.filter((n) => !NAV_PRIMARY.some((p) => p.to === n.to)).map((n) => (
                <Link key={n.to} to={n.to} className={`mnav-sub ${isActive(n.to) ? "on" : ""}`}>{t(n.en, n.ta)}</Link>
              ))}
            </nav>
            <div className="mnav-foot">
              <div className="mnav-lang"><span>{t("Language", "மொழி")}</span><LangSwitch /></div>
              <div className="mnav-pair">
                <Link to={state.user.loggedIn ? "/account" : "/login"} className="btn btn-ghost"><User size={16} /> {state.user.loggedIn ? t("My account", "என் கணக்கு") : t("Sign in", "உள்நுழையவும்")}</Link>
                <Link to="/tracking" className="btn btn-ghost"><PackageSearch size={16} /> {t("Track order", "ஆர்டர் நிலை")}</Link>
              </div>
              <Link to="/events#quote" className="btn btn-primary btn-block"><PartyPopper size={16} /> {t("Book an event order", "விழா ஆர்டர் செய்யுங்கள்")}</Link>
              {phone && <a href={`tel:${phone}`} className="mnav-call"><Phone size={14} /> {t("Call us", "அழைக்க")} · {phone}</a>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
