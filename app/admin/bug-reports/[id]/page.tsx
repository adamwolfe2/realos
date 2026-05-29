import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { BugReportSeverity, BugReportStatus } from "@prisma/client";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import {
  approveBugReport,
  rejectBugReport,
  markBugReportInProgress,
  markBugReportFixed,
  reopenBugReport,
} from "@/lib/actions/bug-report-actions";
import { AddNoteForm } from "@/components/admin/bug-reports/add-note-form";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bug report" };
export const dynamic = "force-dynamic";

type Attachment = {
  url: string;
  pathname: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
};

type TimelineEntry = {
  at: string;
  by: string | null;
  byEmail: string;
  kind: "status" | "note";
  from?: BugReportStatus;
  to?: BugReportStatus;
  text?: string;
};

export default async function BugReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAgency();
  const { id } = await params;
  const report = await prisma.bugReport.findUnique({
    where: { id },
  });
  if (!report) notFound();

  const attachments: Attachment[] = Array.isArray(report.attachments)
    ? (report.attachments as unknown as Attachment[])
    : [];
  const timeline: TimelineEntry[] = Array.isArray(report.timeline)
    ? (report.timeline as unknown as TimelineEntry[])
    : [];

  // Most recent at top, but always preserve the original "submitted"
  // entry at the bottom for context.
  const orderedTimeline = [...timeline].reverse();

  return (
    <div className="space-y-4 ls-page-fade max-w-5xl mx-auto w-full">
      <PageHeader
        eyebrow={
          <Link
            href="/admin/bug-reports"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> All bug reports
          </Link>
        }
        title={report.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <SeverityChip severity={report.severity} />
            <StatusBadge status={report.status} />
            <span className="text-xs text-muted-foreground">
              Filed {formatDistanceToNow(report.createdAt, { addSuffix: true })}
            </span>
          </span>
        }
        actions={
          report.githubIssueUrl ? (
            <a
              href={report.githubIssueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              GitHub #{report.githubIssueNumber}
            </a>
          ) : null
        }
      />

      {/* Triage controls */}
      <SectionCard
        label="Triage"
        description="Move the report through the lifecycle. APPROVED locks the fix in; REJECTED closes without action. Both record a note in the timeline."
      >
        <TriageControls
          id={report.id}
          status={report.status}
          resolutionNote={report.resolutionNote}
        />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
        {/* LEFT — full body + screenshots */}
        <div className="space-y-4">
          <SectionCard label="What happened">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {report.description}
            </p>
          </SectionCard>

          {attachments.length > 0 ? (
            <SectionCard
              label={`Screenshots (${attachments.length})`}
              description="Click any image to open the full-size original."
            >
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachments.map((a, i) => (
                  <li
                    key={a.url}
                    className="rounded-lg border border-border bg-muted/30 overflow-hidden"
                  >
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-video bg-muted overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.url}
                        alt={`Screenshot ${i + 1}`}
                        className="w-full h-full object-cover hover:opacity-95 transition-opacity"
                      />
                    </a>
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-[11px] text-muted-foreground truncate">
                        {a.pathname.split("/").pop()}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {Math.round(a.sizeBytes / 1024).toLocaleString()} KB
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          <SectionCard
            label="Timeline"
            description="Every status change + note, newest first. The original submission anchors the bottom."
          >
            <AddNoteForm reportId={report.id} />
            <ol className="mt-4 space-y-3">
              {orderedTimeline.length === 0 ? (
                <li className="text-xs text-muted-foreground">No activity yet.</li>
              ) : (
                orderedTimeline.map((entry, i) => (
                  <li
                    key={`${entry.at}-${i}`}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "shrink-0 mt-1.5 inline-block h-1.5 w-1.5 rounded-full",
                        entry.kind === "status"
                          ? "bg-primary"
                          : "bg-muted-foreground/40",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground">
                        {entry.kind === "status" ? (
                          <>
                            <span className="font-semibold">
                              {entry.from && entry.to
                                ? `${entry.from} → ${entry.to}`
                                : entry.to ?? "Status change"}
                            </span>
                            {entry.text ? (
                              <span className="text-muted-foreground">
                                {" · "}
                                {entry.text}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="whitespace-pre-wrap">{entry.text}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {entry.byEmail} ·{" "}
                        {format(new Date(entry.at), "MMM d, h:mm a")}
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ol>
          </SectionCard>
        </div>

        {/* RIGHT — context */}
        <div className="space-y-4">
          <SectionCard label="Reporter">
            <dl className="space-y-1.5 text-xs">
              <Row label="Email" value={report.reporterEmail} />
              <Row label="Role" value={report.reporterRole} />
              <Row label="Org" value={report.reporterOrgName} />
              <Row label="Org ID" value={report.reporterOrgId} mono />
            </dl>
          </SectionCard>

          <SectionCard label="Page context">
            <dl className="space-y-1.5 text-xs">
              <Row label="URL" value={report.pageUrl} mono wrap />
              <Row label="Path" value={report.pagePath} mono />
              <Row label="Viewport" value={report.viewport} mono />
              <Row label="User-Agent" value={report.userAgent} mono wrap />
            </dl>
          </SectionCard>

          <SectionCard label="Side effects">
            <dl className="space-y-1.5 text-xs">
              <Row
                label="GitHub"
                value={
                  report.githubIssueUrl ? (
                    <a
                      href={report.githubIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      #{report.githubIssueNumber}
                    </a>
                  ) : (
                    "Not filed"
                  )
                }
              />
              <Row
                label="Email"
                value={report.emailSent ? "Sent to ops inbox" : "Not sent"}
              />
              <Row
                label="Filed"
                value={format(report.createdAt, "MMM d, yyyy 'at' h:mm a")}
              />
              <Row
                label="Updated"
                value={format(report.updatedAt, "MMM d, yyyy 'at' h:mm a")}
              />
            </dl>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function TriageControls({
  id,
  status,
  resolutionNote,
}: {
  id: string;
  status: BugReportStatus;
  resolutionNote: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === BugReportStatus.PENDING ? (
          <form action={markBugReportInProgress}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-amber-600 text-white px-3 py-2 text-xs font-semibold hover:bg-amber-700 transition-colors"
            >
              Start work
            </button>
          </form>
        ) : null}
        {status === BugReportStatus.IN_PROGRESS ? (
          <form action={markBugReportFixed}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-blue-600 text-white px-3 py-2 text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              Mark fixed
            </button>
          </form>
        ) : null}
        {status === BugReportStatus.FIXED ? (
          <>
            <ApprovalForm action={approveBugReport} id={id} verb="Approve" tone="emerald" />
            <ApprovalForm action={rejectBugReport} id={id} verb="Reject" tone="destructive" />
            <form action={reopenBugReport}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
              >
                Re-open
              </button>
            </form>
          </>
        ) : null}
        {(status === BugReportStatus.APPROVED ||
          status === BugReportStatus.REJECTED) && (
          <form action={reopenBugReport}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
            >
              Re-open
            </button>
          </form>
        )}
      </div>
      {resolutionNote ? (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Resolution note:</span>{" "}
          {resolutionNote}
        </div>
      ) : null}
    </div>
  );
}

function ApprovalForm({
  action,
  id,
  verb,
  tone,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  verb: string;
  tone: "emerald" | "destructive";
}) {
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        type="text"
        name="note"
        maxLength={2000}
        placeholder={`Why are you ${verb.toLowerCase()}ing this? (optional)`}
        className="rounded-md border border-border bg-background px-2.5 py-2 text-xs w-56"
      />
      <button
        type="submit"
        className={cn(
          "inline-flex items-center rounded-md px-3 py-2 text-xs font-semibold text-white transition-colors",
          tone === "emerald"
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-destructive hover:bg-destructive/90",
        )}
      >
        {verb}
      </button>
    </form>
  );
}

function Row({
  label,
  value,
  mono,
  wrap,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2">
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground pt-0.5">
        {label}
      </dt>
      <dd
        className={cn(
          "text-foreground",
          mono && "font-mono text-[11px]",
          wrap ? "break-all" : "truncate",
        )}
      >
        {value || <span className="text-muted-foreground">—</span>}
      </dd>
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
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest",
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
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
        tone,
      )}
    >
      {status === BugReportStatus.IN_PROGRESS ? "in progress" : status}
    </span>
  );
}
