"use client";

import type { ViewProps } from "./types";

export function ClientAnalyticsView({ brand, data }: ViewProps) {
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const spending = [3200, 4800, 3900, 6100, 5400, 7200];
  const maxSpend = Math.max(...spending);
  const topProducts = data.products.slice(0, 5);
  const orderFreqs = [12, 10, 8, 6, 4];

  return (
    <div className="p-6 bg-cream">
      <div className="mb-6">
        <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Insights</p>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">Your Analytics</h2>
      </div>

      {/* Monthly Spending */}
      <div className="border border-shell bg-cream p-6 mb-6">
        <div className="font-mono text-xs uppercase tracking-wider font-semibold text-ink mb-4">Monthly Spending</div>
        <div className="flex items-end gap-3 h-40">
          {months.map((m, i) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-1">
              <div className="font-mono text-[9px] font-semibold text-ink">${(spending[i] / 1000).toFixed(1)}K</div>
              <div
                className="w-full transition-all"
                style={{
                  height: `${(spending[i] / maxSpend) * 120}px`,
                  backgroundColor: i === months.length - 1 ? brand.color : `${brand.color}30`,
                }}
              />
              <div className="font-mono text-[9px] text-sand">{m}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="border border-shell bg-cream">
          <div className="px-4 py-3 border-b border-shell">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold text-ink">Top Products by Frequency</span>
          </div>
          {topProducts.map((p, i) => (
            <div key={`${p.name}-${i}`} className="px-4 py-3 border-b border-shell/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-sand w-4">{i + 1}.</span>
                <span className="font-serif text-xs text-ink">{p.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-shell">
                  <div className="h-full" style={{ width: `${(orderFreqs[i] / orderFreqs[0]) * 100}%`, backgroundColor: brand.color }} />
                </div>
                <span className="font-mono text-[10px] text-sand">{orderFreqs[i]} orders</span>
              </div>
            </div>
          ))}
        </div>

        {/* Order Frequency */}
        <div className="border border-shell bg-cream p-4">
          <span className="font-mono text-xs uppercase tracking-wider font-semibold text-ink block mb-4">Order Frequency Trend</span>
          <div className="space-y-3">
            {months.map((m, i) => {
              const count = [4, 6, 5, 8, 7, 9][i];
              return (
                <div key={m} className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-sand w-8">{m}</span>
                  <div className="flex-1 h-2 bg-shell">
                    <div className="h-full" style={{ width: `${(count / 9) * 100}%`, backgroundColor: i === months.length - 1 ? brand.color : `${brand.color}50` }} />
                  </div>
                  <span className="font-mono text-[10px] text-ink w-4 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
