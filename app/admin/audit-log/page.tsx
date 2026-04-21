import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";
import { AuditAction } from "@prisma/client";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const ACTION_TONE: Record<AuditAction, string> = {
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-sky-100 text-sky-700",
  DELETE: "bg-rose-100 text-rose-700",
  IMPERSONATE_START: "bg-amber-100 text-amber-700",
  IMPERSONATE_END: "bg-amber-100 text-amber-700",
  LOGIN: "bg-foreground/10 text-foreground",
  EXPORT: "bg-violet-100 text-violet-700",
  SETTING_CHANGE: "bg-indigo-100 text-indigo-700",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; orgId?: string }>;
}) {
  await requireAgency();
  const { action, orgId } = await searchParams;

  const where: { action?: AuditAction; orgId?: string } = {};
  if (action && action in AuditAction) {
    where.action = action as AuditAction;
  }
  if (orgId) where.orgId = orgId;

  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: {
      org: { select: { name: true, slug: true } },
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  const actionCounts = await prisma.auditEvent.groupBy({
    by: ["action"],
    _count: { _all: true },
    where: {
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Cross-tenant audit trail. All writes, deletes, exports, and impersonations across the platform."
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {Object.values(AuditAction).map((a) => {
          const count =
            actionCounts.find((c) => c.action === a)?._count._all ?? 0;
          return (
            <Link
              key={a}
              href={`/admin/audit-log?action=${a}`}
              className="rounded-lg border border-border bg-card p-3 hover:bg-muted/30"
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {a.toLowerCase().replace(/_/g, " ")}
              </div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {count}
              </div>
              <div className="text-[10px] text-muted-foreground">last 7 days</div>
            </Link>
          );
        })}
      </div>

      {(action || orgId) && (
        <div className="text-sm">
          Filtered by{" "}
          {action && (
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
              {action}
            </span>
          )}{" "}
          <Link href="/admin/audit-log" className="text-xs underline ml-2">
            Clear
          </Link>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">When</th>
              <th className="px-4 py-3 text-left font-medium">Tenant</th>
              <th className="px-4 py-3 text-left font-medium">Actor</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Entity</th>
              <th className="px-4 py-3 text-left font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No audit events match this filter.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(e.createdAt, { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.org.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.org.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {e.user ? (
                      (() => {
                        const fullName = [e.user.firstName, e.user.lastName]
                          .filter(Boolean)
                          .join(" ");
                        return (
                          <>
                            <div>{fullName || e.user.email}</div>
                            {fullName && (
                              <div className="text-muted-foreground">
                                {e.user.email}
                              </div>
                            )}
                          </>
                        );
                      })()
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${ACTION_TONE[e.action]}`}
                    >
                      {e.action.toLowerCase().replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <code className="font-mono">{e.entityType}</code>
                    {e.entityId && (
                      <div className="text-muted-foreground truncate max-w-[160px]">
                        {e.entityId}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-md">
                    {e.description ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing the most recent {PAGE_SIZE} events. Older events live in the
        database; cursor-based pagination is a follow-up.
      </p>
    </div>
  );
}
