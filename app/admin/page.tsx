import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType, TenantStatus } from "@prisma/client";
import { StatCard } from "@/components/admin/stat-card";

export const metadata: Metadata = { title: "Agency overview" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

export default async function AdminHome() {
  await requireAgency();

  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY);

  const [
    activeClients,
    atRiskClients,
    tenantCount,
    intakeThisMonth,
    pendingIntake,
    leadsThisMonth,
    leadsTotal,
    visitorsThisMonth,
    conversationsThisMonth,
    openCreativeRequests,
    mrrRows,
    recentSubmissions,
  ] = await Promise.all([
    prisma.organization.count({
      where: { orgType: OrgType.CLIENT, status: TenantStatus.ACTIVE },
    }),
    prisma.organization.count({
      where: { orgType: OrgType.CLIENT, status: TenantStatus.AT_RISK },
    }),
    prisma.organization.count({ where: { orgType: OrgType.CLIENT } }),
    prisma.intakeSubmission.count({
      where: { submittedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.intakeSubmission.count({
      where: { reviewedAt: null, convertedAt: null },
    }),
    prisma.lead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.lead.count(),
    prisma.visitor.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.chatbotConversation.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.creativeRequest.count({
      where: { status: { in: ["SUBMITTED", "IN_REVIEW", "IN_PROGRESS"] } },
    }),
    prisma.organization.aggregate({
      where: {
        orgType: OrgType.CLIENT,
        subscriptionStatus: { in: ["ACTIVE", "TRIALING"] },
      },
      _sum: { mrrCents: true },
    }),
    prisma.intakeSubmission.findMany({
      orderBy: { submittedAt: "desc" },
      take: 5,
    }),
  ]);

  const mrrUsd = Math.round((mrrRows._sum.mrrCents ?? 0) / 100);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Agency overview</h1>
          <p className="text-sm opacity-60 mt-1">
            Cross-tenant metrics, last 30 days. Dig into a client from the
            Clients tab, or jump to the pipeline.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/intakes"
            className="text-xs px-3 py-2 border rounded"
          >
            Intake queue, {pendingIntake}
          </Link>
          <Link
            href="/admin/pipeline"
            className="text-xs px-3 py-2 bg-foreground text-background rounded"
          >
            Pipeline
          </Link>
        </div>
      </header>

      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <StatCard
          label="Active clients"
          value={activeClients}
          hint={`${tenantCount} total tenants`}
        />
        <StatCard
          label="At-risk"
          value={atRiskClients}
          tone={atRiskClients > 0 ? "warn" : undefined}
        />
        <StatCard label="MRR" value={`$${mrrUsd.toLocaleString()}`} />
        <StatCard label="Intake, 30d" value={intakeThisMonth} />
        <StatCard
          label="Leads, 30d"
          value={leadsThisMonth}
          hint={`${leadsTotal} all-time`}
        />
        <StatCard label="Visitors, 30d" value={visitorsThisMonth} />
        <StatCard label="Chats, 30d" value={conversationsThisMonth} />
        <StatCard
          label="Open creative"
          value={openCreativeRequests}
          tone={openCreativeRequests > 0 ? "warn" : undefined}
        />
      </section>

      <section>
        <header className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-xl font-bold">Recent intakes</h2>
          <Link href="/admin/intakes" className="text-xs opacity-70 underline">
            View all
          </Link>
        </header>
        {recentSubmissions.length === 0 ? (
          <p className="text-sm opacity-60 border rounded-md p-4">
            No intake submissions yet.
          </p>
        ) : (
          <ul className="border rounded-md divide-y">
            {recentSubmissions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/admin/intakes/${s.id}`}
                  className="block px-4 py-3 text-sm hover:bg-muted/40"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium truncate">
                      {s.companyName}
                    </span>
                    <span className="text-xs opacity-60 whitespace-nowrap">
                      {s.status}
                    </span>
                  </div>
                  <div className="text-xs opacity-60">
                    {s.propertyType}
                    {s.currentBackendPlatform
                      ? `, ${s.currentBackendPlatform}`
                      : ""}
                    {s.biggestPainPoint ? `, "${s.biggestPainPoint}"` : ""}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
