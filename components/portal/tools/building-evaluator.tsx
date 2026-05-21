"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calculator,
  Compass,
  Flame,
  MapPin,
  Sparkles,
  TrendingUp,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  evaluateAddress,
  archiveEvaluation,
  type EvaluationResult,
} from "@/lib/actions/value-tool";
import { freshnessCopy } from "@/lib/rentcast/insights";
import type { CalculationOutputs } from "@/lib/zillow/calculations";

// ---------------------------------------------------------------------------
// BuildingEvaluator — client surface for /portal/tools/value.
//
// Two-column on desktop: form on the left (sticky), results card on the
// right. Single-column stacked on mobile.
//
// Visual language matches popup-editor's premium feel — uppercase
// eyebrows, large bold numbers in the hero strip, confidence bands on
// AVMs, monospace freshness chips. Brand accent is the workspace's
// terracotta (#2563EB by default, white-label-safe via the css var).
// ---------------------------------------------------------------------------

const SAMPLE_ADDRESS = "2410 Telegraph Ave, Berkeley, CA 94704";

type RecentRow = {
  id: string;
  addressDisplay: string;
  askingPriceCents: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  createdAt: string;
  calculations: unknown;
};

export function BuildingEvaluator({ recent }: { recent: RecentRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    address: "",
    propertyType: "",
    bedrooms: "",
    bathrooms: "",
    squareFootage: "",
    askingPrice: "",
  });
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await evaluateAddress({
        address: form.address,
        propertyType: form.propertyType || null,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        squareFootage: form.squareFootage ? Number(form.squareFootage) : null,
        askingPrice: form.askingPrice ? Number(form.askingPrice) : null,
      });
      if (!res.ok) {
        setError(res.error);
        setResult(null);
        return;
      }
      setResult(res.data);
    });
  }

  function loadSample() {
    setForm((s) => ({ ...s, address: SAMPLE_ADDRESS }));
  }

  function archive(id: string) {
    if (!confirm("Archive this evaluation? It won't appear in your recent list.")) return;
    startTransition(async () => {
      const res = await archiveEvaluation(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-5">
      {/* LEFT — input form */}
      <form
        onSubmit={submit}
        className="ls-card p-5 space-y-4 self-start lg:sticky lg:top-4"
      >
        <div>
          <div className="ls-eyebrow mb-1" style={{ color: "var(--terracotta)" }}>
            Acquisitions
          </div>
          <h2
            className="text-[18px] font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Evaluate a building
          </h2>
          <p className="mt-1 text-[12px] text-muted-foreground leading-snug">
            One credit each for value, rent, and market — cached 30 days so a
            second look is free.
          </p>
        </div>

        <Field label="Property address" required>
          <input
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder={SAMPLE_ADDRESS}
            required
            disabled={pending}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--terracotta)]/30"
          />
          <button
            type="button"
            onClick={loadSample}
            className="mt-1 text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Use sample: {SAMPLE_ADDRESS}
          </button>
        </Field>

        <Field label="Asking price (drives cap rate)">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={500_000_000}
              value={form.askingPrice}
              onChange={(e) => set("askingPrice", e.target.value)}
              placeholder="475000"
              disabled={pending}
              className="w-full rounded-md border border-border bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--terracotta)]/30"
            />
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Beds">
            <input
              type="number"
              min={0}
              max={20}
              value={form.bedrooms}
              onChange={(e) => set("bedrooms", e.target.value)}
              placeholder="2"
              disabled={pending}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--terracotta)]/30"
            />
          </Field>
          <Field label="Baths">
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={form.bathrooms}
              onChange={(e) => set("bathrooms", e.target.value)}
              placeholder="1"
              disabled={pending}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--terracotta)]/30"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Sq ft">
            <input
              type="number"
              min={1}
              max={200000}
              value={form.squareFootage}
              onChange={(e) => set("squareFootage", e.target.value)}
              placeholder="900"
              disabled={pending}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--terracotta)]/30"
            />
          </Field>
          <Field label="Type">
            <select
              value={form.propertyType}
              onChange={(e) => set("propertyType", e.target.value)}
              disabled={pending}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--terracotta)]/30"
            >
              <option value="">Any</option>
              <option value="Single Family">Single family</option>
              <option value="Condo">Condo</option>
              <option value="Townhouse">Townhouse</option>
              <option value="Apartment">Apartment</option>
              <option value="Manufactured">Manufactured</option>
            </select>
          </Field>
        </div>

        <button
          type="submit"
          disabled={pending || !form.address}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
          style={{
            background: "var(--terracotta)",
            color: "var(--ivory)",
          }}
        >
          {pending ? (
            <>Evaluating&hellip;</>
          ) : (
            <>
              <Compass className="h-4 w-4" /> Run evaluation
            </>
          )}
        </button>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <div className="text-[10px] text-muted-foreground leading-snug pt-1 border-t border-border">
          Each run: 3 credits (value, rent, market). Repeat lookups within
          30 days are free. Hard-capped per workspace.
        </div>
      </form>

      {/* RIGHT — results + recent */}
      <div className="space-y-5">
        {result ? (
          <ResultCard result={result} />
        ) : (
          <EmptyState onSample={loadSample} />
        )}

        {recent.length > 0 ? (
          <RecentList recent={recent} onArchive={archive} />
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero result card — uppercase eyebrows, bold numbers, gold-equivalent
// accent (terracotta on this workspace) on the headline metric, confidence
// bands on AVMs, monospace freshness chip.
// ---------------------------------------------------------------------------

function ResultCard({ result }: { result: EvaluationResult }) {
  const calc = result.calculations;
  const askingDollars = result.askingPriceCents != null ? result.askingPriceCents / 100 : null;
  const valueMid = result.value?.price ?? null;
  const valueDelta =
    askingDollars != null && valueMid != null ? valueMid - askingDollars : null;

  const rent = result.rent?.rent ?? null;
  const sqft = result.squareFootage ?? result.value?.comparables?.[0]?.squareFootage ?? null;
  const rentPerSqft = rent && sqft ? rent / sqft : null;

  const medianDOM = result.market?.rentalData.medianDaysOnMarket ?? null;
  const temperature = pickTemperature(medianDOM);
  const fetchedAt = result.freshness.valueFetchedAt ?? result.freshness.rentFetchedAt;

  return (
    <div className="ls-card p-0 overflow-hidden">
      {/* Header strip */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 p-5 border-b border-border">
        <div className="min-w-0">
          <div
            className="ls-eyebrow mb-1.5"
            style={{ color: "var(--terracotta)" }}
          >
            Evaluation report
          </div>
          <h3
            className="text-[20px] md:text-[22px] font-semibold tracking-tight leading-tight truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {result.addressDisplay}
          </h3>
          {(result.bedrooms != null || result.bathrooms != null || result.squareFootage != null) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
              {result.bedrooms != null ? <span>{result.bedrooms} bd</span> : null}
              {result.bathrooms != null ? <span>· {result.bathrooms} ba</span> : null}
              {result.squareFootage != null ? <span>· {result.squareFootage.toLocaleString()} sqft</span> : null}
              {result.propertyType ? <span>· {result.propertyType}</span> : null}
            </div>
          )}
        </div>
        {fetchedAt ? (
          <span
            className="shrink-0 inline-flex items-center gap-1.5 text-[10.5px] font-medium px-2.5 py-1 rounded-full"
            style={{
              background: "var(--color-elevated)",
              color: "var(--olive-gray, #6B7280)",
              fontFamily: "var(--font-mono)",
            }}
            title="Most recent RentCast fetch"
          >
            <Sparkles className="h-3 w-3" /> {freshnessCopy(new Date(fetchedAt))} · RentCast
          </span>
        ) : null}
      </div>

      {/* Investor math hero strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
        <HeroMetric
          eyebrow="Cap rate"
          value={fmtPct(calc.capRate)}
          accent
          caption={askingDollars ? "at asking price" : "at AVM mid-point"}
        />
        <HeroMetric
          eyebrow="Cash-on-cash"
          value={fmtPct(calc.cashOnCashAt20)}
          caption="20% down, year 1"
        />
        <HeroMetric
          eyebrow="Price-to-rent"
          value={calc.priceToRent != null ? `${calc.priceToRent.toFixed(1)}×` : "—"}
          caption="price ÷ annual rent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Value AVM */}
        <AvmCard
          label="Property value"
          icon={<Building2 className="h-3.5 w-3.5" />}
          mid={result.value?.price ?? null}
          low={result.value?.priceRangeLow ?? null}
          high={result.value?.priceRangeHigh ?? null}
          format="dollars"
          subline={
            valueDelta != null ? (
              <span
                className={cn(
                  "text-[11.5px] font-medium",
                  valueDelta >= 0 ? "text-emerald-700" : "text-rose-700",
                )}
              >
                Asking ${askingDollars!.toLocaleString()} is{" "}
                {valueDelta >= 0 ? "below" : "above"} AVM mid by{" "}
                ${Math.abs(Math.round(valueDelta)).toLocaleString()}
              </span>
            ) : askingDollars == null ? (
              <span className="text-[11.5px] text-muted-foreground">
                Add an asking price to compare against the AVM.
              </span>
            ) : null
          }
        />
        {/* Rent AVM */}
        <AvmCard
          label="Market rent"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          mid={result.rent?.rent ?? null}
          low={result.rent?.rentRangeLow ?? null}
          high={result.rent?.rentRangeHigh ?? null}
          format="rent"
          subline={
            rentPerSqft != null ? (
              <span className="text-[11.5px] text-muted-foreground">
                ${rentPerSqft.toFixed(2)} / sqft / mo
              </span>
            ) : null
          }
        />
      </div>

      {/* Market temperature pill */}
      <div className="px-5 py-4 border-t border-border flex flex-wrap items-center gap-3">
        <TemperaturePill temperature={temperature} />
        <span className="text-[11.5px] text-muted-foreground">
          {medianDOM != null
            ? `${medianDOM}-day median time on market for this ZIP`
            : "Market velocity unavailable for this ZIP"}
        </span>
      </div>

      {/* Rental comps */}
      {result.rent?.comparables && result.rent.comparables.length > 0 ? (
        <CompsStrip
          title="Comparable rentals"
          mode="rent"
          comps={result.rent.comparables.slice(0, 6)}
        />
      ) : null}

      {/* Sale comps */}
      {result.value?.comparables && result.value.comparables.length > 0 ? (
        <CompsStrip
          title="Comparable sales"
          mode="sale"
          comps={result.value.comparables.slice(0, 6)}
        />
      ) : null}

      {/* Down-payment scenarios */}
      <ScenarioTable calc={calc} rent={rent} />

      {/* Partial-failure footer */}
      {result.partialFailures.length > 0 ? (
        <div className="px-5 py-3 border-t border-border bg-muted/30 text-[11px] text-muted-foreground">
          Partial data:{" "}
          {result.partialFailures.map((f, i) => (
            <span key={`${f.source}-${i}`} className="mr-2">
              <span className="font-medium uppercase tracking-wider">{f.source}</span>: {f.reason}
              {i < result.partialFailures.length - 1 ? " · " : ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HeroMetric({
  eyebrow,
  value,
  caption,
  accent,
}: {
  eyebrow: string;
  value: string;
  caption: string;
  accent?: boolean;
}) {
  return (
    <div className="p-5">
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: accent ? "var(--terracotta)" : "var(--olive-gray, #6B7280)" }}
      >
        {eyebrow}
      </div>
      <div
        className={cn(
          "mt-1.5 text-[40px] md:text-[44px] font-semibold leading-none tracking-[-0.02em] tabular-nums",
        )}
        style={{
          fontFamily: "var(--font-display)",
          color: accent ? "var(--terracotta)" : "var(--color-foreground)",
        }}
      >
        {value}
      </div>
      <div className="mt-2 text-[11.5px] text-muted-foreground">{caption}</div>
    </div>
  );
}

function AvmCard({
  label,
  icon,
  mid,
  low,
  high,
  format,
  subline,
}: {
  label: string;
  icon: React.ReactNode;
  mid: number | null;
  low: number | null;
  high: number | null;
  format: "dollars" | "rent";
  subline?: React.ReactNode;
}) {
  if (mid == null) {
    return (
      <div className="p-5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1.5 text-[16px] text-muted-foreground">No data available</div>
      </div>
    );
  }
  const fmt = (n: number) =>
    format === "rent" ? `$${Math.round(n).toLocaleString()}/mo` : `$${Math.round(n).toLocaleString()}`;
  const ratio = low != null && high != null && high > low ? ((mid - low) / (high - low)) * 100 : 50;
  return (
    <div className="p-5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className="mt-1.5 text-[28px] font-semibold tracking-[-0.02em] tabular-nums leading-tight"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {fmt(mid)}
      </div>
      {low != null && high != null ? (
        <>
          <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted-foreground font-mono">
            <span>{fmt(low)}</span>
            <span className="uppercase tracking-widest text-[9px]">Confidence band</span>
            <span>{fmt(high)}</span>
          </div>
          <div className="relative mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute top-0 bottom-0"
              style={{
                left: 0,
                right: 0,
                background: "linear-gradient(90deg, transparent, var(--terracotta) 50%, transparent)",
                opacity: 0.6,
              }}
            />
            <div
              className="absolute top-0 bottom-0 w-[2px]"
              style={{ left: `${Math.max(2, Math.min(98, ratio))}%`, background: "var(--terracotta)" }}
            />
          </div>
        </>
      ) : null}
      {subline ? <div className="mt-2">{subline}</div> : null}
    </div>
  );
}

function TemperaturePill({ temperature }: { temperature: "HOT" | "WARM" | "COOL" }) {
  const palette: Record<typeof temperature, { bg: string; fg: string; label: string; icon: React.ReactNode }> = {
    HOT: {
      bg: "rgba(220, 38, 38, 0.08)",
      fg: "#B91C1C",
      label: "Hot market",
      icon: <Flame className="h-3 w-3" />,
    },
    WARM: {
      bg: "rgba(245, 158, 11, 0.08)",
      fg: "#B45309",
      label: "Warm market",
      icon: <TrendingUp className="h-3 w-3" />,
    },
    COOL: {
      bg: "rgba(37, 99, 235, 0.08)",
      fg: "#1D4ED8",
      label: "Cool market",
      icon: <MapPin className="h-3 w-3" />,
    },
  };
  const p = palette[temperature];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest"
      style={{ background: p.bg, color: p.fg }}
    >
      {p.icon}
      {p.label}
    </span>
  );
}

type RentComp = {
  formattedAddress: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  price: number | null;
  distance: number | null;
  daysOld: number | null;
};

function CompsStrip({
  title,
  mode,
  comps,
}: {
  title: string;
  mode: "rent" | "sale";
  comps: RentComp[];
}) {
  return (
    <div className="px-5 py-4 border-t border-border">
      <div className="flex items-baseline justify-between mb-3">
        <h4
          className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          {title}
        </h4>
        <span className="text-[10.5px] text-muted-foreground font-mono">
          {comps.length} shown
        </span>
      </div>
      <div className="-mx-1 flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
        {comps.map((c, i) => (
          <div
            key={`${c.formattedAddress ?? i}-${i}`}
            className="shrink-0 w-[200px] rounded-lg border border-border bg-card p-3"
          >
            <div className="text-[11.5px] font-semibold truncate" title={c.formattedAddress ?? ""}>
              {c.formattedAddress ?? "Unknown address"}
            </div>
            <div className="mt-0.5 text-[10.5px] text-muted-foreground">
              {c.bedrooms ?? "—"} bd · {c.bathrooms ?? "—"} ba
              {c.squareFootage ? ` · ${c.squareFootage.toLocaleString()} sqft` : ""}
            </div>
            <div
              className="mt-2 text-[18px] font-semibold tabular-nums"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {c.price != null
                ? mode === "rent"
                  ? `$${c.price.toLocaleString()}/mo`
                  : `$${c.price.toLocaleString()}`
                : "—"}
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
              <span>{c.distance != null ? `${c.distance.toFixed(2)} mi` : ""}</span>
              <span>{c.daysOld != null ? `${c.daysOld}d` : ""}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScenarioTable({
  calc,
  rent,
}: {
  calc: CalculationOutputs;
  rent: number | null;
}) {
  if (!calc.downPayments.length) return null;

  return (
    <div className="px-5 py-4 border-t border-border">
      <div className="flex items-baseline justify-between mb-3">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Investor scenarios
        </h4>
        <span className="text-[10.5px] text-muted-foreground font-mono">
          {(calc.assumptions.mortgageRate * 100).toFixed(2)}% · {calc.assumptions.termYears}y
          · {Math.round(calc.assumptions.expenseReserveFrac * 100)}% expense reserve
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2 pr-3 font-semibold uppercase tracking-wider text-[10px]">Down</th>
              <th className="py-2 px-3 font-semibold uppercase tracking-wider text-[10px]">Down payment</th>
              <th className="py-2 px-3 font-semibold uppercase tracking-wider text-[10px]">Monthly P&amp;I</th>
              <th className="py-2 px-3 font-semibold uppercase tracking-wider text-[10px]">Cap rate</th>
              <th className="py-2 px-3 font-semibold uppercase tracking-wider text-[10px]">Cash-on-cash</th>
              <th className="py-2 pl-3 font-semibold uppercase tracking-wider text-[10px]">Breakeven occ.</th>
            </tr>
          </thead>
          <tbody>
            {calc.downPayments.map((d) => {
              // Cap rate is independent of down (depends only on price + rent),
              // so we surface the same number on every row.
              const tierCoc =
                rent != null
                  ? annualCoC(
                      rent,
                      d.monthlyPI,
                      calc.assumptions.expenseReserveFrac,
                      d.downPayment,
                    )
                  : null;
              const breakeven =
                rent != null && rent > 0
                  ? (d.monthlyPI + rent * calc.assumptions.expenseReserveFrac) / rent
                  : null;
              return (
                <tr key={d.downPct} className="border-b border-border last:border-b-0">
                  <td className="py-2.5 pr-3 font-mono">{Math.round(d.downPct * 100)}%</td>
                  <td className="py-2.5 px-3 tabular-nums">
                    ${Math.round(d.downPayment).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums">
                    ${Math.round(d.monthlyPI).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums">{fmtPct(calc.capRate)}</td>
                  <td className="py-2.5 px-3 tabular-nums">{fmtPct(tierCoc)}</td>
                  <td className="py-2.5 pl-3 tabular-nums">{fmtPct(breakeven)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ onSample }: { onSample: () => void }) {
  return (
    <div className="ls-card p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center bg-[var(--color-elevated)]">
        <Calculator className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3
        className="mt-4 text-[18px] font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Run your first evaluation
      </h3>
      <p className="mt-1.5 max-w-md mx-auto text-[13px] text-muted-foreground leading-relaxed">
        Paste an address — and an asking price if you have one — to see live
        market rent, the property's value AVM, and a fully baked investor
        analysis in under two seconds.
      </p>
      <button
        type="button"
        onClick={onSample}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11.5px] font-medium hover:bg-muted/40"
      >
        <Sparkles className="h-3 w-3" />
        Try: {SAMPLE_ADDRESS}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent list
// ---------------------------------------------------------------------------
function RecentList({ recent, onArchive }: { recent: RecentRow[]; onArchive: (id: string) => void }) {
  return (
    <div className="ls-card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3
          className="text-[14px] font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Recent evaluations
        </h3>
        <span className="text-[10.5px] text-muted-foreground font-mono">
          {recent.length} shown
        </span>
      </div>
      <ul className="divide-y divide-border">
        {recent.map((r) => {
          const cap = readCapRate(r.calculations);
          const dollars = r.askingPriceCents != null ? r.askingPriceCents / 100 : null;
          return (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium truncate">{r.addressDisplay}</div>
                <div className="mt-0.5 text-[10.5px] text-muted-foreground font-mono">
                  {dollars != null ? `$${dollars.toLocaleString()}` : "no asking"}
                  {r.bedrooms != null ? ` · ${r.bedrooms} bd` : ""}
                  {r.bathrooms != null ? ` · ${r.bathrooms} ba` : ""}
                  {" · "}
                  {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
              <span className="shrink-0 text-[12px] font-semibold tabular-nums">
                {fmtPct(cap)}
              </span>
              <button
                type="button"
                onClick={() => onArchive(r.id)}
                title="Archive"
                className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function annualCoC(
  monthlyRent: number,
  monthlyPI: number,
  expenseReserveFrac: number,
  downPayment: number,
): number | null {
  if (downPayment <= 0) return null;
  const annualRent = monthlyRent * 12;
  const annualPI = monthlyPI * 12;
  const annualExpenses = annualRent * expenseReserveFrac;
  return (annualRent - annualPI - annualExpenses) / downPayment;
}

function pickTemperature(medianDOM: number | null): "HOT" | "WARM" | "COOL" {
  if (medianDOM == null || !Number.isFinite(medianDOM)) return "WARM";
  if (medianDOM <= 7) return "HOT";
  if (medianDOM <= 21) return "WARM";
  return "COOL";
}

function readCapRate(serialized: unknown): number | null {
  // Recent-list cards persist the full CalculationOutputs as JSON. Pull
  // out the capRate scalar defensively so a future shape change doesn't
  // crash the list.
  if (!serialized || typeof serialized !== "object") return null;
  const cap = (serialized as { capRate?: unknown }).capRate;
  return typeof cap === "number" ? cap : null;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </div>
      {children}
    </label>
  );
}
