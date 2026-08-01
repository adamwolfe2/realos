import { BadgeCheck } from "lucide-react";

// "Managed by LeaseStack" chip — productized-agency identity (Adam
// 2026-07-31): white-glove modules (Content / Creative / Sites) are labeled
// as managed services with a turnaround SLA instead of pretending to be
// self-serve automation. Keep the SLA copy in sync wherever this renders.
export const MANAGED_SLA = "3 business day turnaround";

export function ManagedByChip({ sla }: { sla?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary whitespace-nowrap">
      <BadgeCheck className="h-3 w-3" aria-hidden="true" />
      Managed by LeaseStack
      {sla ? <span className="text-primary/70">· {sla}</span> : null}
    </span>
  );
}
