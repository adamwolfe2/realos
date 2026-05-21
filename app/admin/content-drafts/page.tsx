import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { redirect } from "next/navigation";
import { DraftStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Content drafts" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/content-drafts
//
// Cross-tenant queue of drafts awaiting review. Sorted oldest-first so
// operators don't wait on us. Default filter = PENDING_REVIEW; toggles
// at the top swap to CHANGES_REQUESTED / APPROVED / SHIPPED for audit.
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: DraftStatus; label: string }[] = [
  { value: DraftStatus.PENDING_REVIEW, label: "Pending" },
  { value: DraftStatus.CHANGES_REQUESTED, label: "Changes requested" },
  { value: DraftStatus.APPROVED, label: "Approved" },
  { value: DraftStatus.SHIPPED, label: "Shipped" },
  { value: DraftStatus.REJECTED, label: "Rejected" },
];

function fmtRelative(d: Date | null | undefined): string {
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) {
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    return `${mins}m ago`;
  }
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function AdminContentDraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { error } = await requireAdmin();
  if (error) {
    redirect("/sign-in");
  }

  const sp = await searchParams;
  const status = STATUS_OPTIONS.find((o) => o.value === sp.status)
    ? (sp.status as DraftStatus)
    : DraftStatus.PENDING_REVIEW;

  const drafts = await prisma.contentDraft.findMany({
    where: { status },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
    take: 200,
    include: {
      org: { select: { id: true, name: true } },
      property: { select: { id: true, name: true } },
    },
  });

  // Status counts for the filter chips
  const statusCounts = await prisma.contentDraft.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countMap = new Map(statusCounts.map((s) => [s.status, s._count._all]));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
            Admin
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            Content drafts
          </h1>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-2xl">
            Review AI-generated drafts before they ship. Approve, request changes,
            or reject with notes. Approved drafts close the linked recommendation.
          </p>
        </div>
      </header>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = opt.value === status;
          const count = countMap.get(opt.value) ?? 0;
          return (
            <Link
              key={opt.value}
              href={`/admin/content-drafts?status=${opt.value}`}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                isActive
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-[13px] font-medium text-foreground">
            Nothing in {STATUS_OPTIONS.find((o) => o.value === status)?.label.toLowerCase()}.
          </p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Operators generate drafts from /portal/seo/agent. They land here for review.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
            >
              <Link
                href={`/admin/content-drafts/${d.id}`}
                className="block space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary uppercase tracking-wide">
                        {d.format.replace(/_/g, " ").toLowerCase()}
                      </span>
                      <span className="text-[12px] font-medium text-foreground truncate">
                        {d.org?.name ?? d.orgId}
                        {d.property ? ` · ${d.property.name}` : ""}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] text-foreground line-clamp-2 leading-snug">
                      {d.brief}
                    </p>
                    {d.targetQuery ? (
                      <p className="mt-1 text-[11px] font-mono text-muted-foreground">
                        target: {d.targetQuery}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    {d.estimatedScore != null ? (
                      <div className="text-[11px] font-mono text-muted-foreground">
                        score{" "}
                        <span
                          className={
                            d.estimatedScore >= 80
                              ? "text-green-600"
                              : d.estimatedScore >= 60
                                ? "text-amber-600"
                                : "text-red-600"
                          }
                        >
                          {d.estimatedScore}
                        </span>
                      </div>
                    ) : null}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {fmtRelative(d.submittedAt ?? d.createdAt)}
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
