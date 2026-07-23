import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { EditorClient } from "./editor-client";
import { parseStored } from "@/lib/actions/neighborhood-pages-helpers";
import { parseClaimSets } from "@/lib/aeo/prompts-neighborhood";
import { getEnabledEngines } from "@/lib/aeo/engines";
import type { AeoEngine } from "@prisma/client";
import type {
  CitationHealthData,
  ClaimRow,
  EngineCheck,
  EngineName,
} from "@/components/portal/seo/citation-health-panel";

export const metadata: Metadata = { title: "Edit neighborhood page" };
export const dynamic = "force-dynamic";

const ALL_ENGINES: AeoEngine[] = ["CLAUDE", "CHATGPT", "PERPLEXITY", "GEMINI"];

export default async function NeighborhoodPageEditor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  // Property-level RBAC: match every other SEO route — a restricted user
  // can't open/edit a page anchored on a property outside their scope, and
  // the property dropdown only offers properties they're allowed to see.
  const [row, properties, checks] = await Promise.all([
    prisma.neighborhoodPage.findFirst({
      where: {
        id,
        orgId: scope.orgId,
        ...(scope.allowedPropertyIds
          ? { propertyId: { in: scope.allowedPropertyIds } }
          : {}),
      },
    }),
    prisma.property.findMany({
      where: {
        orgId: scope.orgId,
        ...(scope.allowedPropertyIds
          ? { id: { in: scope.allowedPropertyIds } }
          : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.aeoCitationCheck.findMany({
      where: { orgId: scope.orgId, neighborhoodPageId: id },
      orderBy: { queryRunAt: "desc" },
      select: {
        id: true,
        engine: true,
        prompt: true,
        responseText: true,
        citedUrl: true,
        competitorsCited: true,
        status: true,
        claim: true,
        queryRunAt: true,
      },
      take: 200,
    }),
  ]);

  if (!row) notFound();
  const page = parseStored(row);
  if (!page) notFound();

  const claimSets = parseClaimSets(row.aiCitations);
  const enabledEngines: EngineName[] = getEnabledEngines().map(
    (e) => e.engine as EngineName,
  );
  const citationHealth = buildCitationHealth({
    pageId: page.id,
    claimSets,
    checks,
    enabledEngines,
  });

  return (
    <div className="max-w-4xl">
      <PageHeader
        breadcrumb={
          <Link
            href="/portal/seo/neighborhoods"
            className="hover:underline"
          >
            ← Neighborhood pages
          </Link>
        }
        eyebrow={page.status}
        title={page.title || `${page.neighborhood}, ${page.city}`}
        description={`Public URL: /n/${page.slug}`}
      />
      <EditorClient
        page={page}
        properties={properties}
        citationHealth={citationHealth}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server-side shaping: turn the flat AeoCitationCheck list into a per-claim
// table the panel renders. We bucket by claim text, then take the MOST
// RECENT check per (claim, engine) so the per-engine status pills reflect
// the latest scan, not the entire history.
// ---------------------------------------------------------------------------
function buildCitationHealth(input: {
  pageId: string;
  claimSets: Array<{ claim: string; prompts: string[] }>;
  checks: Array<{
    engine: AeoEngine;
    prompt: string;
    responseText: string;
    citedUrl: string | null;
    competitorsCited: string[];
    status: "CITED" | "NOT_CITED" | "COMPETITOR_CITED";
    claim: string | null;
    queryRunAt: Date;
  }>;
  enabledEngines: EngineName[];
}): CitationHealthData {
  const { pageId, claimSets, checks, enabledEngines } = input;

  // Group checks by claim → latest per (claim, engine).
  const byClaim = new Map<string, Map<EngineName, EngineCheck>>();
  for (const c of checks) {
    const claimKey = (c.claim ?? "").trim();
    if (!claimKey) continue;
    const engine = c.engine as EngineName;
    if (!ALL_ENGINES.includes(engine as AeoEngine)) continue;
    const inner = byClaim.get(claimKey) ?? new Map<EngineName, EngineCheck>();
    if (!inner.has(engine)) {
      // checks is ordered desc by queryRunAt, so the first one we see per
      // (claim, engine) is the latest.
      inner.set(engine, {
        engine,
        status: c.status,
        prompt: c.prompt,
        responseExcerpt: c.responseText.slice(0, 600),
        citedUrl: c.citedUrl,
        competitorsCited: c.competitorsCited,
        queryRunAt: c.queryRunAt.toISOString(),
      });
    }
    byClaim.set(claimKey, inner);
  }

  // Per-engine cited counts across ALL latest-per-(claim,engine) entries.
  const citedByEngine = Object.fromEntries(
    enabledEngines.map((e) => [e, { cited: 0, total: 0 }]),
  ) as Record<EngineName, { cited: number; total: number }>;

  const rows: ClaimRow[] = claimSets.map((s) => {
    const inner = byClaim.get(s.claim.trim()) ?? new Map<EngineName, EngineCheck>();
    const byEngine = Array.from(inner.values()).sort((a, b) =>
      a.engine.localeCompare(b.engine),
    );
    for (const c of byEngine) {
      if (!citedByEngine[c.engine]) {
        citedByEngine[c.engine] = { cited: 0, total: 0 };
      }
      citedByEngine[c.engine].total += 1;
      if (c.status === "CITED") citedByEngine[c.engine].cited += 1;
    }
    return {
      claim: s.claim,
      prompts: s.prompts,
      byEngine,
    };
  });

  const lastScanAt =
    checks.length > 0 ? checks[0].queryRunAt.toISOString() : null;

  return {
    pageId,
    enginesAvailable: enabledEngines,
    lastScanAt,
    totalChecks: checks.length,
    citedByEngine,
    rows,
  };
}
