"use client";

import { Plus, Edit } from "lucide-react";
import type { ViewProps } from "./types";
import { ProductImage } from "./utils";

export function AdminProductsView({ brand, data }: ViewProps) {
  return (
    <div className="p-6 bg-cream">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Catalog</p>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">Product Management</h2>
        </div>
        <button className="px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-cream border" style={{ backgroundColor: brand.color, borderColor: brand.color }}>
          <Plus className="w-3 h-3 inline mr-1" /> Add Product
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.products.map((p, i) => {
          const stockLevel = [24, 8, 156, 89, 203, 67, 45, 31, 120, 15, 78, 92][i % 12];
          return (
            <div key={`${p.name}-${i}`} className="border border-shell bg-cream hover:border-sand transition-colors">
              <ProductImage product={p} brandColor={brand.color} size="lg" />
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono">{p.category}</div>
                    <div className="font-serif text-sm text-ink mt-0.5">{p.name}</div>
                  </div>
                  <button className="p-1.5 border border-shell text-sand hover:text-ink hover:border-ink">
                    <Edit className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-mono text-xs font-semibold text-ink">{p.price}{p.unit ? `/${p.unit}` : ""}</span>
                  <span className="font-mono text-[10px] text-sand flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 ${stockLevel > 20 ? "bg-green-500" : stockLevel > 5 ? "bg-amber-400" : "bg-red-400"}`} />
                    {stockLevel} in stock
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Product CTA card */}
        <div className="border border-dashed border-shell bg-cream flex items-center justify-center min-h-[200px] cursor-pointer hover:border-sand transition-colors">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 flex items-center justify-center border border-shell">
              <Plus className="w-5 h-5 text-sand" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-sand">Add Product</span>
          </div>
        </div>
      </div>
    </div>
  );
}
