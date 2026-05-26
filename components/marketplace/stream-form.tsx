"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

// Buyer-side stream creation form. Posts to /api/marketplace/streams and
// soft-refreshes the page so the new stream appears below.

export function StreamForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [market, setMarket] = useState("");
  const [propertyType, setPropertyType] = useState<string>("");
  const [minIntent, setMinIntent] = useState(75);
  const [maxPriceCents, setMaxPriceCents] = useState(10000);
  const [weeklyBudgetCents, setWeeklyBudgetCents] = useState(50000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/streams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          market: market || null,
          propertyType: propertyType || null,
          minIntent,
          maxPriceCents,
          weeklyBudgetCents,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not create stream");
        return;
      }
      setName("");
      setMarket("");
      setPropertyType("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Stream name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Texas high-intent sale leads"
          className="form-input"
          required
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Market (optional)">
          <input
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            placeholder="e.g. Texas (leave blank for any)"
            className="form-input"
          />
        </Field>
        <Field label="Property type (optional)">
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="form-input"
          >
            <option value="">Any type</option>
            <option value="SALE">Sale</option>
            <option value="RENTAL">Rental</option>
            <option value="INVESTMENT">Investment</option>
            <option value="COMMERCIAL">Commercial</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={`Min intent (${minIntent})`}>
          <input
            type="range"
            min={50}
            max={95}
            value={minIntent}
            onChange={(e) => setMinIntent(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </Field>
        <Field label={`Max price ($${(maxPriceCents / 100).toFixed(0)}/lead)`}>
          <input
            type="range"
            min={1000}
            max={20000}
            step={500}
            value={maxPriceCents}
            onChange={(e) => setMaxPriceCents(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </Field>
        <Field label={`Weekly budget ($${(weeklyBudgetCents / 100).toFixed(0)})`}>
          <input
            type="range"
            min={5000}
            max={500000}
            step={5000}
            value={weeklyBudgetCents}
            onChange={(e) => setWeeklyBudgetCents(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !name}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving…" : "Create stream"}
        </button>
        {error && <span className="text-sm text-red-600 font-medium">{error}</span>}
      </div>

      <style jsx>{`
        .form-input {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background-color: white;
          font-size: 14px;
          color: #1e2a3a;
          font-family: var(--font-sans);
        }
        .form-input:focus {
          outline: none;
          border-color: #2563eb;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
