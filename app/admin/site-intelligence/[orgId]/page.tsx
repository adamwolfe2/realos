import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ExternalLink, Globe } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { RefreshButton } from "../refresh-button";

export const metadata: Metadata = {
  title: "Site intelligence detail · LeaseStack",
};
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/site-intelligence/[orgId]
//
// Full read-out of one org's cached SiteIntelligence:
//   - Brand voice (multi-paragraph string)
//   - Perplexity research (structured JSON → sections + citations)
//   - Crawled pages (compact table, expand for full set)
//   - Sitemap URLs (overflow-collapsed)
//   - lastRunStats (raw key/value)
// ---------------------------------------------------------------------------

interface IngestPersistedPage {
  url: string;
  title: string;
  description: string;
  markdown: string;
  h1: string;
  h2: string[];
  wordCount: number;
}

interface CompanyResearch {
  companyOverview?: string;
  competitiveLandscape?: string;
  recentNews?: string;
  positioningCues?: string;
  citations?: string[];
}

function asPagesArray(value: unknown): IngestPersistedPage[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter(
    (p): p is IngestPersistedPage =>
      !!p && typeof p === "object" && "url" in (p as Record<string, unknown>),
  );
}

function asResearch(value: unknown): CompanyResearch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as CompanyResearch;
}

