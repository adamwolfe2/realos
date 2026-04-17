"use client";

import {
  ShoppingCart,
  Users,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import type { ViewProps } from "./types";
import { StatusBadge } from "./utils";

export function AdminAnalyticsView({ brand, data, seed }: ViewProps) {
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const revenues = [42, 58, 51, 73, 68, 84];
  const maxRev = Math.max(...revenues);
  const categories = Array.from(new Set(data.products.map((p) => p.category).filter(Boolean)));

  return (
    <div className="p-6 bg-cream">
      <div className="mb-6">
        <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Intelligence</p>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">Business Analytics</h2>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Revenue (Feb)", value: "$84,230", change: "+23%", icon: DollarSign },
          { label: "Orders (Feb)", value: "127", change: "+15%", icon: ShoppingCart },
          { label: "Active Clients", value: "89", change: "+8", icon: Users },
          { label: "Avg Order Value", value: "$663", change: "+12%", icon: TrendingUp },
        ].map((kpi) => (
          <div key={kpi.label} className="border border-shell bg-cream p-4">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[9px] font-medium text-ink/50 uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className="h-3.5 w-3.5" style={{ color: `${brand.color}60` }} strokeWidth={1.5} />
            </div>
            <div className="text-2xl font-bold font-serif" style={{ color: brand.color }}>{kpi.value}</div>
            <p className="text-[10px] text-emerald-600 font-medium mt-1">{kpi.change} vs last month</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="border border-shell bg-cream p-6 mb-6">
        <span className="text-xs font-medium text-ink/50 uppercase tracking-wider">Monthly Revenue</span>
        <div className="flex items-end gap-1.5 h-40 mt-4">
          {months.map((m, i) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-1">
              <div className="font-mono text-[8px] font-semibold text-ink">${revenues[i]}K</div>
              <div
                className="w-full transition-all"
                style={{
                  height: `${(revenues[i] / maxRev) * 120}px`,
                  backgroundColor: i >= months.length - 3 ? brand.color : "#C8C0B4",
                  opacity: i === months.length - 1 ? 1 : i >= months.length - 3 ? 0.6 : 0.3,
                }}
              />
              <div className="font-mono text-[8px] text-sand">{m}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top clients */}
        <div className="border border-shell bg-cream">
          <div className="px-4 py-3 border-b border-shell">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold text-ink">Top Clients by Revenue</span>
          </div>
          {seed.clients.slice(0, 5).map((client, i) => (
            <div key={client.name} className="px-4 py-3 border-b border-shell/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-sand w-4">{i + 1}.</span>
                <span className="font-mono text-xs font-semibold text-ink">{client.name}</span>
                <StatusBadge status={client.tier} brandColor={brand.color} />
              </div>
              <span className="font-mono text-xs font-semibold text-ink">{client.spend}</span>
            </div>
          ))}
        </div>

        {/* Category breakdown */}
        <div className="border border-shell bg-cream p-4">
          <span className="font-mono text-xs uppercase tracking-wider font-semibold text-ink block mb-4">Category Breakdown</span>
          <div className="space-y-3">
            {categories.slice(0, 6).map((cat, i) => {
              const count = data.products.filter((p) => p.category === cat).length;
              const pct = Math.round((count / data.products.length) * 100);
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-ink w-28 truncate">{cat}</span>
                  <div className="flex-1 h-2 bg-shell">
                    <div className="h-full" style={{ width: `${pct}%`, backgroundColor: i === 0 ? brand.color : `${brand.color}${60 - i * 10}` }} />
                  </div>
                  <span className="font-mono text-[10px] text-sand w-10 text-right">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
