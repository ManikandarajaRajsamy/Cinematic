import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Minus, Check, ShoppingBag, Repeat } from "lucide-react";
import { useStore, productById } from "@/store/store";
import { ProductCard } from "@/components/ProductCard";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const product = productById(id || "");
  const navigate = useNavigate();
  const { products, productsLoading, addToCart, toast } = useStore();
  const [variantId, setVariantId] = useState(product?.variants[0].id ?? "");
  const [qty, setQty] = useState(1);
  const [subscribe, setSubscribe] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  if (!product && productsLoading) {
    return <section className="section" style={{ paddingTop: "var(--sp-32)", minHeight: "70vh" }} aria-busy="true" />;
  }
  if (!product) {
    return (
      <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
        <div className="container text-center">
          <h1 className="display-3">Product not found</h1>
          <Link to="/products" className="btn btn-primary mt-6">Back to menu</Link>
        </div>
      </section>
    );
  }

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const gallery = product.gallery.length > 1 ? product.gallery : [product.image, ...product.gallery];
  const related = products.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 4);
  const subPrice = Math.round(variant.price * 0.85);

  const handleAdd = () => {
    if (!variant.inStock) return;
    addToCart(product.id, variantId, qty, subscribe);
    toast(`${qty} × ${product.name} added to cart${subscribe ? " (subscription)" : ""}`, "success");
  };

  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container">
        <button className="btn btn-text btn-sm mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="pdp-grid">
          <div className="pdp-gallery">
            <div className="pdp-main-img">
              <img src={gallery[activeImg]} alt={product.name} />
              <div className="pdp-flags">
                {product.bestseller && <span className="badge badge-gold"><span className="dot" />Bestseller</span>}
                {product.isNew && <span className="badge badge-saffron">New</span>}
              </div>
            </div>
            {gallery.length > 1 && (
              <div className="pdp-thumbs">
                {gallery.map((g, i) => (
                  <button key={i} className={`pdp-thumb ${i === activeImg ? "active" : ""}`} onClick={() => setActiveImg(i)}>
                    <img src={g} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pdp-info">
            <span className="eyebrow">{product.tags.join(" · ")}</span>
            <h1 className="display-3 mt-4">{product.name}</h1>
            <p className="lead mt-2" style={{ fontSize: "1.1rem" }}>{product.tagline}</p>
            <div className="pdp-price-row">
              <span className="price" style={{ fontSize: "2.5rem" }}>₹{variant.price}</span>
              {!variant.inStock && <span className="badge badge-error">Out of stock</span>}
            </div>

            <div className="pdp-section">
              <span className="label">Choose size</span>
              <div className="pcard-variants">
                {product.variants.map((v) => (
                  <button key={v.id} className={`pcard-variant ${v.id === variantId ? "selected" : ""}`}
                    onClick={() => setVariantId(v.id)} disabled={!v.inStock}
                    style={!v.inStock ? { opacity: 0.35, cursor: "not-allowed" } : undefined}>
                    {v.label}{!v.inStock && " · Sold out"}
                  </button>
                ))}
              </div>
            </div>

            <div className="pdp-section">
              <span className="label">Quantity</span>
              <div className="qty-wrap">
                <div className="qty">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Decrease"><Minus size={14} /></button>
                  <span>{qty}</span>
                  <button onClick={() => setQty(qty + 1)} aria-label="Increase"><Plus size={14} /></button>
                </div>
              </div>
            </div>

            <div className="pdp-sub-toggle">
              <button className={`sub-option ${subscribe ? "active" : ""}`} onClick={() => setSubscribe(!subscribe)}>
                <Repeat size={16} />
                <div>
                  <strong>Subscribe &amp; save 15%</strong>
                  <span>{subscribe ? `₹${subPrice} per unit with subscription discount` : "Add as a subscription to get 15% off at checkout"}</span>
                </div>
                <div className="sub-check">{subscribe && <Check size={16} />}</div>
              </button>
            </div>

            <div className="pdp-actions">
              <button className="btn btn-primary btn-lg" onClick={handleAdd} disabled={!variant.inStock}>
                <ShoppingBag size={18} /> Add to cart
              </button>
              <Link to="/cart" className="btn btn-ghost btn-lg">View cart</Link>
            </div>

            <div className="pdp-desc">
              <h3 className="title-md mb-4">About this sweet</h3>
              <p>{product.description}</p>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-24">
            <h2 className="title-xl mb-8">You might also like</h2>
            <div className="pgrid">
              {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          </div>
        )}
      </div>
      <style>{`
        .pdp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-16); align-items: start; }
        .pdp-main-img { position: relative; aspect-ratio: 1; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border); }
        .pdp-main-img img { width: 100%; height: 100%; object-fit: cover; }
        .pdp-flags { position: absolute; top: var(--sp-4); left: var(--sp-4); display: flex; gap: 6px; }
        .pdp-thumbs { display: flex; gap: var(--sp-3); margin-top: var(--sp-3); }
        .pdp-thumb { width: 80px; height: 80px; border-radius: var(--radius-sm); overflow: hidden; border: 2px solid transparent; transition: border-color var(--t-fast); cursor: pointer; }
        .pdp-thumb.active { border-color: var(--accent-gold); }
        .pdp-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .pdp-info { display: flex; flex-direction: column; gap: var(--sp-4); }
        .pdp-price-row { display: flex; align-items: center; gap: var(--sp-4); margin-top: var(--sp-2); }
        .pdp-section { display: flex; flex-direction: column; gap: var(--sp-2); }
        .pdp-sub-toggle { margin-top: var(--sp-2); }
        .sub-option { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-4); width: 100%; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-elevated); text-align: left; transition: all var(--t-fast); cursor: pointer; }
        .sub-option:hover { border-color: var(--border-strong); }
        .sub-option.active { border-color: var(--accent-gold); background: var(--accent-gold-glow); }
        .sub-option div { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .sub-option strong { font-size: var(--font-sm); color: var(--text); }
        .sub-option span { font-size: var(--font-xs); color: var(--text-dim); }
        .sub-check { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; color: var(--accent-gold-bright); }
        .pdp-actions { display: flex; gap: var(--sp-3); flex-wrap: wrap; margin-top: var(--sp-2); }
        .pdp-desc { margin-top: var(--sp-6); padding-top: var(--sp-6); border-top: 1px solid var(--border); }
        .pdp-desc p { line-height: 1.8; }
        @media (max-width: 800px) { .pdp-grid { grid-template-columns: 1fr; gap: var(--sp-8); } }
      `}</style>
    </section>
  );
}
