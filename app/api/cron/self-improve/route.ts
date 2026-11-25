import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { generateProposals } from "@/lib/self-improve/generate";

// Weekly self-improve pass (SG cockpit slice 4): proposals only, nothing is
// applied or sent. Workspaces with chatbot or pop-up activity in the last 28
// days, least recently served first; one model call per property with new
// signals, inside a 240s budget.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_ORGS_PER_RUN = 10;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("self-improve", async () => {
    const deadline = Date.now() + 240_000;
    const since = new Date(Date.now() - 28 * 86_400_000);
    const [chatOrgs, popupOrgs] = await Promise.all([
      prisma.chatbotConversation.findMany({
        where: { lastMessageAt: { gte: since }, property: { lifecycle: "ACTIVE" } },
        distinct: ["orgId"],
        select: { orgId: true },
        take: 200,
      }),
      prisma.popupEvent.findMany({ where: { occurredAt: { gte: since } }, distinct: ["orgId"], select: { orgId: true }, take: 200 }),
    ]);
    const candidates = [...new Set([...chatOrgs, ...popupOrgs].map((r) => r.orgId))];
    // Rotate: workspaces never served first, then the longest since their last proposal.
    const served = await prisma.chatbotKnowledgeSuggestion.groupBy({
      by: ["orgId"],
      where: { orgId: { in: candidates }, dedupeKey: { startsWith: "si:" } },
      _max: { createdAt: true },
    });
    const last = new Map(served.map((s) => [s.orgId, s._max.createdAt?.getTime() ?? 0]));
    const orgIds = candidates.sort((a, b) => (last.get(a) ?? 0) - (last.get(b) ?? 0)).slice(0, MAX_ORGS_PER_RUN);

    let proposals = 0;
    let failed = 0;
    let skipped = 0;
    const orgs: Array<{ orgId: string; proposals?: number; llmCalls?: number; partial?: boolean; error?: string }> = [];
    for (const orgId of orgIds) {
      if (Date.now() > deadline) {
        skipped += 1;
        continue;
      }
      try {
        const r = await generateProposals(orgId, { deadline });
        const made = r.answers + r.needsAnswer + r.popups + r.site;
        proposals += made;
        orgs.push({ orgId, proposals: made, llmCalls: r.llmCalls, partial: r.stoppedEarly || r.properties > r.llmCalls });
      } catch (err) {
        failed += 1;
        console.error(`[self-improve] org ${orgId} failed:`, err);
        orgs.push({ orgId, error: err instanceof Error ? err.message : String(err) });
      }
    }
    const partial = orgs.filter((o) => o.partial).length;
    const problems = failed + skipped + partial;
    const summary = [
      failed ? `${failed} failed: ${orgs.filter((o) => o.error).map((o) => o.error).join("; ").slice(0, 300)}` : "",
      skipped ? `${skipped} skipped (time budget)` : "",
      partial ? `${partial} partial (time budget or draft errors)` : "",
    ].filter(Boolean).join(" · ");
    return {
      result: NextResponse.json({ ok: problems === 0, orgs: orgIds.length, proposals, failed, skipped, partial, detail: orgs }),
      recordsProcessed: proposals,
      errorCount: problems,
      ...(summary ? { errorSummary: summary } : {}),
    };
  });
}
