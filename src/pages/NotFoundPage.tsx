import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)", minHeight: "70vh" }}>
      <div className="container-narrow" style={{ textAlign: "center" }}>
        <span className="eyebrow center">404</span>
        <h1 className="display-2">This page wandered off</h1>
        <p className="lead" style={{ marginInline: "auto", marginTop: 16 }}>The page you're looking for doesn't exist or has moved.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}>
          <Link to="/" className="btn btn-primary"><ArrowLeft size={16} /> Back home</Link>
          <Link to="/products" className="btn btn-ghost">Browse products</Link>
        </div>
      </div>
    </section>
  );
}
