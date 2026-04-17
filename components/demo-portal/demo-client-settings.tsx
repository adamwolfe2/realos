"use client";

import { Edit, Plus } from "lucide-react";
import type { ViewProps } from "./types";
import { getIndustryContext } from "./utils";

export function ClientSettingsView({ brand, data, seed }: ViewProps) {
  const ctx = getIndustryContext(data.industry);
  return (
    <div className="p-6 bg-cream">
      <div className="mb-6">
        <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Account</p>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">Settings</h2>
      </div>

      <div className="space-y-4 max-w-2xl">
        {/* Profile */}
        <div className="border border-shell bg-cream p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono">Profile Information</p>
            <button className="font-mono text-[10px] uppercase tracking-wide text-ink/60 hover:text-ink flex items-center gap-1">
              <Edit className="w-3 h-3" /> Edit
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Name", value: ctx.personName },
              { label: "Company", value: seed.clients[0]?.name || "Business" },
              { label: "Email", value: `thomas@${data.domain}` },
              { label: "Phone", value: "(555) 234-5678" },
              { label: "Account Tier", value: "VIP Partner" },
              { label: "Net Terms", value: "Net 30" },
            ].map((f) => (
              <div key={f.label}>
                <div className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">{f.label}</div>
                <div className="font-mono text-xs text-ink">{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="border border-shell bg-cream p-6">
          <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-4">Notification Preferences</p>
          <div className="space-y-3">
            {[
              { label: "Order confirmations", enabled: true },
              { label: "Shipping updates", enabled: true },
              { label: "Invoice reminders", enabled: true },
              { label: "New products & promotions", enabled: false },
              { label: "Price change alerts", enabled: true },
            ].map((n) => (
              <div key={n.label} className="flex items-center justify-between py-1">
                <span className="font-sans text-xs text-ink/80">{n.label}</span>
                <div
                  className="w-8 h-4 border relative cursor-pointer"
                  style={{ borderColor: n.enabled ? brand.color : "var(--color-shell)", backgroundColor: n.enabled ? brand.color : "transparent" }}
                >
                  <div
                    className="w-3 h-3 border absolute top-0"
                    style={{
                      left: n.enabled ? "calc(100% - 12px)" : "0px",
                      backgroundColor: n.enabled ? "var(--color-cream)" : "#C8C0B4",
                      borderColor: n.enabled ? brand.color : "var(--color-shell)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Addresses */}
        <div className="border border-shell bg-cream p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono">Delivery Addresses</p>
            <button className="font-mono text-[10px] uppercase tracking-wide text-cream px-3 py-1 flex items-center gap-1" style={{ backgroundColor: brand.color }}>
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {[
              { label: ctx.locationLabel, address: ctx.locationAddr },
              { label: ctx.secondaryLabel, address: ctx.secondaryAddr },
            ].map((a) => (
              <div key={a.label} className="flex items-center justify-between py-2 border-b border-shell/50 last:border-0">
                <div>
                  <div className="font-mono text-xs font-semibold text-ink">{a.label}</div>
                  <div className="font-mono text-[10px] text-sand">{a.address}</div>
                </div>
                <button className="font-mono text-[10px] text-ink/40 hover:text-ink uppercase">Edit</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
