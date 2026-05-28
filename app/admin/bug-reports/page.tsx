import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bug, ArrowRight, ImageIcon, ExternalLink } from "lucide-react";
import { BugReportSeverity, BugReportStatus, Prisma } from "@prisma/client";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bug reports" };
export const dynamic = "force-dynamic";

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "open", label: "Open" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "fixed", label: "Fixed · awaiting approval" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default async function BugReportsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string }>;
}) {
  await requireAgency();
  const sp = await searchParams;
  const statusFilter = STATUS_FILTERS.some((f) => f.key === sp.status)
    ? sp.status!
    : "open";

  // "open" buckets the live work — anything not APPROVED or REJECTED.
  // The explicit pending/in_progress/fixed filters narrow further.
  const where: Prisma.BugReportWhereInput = (() => {
    if (statusFilter === "open") {
      return {
        status: {
          in: [
            BugReportStatus.PENDING,
            BugReportStatus.IN_PROGRESS,
            BugReportStatus.FIXED,
          ],
        },
      };
    }
    if (statusFilter === "all") return {};
    const map: Record<string, BugReportStatus> = {
      pending: BugReportStatus.PENDING,
      in_progress: BugReportStatus.IN_PROGRESS,
      fixed: BugReportStatus.FIXED,
      approved: BugReportStatus.APPROVED,
      rejected: BugReportStatus.REJECTED,
    };
    const s = map[statusFilter];
    return s ? { status: s } : {};
  })();

  if (sp.severity) {
    const sev = sp.severity.toUpperCase() as BugReportSeverity;
    if (Object.values(BugReportSeverity).includes(sev)) {
      where.severity = sev;
    }
  }

  const [reports, counts] = await Promise.all([
    prisma.bugReport.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.bugReport.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countByStatus = new Map<BugReportStatus, number>();
  for (const c of counts) countByStatus.set(c.status, c._count._all);
  const openCount =
    (countByStatus.get(BugReportStatus.PENDING) ?? 0) +
    (countByStatus.get(BugReportStatus.IN_PROGRESS) ?? 0) +
    (countByStatus.get(BugReportStatus.FIXED) ?? 0);

  return (
    <div className="space-y-4 ls-page-fade">
      <PageHeader
        title="Bug reports"
        description="Every in-app bug report from users, testers, and the team. Triage, mark fixed, and approve here. Image attachments included so Claude sees exactly what the reporter saw."
      />

      <section
        aria-label="Bug report queue at a glance"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 ls-stagger"
      >
        <KpiTile
          label="Open"
          value={openCount.toLocaleString()}
          hint="Pending + in progress + fixed"
        />
        <KpiTile
          label="Pending triage"
          value={(countByStatus.get(BugReportStatus.PENDING) ?? 0).toLocaleString()}
          hint="Newly received"
        />
        <KpiTile
          label="In progress"
          value={(countByStatus.get(BugReportStatus.IN_PROGRESS) ?? 0).toLocaleString()}
          hint="Engineering working"
        />
        <KpiTile
          label="Awaiting approval"
          value={(countByStatus.get(BugReportStatus.FIXED) ?? 0).toLocaleString()}
          hint="Claimed fixed, needs sign-off"
        />
        <KpiTile
          label="Approved"
          value={(countByStatus.get(BugReportStatus.APPROVED) ?? 0).toLocaleString()}
          hint="Verified fixed"
        />
      </section>

      {/* Filter tabs */}
      <nav className="flex flex-wrap gap-1.5" aria-label="Filter by status">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <Link
              key={f.key}
              href={`/admin/bug-reports?status=${f.key}${sp.severity ? `&severity=${sp.severity}` : ""}`}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted/50",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {reports.length === 0 ? (
        <EmptyState
          icon={<Bug className="h-5 w-5" />}
          title={
            statusFilter === "open"
              ? "Inbox zero on bug reports."
              : "No reports match this filter."
          }
          body={
            statusFilter === "open"
              ? "When users file bug reports from the in-app button, they'll show up here for triage."
              : "Try widening the filter."
          }
        />
      ) : (
        <SectionCard
          label={`${reports.length} report${reports.length === 1 ? "" : "s"}`}
          description="Click a row to open the full report with screenshots, page context, and triage controls."
        >
          <ul className="divide-y divide-border -mx-1">
            {reports.map((r) => {
              const attachments = Array.isArray(r.attachments)
                ? (r.attachments as Array<{ url: string }>)
                : [];
              return (
                <li key={r.id}>
                  <Link
                    href={`/admin/bug-reports/${r.id}`}
                    className="group flex items-start gap-3 px-1 py-3 -mx-0.5 rounded-md hover:bg-muted/30 transition-colors"
                  >
                    <SeverityChip severity={r.severity} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {r.title}
                        </span>
                        <StatusBadge status={r.status} />
                        {attachments.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                            <ImageIcon className="h-2.5 w-2.5" />
                            {attachments.length}
                          </span>
                        ) : null}
                        {r.githubIssueNumber ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                            <ExternalLink className="h-2.5 w-2.5" />#{r.githubIssueNumber}
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
                        {r.reporterEmail}
                        {r.reporterOrgName ? ` · ${r.reporterOrgName}` : ""}
                        {r.pagePath ? ` · ${r.pagePath}` : ""}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
                      {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function SeverityChip({ severity }: { severity: BugReportSeverity }) {
  const tone =
    severity === BugReportSeverity.BLOCKER
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : severity === BugReportSeverity.HIGH
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : severity === BugReportSeverity.MEDIUM
          ? "bg-primary/10 text-primary border-primary/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "shrink-0 inline-flex items-center justify-center w-12 text-center rounded-md border px-1 py-1 text-[9px] font-bold uppercase tracking-widest mt-0.5",
        tone,
      )}
    >
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: BugReportStatus }) {
  const tone =
    status === BugReportStatus.APPROVED
      ? "bg-emerald-50 text-emerald-700"
      : status === BugReportStatus.REJECTED
        ? "bg-muted text-muted-foreground"
        : status === BugReportStatus.FIXED
          ? "bg-blue-50 text-blue-700"
          : status === BugReportStatus.IN_PROGRESS
            ? "bg-amber-50 text-amber-700"
            : "bg-primary/10 text-primary";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest",
        tone,
      )}
    >
      {status === BugReportStatus.IN_PROGRESS ? "in progress" : status}
    </span>
  );
}
