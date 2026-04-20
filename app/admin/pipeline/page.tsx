import type { Metadata } from "next";
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
const COLUMNS: Array<{ label: string; statuses: TenantStatus[] }> = [
  { label: "Intake",      statuses: [TenantStatus.INTAKE_RECEIVED] },
  { label: "Call booked", statuses: [TenantStatus.CONSULTATION_BOOKED] },
  { label: "Proposal",    statuses: [TenantStatus.PROPOSAL_SENT] },
  { label: "Signed",      statuses: [TenantStatus.CONTRACT_SIGNED] },
  { label: "Building",    statuses: [TenantStatus.BUILD_IN_PROGRESS, TenantStatus.QA] },
  { label: "Live",        statuses: [TenantStatus.LAUNCHED, TenantStatus.ACTIVE] },
  { label: "At risk",     statuses: [TenantStatus.AT_RISK] },
  { label: "Dormant",     statuses: [TenantStatus.CHURNED, TenantStatus.PAUSED] },
];

export default async function PipelinePage() {
  await requireAgency();

  const orgs = await prisma.organization.findMany({
    where: { orgType: OrgType.CLIENT },
    orderBy: { updatedAt: "desc" },
  });

  const columns = COLUMNS.map((col) => ({
    ...col,
    items: orgs.filter((o) => col.statuses.includes(o.status)).map(toItem),
  }));

  const activeCount = orgs.filter((o) => o.status === TenantStatus.ACTIVE).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Every tenant by lifecycle stage. Change a card's status to move it between columns. Status flips write an audit row."
        actions={
          <div className="text-xs text-muted-foreground">
            {orgs.length} total · {activeCount} active
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {columns.map((col) => (
          <PipelineColumn key={col.label} col={col} />
        ))}
      </div>
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
  };
}) {
  return (
    <section className="min-w-0 flex flex-col gap-2">
      <header className="flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-[11px] font-semibold tracking-wide text-foreground">
          {col.label}
        </h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {col.items.length}
        </span>
      </header>
      <div className="h-px bg-border" />
      <div className="flex flex-col gap-2 min-h-[48px]">
        {col.items.length === 0 ? null : (
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
