import type { Metadata } from "next";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/settings/audit-log — Self-serve audit trail.
//
// AuditEvent rows already track every meaningful state change in the
// platform (org/property/integration/role mutations) but were only visible
// to agency users via /admin. This exposes the org's own events to the
// client so they can answer "who changed what?" without filing a ticket.
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where: { orgId: string; entityType?: string } = { orgId: scope.orgId };
  if (sp.entity) where.entityType = sp.entity;

  const [events, totalCount, entityTypes] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        description: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.groupBy({
      by: ["entityType"],
      where: { orgId: scope.orgId },
      _count: { _all: true },
      orderBy: { _count: { entityType: "desc" } },
      take: 20,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <Link
            href="/portal/settings"
            className="hover:underline"
          >
            ← Settings
          </Link>
        }
        title="Audit log"
        description={`${totalCount.toLocaleString()} events recorded for your account. Read-only — every meaningful action gets logged automatically.`}
      />

      {/* Entity filter pills */}
      {entityTypes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterPill href="/portal/settings/audit-log" active={!sp.entity}>
            All ({totalCount.toLocaleString()})
          </FilterPill>
          {entityTypes.map((e) => (
            <FilterPill
              key={e.entityType}
              href={`/portal/settings/audit-log?entity=${encodeURIComponent(e.entityType)}`}
              active={sp.entity === e.entityType}
            >
              {humanEntity(e.entityType)} ({e._count._all.toLocaleString()})
            </FilterPill>
          ))}
        </div>
      ) : null}

      <DashboardSection
        title={
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Events
          </span>
        }
        eyebrow={
          totalCount === 0
            ? "Empty"
            : `Showing ${rangeStart}–${rangeEnd} of ${totalCount.toLocaleString()}`
        }
        description="Most recent first. Each row links to the affected entity when possible."
      >
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No events match this filter.
          </p>
        ) : (
          <ul className="divide-y divide-border -my-2">
            {events.map((e) => {
              const who =
                [e.user?.firstName, e.user?.lastName].filter(Boolean).join(" ") ||
                e.user?.email ||
                "System";
              const link = entityLink(e.entityType, e.entityId);
              return (
                <li key={e.id} className="py-3">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground mb-0.5">
                        <span>{e.action}</span>
                        <span aria-hidden="true">·</span>
                        <span>{humanEntity(e.entityType)}</span>
                      </div>
                      {e.description ? (
                        <p className="text-xs text-foreground leading-snug">
                          {e.description}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No description recorded
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>{who}</span>
                        <span aria-hidden="true">·</span>
                        <span title={format(e.createdAt, "PPpp")}>
                          {formatDistanceToNow(e.createdAt, { addSuffix: true })}
                        </span>
                        {link ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <Link
                              href={link}
                              className="text-foreground hover:text-primary underline-offset-2 hover:underline"
                            >
                              View
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardSection>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Pager page={page} totalPages={totalPages} entity={sp.entity} delta={-1} label="Previous" />
            <Pager page={page} totalPages={totalPages} entity={sp.entity} delta={1} label="Next" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </Link>
  );
}

function Pager({
  page,
  totalPages,
  entity,
  delta,
  label,
}: {
  page: number;
  totalPages: number;
  entity?: string;
  delta: -1 | 1;
  label: string;
}) {
  const next = page + delta;
  if (next < 1 || next > totalPages) {
    return (
      <span className="px-3 py-1.5 border border-border rounded-md opacity-40 cursor-not-allowed select-none">
        {label}
      </span>
    );
  }
  const params = new URLSearchParams();
  params.set("page", String(next));
  if (entity) params.set("entity", entity);
  return (
    <Link
      href={`/portal/settings/audit-log?${params.toString()}`}
      className="px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors"
    >
      {label}
    </Link>
  );
}

function humanEntity(entityType: string): string {
  // Camel/Pascal-case → human-readable
  const spaced = entityType.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function entityLink(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case "Lead":
      return `/portal/leads/${entityId}`;
    case "Property":
      return `/portal/properties/${entityId}`;
    case "ChatbotConversation":
      return `/portal/conversations/${entityId}`;
    case "CreativeRequest":
      return `/portal/creative/${entityId}`;
    case "Visitor":
      return `/portal/visitors/${entityId}`;
    case "Report":
      return `/portal/reports/${entityId}`;
    default:
      return null;
  }
}
