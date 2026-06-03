import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { trackCronDuration } from "@/lib/observability/cron-tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// GET /api/cron/proposal-expiry
//
// Daily (06:00 UTC) — flips proposals to EXPIRED when their expiresAt has
// passed AND they're still in SENT or VIEWED. We never expire a DRAFT (the
// operator hasn't shipped it) or an ACCEPTED / DECLINED / CANCELED row
// (terminal states), and we don't touch already-EXPIRED rows.
//
// Idempotent — a row that's already past expiresAt + still SENT/VIEWED on a
// later run is a no-op because the WHERE clause excludes already-flipped
// rows.
// ---------------------------------------------------------------------------

const BATCH_LIMIT = 500;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun<NextResponse>("proposal-expiry", () =>
    trackCronDuration("proposal-expiry", async () => {
      const now = new Date();

      const candidates = await prisma.proposal.findMany({
        where: {
          status: { in: ["SENT", "VIEWED"] },
          expiresAt: { not: null, lt: now },
        },
        select: { id: true, number: true },
        take: BATCH_LIMIT,
      });

      if (candidates.length === 0) {
        return {
          result: NextResponse.json({ ok: true, expired: 0 }),
          recordsProcessed: 0,
        };
      }

      const update = await prisma.proposal.updateMany({
        where: { id: { in: candidates.map((c) => c.id) } },
        data: { status: "EXPIRED" },
      });

      return {
        result: NextResponse.json({
          ok: true,
          expired: update.count,
          sample: candidates.slice(0, 10).map((c) => c.number),
        }),
        recordsProcessed: update.count,
      };
    }),
  );
}
