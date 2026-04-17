"use client";

import { Tag, Percent, Calendar, DollarSign } from "lucide-react";
import type { ViewProps } from "./types";

type VolumeTier = {
  readonly product: string;
  readonly tier1: string;
  readonly tier2: string;
  readonly tier3: string;
};

type ClientPricing = {
  readonly client: string;
  readonly discount: number;
  readonly tier: string;
  readonly customProducts: number;
};

type Promotion = {
  readonly name: string;
  readonly discount: string;
  readonly dateRange: string;
  readonly status: string;
};

const VOLUME_BREAKS: readonly VolumeTier[] = [
  { product: "Premium Product A", tier1: "$89.99", tier2: "$79.99", tier3: "$69.99" },
  { product: "Premium Product B", tier1: "$64.99", tier2: "$57.99", tier3: "$49.99" },
  { product: "Premium Product C", tier1: "$42.99", tier2: "$38.49", tier3: "$33.99" },
  { product: "Premium Product D", tier1: "$119.99", tier2: "$104.99", tier3: "$94.99" },
  { product: "Standard Product E", tier1: "$24.99", tier2: "$21.99", tier3: "$18.99" },
];

const CLIENT_PRICING: readonly ClientPricing[] = [
  { client: "The Grand Hotel", discount: 15, tier: "VIP", customProducts: 8 },
  { client: "Bistro Napa", discount: 12, tier: "VIP", customProducts: 5 },
  { client: "Pacific Grill", discount: 8, tier: "REPEAT", customProducts: 3 },
  { client: "Harbor Kitchen", discount: 5, tier: "NEW", customProducts: 0 },
];

const PROMOTIONS: readonly Promotion[] = [
  {
    name: "Spring Launch Special",
    discount: "20% off Premium line",
    dateRange: "Mar 15 — Apr 15, 2026",
    status: "Active",
  },
  {
    name: "Bulk Buyer Bonus",
    discount: "Extra 5% on 100+ units",
    dateRange: "Mar 1 — May 31, 2026",
    status: "Active",
  },
];

export function AdminPricingView({ brand }: ViewProps) {
  return (
    <div className="p-6 bg-cream">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">
          Revenue Optimization
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
          Pricing Rules
        </h2>
      </div>

      {/* Volume Breaks Section */}
      <div className="border border-shell bg-cream mb-6">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-shell">
          <div
            className="w-8 h-8 flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${brand.color}12` }}
          >
            <Tag className="w-4 h-4" style={{ color: brand.color }} />
          </div>
          <div>
            <h3 className="font-serif text-sm font-semibold text-ink">
              Volume Breaks
            </h3>
            <p className="text-xs text-sand">
              Automatic price tiers based on order quantity
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-shell">
                <th className="px-5 py-2.5 text-[10px] tracking-[0.25em] uppercase text-sand font-mono font-normal">
                  Product
                </th>
                <th className="px-5 py-2.5 text-[10px] tracking-[0.25em] uppercase text-sand font-mono font-normal text-right">
                  1-10 Units
                </th>
                <th className="px-5 py-2.5 text-[10px] tracking-[0.25em] uppercase text-sand font-mono font-normal text-right">
                  11-50 Units
                </th>
                <th className="px-5 py-2.5 text-[10px] tracking-[0.25em] uppercase text-sand font-mono font-normal text-right">
                  50+ Units
                </th>
              </tr>
            </thead>
            <tbody>
              {VOLUME_BREAKS.map((row) => (
                <tr key={row.product} className="border-b border-shell last:border-b-0">
                  <td className="px-5 py-3 font-serif text-sm text-ink">
                    {row.product}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink text-right">
                    {row.tier1}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-right" style={{ color: brand.color }}>
                    {row.tier2}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-right" style={{ color: brand.color }}>
                    {row.tier3}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer-Specific Pricing Section */}
      <div className="border border-shell bg-cream mb-6">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-shell">
          <div
            className="w-8 h-8 flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${brand.color}12` }}
          >
            <Percent className="w-4 h-4" style={{ color: brand.color }} />
          </div>
          <div>
            <h3 className="font-serif text-sm font-semibold text-ink">
              Customer-Specific Pricing
            </h3>
            <p className="text-xs text-sand">
              Custom discount rates and product pricing by client
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-shell">
                <th className="px-5 py-2.5 text-[10px] tracking-[0.25em] uppercase text-sand font-mono font-normal">
                  Client
                </th>
                <th className="px-5 py-2.5 text-[10px] tracking-[0.25em] uppercase text-sand font-mono font-normal text-right">
                  Discount
                </th>
                <th className="px-5 py-2.5 text-[10px] tracking-[0.25em] uppercase text-sand font-mono font-normal text-center">
                  Tier
                </th>
                <th className="px-5 py-2.5 text-[10px] tracking-[0.25em] uppercase text-sand font-mono font-normal text-right">
                  Custom Products
                </th>
              </tr>
            </thead>
            <tbody>
              {CLIENT_PRICING.map((row) => (
                <tr key={row.client} className="border-b border-shell last:border-b-0">
                  <td className="px-5 py-3 font-serif text-sm text-ink">
                    {row.client}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-right" style={{ color: brand.color }}>
                    {row.discount}%
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className="border text-[10px] uppercase tracking-wider px-2 py-0.5 font-mono"
                      style={
                        row.tier === "VIP"
                          ? { backgroundColor: brand.color, color: "var(--color-cream)", borderColor: brand.color }
                          : row.tier === "REPEAT"
                            ? { backgroundColor: `${brand.color}18`, color: brand.color, borderColor: `${brand.color}30` }
                            : { backgroundColor: "transparent", color: "var(--color-sand)", borderColor: "var(--color-shell)" }
                      }
                    >
                      {row.tier}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink text-right">
                    {row.customProducts > 0 ? row.customProducts : "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seasonal Promotions Section */}
      <div className="border border-shell bg-cream">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-shell">
          <div
            className="w-8 h-8 flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${brand.color}12` }}
          >
            <DollarSign className="w-4 h-4" style={{ color: brand.color }} />
          </div>
          <div>
            <h3 className="font-serif text-sm font-semibold text-ink">
              Seasonal Promotions
            </h3>
            <p className="text-xs text-sand">
              Time-limited discounts and offers
            </p>
          </div>
        </div>
        <div className="divide-y divide-shell">
          {PROMOTIONS.map((promo) => (
            <div key={promo.name} className="flex items-center justify-between px-5 py-4">
              <div>
                <h4 className="font-serif text-sm font-semibold text-ink">
                  {promo.name}
                </h4>
                <p className="text-xs text-sand mt-0.5">{promo.discount}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-sand flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {promo.dateRange}
                </span>
                <span
                  className="border text-[10px] uppercase tracking-wider px-2 py-0.5 font-mono"
                  style={{ backgroundColor: brand.color, color: "var(--color-cream)", borderColor: brand.color }}
                >
                  {promo.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
