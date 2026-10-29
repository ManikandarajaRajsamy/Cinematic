import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X, PackageOpen } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useReveal } from "@/hooks/useReveal";
import { PRODUCTS, CATEGORIES } from "@/data/catalog";

type SortKey = "featured" | "price-asc" | "price-desc" | "name";

export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(params.get("category") || "all");
  const [sort, setSort] = useState<SortKey>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const r = useReveal();

  useEffect(() => {
    const c = params.get("category");
    if (c) setCategory(c);
  }, [params]);

  const filtered = useMemo(() => {
    let list = PRODUCTS.filter((p) =>
      (category === "all" || p.category === category) &&
      (!query || p.name.toLowerCase().includes(query.toLowerCase())) &&
      (!inStockOnly || p.variants.some((v) => v.inStock))
    );
    if (sort === "price-asc") list = [...list].sort((a, b) => a.variants[0].price - b.variants[0].price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.variants[0].price - a.variants[0].price);
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [category, query, sort, inStockOnly]);

  const clearAll = () => { setQuery(""); setCategory("all"); setSort("featured"); setInStockOnly(false); setParams({}); };
  const hasFilters = query || category !== "all" || sort !== "featured" || inStockOnly;

  return (
    <section className="section" style={{ paddingTop: "var(--sp-32)" }}>
      <div className="container">
        <div className="sec-head">
          <span className="eyebrow">The Menu</span>
          <h1 className="display-2">All sweets &amp; snacks</h1>
          <p className="lead">Filter by category, search by name, and sort to find what you're after.</p>
        </div>

        <div className="catalog-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" aria-label="Search products" />
            {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
          </div>
          <div className="tabs">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={`tab ${category === c.id ? "active" : ""}`} onClick={() => { setCategory(c.id); setParams(c.id === "all" ? {} : { category: c.id }); }}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="catalog-controls">
            <label className="filter-toggle">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
              <span>In stock only</span>
            </label>
            <div className="select-wrap">
              <SlidersHorizontal size={14} />
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name">Name: A–Z</option>
              </select>
            </div>
            {hasFilters && <button className="btn btn-text btn-sm" onClick={clearAll}>Clear filters</button>}
          </div>
        </div>

        <div className="catalog-meta">
          <span>{filtered.length} product{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <PackageOpen size={48} />
            <h3>No products found</h3>
            <p>Try adjusting your filters or search term.</p>
            <button className="btn btn-ghost" onClick={clearAll}>Clear all filters</button>
          </div>
        ) : (
          <div className={`pgrid reveal-stagger ${r.inView ? "in" : ""}`} ref={r.ref as React.RefObject<HTMLDivElement>}>
            {filtered.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        )}
      </div>
      <style>{`
        .catalog-toolbar { display: flex; flex-direction: column; gap: var(--sp-4); margin-bottom: var(--sp-6); }
        .search-field { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--border); border-radius: var(--radius-pill); background: var(--bg-elevated); max-width: 420px; }
        .search-field input { flex: 1; background: none; border: none; color: var(--text); }
        .search-field button { color: var(--text-dim); }
        .catalog-controls { display: flex; align-items: center; gap: var(--sp-4); flex-wrap: wrap; }
        .filter-toggle { display: inline-flex; align-items: center; gap: 8px; font-size: var(--font-sm); color: var(--text-muted); cursor: pointer; }
        .filter-toggle input { width: 16px; height: 16px; accent-color: var(--accent-gold); }
        .select-wrap { display: inline-flex; align-items: center; gap: 6px; }
        .select-wrap .select { padding: var(--sp-2) var(--sp-4); padding-right: 32px; font-size: var(--font-sm); min-width: 180px; }
        .catalog-meta { font-size: var(--font-sm); color: var(--text-dim); margin-bottom: var(--sp-6); }
        .empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-20); text-align: center; color: var(--text-dim); border: 1px dashed var(--border); border-radius: var(--radius-lg); }
        .empty-state svg { color: var(--text-dim); opacity: 0.5; }
        .empty-state h3 { color: var(--text); }
      `}</style>
    </section>
  );
}
