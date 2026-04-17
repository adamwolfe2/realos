"use client";

import { formatCurrency } from "@/lib/utils";
import type { ViewProps } from "./types";
import { StatusBadge } from "./utils";

export function ClientInvoicesView({ brand, seed }: ViewProps) {
  const outstanding = seed.invoices.filter((i) => i.status !== "Paid").reduce((s, i) => s + i.amount, 0);
  const current = seed.invoices.filter((i) => i.status === "Pending").reduce((s, i) => s + i.amount, 0);
  const overdue = seed.invoices.filter((i) => i.status === "Overdue").reduce((s, i) => s + i.amount, 0);
  const paid = seed.invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-6 bg-cream">
      <div className="mb-6">
        <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Billing</p>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">Your Invoices</h2>
      </div>

      {/* Aging summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Outstanding", value: formatCurrency(outstanding), color: "#0A0A0A" },
          { label: "Current", value: formatCurrency(current), color: brand.color },
          { label: "Overdue", value: formatCurrency(overdue), color: "#92400E" },
          { label: "Paid (Feb)", value: formatCurrency(paid), color: "#0A0A0A" },
        ].map((s) => (
          <div key={s.label} className="border border-shell bg-cream p-4">
            <div className="font-mono text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="border border-shell bg-cream overflow-x-auto">
        <div className="grid grid-cols-5 gap-4 px-4 py-2 border-b border-shell min-w-[500px]">
          {["Invoice", "Description", "Amount", "Status", "Due Date"].map((h) => (
            <div key={h} className="text-ink/50 uppercase tracking-wider text-xs font-mono">{h}</div>
          ))}
        </div>
        {seed.invoices.map((inv) => (
          <div key={inv.number} className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-shell/50 hover:bg-white/50 cursor-pointer min-w-[500px]">
            <div className="font-mono text-xs font-semibold" style={{ color: brand.color }}>{inv.number}</div>
            <div className="font-mono text-xs text-ink/70">{inv.client}</div>
            <div className="font-mono text-xs font-semibold text-ink">${inv.amount.toLocaleString()}</div>
            <div><StatusBadge status={inv.status} brandColor={brand.color} /></div>
            <div className="font-mono text-xs text-sand">{inv.due}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
