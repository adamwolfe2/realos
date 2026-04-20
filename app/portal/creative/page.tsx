import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { CreativeRequestStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { StatCard } from "@/components/admin/stat-card";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { humanCreativeStatus } from "@/lib/format";

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
      <PageHeader
        title="Creative studio"
        description="Submit ad, email, story, or flyer creative. The agency team delivers, you review, we iterate."
        actions={
          <Link
            href="/portal/creative/new"
            className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            New request
          </Link>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No creative requests yet. Start one from the button above, the
            studio takes it from there.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/portal/creative/${r.id}`}
                className="block rounded-lg border border-border bg-card p-4 hover:border-foreground/20 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {r.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{r.format.replace(/_/g, " ").toLowerCase()}</span>
                      {r.property ? (
                        <>
                          <span>·</span>
                          <span>{r.property.name}</span>
                        </>
                      ) : null}
                      {r.revisionCount ? (
                        <>
                          <span>·</span>
                          <span>
                            {r.revisionCount} revision
                            {r.revisionCount === 1 ? "" : "s"}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge tone="info">
                      {humanCreativeStatus(r.status)}
                    </StatusBadge>
                    <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                    </div>
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
