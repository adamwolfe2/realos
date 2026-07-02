import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  SiteRequestStatus,
  type Prisma,
} from "@prisma/client";

export const metadata: Metadata = {
  title: `Site engine | ${BRAND_NAME} Admin`,
};
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/site-engine — operational queue for every SiteRequest. Lists every
// row (most-recent activity first), with counts grouped by status. Filter
// strip narrows to a single status. Each row clicks through to the detail
// page where Adam works the actual review.
// ---------------------------------------------------------------------------

const STATUS_GROUPS: { label: string; statuses: SiteRequestStatus[] }[] = [
  { label: "Inbound", statuses: ["SUBMITTED", "TRIAGE", "NEEDS_INFO"] },
  {
    label: "Active",
    statuses: [
      "QUALIFIED",
      "INSPIRATION_EXTRACTION",
      "SPEC_REVIEW",
      "READY_TO_BUILD",
      "IN_BUILD",
      "PREVIEW_READY",
      "CLIENT_REVIEW",
      "REVISION_REQUESTED",
    ],
  },
  { label: "Done", statuses: ["APPROVED", "DEPLOYED", "MAINTENANCE"] },
  { label: "Closed", statuses: ["DISQUALIFIED", "PAUSED", "CHURNED"] },
];

const STATUS_TONE: Record<SiteRequestStatus, string> = {
  SUBMITTED: "bg-blue-50 text-blue-700",
  TRIAGE: "bg-amber-50 text-amber-700",
  NEEDS_INFO: "bg-amber-50 text-amber-700",
  DISQUALIFIED: "bg-muted text-muted-foreground",
  QUALIFIED: "bg-emerald-50 text-emerald-700",
  INSPIRATION_EXTRACTION: "bg-indigo-50 text-indigo-700",
  SPEC_REVIEW: "bg-indigo-50 text-indigo-700",
  READY_TO_BUILD: "bg-emerald-50 text-emerald-700",
  IN_BUILD: "bg-indigo-50 text-indigo-700",
  PREVIEW_READY: "bg-emerald-50 text-emerald-700",
  CLIENT_REVIEW: "bg-amber-50 text-amber-700",
  REVISION_REQUESTED: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  DEPLOYED: "bg-primary/10 text-primary",
  MAINTENANCE: "bg-emerald-50 text-emerald-700",
  PAUSED: "bg-muted text-muted-foreground",
  CHURNED: "bg-muted text-muted-foreground",
};

