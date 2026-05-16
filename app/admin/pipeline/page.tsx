import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType, TenantStatus, Organization } from "@prisma/client";
import {
  TenantPipelineCard,
  type TenantPipelineItem,
} from "@/components/admin/tenant-pipeline-card";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

// Column design is deliberate: one column per "live" lifecycle phase, a single
// "Dormant" bucket for churned + paused, and tight column widths so the whole
// board is legible without a horizontal scrollbar on typical screens.
//
// Empty columns are HIDDEN by default — operator feedback was that the
// 8-column grid wasted screen space when most columns were 0. Adding
// `?show=all` to the URL re-enables the full grid for visual continuity.
const COLUMNS: Array<{ label: string; statuses: TenantStatus[]; hint: string }> = [
  { label: "Intake",      statuses: [TenantStatus.INTAKE_RECEIVED],     hint: "New submissions" },
  { label: "Call booked", statuses: [TenantStatus.CONSULTATION_BOOKED], hint: "Discovery scheduled" },
  { label: "Proposal",    statuses: [TenantStatus.PROPOSAL_SENT],       hint: "Awaiting decision" },
  { label: "Signed",      statuses: [TenantStatus.CONTRACT_SIGNED],     hint: "Scoped, awaiting build" },
  { label: "Building",    statuses: [TenantStatus.BUILD_IN_PROGRESS, TenantStatus.QA], hint: "Development + QA" },
  { label: "Live",        statuses: [TenantStatus.LAUNCHED, TenantStatus.ACTIVE], hint: "Generating MRR" },
  { label: "At risk",     statuses: [TenantStatus.AT_RISK],             hint: "Flagged for churn" },
  { label: "Dormant",     statuses: [TenantStatus.CHURNED, TenantStatus.PAUSED], hint: "Churned + paused" },
];

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  await requireAgency();
  const { show } = await searchParams;
  const showEmpty = show === "all";

  const orgs = await prisma.organization.findMany({
    where: { orgType: OrgType.CLIENT },
    orderBy: { updatedAt: "desc" },
  });

  const columns = COLUMNS.map((col) => ({
    ...col,
    items: orgs.filter((o) => col.statuses.includes(o.status)).map(toItem),
  }));
  const populated = columns.filter((c) => c.items.length > 0);
  const visibleColumns = showEmpty ? columns : populated;
  const hiddenCount = columns.length - populated.length;

  const activeCount = orgs.filter((o) => o.status === TenantStatus.ACTIVE).length;
  const atRiskCount = orgs.filter((o) => o.status === TenantStatus.AT_RISK).length;
  const totalMrr = orgs.reduce((sum, o) => sum + (o.mrrCents ?? 0), 0);
  const atRiskMrr = orgs
    .filter((o) => o.status === TenantStatus.AT_RISK)
    .reduce((sum, o) => sum + (o.mrrCents ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pipeline"
        description="Every tenant by lifecycle stage. Change a card's status to move it between columns."
        actions={
          <Link
            href={showEmpty ? "/admin/pipeline" : "/admin/pipeline?show=all"}
            className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
          >
            {showEmpty ? "Hide empty" : `Show all ${columns.length} columns`}
          </Link>
        }
      />

      {/* Compact summary strip — replaces the floating "3 total · 1 active"
          caption with a real KPI row so the operator sees money + risk
          before scanning the board. */}
      <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <PipelineKpi label="Total tenants" value={orgs.length.toString()} />
        <PipelineKpi label="Live" value={activeCount.toString()} tone="positive" />
        <PipelineKpi
          label="At risk"
          value={atRiskCount.toString()}
          tone={atRiskCount > 0 ? "warn" : undefined}
          hint={atRiskMrr > 0 ? `$${Math.round(atRiskMrr / 100).toLocaleString()}/mo at risk` : undefined}
        />
        <PipelineKpi
          label="Total MRR"
          value={`$${Math.round(totalMrr / 100).toLocaleString()}`}
          hint="Sum across all tenants"
        />
      </div>

      {visibleColumns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 p-10 text-center">
          <p className="text-sm font-semibold text-foreground">
            Pipeline is empty.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Capture an intake to add the first tenant.
          </p>
        </div>
      ) : (
        <>
          {/* Adaptive grid — column count tracks how many lanes are visible
              so a 2-lane board fills the screen instead of leaving 6 empty
              white tracks. Caps at 8 (the lifecycle ceiling). */}
          <div
            className={
              "grid gap-3 " +
              gridColsFor(visibleColumns.length)
            }
          >
            {visibleColumns.map((col) => (
              <PipelineColumn key={col.label} col={col} />
            ))}
          </div>

          {!showEmpty && hiddenCount > 0 ? (
            <div className="text-center">
              <Link
                href="/admin/pipeline?show=all"
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                + {hiddenCount} empty stage{hiddenCount === 1 ? "" : "s"} hidden ·
                {" "}
                <span className="text-primary font-semibold">show all</span>
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// Tailwind needs literal class names — can't interpolate `grid-cols-${n}`.
function gridColsFor(n: number): string {
  switch (n) {
    case 1: return "grid-cols-1";
    case 2: return "grid-cols-1 sm:grid-cols-2";
    case 3: return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    case 4: return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
    case 5: return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5";
    case 6: return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6";
    case 7: return "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7";
    default: return "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8";
  }
}

function PipelineKpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "warn";
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className={
          "text-xl font-semibold tabular-nums tracking-tight mt-1 " +
          (tone === "warn"
            ? "text-amber-700"
            : tone === "positive"
              ? "text-emerald-700"
              : "text-foreground")
        }
      >
        {value}
      </p>
      {hint ? (
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</p>
      ) : null}
    </div>
  );
}

function PipelineColumn({
  col,
}: {
  col: {
    label: string;
    statuses: TenantStatus[];
    items: TenantPipelineItem[];
    hint: string;
  };
}) {
  return (
    <section className="min-w-0 flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-2.5">
      <header className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[12px] font-semibold tracking-tight text-foreground">
            {col.label}
          </h3>
          <p className="text-[10px] text-muted-foreground truncate">
            {col.hint}
          </p>
        </div>
        <span
          className={
            "shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-[10px] font-semibold tabular-nums " +
            (col.items.length === 0
              ? "bg-muted text-muted-foreground/50"
              : "bg-primary/10 text-primary")
          }
        >
          {col.items.length}
        </span>
      </header>
      <div className="flex flex-col gap-2 min-h-[40px]">
        {col.items.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/60 italic px-1 py-2">
            No tenants here yet.
          </p>
        ) : (
          col.items.map((item) => (
            <TenantPipelineCard key={item.id} item={item} />
          ))
        )}
      </div>
    </section>
  );
}

function toItem(o: Organization): TenantPipelineItem {
  const modulesActive = countActiveModules(o);
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    status: o.status,
    propertyType: o.propertyType,
    subscriptionTier: o.subscriptionTier,
    mrrCents: o.mrrCents,
    modulesActive,
    updatedAt: o.updatedAt.toISOString(),
    atRiskReason: o.atRiskReason,
  };
}

function countActiveModules(o: Organization): number {
  return [
    o.moduleWebsite,
    o.modulePixel,
    o.moduleChatbot,
    o.moduleGoogleAds,
    o.moduleMetaAds,
    o.moduleSEO,
    o.moduleEmail,
    o.moduleOutboundEmail,
    o.moduleReferrals,
    o.moduleCreativeStudio,
    o.moduleLeadCapture,
  ].filter(Boolean).length;
}
