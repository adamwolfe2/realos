"use client";

import { formatCurrency } from "@/lib/utils";
import {
  ShoppingCart,
  FileText,
  Users,
  DollarSign,
  TrendingUp,
  Download,
  Target,
} from "lucide-react";
import type { ViewProps } from "./types";
import { StatusBadge } from "./utils";

export function AdminDashboardView({ brand, data, seed }: ViewProps) {
  const totalRevenue = seed.clients.reduce((s, c) => s + parseInt(c.spend.replace(/[^0-9]/g, ""), 10), 0);
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const monthlyRev = [28, 34, 41, 38, 52, 47, 42, 58, 51, 73, 68, 84];
  const maxRev = Math.max(...monthlyRev);
  const categories = Array.from(new Set(data.products.map((p) => p.category).filter(Boolean)));
  const catRevenues = categories.slice(0, 6).map((_, i) => [42, 28, 18, 12, 8, 5][i] || 5);
  const maxCatRev = Math.max(...catRevenues);

  return (
    <div className="p-3 sm:p-6 bg-cream">
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Executive Overview</p>
          <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-ink">CEO Command Center</h2>
        </div>
        <button className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-shell bg-cream text-ink hover:bg-ink hover:text-cream transition-colors flex-shrink-0">
          <Download className="w-3.5 h-3.5" /> Export Summary
        </button>
      </div>

      {/* 7 KPI Cards */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 mb-4 sm:mb-6">
        {[
          { label: "Total Revenue", value: `$${(totalRevenue / 1000).toFixed(0)}K`, sub: "Cumulative all-time", icon: DollarSign },
          { label: "YTD Revenue", value: "$61.2K", sub: "+18% vs last year", icon: TrendingUp, change: "+18%" },
          { label: "Revenue (Feb)", value: "$17.4K", sub: "+23% vs Jan", icon: DollarSign, change: "+23%" },
          { label: "Outstanding AR", value: formatCurrency(seed.invoices.filter((i) => i.status !== "Paid").reduce((s, i) => s + i.amount, 0)), sub: `${seed.invoices.filter((i) => i.status === "Overdue").length} overdue`, icon: FileText },
          { label: "Active Clients", value: seed.clients.length.toString(), sub: "+3 this month", icon: Users, change: "+3" },
          { label: "Orders (Feb)", value: "37", sub: "+15% vs Jan", icon: ShoppingCart, change: "+15%" },
          { label: "30-Day Forecast", value: "$19.8K", sub: "Based on pipeline", icon: Target },
        ].map((kpi) => (
          <div key={kpi.label} className="border border-shell bg-cream p-2.5 sm:p-4">
            <div className="flex items-center justify-between pb-1.5 sm:pb-2">
              <span className="text-[8px] sm:text-[9px] font-medium text-ink/50 uppercase tracking-wider leading-tight">{kpi.label}</span>
              <kpi.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" style={{ color: `${brand.color}60` }} />
            </div>
            <div className="text-lg sm:text-2xl md:text-3xl font-bold font-serif leading-tight" style={{ color: brand.color }}>{kpi.value}</div>
            <p className="text-[9px] sm:text-[10px] text-ink/40 mt-1 leading-tight">
              {kpi.change && <span className="text-emerald-600 font-medium">{kpi.change} </span>}
              {kpi.sub}
            </p>
          </div>
        ))}
      </div>

      {/* NRR Card */}
      <div className="border border-shell bg-cream p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[9px] font-medium text-ink/50 uppercase tracking-wider">Net Revenue Retention</span>
            <div className="text-3xl font-bold font-serif text-emerald-600 mt-1">108%</div>
            <p className="text-[10px] text-ink/40 mt-0.5">Expansion outpacing churn — healthy growth</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink/50">Expansion: <span className="font-semibold text-emerald-600">+$8.2K</span></div>
            <div className="text-xs text-ink/50">Contraction: <span className="font-semibold text-red-500">-$1.4K</span></div>
            <div className="text-xs text-ink/50">Churned: <span className="font-semibold text-red-500">-$0.6K</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Revenue Trend */}
        <div className="border border-shell bg-cream p-5">
          <span className="text-xs font-medium text-ink/50 uppercase tracking-wider">Revenue Trend (12 Months)</span>
          <div className="flex items-end gap-1.5 h-36 mt-4">
            {months.map((m, i) => (
              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                <div className="font-mono text-[8px] font-semibold text-ink">${monthlyRev[i]}K</div>
                <div
                  className="w-full transition-all"
                  style={{
                    height: `${(monthlyRev[i] / maxRev) * 110}px`,
                    backgroundColor: i >= months.length - 3 ? brand.color : "#C8C0B4",
                    opacity: i === months.length - 1 ? 1 : i >= months.length - 3 ? 0.6 : 0.3,
                  }}
                />
                <div className="font-mono text-[8px] text-sand">{m}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Category */}
        <div className="border border-shell bg-cream p-5">
          <span className="text-xs font-medium text-ink/50 uppercase tracking-wider">Revenue by Category</span>
          <div className="space-y-3 mt-4">
            {categories.slice(0, 6).map((cat, i) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs text-ink w-28 truncate font-medium">{cat}</span>
                <div className="flex-1 h-6 bg-shell/40 overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${(catRevenues[i] / maxCatRev) * 100}%`,
                      backgroundColor: brand.color,
                      opacity: [1, 0.8, 0.65, 0.5, 0.4, 0.3][i],
                    }}
                  />
                </div>
                <span className="font-mono text-xs font-bold text-ink w-12 text-right">${catRevenues[i]}K</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Clients */}
        <div className="border border-shell bg-cream">
          <div className="px-4 py-3 border-b border-shell flex items-center justify-between">
            <span className="text-xs font-medium text-ink/50 uppercase tracking-wider">Top Clients by Revenue</span>
            <button className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono hover:text-ink">View All</button>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {seed.clients.slice(0, 5).map((client, i) => (
                <tr key={client.name} className="border-b border-shell last:border-0 hover:bg-ink/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-sand w-6">{i + 1}</td>
                  <td className="py-3 font-medium text-ink">{client.name}</td>
                  <td className="py-3"><StatusBadge status={client.tier} brandColor={brand.color} /></td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-ink">{client.spend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Orders */}
        <div className="border border-shell bg-cream">
          <div className="px-4 py-3 border-b border-shell flex items-center justify-between">
            <span className="text-xs font-medium text-ink/50 uppercase tracking-wider">Recent Orders</span>
            <button className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono hover:text-ink">View All</button>
          </div>
          {seed.orders.slice(0, 5).map((order) => (
            <div key={order.number} className="px-4 py-3 border-b border-shell last:border-0 hover:bg-ink/[0.02] transition-colors flex items-center justify-between">
              <div>
                <div className="font-mono text-xs font-semibold text-ink">{order.number}</div>
                <div className="font-mono text-[10px] text-sand">{order.client} · {order.date}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-ink">${order.total.toLocaleString()}</span>
                <StatusBadge status={order.status} brandColor={brand.color} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
