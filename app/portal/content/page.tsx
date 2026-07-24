import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { ContentFormat, DraftStatus } from "@prisma/client";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";

export const metadata: Metadata = { title: "Content" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/content — operator's content workspace.
//
// Two sections:
//   1. Drafts        — every ContentDraft NOT SHIPPED or EXPIRED, most
//                      recent first. Click row to open editor.
//   2. Recently      — last 10 SHIPPED rows for audit.
//      shipped
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

// Single-blue cohesion. Previous rainbow (green/amber/red/blue) read as
// "broken" alongside the rest of the LeaseStack portal which uses only
// the LeaseStack accent #2563EB. Now: state is carried by opacity +
// label, never by hue. Matches the marketplace + AEO + Opportunities
// treatment so the operator never has to learn a new color taxonomy.
const STATUS_TONE: Record<DraftStatus, string> = {
  GENERATING:        "bg-muted text-muted-foreground",        // soft, in-flight
  PENDING_REVIEW:    "bg-primary/10 text-primary",            // active, awaiting admin
  APPROVED:          "bg-primary/15 text-primary font-semibold", // strong primary
  CHANGES_REQUESTED: "bg-muted text-foreground",              // needs work
  REJECTED:          "bg-muted text-muted-foreground line-through", // terminal-soft
  SHIPPED:           "bg-primary text-primary-foreground",    // strong + final
  EXPIRED:           "bg-muted text-muted-foreground/70",     // faded
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
      },
    }),
  ]);

  return (
    <div className="space-y-8 ls-page-fade">
      <PageHeader
        eyebrow="Content"
        title="Drafts & shipped pieces"
        description="Open a draft to edit it inline with the AI assistant, or scaffold a new piece from scratch."
        actions={<NewDraftMenu />}
      />

      <section className="space-y-3">
        <h2 className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Drafts
        </h2>
        {drafts.length === 0 ? (
          <EmptyState
            title="No drafts yet"
            body="Click New Draft to scaffold your first piece."
          />
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => {
              const title = titleFromDraft(d);
              const words = countWords(d.htmlBody);
              return (
                <li
                  key={d.id}
                  className="rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors"
                >
                  <Link
                    href={`/portal/content/${d.id}`}
                    className="block p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-primary">
                          {FORMAT_LABEL[d.format]}
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono uppercase ${STATUS_TONE[d.status]}`}
                        >
                          {d.status.replace(/_/g, " ").toLowerCase()}
                        </span>
                        {words > 0 ? (
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {words.toLocaleString()} words
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {fmtAge(d.updatedAt)}
                      </span>
                    </div>
                    <p className="text-[14px] font-medium text-foreground line-clamp-1 leading-snug">
                      {title}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Recently shipped
        </h2>
        {shipped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-[12px] text-muted-foreground">
              Nothing shipped yet.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {shipped.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-border bg-card"
              >
                <Link
                  href={`/portal/content/${d.id}`}
                  className="block p-4"
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-primary">
                      {FORMAT_LABEL[d.format]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      shipped {fmtAge(d.shippedAt)}
                    </span>
                  </div>
                  <p className="text-[13px] text-foreground line-clamp-1 leading-snug">
                    {titleFromDraft(d)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewDraftMenu — CSS-only details/summary dropdown (no Radix dep needed).
// ---------------------------------------------------------------------------
function NewDraftMenu() {
  return (
    <details className="relative group">
      <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
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
      <div className="absolute right-0 top-full mt-1.5 z-20 w-56 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
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
