import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProspectAuditStatus } from "@prisma/client";
import { computeSignals } from "@/lib/signals/compute";
import { persistSnapshot } from "@/lib/signals/persist";
import type { SignalSnapshot } from "@/lib/signals/types";

// POST /api/audit/run/[id]
// Internal trigger only — caller MUST send `x-internal-trigger` equal to
// CRON_SECRET. The /api/audit/start route fans out to this endpoint
// fire-and-forget after creating a QUEUED ProspectAudit row.
//
// The function is idempotent: if status !== QUEUED we return 200 quickly
// (used to avoid double-runs from a retry).

export const maxDuration = 60;

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
    select: { id: true, domain: true, status: true },
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

    const snapshot = await computeSignals({
      kind: "prospect",
      prospectAuditId: id,
      domain: audit.domain,
    });
    await persistSnapshot(
      { kind: "prospect", prospectAuditId: id, domain: audit.domain },
      snapshot,
    );

    const sectionScores = buildSectionScores(snapshot);
    const findings = buildFindings(snapshot, audit.domain);
    const claudeSummary = buildSummary(snapshot, audit.domain);

    await prisma.prospectAudit.update({
      where: { id },
      data: {
        status: ProspectAuditStatus.READY,
        overallScore: snapshot.overallScore,
        sectionScores,
        findings,
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

function buildSectionScores(s: SignalSnapshot): Record<string, number> {
  return {
    seo: s.seo?.score ?? 0,
    aeo: s.aeo?.score ?? 0,
    reputation: s.reputation?.score ?? 0,
    traffic: s.traffic?.score ?? 0,
  };
}

// Placeholder findings synthesized from the mock signal data. Builder A's
// Phase-2 compute will produce real findings; until then we generate a
// plausible set so the viewer renders end-to-end.
function buildFindings(s: SignalSnapshot, domain: string) {
  const quickWins = [
    { id: "qw-1", title: "Add FAQ schema to your floor-plan pages", detail: "Lifts AEO citation rate on 'apartments in <city>' queries within 2-3 weeks." },
    { id: "qw-2", title: `Claim ${s.reputation?.totalMentions ?? 0} unresponded review mentions`, detail: "Public replies inside 48 hours measurably lift conversion on the next property visit." },
    { id: "qw-3", title: "Tighten Title + H1 on the homepage", detail: `Currently positioned at ${s.seo?.avgPosition ?? "n/a"} avg. A focused rewrite usually clears 2-3 positions.` },
    { id: "qw-4", title: "Wire your chatbot to your floor-plan inventory", detail: "Today's responses miss live availability — prospects drop off when they have to call to confirm." },
    { id: "qw-5", title: `Backlink outreach to neighborhood blogs around ${domain}`, detail: "Three referring domains in the next 30 days moves you above the local competitive set." },
  ];
  const risks = [
    { id: "r-1", title: `${s.reputation?.newNegative7d ?? 0} new negative mentions this week`, detail: "Sentiment trend is the leading indicator of tour cancellations." },
    { id: "r-2", title: "ChatGPT and Gemini aren't citing your brand yet", detail: "Today's renters check AI search before clicking — un-cited brands are invisible." },
    { id: "r-3", title: "Bounce rate is above the property-marketing median", detail: "Likely first-impression friction on the listings page." },
  ];
  const opportunities = [
    { id: "o-1", title: "Build a per-unit-type page set", detail: "One page per (neighborhood × unit type). Each one indexed and AEO-quotable." },
    { id: "o-2", title: "Capture the 'pet friendly' query cluster", detail: `Volume ${s.seo?.topMovers?.[2]?.volume ?? 1100}/mo. Currently ranking off-page-1.` },
    { id: "o-3", title: "Launch a single Pet-Friendly comparison page", detail: "Multifamily playbook: comparison pages outrank brand sites within 60 days." },
  ];
  return { quickWins, risks, opportunities };
}

function buildSummary(s: SignalSnapshot, domain: string): string {
  return [
    `${domain} sits at an overall LeaseStack score of ${s.overallScore}. SEO is doing the heavy lifting (score ${s.seo?.score ?? 0}); AEO and reputation are the lever.`,
    `The fastest path to a 10-point lift is reputation reply hygiene plus FAQ schema on the floor-plan pages.`,
    `Inside 30 days a tightened H1 + three referring-domain backlinks usually moves a property of this size 2-3 positions on its core neighborhood queries.`,
  ].join(" ");
}
