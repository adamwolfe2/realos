import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { redirect } from "next/navigation";
import { DraftReviewControls } from "@/components/admin/content-drafts/draft-review-controls";

export const metadata: Metadata = { title: "Content draft" };
export const dynamic = "force-dynamic";

export default async function AdminContentDraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { error } = await requireAdmin();
  if (error) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const draft = await prisma.contentDraft.findUnique({
    where: { id },
    include: {
      org: { select: { id: true, name: true } },
      property: {
        select: { id: true, name: true, websiteUrl: true, city: true, state: true },
      },
      recommendation: {
        select: { id: true, title: true, category: true, severity: true },
      },
    },
  });
  if (!draft) {
    notFound();
  }

  const canReview =
    draft.status === "PENDING_REVIEW" || draft.status === "CHANGES_REQUESTED";

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/content-drafts"
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          &larr; All drafts
        </Link>
      </div>

      <header className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary uppercase tracking-wide">
                {draft.format.replace(/_/g, " ").toLowerCase()}
              </span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground uppercase">
                {draft.status.replace(/_/g, " ").toLowerCase()}
              </span>
              {draft.estimatedScore != null ? (
                <span className="text-[11px] font-mono text-muted-foreground">
                  est. score {draft.estimatedScore}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-xl font-semibold text-foreground">
              {draft.org?.name ?? draft.orgId}
              {draft.property ? ` · ${draft.property.name}` : ""}
            </h1>
            <p className="mt-2 text-[13px] text-foreground leading-snug whitespace-pre-wrap">
              {draft.brief}
            </p>
            {draft.targetQuery ? (
              <p className="mt-2 text-[11px] font-mono text-muted-foreground">
                target query: {draft.targetQuery}
              </p>
            ) : null}
            {draft.recommendation ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Closes recommendation:{" "}
                <span className="text-foreground">{draft.recommendation.title}</span>
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right text-[11px] text-muted-foreground space-y-1">
            <div>created {draft.createdAt.toISOString().slice(0, 10)}</div>
            {draft.submittedAt ? (
              <div>submitted {draft.submittedAt.toISOString().slice(0, 10)}</div>
            ) : null}
            {draft.reviewedAt ? (
              <div>reviewed {draft.reviewedAt.toISOString().slice(0, 10)}</div>
            ) : null}
            {draft.model ? (
              <div className="font-mono">{draft.model}</div>
            ) : null}
          </div>
        </div>
      </header>

      {/* The actual generated content */}
      <article className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-3">
          Generated draft
        </h2>
        {draft.outputMarkdown ? (
          <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground font-sans">
            {draft.outputMarkdown}
          </pre>
        ) : (
          <p className="text-[12px] text-muted-foreground italic">
            No markdown output captured.
          </p>
        )}
      </article>

      {draft.reviewNotes ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[11px] font-mono uppercase tracking-wide text-amber-700 mb-1">
            Review notes
          </p>
          <p className="text-[13px] text-foreground whitespace-pre-wrap">
            {draft.reviewNotes}
          </p>
        </div>
      ) : null}

      {canReview ? (
        <DraftReviewControls draftId={draft.id} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-[12px] text-muted-foreground">
          This draft is {draft.status.toLowerCase().replace(/_/g, " ")}. No
          further review actions available.
        </div>
      )}
    </div>
  );
}