function asRunStats(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function fmtAbsolute(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function fmtRelative(d: Date | null | undefined): string {
  if (!d) return "never";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function pickPrimaryDomain(
  domains: { hostname: string; isPrimary: boolean }[],
): string | null {
  if (!domains?.length) return null;
  const primary = domains.find((d) => d.isPrimary);
  return (primary ?? domains[0]).hostname;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

function preview(markdown: string, max = 200): string {
  const cleaned = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return truncate(cleaned, max);
}

function formatStatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const SITEMAP_VISIBLE = 30;
const PAGES_VISIBLE_DEFAULT = 10;

export default async function SiteIntelligenceDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { error } = await requireAdmin();
  if (error) {
    redirect("/sign-in");
  }

  const { orgId } = await params;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      domains: { select: { hostname: true, isPrimary: true } },
      siteIntelligence: true,
    },
  });
  if (!org) {
    notFound();
  }

  const si = org.siteIntelligence;
  const domain = pickPrimaryDomain(org.domains);

  const pages = asPagesArray(si?.pages);
  const research = asResearch(si?.research);
  const runStats = asRunStats(si?.lastRunStats);
  const sitemapUrls = Array.isArray(si?.sitemapUrls) ? si!.sitemapUrls : [];
  const pagesVisible = pages.slice(0, PAGES_VISIBLE_DEFAULT);
  const pagesOverflow = pages.slice(PAGES_VISIBLE_DEFAULT);
  const sitemapVisible = sitemapUrls.slice(0, SITEMAP_VISIBLE);
  const sitemapOverflowCount = Math.max(
    0,
    sitemapUrls.length - SITEMAP_VISIBLE,
  );

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/admin/site-intelligence"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All orgs
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-medium text-foreground">
            {org.name}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {org.slug}
          </span>
          {domain ? (
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-primary"
            >
              <Globe className="h-3 w-3" aria-hidden />
              {domain}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : (
            <span className="text-[11px] font-mono text-muted-foreground italic">
              no domain bound
            </span>
          )}
          <RefreshButton orgId={org.id} />
        </div>
      </div>

      {/* Header summary card */}
      <header className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
          Site intelligence
        </p>
        <h1 className="mt-1 text-xl font-semibold text-foreground leading-tight">
          {org.name}
        </h1>
        {si?.rootUrl ? (
          <p className="mt-1.5 text-[12px] font-mono text-muted-foreground break-all">
            Root URL:{" "}
            <a
              href={si.rootUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
            >
              {si.rootUrl}
            </a>
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Pages" value={`${pages.length}`} />
          <Stat label="Sitemap URLs" value={`${sitemapUrls.length}`} />
          <Stat
            label="Crawled"
            value={fmtRelative(si?.crawledAt ?? null)}
            sub={fmtAbsolute(si?.crawledAt ?? null)}
          />
          <Stat
            label="Researched"
            value={fmtRelative(si?.researchedAt ?? null)}
            sub={fmtAbsolute(si?.researchedAt ?? null)}
          />
        </div>
      </header>

      {!si ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-[14px] font-medium text-foreground">
            No site intelligence yet
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground max-w-md mx-auto">
            Run a refresh to crawl the bound domain with Firecrawl, fetch
            Perplexity research, and extract brand voice with Claude. First
            ingest usually takes 60–180 seconds.
          </p>
          <div className="mt-4 inline-flex">
            <RefreshButton orgId={org.id} label="Run first ingest" />
          </div>
        </div>
      ) : null}

      {/* Brand voice */}
      {si ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
                Brand voice
              </p>
              <h2 className="mt-1 text-[15px] font-semibold text-foreground">
                Claude-extracted voice notes
              </h2>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {(si.brandVoice?.length ?? 0)} chars · last run{" "}
              {fmtRelative(si.brandVoiceAt)}
            </span>
          </div>

          {si.brandVoice && si.brandVoice.trim().length > 0 ? (
            <blockquote className="mt-4 rounded-xl border-l-2 border-primary bg-muted/40 p-4 text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
              {si.brandVoice}
            </blockquote>
          ) : (
            <EmptyInline copy="No brand voice cached yet. Refresh to extract." />
          )}
        </section>
      ) : null}

      {/* Research */}
      {si ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
                Research
              </p>
              <h2 className="mt-1 text-[15px] font-semibold text-foreground">
                Perplexity Sonar briefing
              </h2>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {fmtRelative(si.researchedAt)}
            </span>
          </div>

          {research ? (
            <div className="mt-4 space-y-4">
              <ResearchBlock
                label="Company overview"
                text={research.companyOverview}
              />
              <ResearchBlock
                label="Competitive landscape"
                text={research.competitiveLandscape}
              />
              <ResearchBlock
                label="Recent news"
                text={research.recentNews}
              />
              <ResearchBlock
                label="Positioning cues"
                text={research.positioningCues}
              />

              {research.citations && research.citations.length > 0 ? (
                <div className="border-t border-border pt-3">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Citations
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {research.citations.map((c, i) => (
                      <li
                        key={`${c}-${i}`}
                        className="text-[11px] font-mono text-muted-foreground"
                      >
                        <a
                          href={c}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary break-all"
                        >
                          [{i + 1}] {truncate(c, 80)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyInline copy="No research cached yet. Refresh to fetch Perplexity Sonar." />
          )}
        </section>
      ) : null}

      {/* Crawled pages */}
      {si ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
                Crawled pages
              </p>
              <h2 className="mt-1 text-[15px] font-semibold text-foreground">
                Firecrawl content cache
              </h2>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {pages.length} pages
            </span>
          </div>

          {pages.length === 0 ? (
            <EmptyInline copy="No crawled pages yet. Refresh to populate the cache." />
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-muted/40 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">URL</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium text-right">Words</th>
                    <th className="px-3 py-2 font-medium">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {pagesVisible.map((p) => (
                    <PageRow key={p.url} page={p} />
                  ))}

                  {pagesOverflow.length > 0 ? (
                    <tr className="border-t border-border bg-muted/20">
                      <td colSpan={4} className="px-3 py-2">
                        <details>
                          <summary className="cursor-pointer text-[11px] font-mono text-muted-foreground hover:text-foreground">
                            Show {pagesOverflow.length} more pages
                          </summary>
                          <div className="mt-2 overflow-hidden rounded-lg border border-border">
                            <table className="w-full text-left text-[12px]">
                              <tbody>
                                {pagesOverflow.map((p) => (
                                  <PageRow key={p.url} page={p} />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {/* Sitemap */}
      {si ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
                Sitemap
              </p>
              <h2 className="mt-1 text-[15px] font-semibold text-foreground">
                Discovered URLs
              </h2>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {sitemapUrls.length} total
            </span>
          </div>

          {sitemapUrls.length === 0 ? (
            <EmptyInline copy="No sitemap URLs cached." />
          ) : (
            <ul className="mt-4 space-y-1">
              {sitemapVisible.map((u) => (
                <li key={u} className="text-[11px] font-mono text-muted-foreground">
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary break-all"
                  >
                    {u}
                  </a>
                </li>
              ))}
              {sitemapOverflowCount > 0 ? (
                <li className="text-[11px] font-mono text-muted-foreground italic">
                  + {sitemapOverflowCount} more
                </li>
              ) : null}
            </ul>
          )}
        </section>
      ) : null}

      {/* Last run stats */}
      {si ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
                Last run stats
              </p>
              <h2 className="mt-1 text-[15px] font-semibold text-foreground">
                Ingest telemetry
              </h2>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {fmtRelative(si.updatedAt)}
            </span>
          </div>

          {runStats ? (
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {Object.entries(runStats).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-start justify-between gap-3 border-b border-border/50 py-1.5"
                >
                  <dt className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="text-right text-[12px] font-mono text-foreground break-all whitespace-pre-wrap max-w-[60%]">
                    {formatStatValue(v)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <EmptyInline copy="No telemetry from prior runs." />
          )}
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[14px] font-semibold text-foreground">{value}</p>
      {sub ? (
        <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function ResearchBlock({
  label,
  text,
}: {
  label: string;
  text: string | undefined;
}) {
  if (!text || !text.trim()) return null;
  return (
    <div>
      <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}

function PageRow({ page }: { page: IngestPersistedPage }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground max-w-[18ch] truncate">
        <a
          href={page.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary"
          title={page.url}
        >
          {truncate(page.url, 60)}
        </a>
      </td>
      <td className="px-3 py-2 text-[12px] text-foreground max-w-[24ch]">
        <span className="block truncate" title={page.title || page.h1}>
          {page.title || page.h1 || "—"}
        </span>
      </td>
      <td className="px-3 py-2 text-right font-mono text-[11px] text-muted-foreground">
        {page.wordCount || Math.round((page.markdown?.length ?? 0) / 5)}
      </td>
      <td className="px-3 py-2 text-[12px] text-muted-foreground">
        {page.markdown ? preview(page.markdown) : "—"}
      </td>
    </tr>
  );
}

function EmptyInline({ copy }: { copy: string }) {
  return (
    <p className="mt-3 text-[12px] text-muted-foreground italic">{copy}</p>
  );
}
