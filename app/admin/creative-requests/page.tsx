import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { CreativeRequestStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";

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
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Creative queue</h1>
          <p className="text-sm opacity-60 mt-1">
            Every tenant's open creative requests. Click a card for the full
            brief, references, and conversation thread.
          </p>
        </div>
        <div className="text-xs opacity-60">{rows.length} total</div>
      </header>

      <div
        className="grid gap-3 overflow-x-auto pb-4"
        style={{
          gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(220px, 1fr))`,
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
                col.items.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/creative-requests/${r.id}`}
                    className="block border rounded-md p-3 hover:bg-muted/40"
                  >
                    <div className="font-medium text-sm truncate">
                      {r.title}
                    </div>
                    <div className="text-[11px] opacity-60 truncate">
                      {r.org.name}
                      {r.property ? ` · ${r.property.name}` : ""}
                    </div>
                    <div className="text-[11px] opacity-60 mt-1">
                      {r.format}
                      {r.revisionCount
                        ? ` · ${r.revisionCount} revs`
                        : ""}
                    </div>
                    <div className="text-[11px] opacity-60 mt-1">
                      {formatDistanceToNow(r.createdAt, { addSuffix: true })}
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
