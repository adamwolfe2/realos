"use client";

import {
  computeProposalTotalsShared,
  formatCents,
  type LineLikeShared,
  type ProposalHeaderShared,
} from "@/lib/proposals/totals-shared";

// ---------------------------------------------------------------------------
// TotalsPanel — live-recalculates as the operator edits.
// ---------------------------------------------------------------------------

export function TotalsPanel({
  header,
  lines,
}: {
  header: ProposalHeaderShared;
  lines: LineLikeShared[];
}) {
  const totals = computeProposalTotalsShared(header, lines);
  const cadenceLabel = totals.cadence === "ANNUAL" ? "/yr" : "/mo";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="text-[10px] tracking-[0.14em] uppercase font-semibold text-muted-foreground">
        Totals
      </div>

      <Row
        label="Recurring subtotal"
        value={formatCents(totals.recurringSubtotal)}
        suffix={cadenceLabel}
      />
      {totals.recurringDiscount > 0 ? (
        <Row
          label="Recurring discount"
          value={`− ${formatCents(totals.recurringDiscount)}`}
          tone="muted"
        />
      ) : null}
      <Row
        label="Recurring total"
        value={formatCents(totals.recurringTotal)}
        suffix={cadenceLabel}
        strong
      />

      <hr className="border-border/60" />

      <Row
        label="One-time subtotal"
        value={formatCents(totals.oneTimeSubtotal)}
      />
      {totals.oneTimeDiscount > 0 ? (
        <Row
          label="One-time discount"
          value={`− ${formatCents(totals.oneTimeDiscount)}`}
          tone="muted"
        />
      ) : null}
      <Row
        label="One-time total"
        value={formatCents(totals.oneTimeTotal)}
        strong
      />

      <hr className="border-border/60" />

      <Row
        label={totals.hasTrial ? `Due today (after ${totals.trialDays}d trial)` : "Due today"}
        value={formatCents(totals.firstInvoiceTotal)}
        strong
      />
      {totals.hasTrial ? (
        <p className="text-[11px] text-muted-foreground">
          Recurring portion bills at end of trial.
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  suffix,
  strong,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  strong?: boolean;
  tone?: "muted";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={`text-xs ${tone === "muted" ? "text-muted-foreground" : "text-foreground"}`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${strong ? "text-sm font-semibold text-foreground" : "text-xs text-foreground"}`}
      >
        {value}
        {suffix ? (
          <span className="text-muted-foreground text-[11px]">{suffix}</span>
        ) : null}
      </span>
    </div>
  );
}
