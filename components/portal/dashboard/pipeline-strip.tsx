// ---------------------------------------------------------------------------
// PipelineStrip — compact conversion funnel over the stages LeaseStack
// actually tracks end-to-end (Visitors, Leads, Applications). Tours and
// on-site engagement are excluded entirely rather than rendered as a fake
// zero — an untracked stage is not the same thing as a stage with no
// activity, and showing "0" there reads as a broken product.
//
// Visual: horizontal bar funnel (StageFunnel) — bar length carries the
// magnitude, "→N%" carries the step-down, so the drop-off between stages is
// visible instead of being three bare numbers.
// ---------------------------------------------------------------------------

import { StageFunnel } from "./stage-funnel";

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
      <StageFunnel stages={stages} />
    </div>
  );
}
