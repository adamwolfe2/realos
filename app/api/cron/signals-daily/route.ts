import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeSignals } from "@/lib/signals/compute";
import { persistSnapshot } from "@/lib/signals/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Worst case: N orgs × ~200ms compute (mock) — well under the limit.
// Real provider fan-out in Phase 2 will need this headroom.
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// GET /api/cron/signals-daily
//
// Fires once per UTC day (scheduling wired separately in vercel.json). For
// each "active enough" org, compute today's snapshot and upsert into
// DailySignalSnapshot. Per-org failures are swallowed so one bad provider
// response doesn't take the whole run down.
//
// Auth: Bearer CRON_SECRET (raw header comparison, matches spec).
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  const orgs = await prisma.organization.findMany({
    where: {
      status: { in: ["ACTIVE", "LAUNCHED", "AT_RISK"] },
    },
    select: { id: true, name: true },
  });

  let orgsProcessed = 0;
  const errors: Array<{ orgId: string; orgName: string; error: string }> = [];

  for (const org of orgs) {
    try {
      const snap = await computeSignals({ kind: "tenant", orgId: org.id });
      await persistSnapshot({ kind: "tenant", orgId: org.id }, snap);
      orgsProcessed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:signals-daily] org ${org.id} (${org.name}) failed:`,
        message,
      );
      errors.push({ orgId: org.id, orgName: org.name, error: message });
    }
  }

  return NextResponse.json({
    orgsProcessed,
    errors,
    durationMs: Date.now() - startedAt,
  });
}
