import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProspectAuditStatus } from "@prisma/client";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";
import { getSiteUrl } from "@/lib/brand";
import {
  sendBrandedEmail,
  escapeHtml,
  buildBaseHtml,
  BRAND_NAME,
} from "@/lib/email/shared";
import { buildEmailUnsubUrl } from "@/lib/email/suppression";

// ---------------------------------------------------------------------------
// GET /api/cron/audit-rescan — day 7/14/21 re-scan nurture (2026-08-14,
// goal spec slice 5, Otterly pattern: PMs live in email, not dashboards).
//
// An audit lead who gave an email gets an automated re-scan + "your
// score moved / who AI recommends instead" email at day 7, 14, and 21.
//
// Bounds (spec): only audits WITH an email · max 3 re-scans per audit ·
// re-scan ≈ $0.25 (full fan-out; the crawl is scrapeFresh by design) ·
// max 3 audits per daily run. Selection windows are 1 day wide and the
// cron runs once a day, so each audit is touched at most once per
// window with no extra state column — the audit's own createdAt is the
// clock. Belt: DailySignalSnapshot rows per audit cap total scans.
// ---------------------------------------------------------------------------

export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;
const RESCAN_DAYS = [7, 14, 21] as const;
const MAX_AUDITS_PER_RUN = 3;
// initial scan + 3 re-scans. Snapshots are one-per-scan-day, so ≥4
// distinct snapshot days means the sequence already completed.
const MAX_SNAPSHOT_DAYS = 4;
// Run-route budget: maxDuration 120s. Wait slightly above it.
const RESCAN_WAIT_MS = 130_000;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const summary = await recordCronRun("audit-rescan", async () => {
    const now = Date.now();
    const windows = RESCAN_DAYS.map((d) => ({
      day: d,
      from: new Date(now - (d + 1) * DAY_MS),
      to: new Date(now - d * DAY_MS),
    }));

    const candidates = await prisma.prospectAudit.findMany({
      where: {
        email: { not: null },
        status: ProspectAuditStatus.READY,
        OR: windows.map((w) => ({ createdAt: { gte: w.from, lt: w.to } })),
      },
      orderBy: { createdAt: "asc" },
      take: MAX_AUDITS_PER_RUN,
      select: {
        id: true,
        email: true,
        brandName: true,
        domain: true,
        shareToken: true,
        overallScore: true,
        createdAt: true,
        findings: true,
      },
    });

    let rescanned = 0;
    let emailed = 0;
    let skipped = 0;
    let failures = 0;

    for (const audit of candidates) {
      const scanDays = await prisma.dailySignalSnapshot.count({
        where: { prospectAuditId: audit.id },
      });
      if (scanDays >= MAX_SNAPSHOT_DAYS) {
        skipped += 1;
        continue;
      }

      const day =
        RESCAN_DAYS.find((d) => {
          const age = now - audit.createdAt.getTime();
          return age >= d * DAY_MS && age < (d + 1) * DAY_MS;
        }) ?? RESCAN_DAYS[0];

      const priorScore = audit.overallScore ?? 0;
      const priorTop = topCompetitor(audit.findings);

      // Re-run the scan through the run route (atomic claim, self-heal
      // compatible), then poll the row until it's READY again.
      const ok = await runRescan(audit.id);
      if (!ok) {
        failures += 1;
        continue;
      }
      rescanned += 1;

      const fresh = await prisma.prospectAudit.findUnique({
        where: { id: audit.id },
        select: { overallScore: true, findings: true },
      });
      const newScore = fresh?.overallScore ?? priorScore;
      const newTop = topCompetitor(fresh?.findings ?? null) ?? priorTop;

      const sent = await sendRescanEmail({
        to: audit.email!,
        brandName: audit.brandName ?? audit.domain,
        shareToken: audit.shareToken,
        day,
        priorScore,
        newScore,
        topCompetitor: newTop,
      });
      if (sent) emailed += 1;
    }

    return {
      result: { candidates: candidates.length, rescanned, emailed, skipped, failures },
      recordsProcessed: rescanned,
      errorCount: failures,
    };
  });
  return NextResponse.json(summary);
}

