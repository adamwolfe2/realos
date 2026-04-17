"use client";

import {
  ShoppingCart,
  Plus,
  DollarSign,
  TrendingUp,
  Star,
  Heart,
  Minus,
} from "lucide-react";
import type { ViewProps } from "./types";
import { getIndustryContext, StatusBadge } from "./utils";

export function ClientDashboardView({ brand, data, seed, onNavigate }: ViewProps) {
  const ctx = getIndustryContext(data.industry);
  const top4Products = data.products.slice(0, 4);
  const recentOrders = seed.orders.slice(0, 4);
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const spending = [2800, 4100, 3200, 5600, 4800, 6200];
  const maxSpend = Math.max(...spending);
  const creditUsed = 4200;
  const creditLimit = 10000;
  const creditPct = Math.round((creditUsed / creditLimit) * 100);

  return (
    <div className="p-6 bg-cream">
      {/* Welcome header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">Welcome back{ctx.greeting ? `, ${ctx.greeting} ${ctx.personName.split(" ")[0]}` : `, ${ctx.personName.split(" ")[0]}`}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-ink/50">{seed.clients[0]?.name || "Restaurant"}</span>
            <span className="border border-amber-300 bg-amber-100 text-amber-800 px-2 py-0.5 text-[9px] uppercase tracking-wider font-medium">Bronze</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-cream flex items-center gap-1" style={{ backgroundColor: brand.color }}>
            <Star className="w-3 h-3" /> 4,280 Points
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Spend", value: "$26.8K", icon: DollarSign },
          { label: "Total Orders", value: "42", icon: ShoppingCart },
          { label: "Avg Order Value", value: "$638", icon: TrendingUp },
          { label: "Loyalty Points", value: "4,280", icon: Heart },
        ].map((kpi) => (
          <div key={kpi.label} className="border border-shell bg-cream p-4">
            <div className="flex items-center justify-between pb-2">
              <kpi.icon className="w-4 h-4" style={{ color: `${brand.color}60` }} strokeWidth={1.5} />
            </div>
            <div className="text-2xl font-bold font-serif" style={{ color: brand.color }}>{kpi.value}</div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Credit Utilization */}
      <div className="border border-shell bg-cream p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-ink/50 uppercase tracking-wider">Credit Utilization</span>
          <span className="font-mono text-xs text-ink">${creditUsed.toLocaleString()} / ${creditLimit.toLocaleString()}</span>
        </div>
        <div className="h-1.5 bg-shell overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${creditPct}%`, backgroundColor: creditPct > 80 ? "#EF4444" : creditPct > 60 ? "#F59E0B" : brand.color }} />
        </div>
        <p className="text-[10px] text-sand mt-1">{creditPct}% utilized · Net 30 terms</p>
      </div>

      {/* Quick Reorder */}
      {top4Products.length > 0 && (
        <div className="border border-shell bg-cream mb-6">
          <div className="px-4 py-3 border-b border-shell flex items-center justify-between">
            <span className="text-xs font-medium text-ink/50 uppercase tracking-wider">Quick Reorder</span>
            <span className="text-[10px] text-sand">Your Favorites</span>
          </div>
          <div className="p-4 flex gap-3 overflow-x-auto pb-1">
            {top4Products.map((p, i) => (
              <div key={`${p.name}-${i}`} className="border border-shell bg-cream p-4 min-w-[180px] flex-shrink-0 flex flex-col gap-3">
                <div>
                  <p className="font-medium text-sm text-ink leading-snug">{p.name}</p>
                  <p className="text-xs text-ink/40 mt-0.5">Last ordered {3 + i}d ago</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="h-9 w-9 border border-sand text-ink flex items-center justify-center hover:bg-sand/20 transition-colors">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-semibold text-ink w-6 text-center">{2 + i}</span>
                  <button className="h-9 w-9 border border-sand text-ink flex items-center justify-center hover:bg-sand/20 transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <button className="text-cream text-xs min-h-[36px] font-medium transition-opacity hover:opacity-85" style={{ backgroundColor: brand.color }}>
                  Add to Order
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <div className="border border-shell bg-cream">
          <div className="px-4 py-3 border-b border-shell flex items-center justify-between">
            <span className="text-xs font-medium text-ink/50 uppercase tracking-wider">Recent Orders</span>
            <button className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono hover:text-ink">View All</button>
          </div>
          {recentOrders.map((order) => (
            <div key={order.number} className="px-4 py-3 border-b border-shell last:border-0 hover:bg-ink/[0.02] transition-colors flex items-center justify-between">
              <div>
                <div className="font-mono text-xs font-semibold text-ink">{order.number}</div>
                <div className="text-[10px] text-sand">{order.date} · {order.itemCount} items</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-ink">${order.total.toLocaleString()}</span>
                <StatusBadge status={order.status} brandColor={brand.color} />
              </div>
            </div>
          ))}
        </div>

        {/* Monthly Spending */}
        <div className="border border-shell bg-cream p-4">
          <span className="text-xs font-medium text-ink/50 uppercase tracking-wider block mb-4">Monthly Spending</span>
          <div className="space-y-2">
            {months.map((m, i) => (
              <div key={m} className="flex items-center gap-3">
                <div className="w-8 text-xs font-medium text-ink/50">{m}</div>
                <div className="flex-1 h-7 bg-sand/20 overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${(spending[i] / maxSpend) * 100}%`, backgroundColor: brand.color }}
                  />
                </div>
                <div className="w-14 text-xs font-semibold text-right text-ink">
                  ${(spending[i] / 1000).toFixed(1)}k
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
