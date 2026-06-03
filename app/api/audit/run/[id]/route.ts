import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProspectAuditStatus } from "@prisma/client";
import { computeSignals } from "@/lib/signals/compute";
import { persistSnapshot } from "@/lib/signals/persist";
import { synthesizeAudit } from "@/lib/audit/synthesize";
import { brandNameFromDomain } from "@/lib/audit/reputation-prospect";

// POST /api/audit/run/[id]
// Internal trigger only — caller MUST send `x-internal-trigger` equal to
// CRON_SECRET. The /api/audit/start route fans out to this endpoint
// fire-and-forget after creating a QUEUED ProspectAudit row.
//
// Pipeline:
//   1. computeSignals — real DataforSEO + AEO + reputation fan-out.
//      Returns the SignalSnapshot plus the raw provider data (__provider).
//   2. persistSnapshot — write the daily snapshot row (provider data is
//      stripped on the way in so it doesn't bloat the JSON columns).
//   3. synthesizeAudit — derive findings + claudeSummary from the real
//      signals. No mock copy.
//   4. update — flip ProspectAudit to READY with the synthesized payload.
//
// Idempotent: if status !== QUEUED we early-out with 200.

// 2026-05-29: bumped from 60 → 120. The fan-out grew significantly with
// the broader per-source Tavily scan + multi-query Reddit port + AEO's
// 4 engines × 5 prompts = 20 LLM calls + the synthesizer's Claude
// narrative call. Empirically a fresh scan runs 75-110s; 60 was killing
// the function before persistSnapshot() got a chance to flip the row.
// Tier-safe ceiling: Vercel Hobby caps at 60s for Edge/Serverless,
// Pro at 300s for Node serverless functions. 120 fits inside Pro and
// leaves headroom above the watchdog timeout in
// app/api/audit/[id]/route.ts (90s) so we always hit a clean terminal
// state instead of getting killed mid-write.
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const expected = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("x-internal-trigger") ?? "";
  if (!expected || got !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const audit = await prisma.prospectAudit.findUnique({
    where: { id },
    select: {
      id: true,
      domain: true,
      status: true,
      brandName: true,
      quizAnswers: true,
    },
  });
  if (!audit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (audit.status !== ProspectAuditStatus.QUEUED) {
    return NextResponse.json({ ok: true, status: audit.status });
  }

  try {
    await prisma.prospectAudit.update({
      where: { id },
      data: { status: ProspectAuditStatus.RUNNING },
    });

    const computeResult = await computeSignals({
      kind: "prospect",
      prospectAuditId: id,
      domain: audit.domain,
    });

    // Strip the non-persistable __provider field before saving the daily
    // snapshot — DailySignalSnapshot only carries the typed sections.
    const { __provider, ...snapshot } = computeResult;
    await persistSnapshot(
      { kind: "prospect", prospectAuditId: id, domain: audit.domain },
      snapshot,
    );

    const brandName = audit.brandName ?? brandNameFromDomain(audit.domain);
    // The Prisma column is Json, so the runtime type is `JsonValue`. The
    // scoring + recommendation engines validate per-question; this cast
    // is safe because we wrote a record/string|string[] shape on the
    // start route.
    const quizAnswers =
      (audit.quizAnswers as Record<string, string | string[]> | null) ?? null;
    const { findings, claudeSummary, sectionScores, overallScore } =
      await synthesizeAudit(
        snapshot,
        {
          brandName,
          domain: audit.domain,
          rankedKeywords: __provider?.rankedKeywords ?? null,
          lighthouse: __provider?.lighthouse ?? null,
          lighthouseAudits: null,
          pageAudit: __provider?.pageAudit ?? null,
          siteCrawl: __provider?.siteCrawl ?? null,
          backlinks: __provider?.backlinks ?? null,
          mentions: __provider?.mentions ?? [],
          aeoCompetitorsCited: __provider?.aeoCompetitorsCited ?? [],
          aeoCitedEngines: __provider?.aeoCitedEngines ?? [],
          aeoUncitedEngines: __provider?.aeoUncitedEngines ?? [],
          googleAiOverview: __provider?.googleAiOverview ?? null,
        },
        quizAnswers,
      );

    // overallScore is the post-cap DPS (0-75) so admin views + the
    // public report read the same number. sectionScores still carries
    // the legacy 4-key shape (seo/aeo/reputation/traffic) for backward
    // compatibility — the result page reads the new pillar shape from
    // findings.dps.pillars.
    await prisma.prospectAudit.update({
      where: { id },
      data: {
        status: ProspectAuditStatus.READY,
        brandName: audit.brandName ?? brandName,
        overallScore,
        sectionScores,
        findings: JSON.parse(JSON.stringify(findings)),
        claudeSummary,
      },
    });
    return NextResponse.json({ ok: true, status: "READY" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[POST /api/audit/run/[id]]", err);
    await prisma.prospectAudit
      .update({
        where: { id },
        data: {
          status: ProspectAuditStatus.FAILED,
          errorMessage: message.slice(0, 1000),
        },
      })
      .catch(() => {
        /* swallow — the original error is what matters */
      });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
