"use client";

import { Repeat, Calendar, Pause, Play, Plus, Pencil } from "lucide-react";
import type { ViewProps } from "./types";

type StandingOrderItem = {
  readonly name: string;
  readonly qty: number;
  readonly price: number;
};

type StandingOrder = {
  readonly id: string;
  readonly name: string;
  readonly frequency: string;
  readonly nextDelivery: string;
  readonly status: "Active" | "Paused";
  readonly items: readonly StandingOrderItem[];
};

const STANDING_ORDERS: readonly StandingOrder[] = [
  {
    id: "SO-001",
    name: "Weekly Essentials",
    frequency: "Weekly",
    nextDelivery: "Mar 28, 2026",
    status: "Active",
    items: [
      { name: "Premium Product A", qty: 12, price: 89.99 },
      { name: "Standard Product E", qty: 24, price: 24.99 },
      { name: "Premium Product C", qty: 6, price: 42.99 },
    ],
  },
  {
    id: "SO-002",
    name: "Monthly Bulk",
    frequency: "Monthly",
    nextDelivery: "Apr 1, 2026",
    status: "Active",
    items: [
      { name: "Premium Product D", qty: 48, price: 119.99 },
      { name: "Premium Product B", qty: 36, price: 64.99 },
      { name: "Standard Product F", qty: 60, price: 34.99 },
      { name: "Standard Product E", qty: 100, price: 24.99 },
    ],
  },
  {
    id: "SO-003",
    name: "Friday Fresh",
    frequency: "Biweekly",
    nextDelivery: "Apr 4, 2026",
    status: "Active",
    items: [
      { name: "Premium Product B", qty: 18, price: 64.99 },
      { name: "Premium Product C", qty: 10, price: 42.99 },
    ],
  },
];

function orderTotal(items: readonly StandingOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.price, 0);
}

function monthlyRevenue(): string {
  const weekly = orderTotal(STANDING_ORDERS[0].items) * 4;
  const monthly = orderTotal(STANDING_ORDERS[1].items);
  const biweekly = orderTotal(STANDING_ORDERS[2].items) * 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(weekly + monthly + biweekly);
}

export function ClientStandingOrdersView({ brand }: ViewProps) {
  return (
    <div className="p-6 bg-cream">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">
            Recurring Orders
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
            Standing Orders
          </h2>
        </div>
        <button
          className="px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-cream border flex items-center gap-1.5"
          style={{ backgroundColor: brand.color, borderColor: brand.color }}
        >
          <Plus className="w-3 h-3" /> Create Standing Order
        </button>
      </div>

      {/* Summary Card */}
      <div className="border border-shell bg-cream p-5 mb-6 flex items-center gap-4">
        <div
          className="w-10 h-10 flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${brand.color}12` }}
        >
          <Repeat className="w-5 h-5" style={{ color: brand.color }} />
        </div>
        <div>
          <p className="font-serif text-sm text-ink">
            <strong>3 active standing orders</strong> generating{" "}
            <strong style={{ color: brand.color }}>{monthlyRevenue()}/month</strong>{" "}
            in recurring revenue
          </p>
          <p className="text-xs text-sand mt-0.5">
            Automatically placed on schedule — no manual reordering needed
          </p>
        </div>
      </div>

      {/* Standing Order Cards */}
      <div className="space-y-4">
        {STANDING_ORDERS.map((order) => {
          const total = orderTotal(order.items);
          return (
            <div key={order.id} className="border border-shell bg-cream">
              {/* Card Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-shell">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${brand.color}10` }}
                  >
                    <Repeat className="w-4 h-4" style={{ color: brand.color }} />
                  </div>
                  <div>
                    <h3 className="font-serif text-sm font-semibold text-ink">
                      {order.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="font-mono text-[10px] text-sand flex items-center gap-1">
                        <Repeat className="w-3 h-3" /> {order.frequency}
                      </span>
                      <span className="font-mono text-[10px] text-sand flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Next: {order.nextDelivery}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="border text-[10px] uppercase tracking-wider px-2 py-0.5 font-mono"
                    style={
                      order.status === "Active"
                        ? {
                            backgroundColor: brand.color,
                            color: "var(--color-cream)",
                            borderColor: brand.color,
                          }
                        : {
                            backgroundColor: "transparent",
                            color: "var(--color-sand)",
                            borderColor: "var(--color-shell)",
                          }
                    }
                  >
                    {order.status}
                  </span>
                  <button className="p-1.5 border border-shell text-sand hover:text-ink hover:border-ink">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button className="p-1.5 border border-shell text-sand hover:text-ink hover:border-ink">
                    {order.status === "Active" ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-shell">
                      <th className="px-5 py-2 text-[10px] tracking-[0.25em] uppercase text-sand font-mono font-normal">
                        Product
                      </th>
                      <th className="px-5 py-2 text-[10px] tracking-[0.25em] uppercase text-sand font-mono font-normal text-right">
                        Qty
                      </th>
                      <th className="px-5 py-2 text-[10px] tracking-[0.25em] uppercase text-sand font-mono font-normal text-right">
                        Unit Price
                      </th>
                      <th className="px-5 py-2 text-[10px] tracking-[0.25em] uppercase text-sand font-mono font-normal text-right">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.name} className="border-b border-shell last:border-b-0">
                        <td className="px-5 py-2.5 font-serif text-sm text-ink">
                          {item.name}
                        </td>
                        <td className="px-5 py-2.5 font-mono text-xs text-ink text-right">
                          {item.qty}
                        </td>
                        <td className="px-5 py-2.5 font-mono text-xs text-sand text-right">
                          ${item.price.toFixed(2)}
                        </td>
                        <td className="px-5 py-2.5 font-mono text-xs font-semibold text-ink text-right">
                          ${(item.qty * item.price).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-shell bg-cream">
                <span className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono">
                  Total per delivery
                </span>
                <span className="font-mono text-sm font-bold text-ink">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
