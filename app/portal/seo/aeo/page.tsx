import * as React from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { AeoClient } from "./aeo-client";
import type { EngineCardData } from "./aeo-engine-cards";
import type { ResponseRow } from "./aeo-responses-table";
import { ALL_ENGINES } from "@/lib/aeo/engines";
import type { AeoEngine } from "@prisma/client";

export const metadata: Metadata = { title: "AI search visibility" };
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const ENGINES: AeoEngine[] = ["CHATGPT", "PERPLEXITY", "CLAUDE", "GEMINI"];

// Server entry for /portal/seo/aeo. Owns auth + tenant scoping + the
// Prisma read. Everything below the data fetch is pure shaping into the
// view-prop bundle passed to AeoClient. Keep this thin — the moment a
// hook or onClick shows up here, it belongs in aeo-client.tsx instead.
export default async function AeoPage() {
  const scope = await requireScope();
  const where = tenantWhere(scope);

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * DAY_MS);
  const sixtyDaysAgo = new Date(now - 60 * DAY_MS);
  const sevenDaysAgo = new Date(now - 7 * DAY_MS);

  // Pull every check from the last 60d in one query, partition in memory.
  // For an org with N properties × M engines × 3 prompts/week ≈ a few hundred
  // rows at most — well below any pagination concern.
  const checks = await prisma.aeoCitationCheck.findMany({
    where: {
      ...where,
      queryRunAt: { gte: sixtyDaysAgo },
    },
    select: {
      id: true,
      engine: true,
      prompt: true,
      status: true,
      mentioned: true,
      position: true,
      responseText: true,
      citedUrl: true,
      competitorsCited: true,
      queryRunAt: true,
      propertyId: true,
    },
    orderBy: { queryRunAt: "desc" },
    take: 2000,
  });

  const last30 = checks.filter((c) => c.queryRunAt >= thirtyDaysAgo);
  const prior30 = checks.filter(
    (c) => c.queryRunAt < thirtyDaysAgo && c.queryRunAt >= sixtyDaysAgo,
  );

  const last30Cited = last30.filter((c) => c.status === "CITED").length;
  const last30Total = last30.length;
  const prior30Cited = prior30.filter((c) => c.status === "CITED").length;
  const prior30Total = prior30.length;

  const citationRate30 = last30Total > 0 ? last30Cited / last30Total : 0;
  const priorRate = prior30Total > 0 ? prior30Cited / prior30Total : 0;
  const trendDelta = citationRate30 - priorRate;

  // Configured map per engine — server-only because `isConfigured()`
  // reads env vars. We resolve it here and pass a boolean to the client.
  const engineConfigured = new Map<AeoEngine, boolean>();
  for (const e of ALL_ENGINES) {
    engineConfigured.set(e.engine as AeoEngine, e.isConfigured());
  }

  // Per-engine summaries + 7d sparkline.
  const engineCards: EngineCardData[] = ENGINES.map((engine) => {
    const forEngine = last30.filter((c) => c.engine === engine);
    const cited = forEngine.filter((c) => c.status === "CITED");
    const total = forEngine.length;
    const rate = total > 0 ? cited.length / total : 0;
    const lastScan = forEngine[0]?.queryRunAt ?? null;
    const configured = engineConfigured.get(engine) ?? false;

    // Sparkline: citation rate per day for the last 7 days, oldest → newest.
    const sparkline7d: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now - i * DAY_MS);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const dayRows = forEngine.filter(
        (c) =>
          c.queryRunAt >= sevenDaysAgo &&
          c.queryRunAt >= dayStart &&
          c.queryRunAt < dayEnd,
      );
      const dayCited = dayRows.filter((c) => c.status === "CITED").length;
      sparkline7d.push(dayRows.length > 0 ? dayCited / dayRows.length : 0);
    }

    return {
      engine,
      configured,
      rate,
      cited: cited.length,
      total,
      lastScan,
      sparkline7d,
    };
  });

  // Competitors-cited rollup. Aggregate counts across rows where we
  // weren't cited (NOT_CITED + COMPETITOR_CITED both reveal who the
  // engine surfaced instead of us).
  const competitorCounts = new Map<string, number>();
  for (const c of last30) {
    if (c.status === "CITED") continue;
    for (const name of c.competitorsCited) {
      const key = name.trim();
      if (!key) continue;
      competitorCounts.set(key, (competitorCounts.get(key) ?? 0) + 1);
    }
  }
  const competitorRollup = Array.from(competitorCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Build the response rows for the All Responses table. Truncate
  // server-side to ~300 chars to keep the client payload tight — the
  // full response stays in the DB and can be fetched on demand later.
  const responses: ResponseRow[] = checks.map((c) => {
    const trimmed = (c.responseText ?? "").trim();
    const excerpt =
      trimmed.length > 300 ? trimmed.slice(0, 300).trimEnd() + "…" : trimmed;
    return {
      id: c.id,
      engine: c.engine,
      prompt: c.prompt,
      status: c.status,
      mentioned: c.mentioned,
      position: c.position,
      responseExcerpt: excerpt,
      citedUrl: c.citedUrl,
      competitorsCited: c.competitorsCited,
      queryRunAt: c.queryRunAt.toISOString(),
    };
  });

  const lastScanAt = checks[0]?.queryRunAt
    ? checks[0].queryRunAt.toISOString()
    : null;

  return (
    <AeoClient
      engineCards={engineCards}
      responses={responses}
      competitorRollup={competitorRollup}
      lastScanAt={lastScanAt}
      kpis={{
        citationRate30,
        last30Cited,
        last30Total,
        priorRate,
        prior30Total,
        trendDelta,
        competitorsNamed: competitorCounts.size,
      }}
    />
  );
}
