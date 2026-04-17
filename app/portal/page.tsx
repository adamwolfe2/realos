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
import { formatDistanceToNow } from "date-fns";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

export default async function PortalHome() {
  const scope = await requireScope();
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
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-bold">Dashboard</h1>
        <p className="text-sm opacity-60 mt-1">
          Last 30 days unless noted. Click into Properties, Leads, and
          Conversations for full detail.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          hint={`${propertiesCount} properties`}
        />
        <StatCard label="Identified visitors (30d)" value={visitorsIdentified30d} />
        <StatCard label="Chatbot chats (30d)" value={chatbotConvos30d} />
        <StatCard label="Open creative" value={openCreative} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-md p-5">
          <h2 className="font-serif text-lg font-bold mb-4">Leads funnel</h2>
          <ul className="space-y-2">
            {funnel.map((row) => (
              <li key={row.status} className="flex items-center gap-3">
                <span className="text-xs opacity-70 w-28 shrink-0">
                  {row.label}
                </span>
                <span className="flex-1 h-3 bg-muted rounded overflow-hidden">
                  <span
                    className="block h-full bg-foreground"
                    style={{
                      width: `${Math.max(4, Math.round((row.value / maxFunnel) * 100))}%`,
                    }}
                  />
                </span>
                <span className="text-xs tabular-nums w-10 text-right opacity-80">
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border rounded-md p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-lg font-bold">Recent leads</h2>
            <Link
              href="/portal/leads"
              className="text-xs underline opacity-70"
            >
              View all
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className="text-sm opacity-60">
              No leads yet. Once the chatbot and pixel are live, they'll land
              here.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {recentLeads.map((l) => (
                <li key={l.id} className="py-2">
                  <Link
                    href={`/portal/leads/${l.id}`}
                    className="flex items-baseline justify-between gap-3 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {l.firstName
                          ? `${l.firstName}${l.lastName ? " " + l.lastName : ""}`
                          : l.email ?? "Anonymous"}
                      </div>
                      <div className="text-[11px] opacity-60">
                        {l.source} · {l.status}
                        {l.property ? ` · ${l.property.name}` : ""}
                      </div>
                    </div>
                    <div className="text-[11px] opacity-60 whitespace-nowrap">
                      {formatDistanceToNow(l.createdAt, { addSuffix: true })}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
