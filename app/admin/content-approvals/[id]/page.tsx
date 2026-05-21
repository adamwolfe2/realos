import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  renderClaudeCodePromptFromDraft,
  renderMdxFromDraft,
} from "@/lib/content/render-mdx";
import { ApprovalDetailClient } from "./detail-client";

export const metadata: Metadata = { title: "Content approval · LeaseStack" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/content-approvals/[id]
//
// Full review screen for a single pending draft. Server component handles
// data loading + MDX/Claude Code rendering; the client component owns the
// tab state, copy buttons, and the "Mark as deployed" confirmation flow.
// ---------------------------------------------------------------------------

function wordCountFor(html: string | null, md: string | null): number {
  const src = (md && md.trim()) || (html ? html.replace(/<[^>]+>/g, " ") : "");
  if (!src) return 0;
  return src.trim().split(/\s+/).filter(Boolean).length;
}

function pickDomain(
  domains: { hostname: string; isPrimary: boolean }[],
): string | null {
  if (!domains?.length) return null;
  const primary = domains.find((d) => d.isPrimary);
  return (primary ?? domains[0]).hostname;
}

export default async function ContentApprovalDetailPage({
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
      org: {
        select: {
          id: true,
          name: true,
          domains: { select: { hostname: true, isPrimary: true } },
        },
      },
      property: { select: { id: true, name: true, websiteUrl: true } },
    },
  });
  if (!draft) {
    notFound();
  }

  const domain = pickDomain(draft.org?.domains ?? []);
  const orgForRender = draft.org
    ? { id: draft.org.id, name: draft.org.name, domain }
    : null;

  const rendered = renderMdxFromDraft(draft, orgForRender);
  const claudePrompt = renderClaudeCodePromptFromDraft(draft, orgForRender);
  const words = wordCountFor(draft.htmlBody, draft.outputMarkdown);

  const isTerminal =
    draft.status === "SHIPPED" || draft.status === "REJECTED";

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/admin/content-approvals"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All approvals
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-medium text-foreground">
            {draft.org?.name ?? draft.orgId}
          </span>
          {domain ? (
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-muted-foreground hover:text-primary"
            >
              {domain}
            </a>
          ) : null}
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wide text-primary">
            {draft.format.replace(/_/g, " ").toLowerCase()}
          </span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
            {draft.status.replace(/_/g, " ").toLowerCase()}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {words} words
          </span>
        </div>
      </div>

      {/* Title card */}
      <header className="rounded-2xl border border-border bg-card p-5">
        <h1 className="text-xl font-semibold text-foreground leading-tight">
          {rendered.title}
        </h1>
        {rendered.description && rendered.description !== rendered.title ? (
          <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug max-w-3xl">
            {rendered.description}
          </p>
        ) : null}
        {draft.targetQuery ? (
          <p className="mt-2 text-[11px] font-mono text-muted-foreground">
            target query: {draft.targetQuery}
          </p>
        ) : null}
      </header>

      {draft.reviewNotes ? (
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-1">
            Prior review notes
          </p>
          <p className="text-[13px] text-foreground whitespace-pre-wrap">
            {draft.reviewNotes}
          </p>
        </div>
      ) : null}

      {/* Tabs + actions */}
      <ApprovalDetailClient
        draftId={draft.id}
        canReview={!isTerminal}
        htmlBody={draft.htmlBody ?? ""}
        mdxOutput={rendered.mdx}
        claudePrompt={claudePrompt}
        slug={rendered.slug}
        domain={domain}
        format={draft.format}
      />
    </div>
  );
}
