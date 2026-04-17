"use client";

import { Plus } from "lucide-react";
import type { ViewProps } from "./types";
import { StatusBadge } from "./utils";

export function AdminClientsView({ brand, seed }: ViewProps) {
  return (
    <div className="p-6 bg-cream">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">CRM</p>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">Client Directory</h2>
        </div>
        <button className="px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-cream border" style={{ backgroundColor: brand.color, borderColor: brand.color }}>
          <Plus className="w-3 h-3 inline mr-1" /> Invite Client
        </button>
      </div>

      <div className="border border-shell bg-cream overflow-x-auto">
        <div className="grid grid-cols-6 gap-4 px-4 py-2 border-b border-shell min-w-[600px]">
          {["Client", "Tier", "Lifetime Spend", "Health", "Orders", "Last Order"].map((h) => (
            <div key={h} className="text-ink/50 uppercase tracking-wider text-xs font-mono">{h}</div>
          ))}
        </div>
        {seed.clients.map((client) => (
          <div key={client.name} className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-shell/50 hover:bg-white/50 cursor-pointer min-w-[600px]">
            <div className="font-mono text-xs font-semibold text-ink">{client.name}</div>
            <div><StatusBadge status={client.tier} brandColor={brand.color} /></div>
            <div className="font-mono text-xs font-semibold text-ink">{client.spend}</div>
            <div><StatusBadge status={client.health} brandColor={brand.color} /></div>
            <div className="font-mono text-xs text-sand">{client.orders}</div>
            <div className="font-mono text-xs text-sand">{client.lastOrder}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
