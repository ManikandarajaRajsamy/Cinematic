import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { StaffGuard, PartnerGuard, GuestOnly, RequireCart, RequireJustOrdered } from "@/routes/guards";
import { StoreProvider } from "@/store/store";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ToastHost } from "@/components/Toast";
import { HomePage } from "@/pages/HomePage";
import "@/components/components.css";
import "@/pages/home.css";
import { useScrollMotion, type MotionConfig } from "@/hooks/useScrollMotion";
import { LangProvider } from "@/i18n";
import { useVisitTracking } from "@/hooks/useVisitTracking";
import { HeroVideo } from "@/components/HeroVideo";
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const PromoterPage = lazy(() => import("@/pages/PromoterPage").then((m) => ({ default: m.PromoterPage })));
const PartnerPage = lazy(() => import("@/pages/PartnerPage").then((m) => ({ default: m.PartnerPage })));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const ContactPage = lazy(() => import("@/pages/ContactPage").then((m) => ({ default: m.ContactPage })));
const PoliciesPage = lazy(() => import("@/pages/PoliciesPage").then((m) => ({ default: m.PoliciesPage })));
const BranchesPage = lazy(() => import("@/pages/BranchesPage").then((m) => ({ default: m.BranchesPage })));
const EventsPage = lazy(() => import("@/pages/EventsPage").then((m) => ({ default: m.EventsPage })));
const SubscriptionsPage = lazy(() => import("@/pages/SubscriptionsPage").then((m) => ({ default: m.SubscriptionsPage })));
const AccountPage = lazy(() => import("@/pages/AccountPage").then((m) => ({ default: m.AccountPage })));
const TrackingPage = lazy(() => import("@/pages/TrackingPage").then((m) => ({ default: m.TrackingPage })));
const ConfirmationPage = lazy(() => import("@/pages/ConfirmationPage").then((m) => ({ default: m.ConfirmationPage })));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage").then((m) => ({ default: m.CheckoutPage })));
const CartPage = lazy(() => import("@/pages/CartPage").then((m) => ({ default: m.CartPage })));
const ProductDetailPage = lazy(() => import("@/pages/ProductDetailPage").then((m) => ({ default: m.ProductDetailPage })));
const ProductsPage = lazy(() => import("@/pages/ProductsPage").then((m) => ({ default: m.ProductsPage })));
const OurStoryPage = lazy(() => import("@/pages/OurStoryPage").then((m) => ({ default: m.OurStoryPage })));

/** New page: start at the top, or at the section a link names (/#services). */
function ScrollToTop() {
  const { pathname, hash, search } = useLocation();
  const navigate = useNavigate();
  // a doubled slash (//promoter) would otherwise show "page not found"
  useEffect(() => { if (/\/{2,}/.test(pathname)) navigate(pathname.replace(/\/{2,}/g, "/") + search + hash, { replace: true }); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!hash) { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); return; }
    const t = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 60);
    return () => window.clearTimeout(t);
  }, [pathname, hash]);
  return null;
}

// Customer pages share the homepage's motion: headings rise from a mask, text slides in, cards rise into focus,
// photos open up once they enter. Only the partner and admin apps stay still.
const PAGE_MOTION: MotionConfig = {
  reveal: [
    [".po-media, .os-portrait", "rv-media"],
    [".card, .pc, .pb-plan, .pb-form, .pb-sum, .bd-row, .pg-more-card, .mp-card, .ohl li, .ev-option", "rv-card"],
    [".eyebrow, main h1, main h2.display-2, main h2.display-3, main h2.title-xl, main h2.title-lg, .lead, .pg-crumb, .pg-bar, .sec-head > p, .po-body > :not(h2), .os-text > p", "rv-text"],
  ],
  parallax: [[".po-media img", -0.05, 0.05], [".os-portrait", -0.05]],
  tilt: ".pc, .pb-plan, .pg-more-card, .mp-card",
};
const STILL = ["/partner", "/admin", "/manager", "/promoter"];

function PageMotion() {
  const { pathname } = useLocation();
  const still = pathname === "/" || STILL.some((p) => pathname.startsWith(p));
  useScrollMotion(still ? "#no-motion" : "main", PAGE_MOTION, pathname);
  return null;
}

/** Staff apps, accounts and payment pages are kept out of search engines (robots.txt says the same). */
const PRIVATE = /^\/(admin|manager|partner|promoter|account|checkout|cart|login|reset-password|tracking|t\/|pay)/i;
function usePrivateNoIndex(pathname: string) {
  useEffect(() => {
    if (!PRIVATE.test(pathname)) return;
    const m = document.createElement("meta");
    m.name = "robots"; m.content = "noindex, nofollow";
    document.head.appendChild(m);
    return () => m.remove();
  }, [pathname]);
}

function Layout() {
  const { pathname } = useLocation();
  // own full-screen layouts: sign-in, password reset, the delivery partner app and the admin workspace
  const bare = pathname === "/login" || pathname.startsWith("/reset-password") || pathname.startsWith("/partner") || pathname.startsWith("/admin") || pathname.startsWith("/manager") || pathname === "/promoter";
  // the homepage hero runs under the header; other pages start below it
  const home = pathname === "/";
  useVisitTracking();
  usePrivateNoIndex(pathname);
  return (
    <>
      {/* one pour film, fixed behind every customer screen; it lives here so it keeps playing across pages */}
      {!bare && <div className="home-film" aria-hidden="true"><HeroVideo /></div>}
      {!bare && <Navbar />}
      <PageMotion />
      <main className={bare ? "" : home ? "on-film" : "on-film veil"} style={{ paddingTop: bare || home ? 0 : "var(--nav-h)" }}>
        <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/our-story" element={<OurStoryPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<RequireCart><CheckoutPage /></RequireCart>} />
          <Route path="/confirmation" element={<RequireJustOrdered><ConfirmationPage /></RequireJustOrdered>} />
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="/tracking/:id" element={<TrackingPage />} />
          <Route path="/t/:token" element={<TrackingPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/partner" element={<PartnerGuard><PartnerPage /></PartnerGuard>} />
          <Route path="/admin" element={<StaffGuard><AdminPage /></StaffGuard>} />
          <Route path="/manager" element={<StaffGuard><AdminPage /></StaffGuard>} />
          {/* the promoters screen is a section of the admin workspace: same sign-in (admins and managers) */}
          {/* promoters check their own orders here (mobile + code, no account) */}
          <Route path="/promoter" element={<PromoterPage />} />
          {["/promoters", "/promotor", "/promotors"].map((p) => <Route key={p} path={p} element={<Navigate to="/manager#promoters" replace />} />)}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </main>
      {!bare && <Footer />}
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <LangProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Layout />
        </BrowserRouter>
      </LangProvider>
    </StoreProvider>
  );
}
