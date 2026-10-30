import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Eye } from "lucide-react";
import { Product } from "@/data/catalog";
import { useStore } from "@/store/store";

export function ProductCard({ product, index = 0, showPrice = true }: { product: Product; index?: number; showPrice?: boolean }) {
  const { addToCart, toast } = useStore();
  const navigate = useNavigate();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];

  const add = () => {
    if (!variant.inStock) return;
    addToCart(product.id, variantId, 1);
    toast(`${product.name} (${variant.label}) added to cart`, "success");
  };

  return (
    <article
      className="pcard reveal"
      style={{ transitionDelay: `${(index % 4) * 80}ms` }}
    >
      <div className="pcard-media" onClick={() => navigate(`/product/${product.id}`)} role="button" tabIndex={0}>
        <img src={product.image} alt={product.name} loading="lazy" />
        <div className="pcard-flags">
          {product.bestseller && <span className="badge badge-gold"><span className="dot" />Bestseller</span>}
          {product.isNew && <span className="badge badge-saffron">New</span>}
          {!variant.inStock && <span className="badge badge-error">Out of stock</span>}
        </div>
        <div className="pcard-quick">
          <button className="nav-icon-btn" aria-label="Quick view" onClick={(e) => { e.stopPropagation(); navigate(`/product/${product.id}`); }}>
            <Eye size={16} />
          </button>
        </div>
        <div className="pcard-name-overlay">
          <h3>{product.name}</h3>
        </div>
      </div>
      <div className="pcard-body">
        <p className="pcard-tagline">{product.tagline}</p>
        <div className="pcard-variants" role="group" aria-label="Choose size">
          {product.variants.map((v) => (
            <button key={v.id}
              className={`pcard-variant ${v.id === variantId ? "selected" : ""}`}
              onClick={() => setVariantId(v.id)}
              disabled={!v.inStock}
              style={!v.inStock ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="pcard-foot">
          {showPrice ? <span className="pcard-price">₹{variant.price}</span> : <span />}
          <button className="btn btn-primary btn-sm" onClick={add} disabled={!variant.inStock}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
    </article>
  );
}
