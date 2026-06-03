import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { sendProspectProfileForConversation } from "@/lib/chatbot/send-prospect-profile";

// ---------------------------------------------------------------------------
// GET /api/cron/chatbot-profile-digest
//
// Every 5 minutes. Finds chatbot conversations that:
//   - have at least one message
//   - have been idle for ≥5 min (lastMessageAt threshold)
//   - haven't had their prospect-profile digest email sent yet
//
// For each: extracts the rich profile via Claude Haiku and emails the
// agency's notifyLeadEmail with the full breakdown. Marks
// prospectProfileEmailedAt so we don't re-send.
//
// Capped at MAX_PER_RUN per invocation so a backlog can't blow past
// Vercel's serverless ceiling. Backlog drains over subsequent runs.
//
// Auth: Bearer CRON_SECRET.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // Pro plan ceiling; covers ~25 Claude calls.

const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
const MAX_PER_RUN = 25;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("chatbot-profile-digest", async () => {
    const idleBefore = new Date(Date.now() - IDLE_THRESHOLD_MS);

    // The partial index on (lastMessageAt) WHERE prospectProfileEmailedAt
    // IS NULL keeps this scan tight.
    const queue = await prisma.chatbotConversation.findMany({
      where: {
        prospectProfileEmailedAt: null,
        messageCount: { gt: 0 },
        lastMessageAt: { lt: idleBefore },
      },
      select: { id: true, orgId: true },
      orderBy: { lastMessageAt: "asc" },
      take: MAX_PER_RUN,
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const summary: Array<{
      conversationId: string;
      orgId: string;
      outcome: string;
    }> = [];

    for (const row of queue) {
      try {
        const result = await sendProspectProfileForConversation({
          conversationId: row.id,
          reason: "cron-digest",
        });
        if ("ok" in result && result.ok && result.sent) {
          sent += 1;
          summary.push({
            conversationId: row.id,
            orgId: row.orgId,
            outcome: "sent",
          });
        } else if ("ok" in result && result.ok && !result.sent) {
          skipped += 1;
          // Mark skipped conversations so they don't fight the queue
          // forever (e.g. orgs with no notifyLeadEmail configured).
          // Stamp a sentinel timestamp 100 years in the future would
          // be loud — instead we stamp now so the cron skips on next
          // run; operator can clear by editing the column.
          await prisma.chatbotConversation
            .update({
              where: { id: row.id },
              data: { prospectProfileEmailedAt: new Date() },
            })
            .catch(() => undefined);
          summary.push({
            conversationId: row.id,
            orgId: row.orgId,
            outcome: `skipped: ${result.skipped}`,
          });
        } else {
          failed += 1;
          summary.push({
            conversationId: row.id,
            orgId: row.orgId,
            outcome: `failed: ${result.ok === false ? result.error : "unknown"}`,
          });
        }
      } catch (err) {
        failed += 1;
        console.error(
          `[chatbot-profile-digest] conversation ${row.id} failed:`,
          err,
        );
        summary.push({
          conversationId: row.id,
          orgId: row.orgId,
          outcome: `error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    return {
      result: NextResponse.json({
        ok: true,
        queueSize: queue.length,
        sent,
        skipped,
        failed,
        summary,
      }),
      recordsProcessed: sent,
    };
  });
}