export default async function AdminSiteEnginePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string }>;
}) {
  try {
    await requireAgency();
  } catch {
    redirect("/sign-in");
  }
  const { status, source } = await searchParams;

  const validStatus = status && Object.values(SiteRequestStatus).includes(status as SiteRequestStatus)
    ? (status as SiteRequestStatus)
    : null;

  const where: Prisma.SiteRequestWhereInput = {};
  if (validStatus) where.status = validStatus;
  if (source) where.source = source;

  const [requests, byStatus] = await Promise.all([
    prisma.siteRequest.findMany({
      where,
      orderBy: [{ lastActivityAt: "desc" }],
      take: 200,
      select: {
        id: true,
        slug: true,
        status: true,
        tier: true,
        priority: true,
        submittedByName: true,
        submittedByEmail: true,
        source: true,
        submittedAt: true,
        lastActivityAt: true,
        assignedTo: {
          select: { firstName: true, lastName: true, email: true },
        },
        org: { select: { id: true, name: true, slug: true } },
        intake: { select: { brandName: true, timelineExpectation: true } },
      },
    }),
    prisma.siteRequest.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countMap = new Map<SiteRequestStatus, number>();
  byStatus.forEach((row) => countMap.set(row.status, row._count._all));

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <PageHeader
        title="Site engine"
        description="Custom-build queue. Every row is a SiteRequest from /sites/request (public) or /portal/sites/request (logged-in customer). Click in to review intake, download the build packet, and walk it through the state machine."
        actions={
          <Link
            href="/sites/request"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
          >
            Open public form ↗
          </Link>
        }
      />

      {/* Status counts grouped into lifecycle buckets. Pre-cleanup
          (2026-06-04) every bucket rendered every status tile no
          matter what — so a brand-new agency with zero SiteRequests
          saw seventeen "0" boxes in a 4-row grid above the empty
          state, which made the queue read as broken / overwhelming.
          Now we only render this whole section when at least one
          SiteRequest exists. Inside an active queue we still keep
          the full grid so the pipeline view stays meaningful: each
          tile is a one-click filter into that status. */}
      {requests.length > 0 || validStatus ? (
        <section className="space-y-4">
          {STATUS_GROUPS.map((group) => {
            // Hide buckets that have zero rows AND no currently-active
            // status — keeps a focused queue tight (don't render an
            // empty "Closed" row when the agency only has Inbound work).
            const groupHasCount = group.statuses.some(
              (s) => (countMap.get(s) ?? 0) > 0 || validStatus === s,
            );
            if (!groupHasCount) return null;
            const visibleStatuses = group.statuses.filter(
              (s) => (countMap.get(s) ?? 0) > 0 || validStatus === s,
            );
            return (
              <div key={group.label}>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
                  {group.label}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                  {visibleStatuses.map((s) => {
                    const count = countMap.get(s) ?? 0;
                    const active = validStatus === s;
                    return (
                      <Link
                        key={s}
                        href={active ? "/admin/site-engine" : `/admin/site-engine?status=${s}`}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors",
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:bg-muted/30",
                        )}
                      >
                        <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                          {humanStatus(s)}
                        </div>
                        <div className="text-2xl font-semibold tabular-nums mt-1.5">
                          {count}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {requests.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-muted/30 p-6">
          <p className="text-sm font-semibold">No site requests yet.</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Share the public form at{" "}
            <code className="text-foreground">/sites/request</code> with a{" "}
            <code className="text-foreground">?ref=</code> tag to track attribution.
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                <th className="text-left py-2.5 px-4">Brand</th>
                <th className="text-left py-2.5 px-3">Submitter</th>
                <th className="text-left py-2.5 px-3">Status</th>
                <th className="text-left py-2.5 px-3">Tier</th>
                <th className="text-left py-2.5 px-3">Source</th>
                <th className="text-left py-2.5 px-3">Timeline</th>
                <th className="text-left py-2.5 px-3">Assignee</th>
                <th className="text-right py-2.5 px-4">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((r) => (
                <tr key={r.id} className="text-sm hover:bg-muted/20">
                  <td className="py-3 px-4">
                    <Link
                      href={`/admin/site-engine/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.intake?.brandName ?? r.submittedByName}
                    </Link>
                    <div className="text-[11px] text-muted-foreground">
                      {r.slug}
                      {r.org ? ` · ${r.org.name}` : ""}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-sm">{r.submittedByName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.submittedByEmail}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        STATUS_TONE[r.status],
                      )}
                    >
                      {humanStatus(r.status)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground">
                    {humanTier(r.tier)}
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground">
                    {r.source ?? "direct"}
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground">
                    {r.intake?.timelineExpectation ?? "—"}
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {r.assignedTo
                      ? `${r.assignedTo.firstName ?? ""} ${r.assignedTo.lastName ?? ""}`.trim() ||
                        r.assignedTo.email
                      : <span className="text-muted-foreground">Unassigned</span>}
                  </td>
                  <td className="py-3 px-4 text-right text-xs text-muted-foreground tabular-nums">
                    {formatDistanceToNow(r.lastActivityAt, { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function humanStatus(s: SiteRequestStatus): string {
  return s.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanTier(t: string): string {
  switch (t) {
    case "TIER1_MARKETING":
      return "Marketing";
    case "TIER2_PORTAL":
      return "Portal";
    case "TIER3_CUSTOM":
      return "Custom";
    default:
      return t;
  }
}
