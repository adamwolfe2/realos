import * as React from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { AeoClient } from "./aeo-client";
import type { EngineCardData } from "./aeo-engine-cards";
import type { ResponseRow } from "./aeo-responses-table";
import { ALL_ENGINES, resolveEngineSource } from "@/lib/aeo/engines";
import type {
  ShareOfVoicePerEngine,
  TopEntity,
} from "@/components/portal/aeo/share-of-voice-card";
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

  // Mention = brand was named anywhere in the answer (mentioned column,
  // backfilled from CITED + COMPETITOR_CITED in the migration).
  // Citation = engine returned a URL we own.
  const last30Mentioned = last30.filter((c) => c.mentioned).length;
  const last30Cited = last30.filter((c) => c.status === "CITED").length;
  const last30Total = last30.length;
  const prior30Mentioned = prior30.filter((c) => c.mentioned).length;
  const prior30Total = prior30.length;

  const mentionRate30 = last30Total > 0 ? last30Mentioned / last30Total : 0;
  const citationRate30 = last30Total > 0 ? last30Cited / last30Total : 0;
  const priorMentionRate =
    prior30Total > 0 ? prior30Mentioned / prior30Total : 0;
  const trendDelta = mentionRate30 - priorMentionRate;

  // Composite Visibility Score (0-100). Norman feedback (May 22): the
  // original 50/40/10 weighting capped the score at ~9 even for a
  // property that gets cited on 100% of its branded queries, because
  // the discovery queries (which a small property reliably loses to
  // big-name competitors) dragged the rates down. New weighting:
  //
  //   mention rate         × 50  (do AI engines know who you are?)
  //   citation rate        × 30  (do they link to you?)
  //   position bonus       ×  5  (when cited, are you near the top?)
  //   branded mention rate × 15  (defensive moat — given a name, do
  //                                they have data on you?)
  //
  // The branded-rate kicker is the new piece — it captures the
  // defensive moat (AI knowing you when prompted by name) separately
  // from the growth gap (AI surfacing you off a blank competitive
  // set). Both numbers continue to live on the page below; this just
  // makes the headline score reflect both honestly instead of only
  // the harder discovery axis.
  const citedRowsWithPos = last30.filter(
    (c) => c.status === "CITED" && typeof c.position === "number",
  );
  const positionBonus =
    citedRowsWithPos.length > 0
      ? citedRowsWithPos.reduce((acc, c) => {
          const p = c.position ?? 99;
          if (p === 1) return acc + 1;
          if (p === 2) return acc + 0.66;
          if (p === 3) return acc + 0.33;
          return acc;
        }, 0) / citedRowsWithPos.length
      : 0;
  // Branded mention rate — what fraction of branded prompts ("Tell me
  // about <property>", "What do residents say about <property>", etc.)
  // had us mentioned. Detect by the generator's known phrasings rather
  // than fetching property names — the generator in lib/aeo/prompts.ts
  // always leads branded prompts with one of these templates, so a
  // text match is cheap and self-contained.
  const BRANDED_PROMPT_MARKERS = [
    /^tell me about /i,
    /^what do residents say about /i,
    /^what are the amenities and pricing like at /i,
    / reviews — what are the most common /i,
  ];
  const brandedRows = last30.filter((c) =>
    BRANDED_PROMPT_MARKERS.some((re) => re.test(c.prompt)),
  );
  const brandedMentioned = brandedRows.filter((c) => c.mentioned).length;
  const brandedMentionRate =
    brandedRows.length > 0 ? brandedMentioned / brandedRows.length : 0;
  // Final weights (May 22 retune):
  //   branded mention rate × 45  — the defensive moat; for a small
  //                                 property this IS the AI visibility
  //                                 story, because nobody loses branded
  //                                 queries (engines have public data
  //                                 on every named building). Driving
  //                                 the headline score off this means
  //                                 well-known properties read as
  //                                 "visible" the moment they connect.
  //   mention rate         × 30  — combined branded + discovery
  //                                 mention. Still material — captures
  //                                 the rare discovery win.
  //   citation rate        × 20  — engines actually link to your site
  //   position bonus       ×  5  — when cited, near the top
  //
  // For a property that nails branded and loses every discovery prompt
  // (the realistic case for any small-mid property today), this lands
  // ~60-70/100 — which is the honest read on their actual AI search
  // surface area. Growth ceiling is closing the discovery gap.
  const visibilityScore = Math.round(
    brandedMentionRate * 45 +
      mentionRate30 * 30 +
      citationRate30 * 20 +
      positionBonus * 5,
  );

  // Configured map per engine — server-only because `isConfigured()`
  // reads env vars. We resolve it here and pass a boolean to the client.
  const engineConfigured = new Map<AeoEngine, boolean>();
  for (const e of ALL_ENGINES) {
    engineConfigured.set(e.engine as AeoEngine, e.isConfigured());
  }

  // Per-engine summaries with BOTH mention + citation rates + 7d sparkline.
  // Sparkline tracks mention rate (the more sensitive signal) rather than
  // citation rate, which is binary-flat for most orgs early on.
  const engineCards: EngineCardData[] = ENGINES.map((engine) => {
    const forEngine = last30.filter((c) => c.engine === engine);
    const mentioned = forEngine.filter((c) => c.mentioned).length;
    const cited = forEngine.filter((c) => c.status === "CITED").length;
    const total = forEngine.length;
    const mentionRate = total > 0 ? mentioned / total : 0;
    const citationRate = total > 0 ? cited / total : 0;
    const lastScan = forEngine[0]?.queryRunAt ?? null;
    const configured = engineConfigured.get(engine) ?? false;

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
      const dayMentioned = dayRows.filter((c) => c.mentioned).length;
      sparkline7d.push(dayRows.length > 0 ? dayMentioned / dayRows.length : 0);
    }

    return {
      engine,
      configured,
      mentionRate,
      mentioned,
      citationRate,
      cited,
      total,
      lastScan,
      sparkline7d,
    };
  });

  // Competitors-cited rollup. Aggregate counts across rows where we
  // weren't cited — these are the buildings the AI surfaced instead.
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

  // ---------------------------------------------------------------------
  // "What to do next" — derived recommendations.
  //
  // Three actionable insights based on the actual data. Rule of thumb:
  // every insight must (a) describe what the data shows, (b) name the
  // root cause, and (c) link to the surface where the operator can act.
  // Generic "improve your SEO" copy is forbidden — say what to change.
  // ---------------------------------------------------------------------
  type Recommendation = {
    severity: "high" | "medium" | "low";
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  };
  const recommendations: Recommendation[] = [];

  // Gap 1: Mentioned but not cited → schema / FAQ / canonical URL gaps.
  if (mentionRate30 >= 0.3 && citationRate30 < 0.1 && last30Total >= 4) {
    recommendations.push({
      severity: "high",
      title: "Engines name you, but they don't link.",
      body: `${Math.round(mentionRate30 * 100)}% of AI answers mention your brand, only ${Math.round(citationRate30 * 100)}% cite a URL. Adding FAQPage schema + canonical tags to your top pages is the highest-ROI fix.`,
      ctaLabel: "Draft a FAQ block",
      ctaHref: "/portal/content/new?format=FAQ_BLOCK",
    });
  }

  // Gap 2: Top competitor named 3+ times → counter-page opportunity.
  if (competitorRollup.length > 0 && competitorRollup[0].count >= 3) {
    const top = competitorRollup[0];
    recommendations.push({
      severity: "high",
      title: `"${top.name}" beats you in ${top.count} AI answers.`,
      body: `When prospects ask AI assistants for apartments in your market, "${top.name}" shows up ${top.count}× in the last 30 days while you don't. Draft a comparison page that names both — AI engines reliably surface side-by-side pages.`,
      ctaLabel: "Draft a counter page",
      ctaHref: `/portal/content/new?format=BLOG_POST&target=${encodeURIComponent(`${top.name} vs my property`)}`,
    });
  }

  // Gap 3: Specific engine is shut out → diagnose missing API or low ranking.
  const sparseEngines = engineCards.filter(
    (c) => c.configured && c.total > 0 && c.mentionRate === 0,
  );
  if (sparseEngines.length > 0) {
    const names = sparseEngines.map((e) => e.engine).join(", ");
    recommendations.push({
      severity: "medium",
      title: `Invisible on ${sparseEngines.length === 1 ? sparseEngines[0].engine : names}.`,
      body: `${names} ${sparseEngines.length === 1 ? "queried your prompts" : "queried your prompts"} but never mentioned your brand. ${sparseEngines[0].engine === "PERPLEXITY" ? "Perplexity weighs citations heavily — add canonical URLs and outbound links to citable sources." : "Try adding longer, more structured content (Q&A blocks especially)."}`,
      ctaLabel: "View live responses",
      ctaHref: "#all-responses",
    });
  }

  // Fallback: no data yet → tell them to scan.
  if (recommendations.length === 0 && last30Total === 0) {
    recommendations.push({
      severity: "low",
      title: "No AI scans yet.",
      body: "Run your first scan to see how ChatGPT, Perplexity, Claude, and Gemini answer questions about your market. Scans run automatically every Monday.",
      ctaLabel: "Scan now",
      ctaHref: "#scan",
    });
  }

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

  // ---------------------------------------------------------------------
  // AEO v2 W1 — AI Share of Voice aggregation. Reads AeoMentionSnapshot
  // rows from the last 30 days (DataForSEO-only), groups by engine for
  // the bar chart, and rolls up classified mentions into a top-entities
  // list. Empty arrays when DataForSEO source is off — widget renders
  // its own empty state.
  // ---------------------------------------------------------------------
  const snapshots = await prisma.aeoMentionSnapshot.findMany({
    where: {
      ...where,
      capturedAt: { gte: thirtyDaysAgo },
    },
    select: {
      engine: true,
      shareOfVoice: true,
      mentions: true,
    },
    orderBy: { capturedAt: "desc" },
    take: 2000,
  });

  type SnapshotMention = {
    name: string;
    kind: "self" | "competitor" | "other";
    position: number;
    citedUrl: string | null;
  };

  const sovByEngine = new Map<
    AeoEngine,
    { sum: number; count: number }
  >();
  const entityCounts = new Map<
    string,
    { name: string; kind: SnapshotMention["kind"]; count: number }
  >();

  for (const snap of snapshots) {
    const bucket = sovByEngine.get(snap.engine) ?? { sum: 0, count: 0 };
    bucket.sum += snap.shareOfVoice;
    bucket.count += 1;
    sovByEngine.set(snap.engine, bucket);

    // mentions JSON column → array. Defensive: tolerate non-array shapes
    // from older rows or partial writes by ignoring them.
    const raw = snap.mentions as unknown;
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const m = item as Partial<SnapshotMention>;
      if (typeof m.name !== "string" || m.name.length === 0) continue;
      const kind: SnapshotMention["kind"] =
        m.kind === "self" || m.kind === "competitor" ? m.kind : "other";
      const key = `${kind}::${m.name.toLowerCase()}`;
      const existing = entityCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        entityCounts.set(key, { name: m.name, kind, count: 1 });
      }
    }
  }

  const sovPerEngine: ShareOfVoicePerEngine[] = ENGINES.map((engine) => {
    const bucket = sovByEngine.get(engine);
    return {
      engine,
      avgSov: bucket && bucket.count > 0 ? bucket.sum / bucket.count : 0,
      snapshotCount: bucket?.count ?? 0,
    };
  });

  const topEntities: TopEntity[] = Array.from(entityCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return (
    <AeoClient
      engineCards={engineCards}
      responses={responses}
      competitorRollup={competitorRollup}
      lastScanAt={lastScanAt}
      kpis={{
        visibilityScore,
        mentionRate30,
        last30Mentioned,
        citationRate30,
        last30Cited,
        last30Total,
        priorRate: priorMentionRate,
        prior30Total,
        trendDelta,
        competitorsNamed: competitorCounts.size,
      }}
      recommendations={recommendations}
      shareOfVoice={{
        perEngine: sovPerEngine,
        topEntities,
        totalSnapshots: snapshots.length,
        engineSource: resolveEngineSource(),
      }}
    />
  );
}
