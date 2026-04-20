import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { CreativeRequestStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { humanCreativeStatus } from "@/lib/format";
import type { BadgeTone } from "@/lib/format";

export const metadata: Metadata = { title: "Creative queue" };
export const dynamic = "force-dynamic";

const COLUMNS: Array<{ label: string; statuses: CreativeRequestStatus[] }> = [
  { label: "Submitted", statuses: [CreativeRequestStatus.SUBMITTED] },
  { label: "In review", statuses: [CreativeRequestStatus.IN_REVIEW] },
  { label: "In progress", statuses: [CreativeRequestStatus.IN_PROGRESS] },
  { label: "Revision", statuses: [CreativeRequestStatus.REVISION_REQUESTED] },
  { label: "Delivered", statuses: [CreativeRequestStatus.DELIVERED] },
  { label: "Approved", statuses: [CreativeRequestStatus.APPROVED] },
  { label: "Rejected", statuses: [CreativeRequestStatus.REJECTED] },
];

function creativeStatusTone(s: CreativeRequestStatus): BadgeTone {
  switch (s) {
    case CreativeRequestStatus.APPROVED:
    case CreativeRequestStatus.DELIVERED:
      return "success";
    case CreativeRequestStatus.IN_PROGRESS:
    case CreativeRequestStatus.IN_REVIEW:
      return "info";
    case CreativeRequestStatus.REVISION_REQUESTED:
      return "warning";
    case CreativeRequestStatus.REJECTED:
      return "danger";
    case CreativeRequestStatus.SUBMITTED:
    default:
      return "neutral";
  }
}

export default async function CreativeQueue() {
  await requireAgency();

  const rows = await prisma.creativeRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      org: { select: { id: true, name: true, slug: true } },
      property: { select: { name: true } },
    },
  });

  const columns = COLUMNS.map((col) => ({
    ...col,
    items: rows.filter((r) => col.statuses.includes(r.status)),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Creative queue"
        description="Every tenant's open creative requests. Click a card for the full brief, references, and conversation thread."
        actions={
          <div className="text-xs text-muted-foreground">
            {rows.length} total
          </div>
        }
      />

      <div
        className="grid gap-3 overflow-x-auto pb-4"
        style={{
          gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(220px, 1fr))`,
        }}
      >
        {columns.map((col) => (
          <section key={col.label} className="min-w-0 flex flex-col gap-2">
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
              {col.items.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-3 text-[11px] text-muted-foreground/60 text-center">
                  Empty
                </p>
              ) : (
                col.items.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/creative-requests/${r.id}`}
                    className="block rounded-lg border border-border bg-card p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="font-medium text-sm text-foreground truncate">
                      {r.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {r.org.name}
                      {r.property ? ` · ${r.property.name}` : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {r.format}
                      {r.revisionCount ? ` · ${r.revisionCount} revs` : ""}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <StatusBadge tone={creativeStatusTone(r.status)}>
                        {humanCreativeStatus(r.status)}
                      </StatusBadge>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
