import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { StoreProvider } from "@/store/store";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ToastHost } from "@/components/Toast";
import { ScrollProgress } from "@/components/ScrollProgress";
import { HomePage } from "@/pages/HomePage";
import "@/components/components.css";
import { BackgroundVideo } from "@/components/BackgroundVideo";
import { useVisitTracking } from "@/hooks/useVisitTracking";
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })));
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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [pathname]);
  return null;
}

function Layout() {
  const { pathname } = useLocation();
  // own full-screen layouts: sign-in, password reset and the delivery partner app
  const bare = pathname === "/login" || pathname.startsWith("/reset-password") || pathname.startsWith("/partner");
  // the homepage brings its own header and footer
  const home = pathname === "/";
  useVisitTracking();
  return (
    <>
      {/* one fixed video behind every screen; it lives here so it keeps playing across page changes */}
      {!bare && <BackgroundVideo dim={!home} />}
      {!home && <ScrollProgress />}
      {!bare && !home && <Navbar />}
      <main className={bare || home ? "" : "page-enter"} style={{ paddingTop: bare || home ? 0 : "var(--nav-h)" }}>
        <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/our-story" element={<OurStoryPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="/tracking/:id" element={<TrackingPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/partner" element={<PartnerPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </main>
      {!bare && !home && <Footer />}
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Layout />
      </BrowserRouter>
    </StoreProvider>
  );
}
