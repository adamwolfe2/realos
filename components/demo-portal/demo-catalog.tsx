"use client";

import { useState } from "react";
import {
  ShoppingCart,
  Search,
  CheckCircle2,
  Package,
  Snowflake,
  CreditCard,
} from "lucide-react";
import type { ViewProps, ScrapeData } from "./types";

export function CatalogView({ brand, data, cart, onAddToCart, onOpenCart }: ViewProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  const categories = ["All", ...Array.from(new Set(data.products.map((p) => p.category).filter(Boolean)))];

  const filtered = data.products.filter((p) => {
    const matchesSearch = search === "" || p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === "All" || p.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const handleAdd = (p: ScrapeData["products"][0]) => {
    onAddToCart?.(p);
    setAddedItems((prev) => new Set(prev).add(p.name));
    setTimeout(() => setAddedItems((prev) => { const n = new Set(prev); n.delete(p.name); return n; }), 1500);
  };

  const cartCount = cart?.reduce((s, c) => s + c.quantity, 0) || 0;
  const stockLevels = [24, 8, 156, 89, 203, 67, 45, 3, 120, 15, 78, 92];

  return (
    <div className="bg-cream">
      {/* Catalog Hero */}
      <div className="px-6 sm:px-10 pt-8 pb-6 border-b border-shell">
        <p className="text-[10px] tracking-[0.25em] uppercase text-sand mb-3">Wholesale Catalog</p>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.05] text-ink">
          The Full Catalog.
        </h1>
      </div>

      {/* Filter bar */}
      <div className="px-6 sm:px-10 py-4 border-b border-shell flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-nowrap overflow-x-auto gap-1.5 pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="text-[11px] tracking-wide border px-4 py-2 transition-all whitespace-nowrap"
              style={
                activeCategory === cat
                  ? { backgroundColor: "#0A0A0A", color: "var(--color-cream)", borderColor: "#0A0A0A" }
                  : { backgroundColor: "transparent", borderColor: "var(--color-shell)", color: "#0A0A0A" }
              }
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink/40">
            <span className="font-medium text-ink/70">{filtered.length}</span> products
          </span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sand" />
            <input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
              className="border border-shell bg-white pl-9 pr-4 py-2 text-xs w-40 focus:outline-none focus:border-ink"
            />
          </div>
          {cartCount > 0 && (
            <button
              onClick={() => onOpenCart?.()}
              className="relative h-9 px-4 text-xs font-medium text-cream flex items-center gap-2"
              style={{ backgroundColor: brand.color }}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Cart ({cartCount})
            </button>
          )}
        </div>
      </div>

      {/* Product Grid -- gap-px technique */}
      <div className="mx-6 sm:mx-10 my-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-shell">
        {filtered.map((p, i) => {
          const stock = stockLevels[i % stockLevels.length];
          const isAdded = addedItems.has(p.name);
          return (
            <article key={`${p.name}-${i}`} className="bg-cream flex flex-col group hover:bg-cream-hover transition-colors">
              <div className="flex flex-col flex-1 p-4 sm:p-5">
                <p className="text-[9px] tracking-[0.18em] uppercase text-sand mb-1.5">{p.category}</p>
                <h3 className="font-serif font-bold leading-tight text-sm sm:text-base text-ink mb-2">{p.name}</h3>
                <p className="text-base font-bold text-ink leading-none">
                  {p.price}<span className="text-xs font-normal text-sand">{p.unit ? `/${p.unit}` : ""}</span>
                </p>
                <p className="text-xs text-ink/50 leading-relaxed line-clamp-2 mt-2 mb-auto">{p.description}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {i % 3 === 0 && (
                    <span className="text-[9px] tracking-wide uppercase border border-shell px-1.5 py-0.5 text-sand inline-flex items-center gap-0.5">
                      <Snowflake className="h-2 w-2" /> Cold Chain
                    </span>
                  )}
                  {i % 4 === 0 && (
                    <span className="text-[9px] tracking-wide uppercase border border-shell px-1.5 py-0.5 text-sand inline-flex items-center gap-0.5">
                      <CreditCard className="h-2 w-2" /> Prepay
                    </span>
                  )}
                  {stock <= 8 && (
                    <span className="text-[9px] tracking-wide uppercase border border-amber-300 bg-amber-50 text-amber-700 px-1.5 py-0.5 inline-flex items-center gap-0.5">
                      <span className="h-1.5 w-1.5 bg-amber-500 inline-block" /> Only {stock} left
                    </span>
                  )}
                </div>
                {data.minimumOrder && (
                  <p className="text-[10px] text-sand mt-2 pt-2 border-t border-shell">Min. order: {data.minimumOrder}</p>
                )}
              </div>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 mt-auto">
                <button
                  onClick={() => handleAdd(p)}
                  className="w-full h-9 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                  style={
                    isAdded
                      ? { backgroundColor: brand.color, color: "var(--color-cream)" }
                      : { border: `1px solid ${brand.color}`, color: brand.color }
                  }
                  onMouseEnter={(e) => { if (!isAdded) { e.currentTarget.style.backgroundColor = brand.color; e.currentTarget.style.color = "var(--color-cream)"; } }}
                  onMouseLeave={(e) => { if (!isAdded) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = brand.color; } }}
                >
                  {isAdded ? (
                    <><CheckCircle2 className="h-3 w-3" /> Added</>
                  ) : (
                    <><ShoppingCart className="h-3 w-3" /> Add to Order</>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-8 h-8 text-shell mx-auto mb-3" />
          <p className="text-sm text-sand">No products found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
