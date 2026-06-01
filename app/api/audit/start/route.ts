import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ProspectAuditStatus } from "@prisma/client";
import {
  generateShareToken,
  normalizeDomain,
} from "@/lib/audit/token";
import { checkAuditStartLimit } from "@/lib/audit/rate-limit";
import { rateLimited, getIp } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/brand";
import { COMPUTE_VERSION } from "@/lib/signals/types";

// POST /api/audit/start
// Public, unauthenticated entry point for the prospect lead-magnet flow.
//
// Flow:
//   1. Rate-limit per IP (5/hr).
//   2. Normalize the supplied URL to a bare domain. Reject invalid.
//   3. Dedupe: a READY audit for the same domain in the past 14d is
//      returned as-is so we don't fan out duplicate scans for the
//      same prospect company.
//   4. Otherwise create a QUEUED row + fire a background `/api/audit/run/[id]`
//      to do the actual compute. Background trigger is fire-and-forget so
//      the form-submit response stays snappy.
//
// Response: { auditId, shareToken, status, cached? }

// quizAnswers is `Record<string, string | string[]>` per
// `lib/audit/quiz-questions.ts::QuizAnswers`. Zod can't express the
// keys-from-runtime-array shape exactly, so we validate the shape (record
// of values that are string or string[]) and trust the schema source of
// truth in quiz-questions.ts.
const QuizAnswerValue = z.union([
  z.string().trim().max(500),
  z.array(z.string().trim().min(1).max(120)).max(20),
]);

const BodySchema = z.object({
  url: z.string().trim().min(1).max(500),
  quizAnswers: z
    .record(z.string().max(64), QuizAnswerValue)
    .optional()
    .nullable(),
});

const DEDUPE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const INITIAL_EXPIRY_DAYS = 90;

export async function POST(req: NextRequest) {
  const rl = await checkAuditStartLimit(req);
  if (!rl.allowed) {
    return rateLimited(
      "Too many audit requests. Try again in an hour.",
      rl.retryAfterSec,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "url is required" },
      { status: 400 },
    );
  }

  const domain = normalizeDomain(parsed.data.url);
  if (!domain) {
    return NextResponse.json(
      { error: "Please enter a valid website URL." },
      { status: 400 },
    );
  }

  try {
    // Dedupe — return any READY audit completed for this domain in the
    // last 14d, BUT only if it was computed under the current pipeline
    // version. An audit run before COMPUTE_VERSION bumped (e.g. before
    // real reputation fan-out shipped) had mock/empty mentions, so we
    // fall through and trigger a fresh scan instead of returning fluff.
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const existing = await prisma.prospectAudit.findFirst({
      where: {
        domain,
        status: ProspectAuditStatus.READY,
        createdAt: { gt: since },
        snapshots: { some: { computeVersion: COMPUTE_VERSION } },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, shareToken: true, status: true },
    });
    if (existing) {
      return NextResponse.json({
        auditId: existing.id,
        shareToken: existing.shareToken,
        status: existing.status,
        cached: true,
      });
    }

    const shareToken = generateShareToken();
    const expiresAt = new Date(
      Date.now() + INITIAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );
    // Normalize quizAnswers — null and undefined both round-trip to JSON
    // null on the column. We persist as-is; the scoring + recommendation
    // engines validate shape per-question. Sanity cap: an answer object
    // with more than 32 keys is almost certainly malformed or hostile.
    const quizAnswers =
      parsed.data.quizAnswers &&
      Object.keys(parsed.data.quizAnswers).length <= 32
        ? parsed.data.quizAnswers
        : null;
    const audit = await prisma.prospectAudit.create({
      data: {
        shareToken,
        urlInput: parsed.data.url,
        domain,
        ipAddress: getIp(req),
        userAgent: req.headers.get("user-agent") ?? null,
        status: ProspectAuditStatus.QUEUED,
        expiresAt,
        quizAnswers: quizAnswers ?? undefined,
      },
      select: { id: true, shareToken: true, status: true },
    });

    // Fire-and-forget trigger to the run route. We can't use `after()` here
    // because the scan can outlast a Vercel function timeout — the run
    // route has its own 60s budget. We dispatch via fetch with no await
    // and swallow errors so a transient hiccup never bubbles up to the
    // form submitter. If the trigger truly fails the audit row stays
    // QUEUED and a future cron / retry mechanism can pick it up.
    const triggerUrl = `${getSiteUrl()}/api/audit/run/${audit.id}`;
    const cronSecret = process.env.CRON_SECRET ?? "";
    fetch(triggerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-trigger": cronSecret,
      },
    }).catch(() => {
      // Intentional: any failure here is non-fatal. The /audit page polls
      // status; if it stalls in QUEUED we surface the error to the user.
    });

    return NextResponse.json({
      auditId: audit.id,
      shareToken: audit.shareToken,
      status: audit.status,
    });
  } catch (err) {
    console.error("[POST /api/audit/start]", err);
    return NextResponse.json(
      { error: "Could not start audit" },
      { status: 500 },
    );
  }
}
