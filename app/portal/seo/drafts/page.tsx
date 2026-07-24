import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { DraftStatus } from "@prisma/client";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Content drafts" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/seo/drafts — operator cross-property view of every content
// draft they've sent for review. Mirrors /admin/content-drafts shape
// but scoped to the calling org + the operator's property-RBAC set.
//
// Default filter = PENDING_REVIEW + CHANGES_REQUESTED so operators see
// what needs their attention first. Chip strip switches to APPROVED /
// SHIPPED / REJECTED for audit.
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: Array<{
  value: DraftStatus | "ACTIVE";
  label: string;
}> = [
  { value: "ACTIVE", label: "Active" },
  { value: DraftStatus.PENDING_REVIEW, label: "Pending review" },
  { value: DraftStatus.CHANGES_REQUESTED, label: "Changes requested" },
  { value: DraftStatus.APPROVED, label: "Approved" },
  { value: DraftStatus.SHIPPED, label: "Shipped" },
  { value: DraftStatus.REJECTED, label: "Rejected" },
];

// Single-blue cohesion across draft statuses. Matches /portal/content
// list + admin queue. No amber/green/red status pills.
const STATUS_TONE: Record<string, string> = {
  GENERATING:        "bg-muted text-muted-foreground",
  PENDING_REVIEW:    "bg-primary/10 text-primary",
  APPROVED:          "bg-primary/15 text-primary font-semibold",
  CHANGES_REQUESTED: "bg-muted text-foreground",
  REJECTED:          "bg-muted text-muted-foreground line-through",
  SHIPPED:           "bg-primary text-primary-foreground",
  EXPIRED:           "bg-muted text-muted-foreground/70",
};

function fmtAge(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(0, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function PortalDraftsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;

  const requested = sp.status ?? "ACTIVE";
  const filter = STATUS_OPTIONS.find((o) => o.value === requested)
    ? (requested as (typeof STATUS_OPTIONS)[number]["value"])
    : "ACTIVE";

  const where: Record<string, unknown> = { ...tenantWhere(scope) };
  if (scope.allowedPropertyIds) {
    where.propertyId = { in: scope.allowedPropertyIds };
  }
  if (filter === "ACTIVE") {
    where.status = {
      in: [
        DraftStatus.GENERATING,
        DraftStatus.PENDING_REVIEW,
        DraftStatus.CHANGES_REQUESTED,
      ],
    };
  } else {
    where.status = filter as DraftStatus;
  }

  const [drafts, statusCounts] = await Promise.all([
    prisma.contentDraft.findMany({
      where: where as never,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        format: true,
        brief: true,
        targetQuery: true,
        status: true,
        estimatedScore: true,
        submittedAt: true,
        reviewedAt: true,
        reviewNotes: true,
        createdAt: true,
        propertyId: true,
        property: { select: { name: true } },
      },
    }),
    prisma.contentDraft.groupBy({
      by: ["status"],
      where: {
        ...tenantWhere(scope),
        ...(scope.allowedPropertyIds
          ? { propertyId: { in: scope.allowedPropertyIds } }
          : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const countMap = new Map(statusCounts.map((s) => [s.status, s._count._all]));
  const activeCount =
    (countMap.get("GENERATING") ?? 0) +
    (countMap.get("PENDING_REVIEW") ?? 0) +
    (countMap.get("CHANGES_REQUESTED") ?? 0);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/portal/seo/agent"
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          &larr; SEO Agent
        </Link>
      </div>

      <PageHeader
        eyebrow="Content drafts"
        title="Your drafts inbox"
        description="Every AI-generated draft across your portfolio. LeaseStack reviews each one before anything ships."
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = opt.value === filter;
          const count =
            opt.value === "ACTIVE" ? activeCount : (countMap.get(opt.value) ?? 0);
          return (
            <Link
              key={opt.value}
              href={`/portal/seo/drafts?status=${opt.value}`}
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
            {filter === "ACTIVE"
              ? "No drafts in flight."
              : `No ${STATUS_OPTIONS.find((o) => o.value === filter)?.label.toLowerCase()} drafts.`}
          </p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Open the SEO Agent for a property and click <span className="font-medium">Generate draft</span>.
          </p>
          <Link
            href="/portal/seo/agent"
            className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            Open SEO Agent →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {drafts.map((d) => {
            const fmt = d.format.replace(/_/g, " ").toLowerCase();
            const tone = STATUS_TONE[d.status] ?? STATUS_TONE.GENERATING;
            return (
              <li
                key={d.id}
                className="rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors"
              >
                <Link
                  href={`/portal/seo/agent/drafts/${d.id}`}
                  className="block p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-primary">
                        {fmt}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono uppercase ${tone}`}
                      >
                        {d.status.replace(/_/g, " ").toLowerCase()}
                      </span>
                      {d.property?.name ? (
                        <span className="text-[11px] text-muted-foreground">
                          {d.property.name}
                        </span>
                      ) : null}
                      {d.estimatedScore != null ? (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          est. {d.estimatedScore}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {fmtAge(d.submittedAt ?? d.createdAt)}
                    </span>
                  </div>
                  <p className="text-[13px] text-foreground line-clamp-2 leading-snug">
                    {d.brief}
                  </p>
                  {d.targetQuery ? (
                    <p className="mt-1 text-[11px] font-mono text-muted-foreground">
                      target: {d.targetQuery}
                    </p>
                  ) : null}
                  {d.reviewNotes ? (
                    <div className="mt-2 rounded-md bg-primary/10 px-2.5 py-1.5 border border-primary/20">
                      <p className="text-[10px] font-mono uppercase tracking-wide text-primary mb-0.5">
                        Notes from LeaseStack
                      </p>
                      <p className="text-[12px] text-foreground whitespace-pre-wrap leading-snug">
                        {d.reviewNotes}
                      </p>
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
