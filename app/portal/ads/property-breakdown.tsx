import Link from "next/link";
import { Logo, Panel } from "@/components/portal/overview/kit";
import type { PropertyAdRollup } from "@/lib/integrations/ads-property-rollup";

// "By property" panel on /portal/ads: what each property spent on Google
// and Meta over the window, and what reached the leasing system from it.
// Both brands are blue, so Meta gets a light tint of its blue to keep the
// split readable; the header key shows which is which.
const GOOGLE_BLUE = "#4285f4";
const META_BLUE = "#a8c7fa";

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function per(spendCents: number, count: number): string {
  return spendCents > 0 && count > 0 ? dollars(Math.round(spendCents / count)) : "—";
}

export function PropertyBreakdown({ rows, rangeDays }: { rows: PropertyAdRollup[]; rangeDays: number }) {
  if (rows.length === 0) return null;
  const maxSpend = Math.max(1, ...rows.map((r) => r.spendCents));
  const hasPortfolioRow = rows.some((r) => r.propertyId === null && r.spendCents > 0);

  return (
    <Panel
      title="By property"
      aside={
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: GOOGLE_BLUE }} aria-hidden />
            <Logo slug="google-ads" size={12} />Google
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: META_BLUE }} aria-hidden />
            <Logo slug="meta-ads" size={12} />Meta
          </span>
          <span>{rangeDays} days</span>
        </span>
      }
      flush
      className="overflow-x-auto"
    >
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-[var(--t-divider)]">
          <tr className="ls-eyebrow">
            <th className="px-4 py-2 text-left">Property</th>
            <th className="px-4 py-2 text-left">Spend</th>
            <th className="px-4 py-2 text-right" title="Conversions as reported by Google and Meta">Platform conv.</th>
            <th className="px-4 py-2 text-right">Leads</th>
            <th className="px-4 py-2 text-right">Tours</th>
            <th className="px-4 py-2 text-right">Leases</th>
            <th className="px-4 py-2 text-right">Cost / lead</th>
            <th className="px-4 py-2 text-right">Cost / lease</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--t-divider)]">
          {rows.map((r) => (
            <tr key={r.propertyId ?? "portfolio"} className="align-middle">
              <td className="px-4 py-3">
                {r.propertyId ? (
                  <Link
                    href={`/portal/ads?property=${r.propertyId}${rangeDays === 28 ? "" : `&range=${rangeDays}`}`}
                    className="font-medium text-[var(--t-ink)] hover:text-[var(--t-accent)] hover:underline underline-offset-2"
                  >
                    {r.name}
                  </Link>
                ) : (
                  <div className="font-medium text-[var(--t-ink)]">{r.name}</div>
                )}
                {r.propertyId === null ? (
                  <div className="text-[11.5px] text-[var(--t-muted)]">Campaigns that promote several properties</div>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 font-semibold tabular-nums text-[var(--t-ink)]">{dollars(r.spendCents)}</span>
                  <div
                    className="flex h-2 min-w-[96px] max-w-[180px] flex-1 overflow-hidden rounded-full bg-[var(--t-wash)]"
                    role="img"
                    aria-label={`Google ${dollars(r.googleCents)}, Meta ${dollars(r.metaCents)}`}
                  >
                    <div style={{ width: `${(r.googleCents / maxSpend) * 100}%`, background: GOOGLE_BLUE }} />
                    <div style={{ width: `${(r.metaCents / maxSpend) * 100}%`, background: META_BLUE }} />
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-[var(--t-text)]">
                {r.conversions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-[var(--t-ink)]">{r.leads.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tabular-nums text-[var(--t-ink)]">{r.tours.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-[var(--t-ink)]">{r.signed.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tabular-nums text-[var(--t-text)]">{per(r.spendCents, r.leads)}</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-[var(--t-ink)]">{per(r.spendCents, r.signed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[var(--t-divider)] px-4 py-2.5 text-[12px] text-[var(--t-muted)]">
        Leads, tours and leases come from your leasing system, matched to the ad that brought the renter in.
        {hasPortfolioRow ? " Portfolio-wide spend is not split across properties, so per-property costs only count that property's own campaigns." : ""}
      </p>
    </Panel>
  );
}
