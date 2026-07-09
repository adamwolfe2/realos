import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { pushConversationLeadToFunnel } from "@/lib/integrations/funnel-client";

// ---------------------------------------------------------------------------
// GET /api/cron/funnel-lead-sync
//
// Every 5 minutes. Pushes chatbot leads to their org's Funnel Leasing CRM
// ONCE, after the conversation has gone idle — so Funnel's Prospect `notes`
// gets the FULL transcript, not the empty (pre-chat) / partial (mid-conversation
// auto-capture) snapshot that existed at capture time. This is why chatbot leads
// are excluded from the inline push in notifyLeadCaptured; every other channel
// is a complete event at capture and pushes immediately there.
//
// Finds chatbot conversations that:
//   - belong to an org with a connected + enabled FunnelIntegration
//   - have a leadId (a real lead to push)
//   - have been idle for ≥5 min (lastMessageAt threshold)
//   - haven't been pushed yet (funnelPushedAt IS NULL)
//
// funnelPushedAt is stamped BEFORE the push fires → at-most-once semantics.
// Funnel's POST /clients creates a NEW Prospect on every call (no upsert), so a
// duplicate push would duplicate the client's CRM record; a crash mid-push must
// never re-create. A genuine push failure is surfaced via
// FunnelIntegration.lastError (set by pushLeadToFunnel), not retried.
//
// Capped at MAX_PER_RUN per invocation; a backlog drains over subsequent runs.
//
// Auth: Bearer CRON_SECRET.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
const MAX_PER_RUN = 25;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("funnel-lead-sync", async () => {
    const idleBefore = new Date(Date.now() - IDLE_THRESHOLD_MS);

    // Only orgs with a fully-configured, enabled Funnel integration are worth
    // scanning — everyone else has nothing to push to. This also means we never
    // stamp funnelPushedAt on conversations for orgs that don't use Funnel, so
    // if an org connects Funnel later, their live conversations start syncing
    // from that point forward (we intentionally don't backfill history).
    const connectedOrgs = await prisma.funnelIntegration.findMany({
      where: {
        enabled: true,
        apiKeyEncrypted: { not: null },
        apiBaseUrl: { not: null },
        groupId: { not: null },
      },
      select: { orgId: true },
    });
    const orgIds = connectedOrgs.map((o) => o.orgId);

    if (orgIds.length === 0) {
      return {
        result: NextResponse.json({ ok: true, queueSize: 0, pushed: 0, skipped: 0, failed: 0 }),
        recordsProcessed: 0,
      };
    }

    const queue = await prisma.chatbotConversation.findMany({
      where: {
        orgId: { in: orgIds },
        leadId: { not: null },
        funnelPushedAt: null,
        lastMessageAt: { lt: idleBefore },
      },
      select: { id: true, orgId: true },
      orderBy: { lastMessageAt: "asc" },
      take: MAX_PER_RUN,
    });

    let pushed = 0;
    let skipped = 0;
    let failed = 0;
    const summary: Array<{
      conversationId: string;
      orgId: string;
      outcome: string;
    }> = [];

    for (const row of queue) {
      // Stamp BEFORE the push (at-most-once). If the process dies between the
      // Funnel create and this stamp, the stamp wins on the next run and we do
      // NOT re-create a duplicate Prospect. A failed push is visible via
      // FunnelIntegration.lastError, not retried here.
      const stamped = await prisma.chatbotConversation
        .update({
          where: { id: row.id },
          data: { funnelPushedAt: new Date() },
        })
        .then(() => true)
        .catch(() => false);

      if (!stamped) {
        // Couldn't claim the row — skip rather than risk a double push.
        skipped += 1;
        summary.push({
          conversationId: row.id,
          orgId: row.orgId,
          outcome: "skipped: could not stamp funnelPushedAt",
        });
        continue;
      }

      try {
        const result = await pushConversationLeadToFunnel(row.id);
        if (result.ok) {
          pushed += 1;
          summary.push({ conversationId: row.id, orgId: row.orgId, outcome: "pushed" });
        } else if (result.skipped) {
          skipped += 1;
          summary.push({
            conversationId: row.id,
            orgId: row.orgId,
            outcome: `skipped: ${result.reason}`,
          });
        } else {
          failed += 1;
          summary.push({
            conversationId: row.id,
            orgId: row.orgId,
            outcome: `failed: ${result.error}`,
          });
        }
      } catch (err) {
        // pushConversationLeadToFunnel never throws, but guard anyway so one bad
        // row can't abort the batch.
        failed += 1;
        console.error(`[funnel-lead-sync] conversation ${row.id} failed:`, err);
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
        pushed,
        skipped,
        failed,
        summary,
      }),
      recordsProcessed: pushed,
    };
  });
}