function topCompetitor(findings: unknown): string | null {
  const ranked = (findings as { aeoCompetitorsRanked?: Array<{ name: string }> } | null)
    ?.aeoCompetitorsRanked;
  return ranked?.[0]?.name ?? null;
}

async function runRescan(auditId: string): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET ?? "";
  if (!cronSecret) return false;
  await prisma.prospectAudit.update({
    where: { id: auditId },
    data: { status: ProspectAuditStatus.QUEUED, errorMessage: null },
  });
  try {
    const res = await fetch(`${getSiteUrl()}/api/audit/run/${auditId}`, {
      method: "POST",
      headers: { "x-internal-trigger": cronSecret },
      signal: AbortSignal.timeout(RESCAN_WAIT_MS),
    });
    if (!res.ok) return false;
    const row = await prisma.prospectAudit.findUnique({
      where: { id: auditId },
      select: { status: true },
    });
    return row?.status === ProspectAuditStatus.READY;
  } catch (err) {
    console.error(
      `[audit-rescan] re-scan failed for ${auditId}:`,
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

async function sendRescanEmail(input: {
  to: string;
  brandName: string;
  shareToken: string;
  day: number;
  priorScore: number;
  newScore: number;
  topCompetitor: string | null;
}): Promise<boolean> {
  const { to, brandName, day, priorScore, newScore } = input;
  const delta = newScore - priorScore;
  const reportUrl = `${getSiteUrl()}/audit/${input.shareToken}`;

  const subject =
    delta < 0
      ? `${brandName}: your AI visibility score dropped to ${newScore}`
      : delta > 0
        ? `${brandName}: your AI visibility score is up to ${newScore}`
        : `${brandName}: your day-${day} AI visibility re-scan is in`;

  const deltaLine =
    delta === 0
      ? `Your Digital Performance Score held at <strong>${newScore}/100</strong> since we last checked.`
      : `Your Digital Performance Score moved from <strong>${priorScore}</strong> to <strong>${newScore}</strong> out of 100.`;
  const competitorLine = input.topCompetitor
    ? `<p style="margin:0 0 16px;">When renters ask AI where to live, the building it names most is <strong>${escapeHtml(input.topCompetitor)}</strong> — not you.</p>`
    : "";

  const unsubscribeUrl = buildEmailUnsubUrl(to);
  const html = buildBaseHtml({
    headline: `Your day-${day} AI visibility re-scan`,
    title: `Day-${day} re-scan for ${escapeHtml(brandName)}`,
    preheader:
      delta === 0
        ? `Score held at ${newScore}/100. Here's who AI recommends instead.`
        : `Score moved ${priorScore} → ${newScore}. Fresh engine answers inside.`,
    bodyHtml: `
      <p style="margin:0 0 16px;">We re-ran the full AI search visibility scan for ${escapeHtml(brandName)} — same five renter questions, same four engines, fresh answers.</p>
      <p style="margin:0 0 16px;">${deltaLine}</p>
      ${competitorLine}
      <p style="margin:0;color:#6f6f6f;font-size:13px;">${BRAND_NAME} monitors this daily for client properties and tells your team exactly what to fix.</p>
    `,
    ctaText: "See the updated report",
    ctaUrl: reportUrl,
    ctaCase: "sentence",
    includeUnsubscribe: true,
    unsubscribeUrl,
  });

  const result = await sendBrandedEmail({
    to,
    subject,
    html,
    category: "broadcast",
    template: "audit-rescan",
    entityRefId: `audit-rescan-${input.shareToken}-d${day}`,
    unsubscribeUrl,
  });
  return result.ok;
}
