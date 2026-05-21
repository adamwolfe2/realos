import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { ResubmitWithChangesButton } from "@/components/portal/seo/resubmit-with-changes-button";

export const metadata: Metadata = { title: "Draft preview" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Operator-facing draft preview. Sibling to /admin/content-drafts/[id]
// but scoped to the calling org so operators can review their own
// submissions and see admin notes.
// ---------------------------------------------------------------------------

const STATUS_TONE: Record<string, string> = {
  GENERATING: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  APPROVED: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  CHANGES_REQUESTED: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  REJECTED: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  SHIPPED: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  EXPIRED: "bg-muted text-muted-foreground",
};

export default async function PortalDraftViewer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  const draft = await prisma.contentDraft.findFirst({
    where: { id, ...tenantWhere(scope) },
    include: {
      property: { select: { id: true, name: true, websiteUrl: true } },
      recommendation: { select: { id: true, title: true, category: true } },
    },
  });
  if (!draft) notFound();
  if (
    draft.propertyId &&
    scope.allowedPropertyIds &&
    !scope.allowedPropertyIds.includes(draft.propertyId)
  ) {
    notFound();
  }

  const statusTone = STATUS_TONE[draft.status] ?? STATUS_TONE.GENERATING;
  const fmt = draft.format.replace(/_/g, " ").toLowerCase();
  const statusLabel = draft.status.toLowerCase().replace(/_/g, " ");

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link
          href="/portal/seo/agent"
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          &larr; Back to SEO Agent
        </Link>
      </div>

      <header className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-primary">
                {fmt}
              </span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono uppercase ${statusTone}`}
              >
                {statusLabel}
              </span>
              {draft.estimatedScore != null ? (
                <span className="text-[11px] font-mono text-muted-foreground">
                  est. score {draft.estimatedScore}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-lg font-semibold text-foreground">
              {draft.property?.name ?? "Draft"}
            </h1>
            <p className="mt-2 text-[13px] text-foreground leading-snug whitespace-pre-wrap">
              {draft.brief}
            </p>
            {draft.targetQuery ? (
              <p className="mt-2 text-[11px] font-mono text-muted-foreground">
                target query: {draft.targetQuery}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right text-[11px] text-muted-foreground space-y-1">
            <div>created {draft.createdAt.toISOString().slice(0, 10)}</div>
            {draft.submittedAt ? (
              <div>
                submitted {draft.submittedAt.toISOString().slice(0, 10)}
              </div>
            ) : null}
            {draft.reviewedAt ? (
              <div>reviewed {draft.reviewedAt.toISOString().slice(0, 10)}</div>
            ) : null}
          </div>
        </div>
      </header>

      {draft.reviewNotes ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/20">
          <p className="text-[11px] font-mono uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-1">
            Notes from LeaseStack
          </p>
          <p className="text-[13px] text-foreground whitespace-pre-wrap">
            {draft.reviewNotes}
          </p>
        </div>
      ) : null}

      {/* Status-specific call to action */}
      {draft.status === "GENERATING" ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-[13px] font-medium text-foreground">
            Drafting…
          </p>
          <p className="text-[12px] text-muted-foreground mt-1">
            This usually takes 8 to 15 seconds. Refresh the page to check.
          </p>
        </div>
      ) : null}

      {draft.status === "CHANGES_REQUESTED" && draft.propertyId ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
            <p className="text-[12px] font-medium text-foreground">
              Changes requested. Apply the notes above and re-submit
              below — we&apos;ll review again.
            </p>
          </div>
          <ResubmitWithChangesButton
            draftId={draft.id}
            propertyId={draft.propertyId}
            format={draft.format}
            originalBrief={draft.brief}
            reviewNotes={draft.reviewNotes ?? ""}
            targetQuery={draft.targetQuery}
          />
        </div>
      ) : null}

      {/* Generated content */}
      {draft.outputMarkdown ? (
        <article className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-3">
            Generated draft
          </h2>
          <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground font-sans">
            {draft.outputMarkdown}
          </pre>
        </article>
      ) : null}

      <div className="text-[11px] text-muted-foreground">
        LeaseStack reviews every draft before it ships. You&apos;ll see the
        status update here.
      </div>
    </div>
  );
}
