import type { Metadata } from "next";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType, TenantStatus, Organization } from "@prisma/client";
import {
  TenantPipelineCard,
  type TenantPipelineItem,
} from "@/components/admin/tenant-pipeline-card";

export const metadata: Metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

// Column order reflects the fulfillment lifecycle. The two terminal states,
// CHURNED and PAUSED, are rendered as a single "Dormant" column so the
// active pipeline stays readable.
const COLUMNS: Array<{ label: string; statuses: TenantStatus[] }> = [
  { label: "Intake", statuses: [TenantStatus.INTAKE_RECEIVED] },
  { label: "Call booked", statuses: [TenantStatus.CONSULTATION_BOOKED] },
  { label: "Proposal", statuses: [TenantStatus.PROPOSAL_SENT] },
  { label: "Signed", statuses: [TenantStatus.CONTRACT_SIGNED] },
  { label: "Building", statuses: [TenantStatus.BUILD_IN_PROGRESS] },
  { label: "QA", statuses: [TenantStatus.QA] },
  { label: "Launched", statuses: [TenantStatus.LAUNCHED] },
  { label: "Active", statuses: [TenantStatus.ACTIVE] },
  { label: "At risk", statuses: [TenantStatus.AT_RISK] },
  { label: "Dormant", statuses: [TenantStatus.CHURNED, TenantStatus.PAUSED] },
];

export default async function PipelinePage() {
  await requireAgency();

  const orgs = await prisma.organization.findMany({
    where: { orgType: OrgType.CLIENT },
    orderBy: { updatedAt: "desc" },
  });

  const columns = COLUMNS.map((col) => ({
    ...col,
    items: orgs
      .filter((o) => col.statuses.includes(o.status))
      .map(toItem),
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Pipeline</h1>
          <p className="text-sm opacity-60 mt-1">
            Every tenant, by status. Change a card's status to move it
            between columns. Status flips write an audit row.
          </p>
        </div>
        <div className="text-xs opacity-60">
          {orgs.length} tenants · {orgs.filter((o) => o.status === TenantStatus.ACTIVE).length} active
        </div>
      </header>

      <div
        className="grid gap-3 overflow-x-auto pb-4"
        style={{
          gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(200px, 1fr))`,
        }}
      >
        {columns.map((col) => (
          <section key={col.label} className="min-w-0 space-y-3">
            <header className="flex items-center justify-between">
              <h3 className="text-[10px] tracking-widest uppercase opacity-60">
                {col.label}
              </h3>
              <span className="text-[10px] bg-muted rounded px-1.5 py-0.5">
                {col.items.length}
              </span>
            </header>
            <div className="border-t" />
            <div className="space-y-2">
              {col.items.length === 0 ? (
                <p className="border border-dashed rounded-md p-3 text-[11px] opacity-40 text-center">
                  Empty
                </p>
              ) : (
                col.items.map((item) => (
                  <TenantPipelineCard key={item.id} item={item} />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
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
