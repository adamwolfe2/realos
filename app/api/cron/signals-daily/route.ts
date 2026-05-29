import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeSignals } from "@/lib/signals/compute";
import { persistSnapshot } from "@/lib/signals/persist";
import { getMonthToDateSpend } from "@/lib/cost-tracker/cap";
import { logUsage } from "@/lib/cost-tracker/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Worst case: N orgs × ~200ms compute (mock) — well under the limit.
// Real provider fan-out in Phase 2 will need this headroom.
export const maxDuration = 300;

// 2026-05-29: hard ceiling on this cron. Each org's compute fans out
// across DataForSEO + AEO 4 engines + Tavily — easily $0.10-0.30 per
// org. 10 orgs × 30 days = $30-90/mo just from this cron, and that
// scales linearly with new tenants. Halt the run if month-to-date
// spend has already exceeded COST_MONTHLY_CAP_USD so we don't blow
// past a budget the operator hasn't explicitly raised.
//
// Default cap is $200/mo (same default as lib/cost-tracker/cap.ts).
// Set COST_MONTHLY_CAP_USD on Vercel to tune.

// ---------------------------------------------------------------------------
// GET /api/cron/signals-daily
//
// Fires once per UTC day (scheduling wired separately in vercel.json). For
// each "active enough" org, compute today's snapshot and upsert into
// DailySignalSnapshot. Per-org failures are swallowed so one bad provider
// response doesn't take the whole run down.
//
// Spend guard: before kicking off, check month-to-date API spend against
// COST_MONTHLY_CAP_USD. If we're already over, short-circuit with a
// SKIPPED_CAP audit row so /admin/costs shows "we skipped today's
// signals-daily run because we hit the monthly cap" instead of silently
// running up the bill.
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

  // --- Spend cap pre-check --------------------------------------------------
  // Read MTD spend from ApiUsage; if we've already hit the configured
  // monthly cap, halt the run before fanning out across orgs.
  const capUsd = Number(process.env.COST_MONTHLY_CAP_USD ?? "200");
  if (Number.isFinite(capUsd) && capUsd > 0) {
    const mtd = await getMonthToDateSpend();
    if (mtd.totalUsd >= capUsd) {
      await logUsage({
        provider: "leasestack-cron",
        endpoint: "signals-daily",
        status: "SKIPPED_CAP",
        costUsd: 0,
        meta: {
          spentUsd: mtd.totalUsd,
          capUsd,
          reason:
            "Month-to-date spend exceeded COST_MONTHLY_CAP_USD. Skipping today's run.",
          perProvider: mtd.perProvider,
        },
      });
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "monthly_cap_exceeded",
        spentUsd: mtd.totalUsd,
        capUsd,
      });
    }
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
