import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { CreativeRequestStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { StatCard } from "@/components/admin/stat-card";

export const metadata: Metadata = { title: "Creative studio" };
export const dynamic = "force-dynamic";

export default async function CreativePage() {
  const scope = await requireScope();
  const tenant = tenantWhere(scope);

  const [requests, counts] = await Promise.all([
    prisma.creativeRequest.findMany({
      where: tenant,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { property: { select: { id: true, name: true } } },
    }),
    prisma.creativeRequest.groupBy({
      by: ["status"],
      where: tenant,
      _count: { _all: true },
    }),
  ]);

  const countsByStatus = new Map<CreativeRequestStatus, number>();
  for (const r of counts) countsByStatus.set(r.status, r._count._all);
  const open =
    (countsByStatus.get(CreativeRequestStatus.SUBMITTED) ?? 0) +
    (countsByStatus.get(CreativeRequestStatus.IN_REVIEW) ?? 0) +
    (countsByStatus.get(CreativeRequestStatus.IN_PROGRESS) ?? 0) +
    (countsByStatus.get(CreativeRequestStatus.REVISION_REQUESTED) ?? 0);
  const delivered = countsByStatus.get(CreativeRequestStatus.DELIVERED) ?? 0;
  const approved = countsByStatus.get(CreativeRequestStatus.APPROVED) ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Creative studio</h1>
          <p className="text-sm opacity-60 mt-1">
            Submit ad, email, story, or flyer creative. The agency team
            delivers, you review, we iterate.
          </p>
        </div>
        <Link
          href="/portal/creative/new"
          className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-4 py-2 text-xs font-semibold rounded"
        >
          New request
        </Link>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Open"
          value={open}
          tone={open > 0 ? "warn" : undefined}
        />
        <StatCard
          label="Delivered, awaiting review"
          value={delivered}
          tone={delivered > 0 ? "success" : undefined}
        />
        <StatCard label="Approved" value={approved} />
        <StatCard label="Total" value={requests.length} />
      </section>

      {requests.length === 0 ? (
        <p className="text-sm opacity-60 border rounded-md p-6">
          No creative requests yet. Start one from the button above, we'll
          take it from there.
        </p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/portal/creative/${r.id}`}
                className="block border rounded-md p-4 hover:bg-muted/40"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.title}</div>
                    <div className="text-xs opacity-60">
                      {r.format}
                      {r.property ? ` · ${r.property.name}` : ""} · {r.status}
                      {r.revisionCount
                        ? ` · ${r.revisionCount} revisions`
                        : ""}
                    </div>
                  </div>
                  <div className="text-right text-xs opacity-60 whitespace-nowrap">
                    {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
