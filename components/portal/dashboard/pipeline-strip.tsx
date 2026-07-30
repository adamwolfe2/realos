// ---------------------------------------------------------------------------
// PipelineStrip — compact replacement for the old blue-chevron conversion
// funnel. Renders ONLY the stages LeaseStack actually tracks end-to-end
// (Visitors, Leads, Applications) as inline mono metric groups. Tours and
// on-site engagement are excluded entirely rather than rendered as a fake
// zero — an untracked stage is not the same thing as a stage with no
// activity, and showing "0" there reads as a broken product.
// ---------------------------------------------------------------------------

export type PipelineStage = {
  label: string;
  value: number;
  /** True when the org has no way to produce a real number for this stage
   *  yet (e.g. no PMS connected). Rendered as "—", never "0". */
  notApplicable?: boolean;
};

type Props = {
  /** Only tracked stages — Visitors, Leads, Applications. */
  stages: PipelineStage[];
  /** The dashboard's selected range — keeps the label honest when the
   *  operator picks 7d/90d. */
  periodDays?: number;
};

export function PipelineStrip({ stages, periodDays = 28 }: Props) {
  if (stages.length === 0) return null;

  return (
    <div className="ls-card p-4">
      <div className="ls-eyebrow mb-3">Pipeline ({periodDays}d)</div>
      <div className="flex items-stretch divide-x divide-[var(--hair)]">
        {stages.map((stage, i) => {
          const prev = i > 0 ? stages[i - 1] : null;
          const conversionPct =
            prev && !prev.notApplicable && !stage.notApplicable && prev.value > 0
              ? Math.round((stage.value / prev.value) * 100)
              : null;
          return (
            <div
              key={stage.label}
              className="flex-1 min-w-0 px-4 first:pl-0 last:pr-0"
            >
              {conversionPct != null ? (
                <div className="text-[10px] font-mono tabular-nums text-muted-foreground mb-1">
                  {conversionPct}% of {prev!.label.toLowerCase()}
                </div>
              ) : (
                <div className="text-[10px] font-mono text-transparent mb-1" aria-hidden="true">
                  &nbsp;
                </div>
              )}
              <div className="ls-eyebrow">{stage.label}</div>
              <div className="ls-metric ls-metric-md mt-1">
                {stage.notApplicable ? "—" : stage.value.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
