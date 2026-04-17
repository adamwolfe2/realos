"use client";

import { useState } from "react";
import { CheckCircle2, Copy } from "lucide-react";
import type { ViewProps } from "./types";

export function ClientReferralsView({ brand, data }: ViewProps) {
  const [copied, setCopied] = useState(false);
  const refCode = `${data.companyName.replace(/\s/g, "").toUpperCase().slice(0, 6)}-REF2026`;

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 bg-cream">
      <div className="mb-6">
        <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Earn Rewards</p>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">Referral Program</h2>
      </div>

      {/* Referral Code */}
      <div className="border border-shell bg-cream p-6 mb-6">
        <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-3">Your Referral Code</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 border border-shell bg-white px-4 py-3">
            <span className="font-mono text-sm font-semibold tracking-wider text-ink">{refCode}</span>
          </div>
          <button
            onClick={handleCopy}
            className="px-4 py-3 font-mono text-[10px] uppercase tracking-wide text-cream border flex items-center gap-2"
            style={{ backgroundColor: brand.color, borderColor: brand.color }}
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="border border-shell bg-cream p-6 mb-6">
        <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-4">How It Works</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: "01", title: "Share Your Code", desc: "Send your unique referral code to other businesses in your network" },
            { step: "02", title: "They Sign Up", desc: "When they create an account and place their first order, both accounts are credited" },
            { step: "03", title: "Earn Rewards", desc: "Get $50 credit for each successful referral — no limit on earnings" },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-10 h-10 mx-auto mb-3 flex items-center justify-center border border-shell">
                <span className="font-mono text-sm font-bold" style={{ color: brand.color }}>{s.step}</span>
              </div>
              <div className="font-serif text-sm font-semibold text-ink mb-1">{s.title}</div>
              <div className="font-sans text-xs text-sand">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Referrals", value: "7" },
          { label: "Successful", value: "5" },
          { label: "Credits Earned", value: "$250" },
        ].map((s) => (
          <div key={s.label} className="border border-shell bg-cream p-4 text-center">
            <div className="font-mono text-xl font-bold text-ink">{s.value}</div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
