import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ta";
const KEY = "ssp-lang";

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: (en: string, ta: string) => string }
const Ctx = createContext<LangCtx | null>(null);

/** English/Tamil switch for the site's own headings and navigation. Order data stays as the server sends it. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return localStorage.getItem(KEY) === "ta" ? "ta" : "en"; } catch { return "en"; }
  });
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* private mode: the choice lasts for this visit */ }
  }, []);
  const t = useCallback((en: string, ta: string) => (lang === "ta" ? ta : en), [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useLang() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLang must be used within LangProvider");
  return c;
}

/** The header shows only the business priorities: event orders, daily subscriptions, then home delivery. */
export const NAV_PRIMARY = [
  { to: "/", en: "Home", ta: "முகப்பு" },
  { to: "/events", en: "Event Orders", ta: "விழா ஆர்டர்கள்" },
  { to: "/subscriptions", en: "Subscriptions", ta: "சந்தா" },
  { to: "/products", en: "Home Delivery", ta: "வீட்டு டெலிவரி" },
];

/** Shared labels, so the header, footer and homepage name things the same way. */
export const NAV_ITEMS = [
  { to: "/", en: "Home", ta: "முகப்பு" },
  { to: "/our-story", en: "Our Story", ta: "எங்கள் கதை" },
  { to: "/products", en: "Products", ta: "பொருட்கள்" },
  { to: "/subscriptions", en: "Subscriptions", ta: "சந்தா" },
  { to: "/events", en: "Event Orders", ta: "விழா ஆர்டர்கள்" },
  { to: "/branches", en: "Branches", ta: "கிளைகள்" },
  { to: "/contact", en: "Contact", ta: "தொடர்பு" },
];
