import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { VisitorIdentificationStatus, Prisma } from "@prisma/client";

// POST /api/webhooks/cursive
//
// Cursive pushes visitor events here. We verify the signature with
// CURSIVE_WEBHOOK_SECRET, then upsert each visitor by cursiveVisitorId,
// merge fields, and recompute intent score.
//
// TODO(Sprint 08 follow-up): confirm the signature header name + payload
// key casing against Cursive's actual webhook docs. Everything below
// follows the PRD's reasonable guess.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-cursive-signature") ??
    req.headers.get("x-webhook-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: CursiveWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as CursiveWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pixelId = payload.pixelId ?? payload.pixel_id;
  const visitors = payload.visitors ?? [];
  if (!pixelId) {
    return NextResponse.json({ error: "Missing pixelId" }, { status: 400 });
  }

  const integration = await prisma.cursiveIntegration.findFirst({
    where: { cursivePixelId: pixelId },
    select: { orgId: true },
  });
  if (!integration) {
    return NextResponse.json({ error: "Unknown pixel" }, { status: 404 });
  }

  let processed = 0;
  for (const v of visitors) {
    const visitorId = v.visitor_id ?? v.visitorId;
    if (!visitorId) continue;

    const hashedEmail = v.email ? sha256(v.email.toLowerCase().trim()) : null;
    const status = v.identified
      ? VisitorIdentificationStatus.IDENTIFIED
      : VisitorIdentificationStatus.ANONYMOUS;
    const intentScore = computeIntentScore(v);

    const firstSeenAt = v.first_seen_at ?? v.firstSeenAt;
    const lastSeenAt = v.last_seen_at ?? v.lastSeenAt;

    const pagesViewed = Array.isArray(v.pages_viewed ?? v.pagesViewed)
      ? ((v.pages_viewed ?? v.pagesViewed) as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;
    const enriched = v.enrichment
      ? (v.enrichment as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;

    await prisma.visitor.upsert({
      where: { cursiveVisitorId: visitorId },
      create: {
        orgId: integration.orgId,
        cursiveVisitorId: visitorId,
        visitorHash: v.visitor_hash ?? v.visitorHash ?? null,
        hashedEmail,
        status,
        firstName: v.first_name ?? v.firstName ?? null,
        lastName: v.last_name ?? v.lastName ?? null,
        email: v.email ?? null,
        phone: v.phone ?? null,
        enrichedData: enriched,
        firstSeenAt: firstSeenAt ? new Date(firstSeenAt) : new Date(),
        lastSeenAt: lastSeenAt ? new Date(lastSeenAt) : new Date(),
        sessionCount: v.session_count ?? v.sessionCount ?? 1,
        pagesViewed,
        totalTimeSeconds: v.total_time_seconds ?? v.totalTimeSeconds ?? 0,
        referrer: v.referrer ?? null,
        utmSource: v.utm_source ?? v.utmSource ?? null,
        utmMedium: v.utm_medium ?? v.utmMedium ?? null,
        utmCampaign: v.utm_campaign ?? v.utmCampaign ?? null,
        intentScore,
      },
      update: {
        status,
        firstName: v.first_name ?? v.firstName ?? undefined,
        lastName: v.last_name ?? v.lastName ?? undefined,
        email: v.email ?? undefined,
        phone: v.phone ?? undefined,
        hashedEmail: hashedEmail ?? undefined,
        enrichedData: enriched,
        lastSeenAt: new Date(),
        sessionCount: v.session_count ?? v.sessionCount ?? 1,
        pagesViewed,
        totalTimeSeconds: v.total_time_seconds ?? v.totalTimeSeconds ?? 0,
        intentScore,
      },
    });
    processed++;
  }

  await prisma.cursiveIntegration.update({
    where: { orgId: integration.orgId },
    data: {
      lastEventAt: new Date(),
      totalEventsCount: { increment: processed },
    },
  });

  return NextResponse.json({ ok: true, processed });
}

type CursiveWebhookPayload = {
  pixelId?: string;
  pixel_id?: string;
  visitors?: Array<CursiveWebhookVisitor>;
};

type CursiveWebhookVisitor = {
  visitor_id?: string;
  visitorId?: string;
  visitor_hash?: string;
  visitorHash?: string;
  identified?: boolean;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  enrichment?: Record<string, unknown>;
  first_seen_at?: string;
  firstSeenAt?: string;
  last_seen_at?: string;
  lastSeenAt?: string;
  session_count?: number;
  sessionCount?: number;
  pages_viewed?: Array<{ url: string; ts: string }>;
  pagesViewed?: Array<{ url: string; ts: string }>;
  total_time_seconds?: number;
  totalTimeSeconds?: number;
  referrer?: string;
  utm_source?: string;
  utmSource?: string;
  utm_medium?: string;
  utmMedium?: string;
  utm_campaign?: string;
  utmCampaign?: string;
};

function verifySignature(body: string, sig: string | null): boolean {
  const secret = process.env.CURSIVE_WEBHOOK_SECRET;
  if (!sig || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function computeIntentScore(v: CursiveWebhookVisitor): number {
  let score = 0;
  const sessionCount = v.session_count ?? v.sessionCount ?? 1;
  const totalTimeSeconds = v.total_time_seconds ?? v.totalTimeSeconds ?? 0;
  const pages = v.pages_viewed ?? v.pagesViewed;
  if (sessionCount > 1) score += 20;
  if (totalTimeSeconds > 60) score += 20;
  if (totalTimeSeconds > 300) score += 20;
  if (Array.isArray(pages) && pages.length > 3) score += 20;
  if (v.identified) score += 20;
  return Math.min(100, score);
}
