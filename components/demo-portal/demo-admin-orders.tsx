"use client";

import { useState } from "react";
import { Plus, Download } from "lucide-react";
import type { ViewProps } from "./types";
import { StatusBadge } from "./utils";

export function AdminOrdersView({ brand, seed }: ViewProps) {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Processing", "Shipped", "Delivered", "Pending"];
  const filtered = filter === "All" ? seed.orders : seed.orders.filter((o) => o.status === filter);

  return (
    <div className="p-6 bg-cream">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Management</p>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">Order Management</h2>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 font-mono text-[10px] uppercase tracking-wide border border-shell text-sand hover:border-ink hover:text-ink flex items-center gap-1">
            <Download className="w-3 h-3" /> Export CSV
          </button>
          <button className="px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-cream border" style={{ backgroundColor: brand.color, borderColor: brand.color }}>
            <Plus className="w-3 h-3 inline mr-1" /> New Order
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide border transition-colors"
            style={
              filter === f
                ? { backgroundColor: "#0A0A0A", color: "var(--color-cream)", borderColor: "#0A0A0A" }
                : { backgroundColor: "transparent", borderColor: "var(--color-shell)", color: "#C8C0B4" }
            }
          >
            {f} {f === "All" ? `(${seed.orders.length})` : `(${seed.orders.filter((o) => o.status === f).length})`}
          </button>
        ))}
      </div>

      <div className="border border-shell bg-cream overflow-x-auto">
        <div className="grid grid-cols-6 gap-4 px-4 py-2 border-b border-shell min-w-[600px]">
          {["Order", "Client", "Items", "Total", "Status", "Date"].map((h) => (
            <div key={h} className="text-ink/50 uppercase tracking-wider text-xs font-mono">{h}</div>
          ))}
        </div>
        {filtered.map((order) => (
          <div key={order.number} className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-shell/50 hover:bg-white/50 cursor-pointer min-w-[600px]">
            <div className="font-mono text-xs font-semibold" style={{ color: brand.color }}>{order.number}</div>
            <div className="font-mono text-xs text-ink">{order.client}</div>
            <div className="font-mono text-xs text-sand">{order.itemCount} items</div>
            <div className="font-mono text-xs font-semibold text-ink">${order.total.toLocaleString()}</div>
            <div><StatusBadge status={order.status} brandColor={brand.color} /></div>
            <div className="font-mono text-xs text-sand">{order.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
