import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { runChatbotLearningLoop } from "@/lib/chatbot/learning/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RECENT_WINDOW_DAYS = 90;
const MAX_ORGS_PER_RUN = 25;
const CONVERSATIONS_PER_ORG = 500;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("chatbot-learning-loop", async () => {
    const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const orgRows = await prisma.chatbotConversation.findMany({
      where: {
        messageCount: { gt: 0 },
        lastMessageAt: { gte: since },
      },
      distinct: ["orgId"],
      select: { orgId: true },
      orderBy: { lastMessageAt: "desc" },
      take: MAX_ORGS_PER_RUN,
    });

    let scannedConversations = 0;
    let persistedRecords = 0;
    let failed = 0;
    const orgs: Array<{
      orgId: string;
      scannedConversations?: number;
      persisted?: number;
      error?: string;
    }> = [];

    for (const row of orgRows) {
      try {
        const result = await runChatbotLearningLoop({
          orgId: row.orgId,
          dryRun: false,
          take: CONVERSATIONS_PER_ORG,
        });
        const persisted =
          (result.persisted?.cases ?? 0) +
          (result.persisted?.tasks ?? 0) +
          (result.persisted?.drafts ?? 0) +
          (result.persisted?.knowledgeSuggestions ?? 0) +
          (result.persisted?.conversationInsights ?? 0) +
          (result.persisted?.siteRecommendations ?? 0);

        scannedConversations += result.scannedConversations;
        persistedRecords += persisted;
        orgs.push({
          orgId: row.orgId,
          scannedConversations: result.scannedConversations,
          persisted,
        });
      } catch (err) {
        failed += 1;
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[chatbot-learning-loop] org ${row.orgId} failed:`, err);
        orgs.push({ orgId: row.orgId, error });
      }
    }

    return {
      result: NextResponse.json({
        ok: failed === 0,
        queuedOrgs: orgRows.length,
        scannedConversations,
        persistedRecords,
        failed,
        orgs,
      }),
      recordsProcessed: persistedRecords,
      errorCount: failed,
    };
  });
}
