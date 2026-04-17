import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { VisitorIdentificationStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { StatCard } from "@/components/admin/stat-card";

export const metadata: Metadata = { title: "Visitors" };
export const dynamic = "force-dynamic";

export default async function VisitorsPage() {
  const scope = await requireScope();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const tenant = tenantWhere(scope);

  const [visitors, integration, totals] = await Promise.all([
    prisma.visitor.findMany({
      where: { ...tenant, lastSeenAt: { gte: since30d } },
      orderBy: [{ intentScore: "desc" }, { lastSeenAt: "desc" }],
      take: 300,
    }),
    prisma.cursiveIntegration.findUnique({
      where: { orgId: scope.orgId },
      select: {
        cursivePixelId: true,
        pixelScriptUrl: true,
        installedOnDomain: true,
        provisionedAt: true,
        lastEventAt: true,
        totalEventsCount: true,
      },
    }),
    prisma.visitor.groupBy({
      by: ["status"],
      where: { ...tenant, lastSeenAt: { gte: since30d } },
      _count: { _all: true },
    }),
  ]);

  const countsByStatus = new Map<VisitorIdentificationStatus, number>();
  for (const row of totals) countsByStatus.set(row.status, row._count._all);
  const total = visitors.length;
  const identified =
    (countsByStatus.get(VisitorIdentificationStatus.IDENTIFIED) ?? 0) +
    (countsByStatus.get(VisitorIdentificationStatus.ENRICHED) ?? 0) +
    (countsByStatus.get(VisitorIdentificationStatus.MATCHED_TO_LEAD) ?? 0);
  const matched =
    countsByStatus.get(VisitorIdentificationStatus.MATCHED_TO_LEAD) ?? 0;
  const identifiedRate = total > 0 ? Math.round((identified / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">
            Website visitors, 30d
          </h1>
          <p className="text-sm opacity-60 mt-1">
            Captured by your Cursive pixel. Identified visitors get
            auto-emailed within an hour; every anonymous visitor can be
            synced to your ad audiences for retargeting.
          </p>
        </div>
        <Link
          href="/api/tenant/visitors/export"
          className="text-xs px-3 py-2 border rounded"
        >
          Export hashed emails (CSV)
        </Link>
      </header>

      {!integration?.pixelScriptUrl ? (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-md p-4 text-sm">
          Pixel hasn't been provisioned yet. Your account manager provisions
          it from the agency admin. Once live, visitors populate here within
          seconds.
        </div>
      ) : (
        <p className="text-xs opacity-70">
          Pixel installed on{" "}
          <span className="font-semibold">
            {integration.installedOnDomain ?? "unknown host"}
          </span>
          {integration.lastEventAt
            ? `, last event ${formatDistanceToNow(integration.lastEventAt, {
                addSuffix: true,
              })}`
            : ", no events yet"}
          . Total events: {integration.totalEventsCount ?? 0}.
        </p>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total visitors" value={total} />
        <StatCard
          label="Identified"
          value={identified}
          hint={`${identifiedRate}% ID rate`}
          tone={identifiedRate >= 40 ? "success" : undefined}
        />
        <StatCard label="Converted to lead" value={matched} />
        <StatCard
          label="Anonymous"
          value={
            countsByStatus.get(VisitorIdentificationStatus.ANONYMOUS) ?? 0
          }
        />
      </section>

      {visitors.length === 0 ? (
        <p className="text-sm opacity-60 border rounded-md p-6">
          No visitors in the last 30 days. Once the pixel is firing and the
          site has traffic, rows appear here.
        </p>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] tracking-widest uppercase opacity-60">
              <tr>
                <th className="text-left px-4 py-2">Visitor</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Intent</th>
                <th className="text-right px-4 py-2">Sessions</th>
                <th className="text-right px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-right px-4 py-2">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visitors.map((v) => {
                const displayName =
                  [v.firstName, v.lastName].filter(Boolean).join(" ") ||
                  (v.status === "ANONYMOUS" ? "Anonymous visitor" : "Identified");
                const minutes = Math.round((v.totalTimeSeconds ?? 0) / 60);
                return (
                  <tr key={v.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2">
                      <div className="font-medium">{displayName}</div>
                      <div className="text-[11px] opacity-60">
                        {v.status}
                        {v.outreachSent ? " · outreach sent" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {v.email ?? (
                        <span className="opacity-60">Not yet identified</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full bg-foreground"
                            style={{ width: `${v.intentScore}%` }}
                          />
                        </div>
                        <span className="text-[11px] tabular-nums">
                          {v.intentScore}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {v.sessionCount}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {minutes}m
                    </td>
                    <td className="px-4 py-2 text-xs opacity-80">
                      {v.utmSource ? v.utmSource : v.referrer ?? "direct"}
                    </td>
                    <td className="px-4 py-2 text-right text-xs opacity-60 whitespace-nowrap">
                      {formatDistanceToNow(v.lastSeenAt, { addSuffix: true })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
