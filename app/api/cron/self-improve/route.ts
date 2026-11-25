import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { generateProposals } from "@/lib/self-improve/generate";

// Weekly self-improve pass (SG cockpit slice 4): proposals only, nothing is
// applied or sent. Workspaces with a live chatbot or pop-up in the last 28
// days; one model call per property with new signals.

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
    // Most recently active workspaces first.
    const orgRows = await prisma.chatbotConversation.findMany({
      where: { createdAt: { gte: since }, property: { lifecycle: "ACTIVE" } },
      distinct: ["orgId"],
      orderBy: { createdAt: "desc" },
      select: { orgId: true },
      take: MAX_ORGS_PER_RUN,
    });

    let proposals = 0;
    let failed = 0;
    const orgs: Array<{ orgId: string; proposals?: number; llmCalls?: number; error?: string }> = [];
    for (const { orgId } of orgRows) {
      try {
        if (Date.now() > deadline) break;
        const r = await generateProposals(orgId, { deadline });
        const made = r.answers + r.needsAnswer + r.popups + r.site;
        proposals += made;
        orgs.push({ orgId, proposals: made, llmCalls: r.llmCalls });
      } catch (err) {
        failed += 1;
        console.error(`[self-improve] org ${orgId} failed:`, err);
        orgs.push({ orgId, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return {
      result: NextResponse.json({ ok: failed === 0, orgs: orgRows.length, proposals, failed, detail: orgs }),
      recordsProcessed: proposals,
      errorCount: failed,
    };
  });
}
