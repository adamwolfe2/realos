import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";

export const maxDuration = 60;

// GET /api/cron/cleanup-stripe-events
// Daily at 03:00 UTC. Prunes ProcessedStripeEvent rows older than 30 days.
// Stripe's retry window is 3 days; 30 days gives generous forensic margin.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("cleanup-stripe-events", async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { count } = await prisma.processedStripeEvent.deleteMany({
      where: { processedAt: { lt: cutoff } },
    });
    return {
      result: NextResponse.json({
        ok: true,
        deleted: count,
        cutoff: cutoff.toISOString(),
      }),
      recordsProcessed: count,
    };
  });
}
