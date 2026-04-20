import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import {
  ApplicationStatus,
  LeadStatus,
  TourStatus,
  VisitorIdentificationStatus,
} from "@prisma/client";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { SetupBanner } from "@/components/portal/setup/setup-banner";
import { formatDistanceToNow } from "date-fns";
import {
  humanLeadSource,
  humanLeadStatus,
  leadStatusTone,
} from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<{ showSetup?: string }>;
}) {
  const scope = await requireScope();
  const { showSetup } = await searchParams;
  const forceShowSetup = showSetup === "1";
  const since30d = new Date(Date.now() - 30 * DAY);
  const where = tenantWhere<{ orgId?: string }>(scope);

  const [
    propertiesCount,
    leadsTotal,
    leadsNew30d,
    toursScheduled,
    applicationsSubmitted,
    visitorsIdentified30d,
    chatbotConvos30d,
    listingsAvailable,
    openCreative,
    recentLeads,
  ] = await Promise.all([
    prisma.property.count({ where }),
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { ...where, createdAt: { gte: since30d } } }),
    prisma.tour.count({
      where: {
        status: TourStatus.SCHEDULED,
        lead: where,
      },
    }),
    prisma.application.count({
      where: {
        status: ApplicationStatus.SUBMITTED,
        lead: where,
      },
    }),
    prisma.visitor.count({
      where: {
        ...where,
        status: VisitorIdentificationStatus.IDENTIFIED,
        firstSeenAt: { gte: since30d },
      },
    }),
    prisma.chatbotConversation.count({
      where: { ...where, createdAt: { gte: since30d } },
    }),
    prisma.listing.count({
      where: {
        isAvailable: true,
        property: where,
      },
    }),
    prisma.creativeRequest.count({
      where: {
        ...where,
        status: { in: ["SUBMITTED", "IN_REVIEW", "IN_PROGRESS"] },
      },
    }),
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { property: { select: { name: true } } },
    }),
  ]);

  const leadsByStatus = await prisma.lead.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });
  const statusCounts = new Map<LeadStatus, number>();
  for (const row of leadsByStatus) {
    statusCounts.set(row.status, row._count._all);
  }

  const funnel: Array<{ label: string; value: number; status: LeadStatus }> = [
    { label: "New", value: statusCounts.get(LeadStatus.NEW) ?? 0, status: LeadStatus.NEW },
    { label: "Contacted", value: statusCounts.get(LeadStatus.CONTACTED) ?? 0, status: LeadStatus.CONTACTED },
    { label: "Tour scheduled", value: statusCounts.get(LeadStatus.TOUR_SCHEDULED) ?? 0, status: LeadStatus.TOUR_SCHEDULED },
    { label: "Toured", value: statusCounts.get(LeadStatus.TOURED) ?? 0, status: LeadStatus.TOURED },
    { label: "Applied", value: statusCounts.get(LeadStatus.APPLIED) ?? 0, status: LeadStatus.APPLIED },
    { label: "Approved", value: statusCounts.get(LeadStatus.APPROVED) ?? 0, status: LeadStatus.APPROVED },
    { label: "Signed", value: statusCounts.get(LeadStatus.SIGNED) ?? 0, status: LeadStatus.SIGNED },
  ];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <div className="space-y-6">
      <SetupBanner forceShow={forceShowSetup} />

      <PageHeader
        title="Dashboard"
        description="Last 30 days unless noted. Click into Properties, Leads, and Conversations for full detail."
      />

      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard
          label="Leads (30d)"
          value={leadsNew30d}
          hint={`${leadsTotal} all-time`}
        />
        <StatCard label="Tours scheduled" value={toursScheduled} />
        <StatCard label="Applications" value={applicationsSubmitted} />
        <StatCard
          label="Available units"
          value={listingsAvailable}
          hint={`${propertiesCount} propert${propertiesCount === 1 ? "y" : "ies"}`}
        />
        <StatCard
          label="Identified visitors"
          value={visitorsIdentified30d}
          hint="Last 30 days"
        />
        <StatCard
          label="Chatbot chats"
          value={chatbotConvos30d}
          hint="Last 30 days"
        />
        <StatCard label="Open creative" value={openCreative} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard label="Leads funnel">
          <ul className="space-y-2.5">
            {funnel.map((row) => (
              <li key={row.status} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-28 shrink-0">
                  {row.label}
                </span>
                <span className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <span
                    className="block h-full bg-primary/90 rounded-full transition-all"
                    style={{
                      width: `${Math.max(4, Math.round((row.value / maxFunnel) * 100))}%`,
                    }}
                  />
                </span>
                <span className="text-xs tabular-nums w-10 text-right font-medium text-foreground">
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          label="Recent leads"
          action={
            <Link
              href="/portal/leads"
              className="text-xs font-medium text-primary hover:underline underline-offset-2"
            >
              View all →
            </Link>
          }
        >
          {recentLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No leads yet. Once the chatbot and pixel are live, new leads
              land here automatically.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentLeads.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/portal/leads/${l.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-accent/40 rounded-md px-1 -mx-1"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-foreground truncate">
                        {l.firstName
                          ? `${l.firstName}${l.lastName ? " " + l.lastName : ""}`
                          : (l.email ?? "Anonymous")}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {humanLeadSource(l.source)}
                        {l.property ? ` · ${l.property.name}` : ""}
                      </div>
                    </div>
                    <StatusBadge tone={leadStatusTone(l.status)}>
                      {humanLeadStatus(l.status)}
                    </StatusBadge>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(l.createdAt, { addSuffix: true })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </section>
    </div>
  );
}
