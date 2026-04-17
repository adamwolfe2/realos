"use client";

import { Plus } from "lucide-react";
import type { ViewProps } from "./types";
import { StatusBadge } from "./utils";

export function ClientOrdersView({ brand, seed }: ViewProps) {
  return (
    <div className="p-6 bg-cream">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Order History</p>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">Your Orders</h2>
        </div>
        <button className="px-4 py-2 font-mono text-[10px] uppercase tracking-wide text-cream border" style={{ backgroundColor: brand.color, borderColor: brand.color }}>
          <Plus className="w-3 h-3 inline mr-1" /> New Order
        </button>
      </div>

      <div className="border border-shell bg-cream overflow-x-auto">
        <div className="grid grid-cols-6 gap-4 px-4 py-2 border-b border-shell min-w-[600px]">
          {["Order", "Date", "Items", "Total", "Status", ""].map((h) => (
            <div key={h || "action"} className="text-ink/50 uppercase tracking-wider text-xs font-mono">{h}</div>
          ))}
        </div>
        {seed.orders.slice(0, 6).map((order) => (
          <div key={order.number} className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-shell/50 hover:bg-white/50 cursor-pointer min-w-[600px]">
            <div className="font-mono text-xs font-semibold" style={{ color: brand.color }}>{order.number}</div>
            <div className="font-mono text-xs text-ink/70">{order.date}</div>
            <div className="font-mono text-xs text-sand">{order.itemCount} items</div>
            <div className="font-mono text-xs font-semibold text-ink">${order.total.toLocaleString()}</div>
            <div><StatusBadge status={order.status} brandColor={brand.color} /></div>
            <div>
              <button className="font-mono text-[10px] text-ink/40 hover:text-ink uppercase">View</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
