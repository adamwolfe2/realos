import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, Clock3, RotateCcw, Send } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { ContentFormat, DraftStatus } from "@prisma/client";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { ManagedByChip, MANAGED_SLA } from "@/components/portal/managed-by-chip";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = { title: "Content" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/content — operator's content workspace.
//
// One screen, one story: PageHeader, a KPI strip derived from the same two
// queries below (no extra fetches), then ONE dense main surface — a single
// hairline-divided list inside an ls-card. Open drafts (most recent first)
// come first; the last 10 SHIPPED rows trail behind a thin group label for
// audit. Click any row to open the editor.
//
// Top-right "New Draft" dropdown lists every ContentFormat. Selecting a
// format routes to /portal/content/new?format=BLOG_POST so the wizard
// pre-fills.
// ---------------------------------------------------------------------------

const FORMAT_OPTIONS: Array<{ value: ContentFormat; label: string }> = [
  { value: "BLOG_POST", label: "Blog Post" },
  { value: "NEIGHBORHOOD_PAGE", label: "Neighborhood Page" },
  { value: "PROPERTY_DESCRIPTION", label: "Property Description" },
  { value: "META_REWRITE", label: "Meta Rewrite" },
  { value: "FAQ_BLOCK", label: "FAQ Block" },
  { value: "AD_COPY", label: "Ad Copy" },
];

const FORMAT_LABEL: Record<ContentFormat, string> = Object.fromEntries(
  FORMAT_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ContentFormat, string>;

// Single-blue cohesion (kept from the prior pass): state is carried by
// pill weight + label, never by hue, so this page matches the rest of the
// portal's status vocabulary instead of introducing a rainbow.
const STATUS_PILL: Record<DraftStatus, string> = {
  GENERATING: "ls-pill ls-pill-neutral",
  PENDING_REVIEW: "ls-pill ls-pill-info",
  APPROVED: "ls-pill ls-pill-active",
  CHANGES_REQUESTED: "ls-pill ls-pill-neutral",
  REJECTED: "ls-pill ls-pill-neutral opacity-70",
  SHIPPED: "ls-pill ls-pill-active",
  EXPIRED: "ls-pill ls-pill-neutral opacity-70",
};

function fmtAge(d: Date | null): string {
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function countWords(html: string | null): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

function titleFromDraft(d: {
  brief: string;
  output: unknown;
  htmlBody: string | null;
}): string {
  // Prefer the AI-generated title where one exists.
  const out = d.output as { title?: unknown } | null;
  if (out && typeof out.title === "string" && out.title.trim().length > 0) {
    return out.title.trim();
  }
  if (d.htmlBody) {
    const m = d.htmlBody.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (m && m[1].trim()) return m[1].trim();
  }
  return d.brief.length > 80 ? `${d.brief.slice(0, 78)}…` : d.brief;
}

type DraftRow = {
  id: string;
  format: ContentFormat;
  status: DraftStatus;
  htmlBody: string | null;
  output: unknown;
  brief: string;
  date: Date | null;
  dateLabel: string;
  publishedUrl?: string | null;
};

export default async function ContentPage() {
  const scope = await requireScope();

  const baseWhere: Record<string, unknown> = { ...tenantWhere(scope) };
  if (scope.allowedPropertyIds) {
    baseWhere.OR = [
      { propertyId: null },
      { propertyId: { in: scope.allowedPropertyIds } },
    ];
  }

  const [drafts, shipped] = await Promise.all([
    prisma.contentDraft.findMany({
      where: {
        ...baseWhere,
        status: { notIn: [DraftStatus.SHIPPED, DraftStatus.EXPIRED] },
      } as never,
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
      select: {
        id: true,
        format: true,
        brief: true,
        status: true,
        htmlBody: true,
        output: true,
        updatedAt: true,
        createdAt: true,
      },
    }),
    prisma.contentDraft.findMany({
      where: { ...baseWhere, status: DraftStatus.SHIPPED } as never,
      orderBy: [{ shippedAt: "desc" }],
      take: 10,
      select: {
        id: true,
        format: true,
        brief: true,
        status: true,
        htmlBody: true,
        output: true,
        shippedAt: true,
        publishedUrl: true,
      },
    }),
  ]);

  // KPI strip is derived entirely from the two queries above — no extra
  // fetches. Counts reflect what's on screen, labeled honestly (the
  // "shipped" count is the last 10, not a lifetime total).
  const pendingCount = drafts.filter(
    (d) => d.status === "PENDING_REVIEW",
  ).length;
  const changesRequestedCount = drafts.filter(
    (d) => d.status === "CHANGES_REQUESTED",
  ).length;

  const draftRows: DraftRow[] = drafts.map((d) => ({
    id: d.id,
    format: d.format,
    status: d.status,
    htmlBody: d.htmlBody,
    output: d.output,
    brief: d.brief,
    date: d.updatedAt,
    dateLabel: fmtAge(d.updatedAt),
  }));
  const shippedRows: DraftRow[] = shipped.map((d) => ({
    id: d.id,
    format: d.format,
    status: d.status,
    htmlBody: d.htmlBody,
    output: d.output,
    brief: d.brief,
    date: d.shippedAt,
    dateLabel: `shipped ${fmtAge(d.shippedAt)}`,
    publishedUrl: d.publishedUrl,
  }));

  const hasAnyContent = draftRows.length > 0 || shippedRows.length > 0;

  return (
    <div className="space-y-4 ls-page-fade">
      <PageHeader
        eyebrow="Content"
        title={
          <span className="flex items-center gap-3 flex-wrap">
            Drafts &amp; shipped pieces
            <ManagedByChip sla={MANAGED_SLA} />
          </span>
        }
        description="Open a draft to edit it with the AI assistant, or scaffold a new piece. Our team reviews, publishes, and links every shipped piece below."
        actions={<NewDraftMenu />}
      />

      <section
        aria-label="Content pipeline at a glance"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 ls-stagger"
      >
        <KpiTile
          label="Open drafts"
          value={draftRows.length.toLocaleString()}
          hint={
            draftRows.length === 0
              ? "None right now"
              : `${pendingCount} awaiting review`
          }
          icon={<FileText className="h-4 w-4" />}
        />
        <KpiTile
          label="Awaiting review"
          value={pendingCount.toLocaleString()}
          hint={pendingCount === 0 ? "All caught up" : "Needs admin action"}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <KpiTile
          label="Needs changes"
          value={changesRequestedCount.toLocaleString()}
          hint={
            changesRequestedCount === 0
              ? "None flagged"
              : "Sent back to draft"
          }
          icon={<RotateCcw className="h-4 w-4" />}
        />
        <KpiTile
          label="Recently shipped"
          value={shippedRows.length.toLocaleString()}
          hint="Last 10 shown below"
          icon={<Send className="h-4 w-4" />}
        />
      </section>

      {!hasAnyContent ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No content yet"
          body="Click New Draft to scaffold your first piece — the AI assistant helps you write it inline."
          action={{ label: "New draft", href: "/portal/content/new" }}
        />
      ) : (
        <SectionCard
          label="Content pipeline"
          description="Click a row to open the editor."
        >
          <ul className="divide-y divide-border -mx-1">
            {draftRows.length === 0 ? (
              <li className="px-1 py-3 text-[12px] text-muted-foreground">
                No open drafts.
              </li>
            ) : (
              draftRows.map((d) => <ContentRow key={d.id} draft={d} />)
            )}
            {shippedRows.length > 0 ? (
              <>
                <li
                  aria-hidden="true"
                  className="px-1 pt-4 pb-1 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Recently shipped
                </li>
                {shippedRows.map((d) => (
                  <ContentRow key={d.id} draft={d} />
                ))}
              </>
            ) : null}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function ContentRow({ draft }: { draft: DraftRow }) {
  const title = titleFromDraft(draft);
  const words = countWords(draft.htmlBody);

  return (
    <li className="flex items-center gap-2">
      <Link
        href={`/portal/content/${draft.id}`}
        className="group flex min-w-0 flex-1 items-center gap-3 px-1 py-3 -mx-0.5 rounded-md hover:bg-muted/30 transition-colors"
      >
        <span
          aria-hidden="true"
          className="shrink-0 h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"
        >
          <FileText className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {title}
            </span>
            <span className={STATUS_PILL[draft.status]}>
              {draft.status.replace(/_/g, " ").toLowerCase()}
            </span>
          </span>
          <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
            {FORMAT_LABEL[draft.format]} · {draft.dateLabel}
            {words > 0 ? ` · ${words.toLocaleString()} words` : ""}
          </span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
      </Link>
      {/* Proof-of-life: where the shipped piece actually lives. Sits outside
          the row Link (nested anchors are invalid HTML). */}
      {draft.publishedUrl ? (
        <a
          href={draft.publishedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          Live
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// NewDraftMenu — CSS-only details/summary dropdown (no Radix dep needed).
// ---------------------------------------------------------------------------
function NewDraftMenu() {
  return (
    <details className="relative group">
      <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors">
        New Draft
        <svg
          className="w-3.5 h-3.5 opacity-80"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="absolute right-0 top-full mt-1.5 z-20 w-56 rounded-[2px] border border-border bg-card shadow-lg overflow-hidden">
        <ul className="py-1">
          {FORMAT_OPTIONS.map((opt) => (
            <li key={opt.value}>
              <Link
                href={`/portal/content/new?format=${opt.value}`}
                className="block px-3 py-2 text-[13px] text-foreground hover:bg-muted"
              >
                {opt.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
