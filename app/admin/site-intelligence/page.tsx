import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Globe, SatelliteDish } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { RefreshButton } from "./refresh-button";
import { SearchInput } from "./search-input";

export const metadata: Metadata = { title: "Site intelligence · LeaseStack" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/site-intelligence
//
// One row per Organization that either has a SiteIntelligence record OR a
// DomainBinding attached. The point: let Adam/operators eyeball what the
// Firecrawl + Perplexity + Claude voice extractor actually grounded on
// before any drafting agent consumes it. Refresh-in-place via the existing
// /api/admin/site-intelligence/[orgId]/refresh endpoint.
// ---------------------------------------------------------------------------

const STALE_AFTER_DAYS = 7;

interface IngestPersistedPage {
  url: string;
  title: string;
  description: string;
  markdown: string;
  h1: string;
  h2: string[];
  wordCount: number;
}

function asPagesArray(value: unknown): IngestPersistedPage[] {
  if (!Array.isArray(value)) return [];
  return value as IngestPersistedPage[];
}

function fmtRelative(d: Date | null | undefined): string {
  if (!d) return "Never";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "Just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function daysSince(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function pickPrimaryDomain(
  domains: { hostname: string; isPrimary: boolean }[],
): string | null {
  if (!domains?.length) return null;
  const primary = domains.find((d) => d.isPrimary);
  return (primary ?? domains[0]).hostname;
}

type StatusKind = "fresh" | "stale" | "never";

function statusFor(crawledAt: Date | null, hasRow: boolean): {
  kind: StatusKind;
  label: string;
} {
  if (!hasRow || !crawledAt) {
    return { kind: "never", label: "Never ingested" };
  }
  const days = daysSince(crawledAt);
  if (days !== null && days >= STALE_AFTER_DAYS) {
    return { kind: "stale", label: `Stale · ${days}d old` };
  }
  return { kind: "fresh", label: `Ingested · ${fmtRelative(crawledAt)}` };
}

function statusBadgeClass(kind: StatusKind): string {
  switch (kind) {
    case "fresh":
      return "bg-primary/10 text-primary";
    case "stale":
      return "bg-muted text-foreground";
    case "never":
      return "border border-dashed border-border text-muted-foreground";
  }
}

export default async function SiteIntelligenceListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { error } = await requireAdmin();
  if (error) {
    redirect("/sign-in");
  }

  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();

  // Pull every org that either has a SiteIntelligence row OR at least one
  // DomainBinding. This way orgs that haven't been ingested yet still show
  // up so the operator can kick off a first run.
  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        { siteIntelligence: { isNot: null } },
        { domains: { some: {} } },
      ],
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      domains: {
        select: { hostname: true, isPrimary: true },
      },
      siteIntelligence: {
        select: {
          crawledAt: true,
          researchedAt: true,
          brandVoiceAt: true,
          brandVoice: true,
          pages: true,
          sitemapUrls: true,
        },
      },
    },
    take: 500,
  });

  const rows = orgs.map((o) => {
    const si = o.siteIntelligence;
    const pages = asPagesArray(si?.pages);
    const domain = pickPrimaryDomain(o.domains);
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      domain,
      hasRow: !!si,
      crawledAt: si?.crawledAt ?? null,
      researchedAt: si?.researchedAt ?? null,
      brandVoiceAt: si?.brandVoiceAt ?? null,
      pageCount: pages.length,
      sitemapCount: si?.sitemapUrls?.length ?? 0,
      voiceChars: si?.brandVoice?.length ?? 0,
    };
  });

  const filtered = q
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.slug.toLowerCase().includes(q) ||
          (r.domain?.toLowerCase().includes(q) ?? false),
      )
    : rows;

  const ingestedCount = rows.filter((r) => r.hasRow && r.crawledAt).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
            Admin
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-foreground">
              Site intelligence
            </h1>
            <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-primary/10 px-2 text-[11px] font-mono font-medium text-primary">
              {ingestedCount} / {rows.length}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-2xl">
            Cached Firecrawl pages, Perplexity research, and Claude-extracted
            brand voice — one record per client org. Eyeball what the drafting
            agent is grounded on, then refresh when copy changes on the
            client&apos;s live site.
          </p>
        </div>

        <Suspense fallback={<div className="h-9 w-64 animate-pulse bg-neutral-100 rounded" />}>
          <SearchInput />
        </Suspense>
      </header>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <SatelliteDish className="h-5 w-5 text-primary" />
          </div>
          <p className="text-[14px] font-medium text-foreground">
            {q ? "No orgs match that search" : "No organizations yet"}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {q
              ? "Try clearing the filter or searching by domain instead."
              : "Site intelligence is built per-org once a domain is bound. Add a tenant first."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((r) => {
            const status = statusFor(r.crawledAt, r.hasRow);
            return (
              <li
                key={r.id}
                className="group rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-2 flex-none">
                    <span
                      aria-hidden
                      className="block h-2 w-2 rounded-full bg-primary shadow-[0_0_0_3px_rgba(0,0,0,0.04)]"
                    />
                  </div>

                  <Link
                    href={`/admin/site-intelligence/${r.id}`}
                    className="min-w-0 flex-1 space-y-1.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-medium text-foreground">
                        {r.name}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {r.slug}
                      </span>
                      {r.domain ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                          <Globe className="h-3 w-3" aria-hidden />
                          {r.domain}
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-muted-foreground italic">
                          no domain
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wide ${statusBadgeClass(status.kind)}`}
                      >
                        {status.label}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {r.pageCount} pages
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        · {r.voiceChars} voice chars
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        · research {fmtRelative(r.researchedAt)}
                      </span>
                    </div>
                  </Link>

                  <div className="flex-none flex items-center gap-2">
                    <RefreshButton orgId={r.id} variant="secondary" />
                    <Link
                      href={`/admin/site-intelligence/${r.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Open
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
