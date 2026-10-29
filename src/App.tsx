import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { StoreProvider } from "@/store/store";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ToastHost } from "@/components/Toast";
import { ScrollProgress } from "@/components/ScrollProgress";
import { HomePage } from "@/pages/HomePage";
import { OurStoryPage } from "@/pages/OurStoryPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { CartPage } from "@/pages/CartPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { ConfirmationPage } from "@/pages/ConfirmationPage";
import { TrackingPage } from "@/pages/TrackingPage";
import { AccountPage } from "@/pages/AccountPage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import { EventsPage } from "@/pages/EventsPage";
import { BranchesPage } from "@/pages/BranchesPage";
import { PoliciesPage } from "@/pages/PoliciesPage";
import { ContactPage } from "@/pages/ContactPage";
import { LoginPage } from "@/pages/LoginPage";
import { AdminPage } from "@/pages/AdminPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import "@/components/components.css";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [pathname]);
  return null;
}

function Layout() {
  const { pathname } = useLocation();
  const bare = pathname === "/login";
  return (
    <>
      <ScrollProgress />
      {!bare && <Navbar />}
      <main className={bare ? "" : "page-enter"} style={{ paddingTop: bare ? 0 : "var(--nav-h)" }}>
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
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {!bare && <Footer />}
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
