"use client";

import { ExternalLink } from "lucide-react";
import { SectionCard } from "@/components/admin/page-header";
import type { ZillowListing } from "@/lib/zillow/scrape";
import type { CalculationOutputs } from "@/lib/zillow/calculations";

// ---------------------------------------------------------------------------
// ZillowReportView — pure renderer for a parsed listing + calculations.
// Shared between the live "just generated" view and the "load a saved
// report" view so both surfaces stay in lockstep.
// ---------------------------------------------------------------------------

type Props = {
  listing: ZillowListing;
  calculations: CalculationOutputs;
  /** Saved row id, if this report has been persisted. */
  savedId?: string | null;
  /** When provided, renders the "Save report" CTA wired to this handler. */
  onSave?: () => void;
  saving?: boolean;
};

export function ZillowReportView({
  listing,
  calculations,
  savedId,
  onSave,
  saving,
}: Props) {
  return (
    <div className="space-y-5">
      {/* Hero ----------------------------------------------------------- */}
      <SectionCard label="Property snapshot" padded={false}>
        <div className="flex flex-col md:flex-row gap-0 md:gap-5">
          <div className="md:w-[42%] aspect-[16/10] md:aspect-auto bg-muted overflow-hidden">
            {listing.primaryImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.primaryImageUrl}
                alt={listing.address ?? "Listing photo"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                No photo
              </div>
            )}
          </div>
          <div className="flex-1 p-5 space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                Address
              </div>
              <div className="text-[18px] font-semibold leading-tight text-foreground mt-1">
                {listing.address ?? "Address unavailable"}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                List price
              </div>
              <div className="text-[28px] font-semibold tabular-nums text-foreground mt-1">
                {formatCurrency(listing.listPrice)}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground">
              <Stat label="Beds" value={formatNum(listing.beds)} />
              <Stat label="Baths" value={formatNum(listing.baths)} />
              <Stat label="Sqft" value={formatNum(listing.sqft)} />
              <Stat label="Type" value={listing.homeType} />
              <Stat label="Status" value={listing.homeStatus} />
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground underline-offset-4 hover:underline"
              >
                Open on Zillow
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {onSave && !savedId && (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-md px-3 h-8 text-[13px] font-medium border border-border bg-background hover:bg-muted disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save report"}
                </button>
              )}
              {savedId && (
                <span className="text-[12px] text-muted-foreground">
                  Saved · revisit any time from the list above.
                </span>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Facts ---------------------------------------------------------- */}
      <SectionCard label="Facts">
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
          <Fact label="Year built" value={formatNum(listing.yearBuilt)} />
          <Fact label="Lot size" value={listing.lotSize ?? "—"} />
          <Fact label="Days on Zillow" value={formatNum(listing.daysOnMarket)} />
          <Fact label="Zestimate" value={formatCurrency(listing.zestimate)} />
          <Fact
            label="Rent Zestimate"
            value={
              listing.rentZestimate
                ? `${formatCurrency(listing.rentZestimate)}/mo`
                : "—"
            }
          />
          <Fact
            label="zpid"
            value={listing.zpid}
            mono
          />
        </dl>
      </SectionCard>

      {/* Investor math -------------------------------------------------- */}
      <SectionCard
        label="Investor math"
        description={`Assumes ${formatPct(
          calculations.assumptions.mortgageRate,
        )} / ${calculations.assumptions.termYears}y fixed, ${formatPct(
          calculations.assumptions.expenseReserveFrac,
        )} expense reserve on gross rent.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground font-medium border-b border-[var(--hair)]">
                <th className="py-2 pr-4 font-medium">Down</th>
                <th className="py-2 pr-4 font-medium">Cash down</th>
                <th className="py-2 pr-4 font-medium">Loan</th>
                <th className="py-2 font-medium">Monthly P&amp;I</th>
              </tr>
            </thead>
            <tbody>
              {calculations.downPayments.map((d) => (
                <tr
                  key={d.downPct}
                  className="border-b border-[var(--hair)] last:border-0"
                >
                  <td className="py-2 pr-4 tabular-nums">
                    {formatPct(d.downPct)}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">
                    {formatCurrency(d.downPayment)}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">
                    {formatCurrency(d.loanAmount)}
                  </td>
                  <td className="py-2 tabular-nums">
                    {formatCurrency(d.monthlyPI)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-[var(--hair)]">
          <Metric
            label="Cap rate"
            value={
              calculations.capRate !== null
                ? formatPct(calculations.capRate, 2)
                : "—"
            }
            hint="Annual rent ÷ list price"
          />
          <Metric
            label="Price-to-rent"
            value={
              calculations.priceToRent !== null
                ? `${calculations.priceToRent.toFixed(1)}×`
                : "—"
            }
            hint="List price ÷ annual rent"
          />
          <Metric
            label="Cash-on-cash @ 20% down"
            value={
              calculations.cashOnCashAt20 !== null
                ? formatPct(calculations.cashOnCashAt20, 2)
                : "—"
            }
            hint="(Annual rent − P&I − reserve) ÷ down"
          />
        </div>
        {!listing.rentZestimate && (
          <p className="mt-4 text-[12px] text-muted-foreground">
            Zillow didn't return a Rent Zestimate for this listing, so cap
            rate, price-to-rent, and cash-on-cash are unavailable.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers ---------------------------------------------------------------------
// ---------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
        {label}
      </span>
      <span className="text-[14px] tabular-nums">{value}</span>
    </div>
  );
}

function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
        {label}
      </dt>
      <dd
        className={`text-[14px] mt-1 ${mono ? "font-mono text-[12.5px]" : "tabular-nums"}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
        {label}
      </div>
      <div className="text-[22px] font-semibold tabular-nums leading-tight mt-1">
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatNum(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return new Intl.NumberFormat("en-US").format(n);
}

function formatPct(frac: number, digits = 1): string {
  return `${(frac * 100).toFixed(digits)}%`;
}
