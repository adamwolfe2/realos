import * as React from "react";
import Link from "next/link";
import { TrendingUp, ShieldCheck } from "lucide-react";
import {
  TIERS,
  computeGraduatedMonthlyCents,
} from "@/lib/billing/catalog";

// ---------------------------------------------------------------------------
// BillingImpactCallout — sits at the top of the AppFolio curation queue so
// operators see the financial consequence of approving properties BEFORE
// they bulk-click "Mark active". Computes the *delta* between current
// active count and the count if everything in the queue were approved,
// using the operator's chosen tier and the graduated bracket pricing
// from lib/billing/catalog.ts.
//
// Intent: address Norman's exact concern — "when people sync their app
// folio, we need them to choose which accounts they want to add in, or
// else they're going to add all of them to billing."
//
// Design rules:
//   - Neutral tone (not red/destructive). Approving properties is the
//     happy path — the callout is informative, not a warning.
//   - Always show the per-property rate AND the total delta so the
//     operator can do the math at any property count.
//   - When tier is unknown (CUSTOM / null subscription), fall back to
//     a generic "billing changes once you exceed your trial cap" line
//     and link to /portal/billing instead of trying to quote a number.
// ---------------------------------------------------------------------------

type Props = {
  /** Active properties currently counting toward billing. */
  currentActive: number;
  /** Properties pending review (lifecycle = IMPORTED). */
  pendingCount: number;
  /** Tier the org has chosen / is on. Optional — degrades gracefully. */
  tierId: "starter" | "growth" | "scale" | null;
  /** True while the org is still in trial (no immediate billing change). */
  trialing: boolean;
};

function fmtUSD(cents: number): string {
  const dollars = Math.round(cents / 100);
  return `$${dollars.toLocaleString()}`;
}

export function BillingImpactCallout({
  currentActive,
  pendingCount,
  tierId,
  trialing,
}: Props) {
  if (pendingCount === 0) return null;

  const tier = tierId ? TIERS.find((t) => t.id === tierId) ?? null : null;
  const base = tier?.monthly.unitAmountCents ?? null;

  // Compute the cents delta only when we know the tier. Otherwise we
  // can't quote a number honestly — show the qualitative version.
  const projected = currentActive + pendingCount;
  const currentMonthlyCents =
    base != null ? computeGraduatedMonthlyCents(base, currentActive) : null;
  const projectedMonthlyCents =
    base != null ? computeGraduatedMonthlyCents(base, projected) : null;
  const deltaCents =
    currentMonthlyCents != null && projectedMonthlyCents != null
      ? projectedMonthlyCents - currentMonthlyCents
      : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
          <TrendingUp className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">
            Approve only the properties you want LeaseStack to market
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground leading-snug">
            AppFolio imports your <strong>entire</strong> property directory —
            including parking, storage, and sub-records. Each property you mark{" "}
            <strong>Active</strong> joins your marketable count and is billed at
            your tier&rsquo;s graduated per-property rate.
            {trialing
              ? " You&rsquo;re still in trial, so no charge today; activations take effect when the trial converts."
              : ""}
          </p>

          {/* Quantitative impact strip — only when we know the tier. */}
          {base != null &&
          deltaCents != null &&
          currentMonthlyCents != null &&
          projectedMonthlyCents != null ? (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <ImpactStat
                label="Active today"
                value={`${currentActive.toLocaleString()} ${currentActive === 1 ? "property" : "properties"}`}
                sub={`${fmtUSD(currentMonthlyCents)}/mo`}
              />
              <ImpactStat
                label="Pending review"
                value={`+${pendingCount.toLocaleString()}`}
                sub={
                  deltaCents > 0
                    ? `+${fmtUSD(deltaCents)}/mo if all approved`
                    : "no billing change"
                }
                emphasised
              />
              <ImpactStat
                label="If you approve everything"
                value={`${projected.toLocaleString()} ${projected === 1 ? "property" : "properties"}`}
                sub={`${fmtUSD(projectedMonthlyCents)}/mo total`}
              />
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[12px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Pricing tier not selected yet —{" "}
              <Link
                href="/portal/billing"
                className="font-semibold text-primary hover:underline"
              >
                review billing
              </Link>{" "}
              to see exact numbers.
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground/80 leading-snug">
            Properties marked <strong>Excluded</strong> stay in your AppFolio
            mirror but never count toward billing or appear in dashboards. You
            can always restore an excluded property later from the Excluded
            tab.
          </p>
        </div>
      </div>
    </div>
  );
}

function ImpactStat({
  label,
  value,
  sub,
  emphasised,
}: {
  label: string;
  value: string;
  sub: string;
  emphasised?: boolean;
}) {
  return (
    <div
      className={
        emphasised
          ? "rounded-md border border-primary/30 bg-primary/5 px-3 py-2"
          : "rounded-md border border-border bg-card px-3 py-2"
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={
          emphasised
            ? "mt-0.5 text-base font-semibold tabular-nums text-primary"
            : "mt-0.5 text-base font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
        {sub}
      </div>
    </div>
  );
}
