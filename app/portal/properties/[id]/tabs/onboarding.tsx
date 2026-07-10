import Link from "next/link";
import { CheckCircle2, Circle, AlertCircle, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLaunchChecklist } from "@/lib/properties/launch";
import {
  StatusChip,
  type ConnectionStatus,
} from "@/components/portal/ui/status-chip";
import { LaunchStatusActions } from "./launch-status-actions";

// ---------------------------------------------------------------------------
// Property onboarding tab. Renders the per-property launch checklist
// (marketing content / pixel installed / pixel firing / GA4 / GSC /
// Google Ads / Meta Ads) plus the operator's launchStatus controls.
//
// This is THE page where Norman sets up Telegraph Commons end-to-end,
// where David (or you, the agency) onboards each of the five new SG
// builds, and where any future operator walks their full portfolio
// from DRAFT → ONBOARDING → LIVE.
// ---------------------------------------------------------------------------

// Launch status → shared StatusChip vocabulary. Live is GREEN (#24a148,
// never blue — blue is reserved for in-progress); Onboarding maps to the
// in-progress blue; Draft/Paused read neutral.
const STATUS_CHIP: Record<string, { status: ConnectionStatus; label: string }> =
  {
    LIVE: { status: "live", label: "Live" },
    ONBOARDING: { status: "connecting", label: "Onboarding" },
    DRAFT: { status: "not_connected", label: "Draft" },
    PAUSED: { status: "stale", label: "Paused" },
  };

export async function OnboardingTab({
  orgId,
  propertyId,
}: {
  orgId: string;
  propertyId: string;
}) {
  const checklist = await getLaunchChecklist(orgId, propertyId);
  if (!checklist) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Property not found.
      </div>
    );
  }

  const chip = STATUS_CHIP[checklist.status] ?? STATUS_CHIP.DRAFT;

  // Required progress drives the headline. Optional items render below
  // and don't block LIVE.
  const requiredPct = checklist.totalRequiredCount > 0
    ? Math.round((checklist.completedRequiredCount / checklist.totalRequiredCount) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Status header + actions */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Rocket className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                Launch status
              </span>
              <StatusChip status={chip.status} label={chip.label} />
              {checklist.setBy === "OPERATOR" ? (
                <span className="text-[10px] text-muted-foreground">
                  set by operator
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  auto-derived
                </span>
              )}
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
              {checklist.completedRequiredCount} of {checklist.totalRequiredCount}{" "}
              required steps complete
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {checklist.status === "LIVE"
                ? "This property is live. Marketing data is flowing into your dashboards."
                : checklist.status === "PAUSED"
                  ? "This property is paused. Reporting is suspended; the property stays in your portfolio for residents/leases data."
                  : checklist.completedRequiredCount === checklist.totalRequiredCount
                    ? "All required steps are complete. Ready to mark live."
                    : "Complete the required steps below to launch this property."}
            </p>
          </div>
          <LaunchStatusActions
            propertyId={propertyId}
            currentStatus={checklist.status}
            allRequiredComplete={
              checklist.completedRequiredCount === checklist.totalRequiredCount
            }
          />
        </div>

        {/* Progress bar — real visible fill on a hard #e0e0e0 track.
            (The prior bg-secondary fill was near-invisible against the
            muted track.) Live fills success green; everything else uses
            the primary token. */}
        <div className="mt-4">
          <div className="h-1.5 w-full rounded-[2px] bg-[#e0e0e0] overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${requiredPct}%`,
                backgroundColor:
                  chip.status === "live" ? "#24a148" : "var(--color-primary)",
              }}
            />
          </div>
        </div>
      </section>

      {/* Required checklist */}
      <section className="space-y-3">
        <header>
          <h3 className="text-sm font-semibold text-foreground">
            Required to launch
          </h3>
          <p className="text-xs text-muted-foreground">
            Each property must complete these steps before showing real
            metrics in dashboards.
          </p>
        </header>
        <ul className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {checklist.items
            .filter((i) => i.required)
            .map((item) => (
              <ChecklistRow key={item.key} item={item} />
            ))}
        </ul>
      </section>

      {/* Optional checklist — only render when this property's package
          actually includes optional integrations (ads, popups). */}
      {checklist.items.some((i) => !i.required) ? (
        <section className="space-y-3">
          <header>
            <h3 className="text-sm font-semibold text-foreground">
              Optional integrations
            </h3>
            <p className="text-xs text-muted-foreground">
              Connect these to round out this property — paid traffic and
              on-site popups.
            </p>
          </header>
          <ul className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {checklist.items
              .filter((i) => !i.required)
              .map((item) => (
                <ChecklistRow key={item.key} item={item} />
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ChecklistRow({ item }: { item: Awaited<ReturnType<typeof getLaunchChecklist>> extends infer T ? (T extends { items: (infer I)[] } ? I : never) : never }) {
  const Icon = item.done ? CheckCircle2 : Circle;
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <Icon
        className={cn(
          "w-4 h-4 mt-0.5 shrink-0",
          item.done ? "text-primary" : "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {item.label}
          </span>
          {!item.done && item.required ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-foreground px-1.5 py-0.5 rounded bg-secondary/10">
              <AlertCircle className="w-2.5 h-2.5" aria-hidden="true" />
              required
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.description}
        </p>
        {item.detail ? (
          <p className="text-[11px] text-muted-foreground/80 mt-1 font-mono">
            {item.detail}
          </p>
        ) : null}
      </div>
      {!item.done && item.actionHref && item.actionLabel ? (
        <Link
          href={item.actionHref}
          className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border border-foreground bg-primary text-primary-foreground hover:bg-primary-dark transition-colors shrink-0"
        >
          {item.actionLabel}
        </Link>
      ) : item.done && item.actionHref ? (
        <Link
          href={item.actionHref}
          className="inline-flex items-center px-2.5 py-1 text-xs text-muted-foreground rounded-md border border-border hover:bg-secondary transition-colors shrink-0"
        >
          Manage
        </Link>
      ) : null}
    </li>
  );
}
