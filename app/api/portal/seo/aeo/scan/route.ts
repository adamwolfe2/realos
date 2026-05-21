import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { runAeoScan } from "@/lib/aeo/orchestrate";
import { getEnabledEngines } from "@/lib/aeo/engines";

// ---------------------------------------------------------------------------
// POST /api/portal/seo/aeo/scan
//
// On-demand AEO scan for the caller's org. Wired to the "Scan now" button
// on /portal/seo/aeo. Rate-limited per org so a chatty operator can't burn
// through engine quotas (Perplexity + OpenAI both meter aggressively).
//
// Cooldown defaults to 30 minutes — generous enough for OS demos / sales
// walk-throughs where you want to fire a scan, show results, then re-run.
// Agency owners (super admins) bypass the cooldown entirely via the
// `bypass=1` query string so internal QA never gets stuck behind it.
//
// Limiter is a Prisma count rather than Redis so it survives an Upstash
// outage — same pattern as /api/portal/reputation/scan.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SCAN_COOLDOWN_MINUTES = 30;

export async function POST(req: NextRequest) {
  let scope: Awaited<ReturnType<typeof requireScope>>;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bypass cooldown for agency owners (LeaseStack internal QA + Adam).
  // The role lives on the resolved scope — no separate header check
  // needed. Operators on a client org still get the 30-minute throttle.
  const url = new URL(req.url);
  const wantsBypass = url.searchParams.get("bypass") === "1";
  const canBypass = wantsBypass && scope.role === "AGENCY_OWNER";

  if (!canBypass) {
    const cutoff = new Date(
      Date.now() - SCAN_COOLDOWN_MINUTES * 60 * 1000,
    );
    const recent = await prisma.aeoCitationCheck.count({
      where: {
        ...tenantWhere(scope),
        queryRunAt: { gte: cutoff },
      },
    });
    if (recent > 0) {
      return NextResponse.json(
        {
          error: `An AI-search visibility scan ran in the last ${SCAN_COOLDOWN_MINUTES} minutes. Try again shortly.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(SCAN_COOLDOWN_MINUTES * 60),
          },
        },
      );
    }
  }

  // Fail fast when no engine has a configured API key on the server.
  // Pre-fix the orchestrator would happily iterate 0 engines and return
  // rowsWritten=0, which surfaced in the UI as a "scan succeeded" green
  // checkmark with zero new data — indistinguishable from a clean run
  // where nothing changed. Surface this as a 503 so operators see the
  // real cause.
  const engines = getEnabledEngines();
  if (engines.length === 0) {
    return NextResponse.json(
      {
        error:
          "No AI engines are configured on the server. Set at least ANTHROPIC_API_KEY (Claude), and optionally OPENAI_API_KEY / PERPLEXITY_API_KEY / GOOGLE_GEMINI_API_KEY.",
      },
      { status: 503 },
    );
  }

  try {
    const result = await runAeoScan({ orgId: scope.orgId, engines });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[portal/seo/aeo/scan] failed:", message);
    return NextResponse.json(
      { error: "Scan failed", detail: message },
      { status: 500 },
    );
  }
}
