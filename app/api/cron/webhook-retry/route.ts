import { NextResponse, type NextResponse as NextResponseType } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";

// Retries failed inbound webhook events. Picks up rows with status=failed and
// nextRetryAt in the past, exponentially backs off, abandons after 5 attempts.
//
// Each retry POSTs the stored rawBody back at the source-specific webhook
// route so the same handler logic runs (with the same dedup guard, which now
// accepts the existing row since it gets flipped to status=received before
// processing).

const MAX_ATTEMPTS = 5;
const BACKOFF_SECS = [60, 5 * 60, 30 * 60, 2 * 60 * 60, 12 * 60 * 60];
const ALLOWED_SOURCES = new Set(["clerk", "cursive", "resend", "stripe"]);

export async function GET(req: Request) {
  return recordCronRun("webhook-retry", async () => {
    // Fail closed: missing CRON_SECRET means the route is fully open and
    // anyone can drive replay traffic against /api/webhooks/*.
    if (!process.env.CRON_SECRET) {
      return {
        result: NextResponse.json(
          { error: "Cron secret not configured" },
          { status: 503 },
        ) as NextResponseType,
        recordsProcessed: 0,
      };
    }
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return {
        result: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as NextResponseType,
        recordsProcessed: 0,
      };
    }

    const due = await prisma.webhookEvent.findMany({
      where: {
        status: "failed",
        nextRetryAt: { lte: new Date() },
        attempts: { lt: MAX_ATTEMPTS },
      },
      orderBy: { nextRetryAt: "asc" },
      take: 25,
    });

    let succeeded = 0;
    let stillFailing = 0;
    let abandoned = 0;

    for (const event of due) {
      if (!event.rawBody) {
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: "abandoned",
            processingError: "No rawBody captured; cannot retry.",
          },
        });
        abandoned++;
        continue;
      }
      if (!ALLOWED_SOURCES.has(event.source)) {
        console.warn(
          `[webhook-retry] skipping event ${event.id}: source "${event.source}" not in allowlist`,
        );
        continue;
      }
      const url = new URL(req.url);
      const target = `${url.protocol}//${url.host}/api/webhooks/${event.source}`;
      // Free up the dedup row so the handler can recreate cleanly.
      await prisma.webhookEvent.delete({ where: { id: event.id } });
      let res: Response;
      try {
        res = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: event.rawBody,
        });
      } catch (err) {
        const nextAttempts = event.attempts + 1;
        const isFinal = nextAttempts >= MAX_ATTEMPTS;
        await prisma.webhookEvent.create({
          data: {
            source: event.source,
            bodyHash: event.bodyHash,
            eventFingerprint: event.eventFingerprint,
            eventType: event.eventType,
            orgId: event.orgId,
            status: isFinal ? "abandoned" : "failed",
            attempts: nextAttempts,
            lastAttemptAt: new Date(),
            rawBody: event.rawBody,
            processingError: `Replay network error: ${(err as Error).message}`,
            nextRetryAt: isFinal
              ? null
              : new Date(
                  Date.now() +
                    (BACKOFF_SECS[nextAttempts] ?? 12 * 60 * 60) * 1000,
                ),
          },
        });
        if (isFinal) abandoned++;
        else stillFailing++;
        continue;
      }
      if (res.ok) {
        succeeded++;
        // The handler created its own success row; nothing more to do.
      } else {
        const errText = await res.text().catch(() => "");
        const nextAttempts = event.attempts + 1;
        const isFinal = nextAttempts >= MAX_ATTEMPTS;
        // Use upsert in case the handler already created a row.
        await prisma.webhookEvent.upsert({
          where: {
            source_bodyHash: {
              source: event.source,
              bodyHash: event.bodyHash ?? "",
            },
          },
          create: {
            source: event.source,
            bodyHash: event.bodyHash,
            eventFingerprint: event.eventFingerprint,
            eventType: event.eventType,
            orgId: event.orgId,
            status: isFinal ? "abandoned" : "failed",
            attempts: nextAttempts,
            lastAttemptAt: new Date(),
            rawBody: event.rawBody,
            processingError: `Replay HTTP ${res.status}: ${errText.slice(0, 500)}`,
            nextRetryAt: isFinal
              ? null
              : new Date(
                  Date.now() +
                    (BACKOFF_SECS[nextAttempts] ?? 12 * 60 * 60) * 1000,
                ),
          },
          update: {
            status: isFinal ? "abandoned" : "failed",
            attempts: nextAttempts,
            lastAttemptAt: new Date(),
            processingError: `Replay HTTP ${res.status}: ${errText.slice(0, 500)}`,
            nextRetryAt: isFinal
              ? null
              : new Date(
                  Date.now() +
                    (BACKOFF_SECS[nextAttempts] ?? 12 * 60 * 60) * 1000,
                ),
          },
        });
        if (isFinal) abandoned++;
        else stillFailing++;
      }
    }

    return {
      result: NextResponse.json({
        ok: true,
        attempted: due.length,
        succeeded,
        stillFailing,
        abandoned,
      }) as NextResponseType,
      recordsProcessed: due.length,
    };
  });
}
