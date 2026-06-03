import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/tenancy/scope";
import { getSiteUrl } from "@/lib/get-site-url";
import type { SinkProvider } from "@/lib/admin/data-sinks";

// ---------------------------------------------------------------------------
// POST /api/admin/data-sinks/[provider]/run
//
// Manually kicks off a cron sync from the Data Sinks board. We don't run
// the sync inline — instead we fire the existing /api/cron/<job> endpoint
// with the CRON_SECRET header so it runs the exact same code path Vercel
// Cron uses on schedule. This avoids duplicating sync logic between two
// call sites and inherits all observability/recordCronRun behavior.
//
// Returns 200 fast (don't await the cron's full work). The page client
// then router.refresh()es to repaint the board with the new "running" row
// once the cron's recordCronRun starts writing.
// ---------------------------------------------------------------------------

const CRON_JOB_BY_PROVIDER: Record<SinkProvider, string | null> = {
  appfolio: "appfolio-sync",
  ga4: "seo-sync",
  gsc: "seo-sync",
  google_ads: "ads-sync",
  meta_ads: "ads-sync",
  dataforseo: "dataforseo-sync",
  aeo: "aeo-scan",
  reputation: "reputation-scan",
  cursive_pixel: "pixel-segment-sync",
  site_intelligence: "site-intelligence-refresh",
};

const VALID_PROVIDERS = new Set<SinkProvider>(
  Object.keys(CRON_JOB_BY_PROVIDER) as SinkProvider[]
);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  try {
    await requireAgency();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { provider } = await ctx.params;
  if (!VALID_PROVIDERS.has(provider as SinkProvider)) {
    return NextResponse.json(
      { error: `Unknown provider: ${provider}` },
      { status: 400 }
    );
  }

  const jobName = CRON_JOB_BY_PROVIDER[provider as SinkProvider];
  if (!jobName) {
    return NextResponse.json(
      { error: "Push-driven sink — no manual run" },
      { status: 400 }
    );
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on this deployment" },
      { status: 500 }
    );
  }

  const target = `${getSiteUrl().replace(/\/$/, "")}/api/cron/${jobName}`;

  // Fire-and-forget kickoff. We deliberately do NOT await the full cron
  // duration — they can take minutes. We DO await the initial connection
  // so any auth/URL failures surface as 4xx/5xx to the operator instead of
  // silently dropping. The cron's own recordCronRun handles tracking
  // completion in the CronRun table that the board reads on refresh.
  //
  // Using an AbortController with a short timeout means we return 200 to
  // the operator within seconds even when the underlying cron will take
  // 30s+ to finish — the operator sees the spinner, hits router.refresh,
  // and the next render shows a "running" row in the CronRun table.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  let kickedOff = false;
  let upstreamStatus: number | null = null;
  try {
    const res = await fetch(target, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    upstreamStatus = res.status;
    kickedOff = res.status < 500;
  } catch (err) {
    // AbortError is expected and means the cron is happily running on the
    // other side of the wire — that's success from our perspective.
    if (err instanceof Error && err.name === "AbortError") {
      kickedOff = true;
    }
  } finally {
    clearTimeout(timer);
  }

  if (!kickedOff) {
    return NextResponse.json(
      {
        ok: false,
        error: `Cron kickoff failed${upstreamStatus ? ` (HTTP ${upstreamStatus})` : ""}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, jobName });
}
