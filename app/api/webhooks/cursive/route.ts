import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import {
  LeadSource,
  LeadStatus,
  Prisma,
  VisitorIdentificationStatus,
} from "@prisma/client";

// POST /api/webhooks/cursive
//
// AudienceLab SuperPixel webhook receiver. Cursive is an AL reseller but
// does NOT proxy AL webhooks — Path A integration, so payloads arrive
// raw from AL directly with x-audiencelab-* auth headers.
//
// Spec compliance:
//  - Three wrapper shapes: single event, bare array, { result: [] }
//  - Top-level pixel_id with resolution.pixel_id fallback
//  - Identity cascade: profile_id > uid > hem_sha256 > sha256(email_raw)
//  - On authentication events, hem_sha256 usually absent — compute from
//    email_raw so it bridges to the later enriched page_view
//  - Dedupe: whole-body SHA-256 (catches byte-identical retries) PLUS
//    per-event fingerprint (catches re-serialized duplicates in batches)
//  - Merge enrichment (don't overwrite) — AL sends patches as fields
//    evolve (LAST_SEEN_BY_ESP_DATE, new phones, DNC flips)
//  - Lead gate uses PERSONAL_EMAIL_VALIDATION_STATUS + computed
//    deliverability score ≥ 60 per spec §10
//  - Respond < 250ms target (synchronous writes acceptable at current scale;
//    move to Inngest queue once volume warrants)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 3 * 1024 * 1024;
const DELIVERABILITY_FLOOR = 60;

type ValidationStatus =
  | "Valid (esp)"
  | "Valid"
  | "Catch-all"
  | "Unknown"
  | "Invalid"
  | null;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Body too large" }, { status: 413 });
  }

  const secret = process.env.CURSIVE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const sharedSecret = req.headers.get("x-audiencelab-secret");
  const signature =
    req.headers.get("x-audiencelab-signature") ??
    req.headers.get("x-webhook-signature");
  if (!verifyAuth({ rawBody, secret, sharedSecret, signature })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = unwrapEvents(parsed);
  if (events.length === 0) {
    return NextResponse.json({ error: "No events" }, { status: 400 });
  }

  const bodyHash = sha256(rawBody);
  try {
    await prisma.webhookEvent.create({
      data: { source: "cursive", bodyHash, eventType: null },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  const results: Array<{
    visitorId: string | null;
    leadId: string | null;
    skipped?: string;
  }> = [];

  for (const ev of events) {
    results.push(await processEvent(ev));
  }

  return NextResponse.json({
    ok: true,
    events: events.length,
    processed: results,
  });
}

// ---------------------------------------------------------------------------
// Event processing
// ---------------------------------------------------------------------------

async function processEvent(
  ev: Record<string, unknown>
): Promise<{
  visitorId: string | null;
  leadId: string | null;
  skipped?: string;
}> {
  const flat = flatten(ev);

  const pixelId = pickString(flat, "pixel_id", "resolution.pixel_id");
  if (!pixelId) return { visitorId: null, leadId: null, skipped: "no pixel_id" };

  const integration = await prisma.cursiveIntegration.findFirst({
    where: { cursivePixelId: pixelId },
    select: { orgId: true, installedOnDomain: true },
  });
  if (!integration) {
    return { visitorId: null, leadId: null, skipped: "unknown pixel" };
  }

  const eventType =
    pickString(flat, "event", "event_type", "event_data.event_type") ?? null;
  const eventTimestamp = pickString(
    flat,
    "event_timestamp",
    "activity_start_date"
  );
  const profileId = pickString(flat, "profile_id");
  const uid = pickString(flat, "uid");
  const cookieId = pickString(flat, "cookie_id");

  const emailRaw =
    pickString(flat, "email_raw") ??
    firstEmail(flat["resolution.PERSONAL_EMAILS"]) ??
    firstEmail(flat["PERSONAL_EMAILS"]) ??
    pickString(flat, "resolution.BUSINESS_EMAIL", "BUSINESS_EMAIL");

  const normalizedEmail = emailRaw ? emailRaw.toLowerCase().trim() : null;
  const hemSha256 =
    pickString(flat, "hem_sha256") ??
    (normalizedEmail ? sha256(normalizedEmail) : null);

  const fingerprint = computeFingerprint({
    pixelId,
    profileId,
    eventTimestamp,
    eventType,
  });
  if (fingerprint) {
    try {
      await prisma.webhookEvent.create({
        data: {
          source: "cursive",
          eventFingerprint: fingerprint,
          eventType,
          orgId: integration.orgId,
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return { visitorId: null, leadId: null, skipped: "duplicate event" };
      }
      throw err;
    }
  }

  const identityKey =
    profileId ?? uid ?? hemSha256 ?? cookieId ?? `anon:${pixelId}:${Date.now()}`;

  const firstName = pickString(flat, "resolution.FIRST_NAME", "FIRST_NAME");
  const lastName = pickString(flat, "resolution.LAST_NAME", "LAST_NAME");
  const phone =
    pickString(
      flat,
      "resolution.MOBILE_PHONE",
      "MOBILE_PHONE",
      "resolution.PERSONAL_PHONE",
      "resolution.DIRECT_NUMBER"
    ) ?? null;

  const personalValidation = pickValidationStatus(
    flat["resolution.PERSONAL_EMAIL_VALIDATION_STATUS"] ??
      flat["PERSONAL_EMAIL_VALIDATION_STATUS"]
  );
  const businessValidation = pickValidationStatus(
    flat["resolution.BUSINESS_EMAIL_VALIDATION_STATUS"] ??
      flat["BUSINESS_EMAIL_VALIDATION_STATUS"]
  );
  const personalLastSeen = pickString(
    flat,
    "resolution.PERSONAL_EMAIL_LAST_SEEN_BY_ESP_DATE",
    "PERSONAL_EMAIL_LAST_SEEN_BY_ESP_DATE"
  );

  const companyDomain = pickString(
    flat,
    "resolution.COMPANY_DOMAIN",
    "COMPANY_DOMAIN"
  );
  const hasSkiptrace =
    pickString(flat, "resolution.SKIPTRACE_MATCH_SCORE", "SKIPTRACE_MATCH_SCORE") !=
    null;

  const deliverability = computeDeliverabilityScore({
    personalValidation,
    businessValidation,
    hasPhone: Boolean(phone),
    hasCompanyDomain: Boolean(companyDomain),
    lastSeenIso: personalLastSeen,
    hasSkiptrace,
  });

  const identified = Boolean(normalizedEmail && firstName && lastName);
  const leadWorthy = identified && deliverability >= DELIVERABILITY_FLOOR;

  const status = identified
    ? VisitorIdentificationStatus.IDENTIFIED
    : VisitorIdentificationStatus.ANONYMOUS;

  const referrer = pickString(
    flat,
    "event_data.referrer",
    "event_data.referer",
    "referrer"
  );
  const utmSource = pickString(flat, "event_data.utm_source", "utm_source");
  const utmMedium = pickString(flat, "event_data.utm_medium", "utm_medium");
  const utmCampaign = pickString(
    flat,
    "event_data.utm_campaign",
    "utm_campaign"
  );
  const pageUrl = pickString(
    flat,
    "page_url",
    "landing_url",
    "event_data.url",
    "event_data.page_url"
  );

  const now = new Date();
  const eventTime = eventTimestamp ? new Date(eventTimestamp) : now;
  const intentScore = computeIntentScore({
    identified,
    hasPageUrl: Boolean(pageUrl),
    deliverability,
  });

  // Find an existing visitor across any known identity. profile_id/uid we
  // stash on cursiveVisitorId as we've seen them; hashedEmail mirrors
  // hem_sha256 so auth events bridge to enriched events later.
  const identityCandidates = [
    profileId,
    uid,
    hemSha256,
    cookieId,
  ].filter((v): v is string => Boolean(v));
  const emailCandidates = [hemSha256].filter((v): v is string => Boolean(v));

  const orClauses: Prisma.VisitorWhereInput[] = [
    ...(identityCandidates.length
      ? [{ cursiveVisitorId: { in: identityCandidates } }]
      : []),
    ...(emailCandidates.length
      ? [{ hashedEmail: { in: emailCandidates } }]
      : []),
    ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
  ];
  const existing = orClauses.length
    ? await prisma.visitor.findFirst({
        where: { orgId: integration.orgId, OR: orClauses },
      })
    : null;

  const incomingResolution =
    (ev as Record<string, unknown>).resolution ??
    (ev as Record<string, unknown>)["resolution"] ??
    null;
  const mergedEnrichment = mergeEnrichment(
    existing?.enrichedData ?? null,
    incomingResolution
  );

  const pagesEntry = pageUrl
    ? [{ url: pageUrl, ts: eventTime.toISOString(), type: eventType }]
    : undefined;

  let visitor;
  if (existing) {
    visitor = await prisma.visitor.update({
      where: { id: existing.id },
      data: {
        cursiveVisitorId: pickHighestPriorityIdentity(
          existing.cursiveVisitorId,
          profileId,
          uid,
          hemSha256,
          cookieId
        ),
        status:
          status === VisitorIdentificationStatus.IDENTIFIED
            ? status
            : existing.status,
        firstName: firstName ?? existing.firstName ?? undefined,
        lastName: lastName ?? existing.lastName ?? undefined,
        email: normalizedEmail ?? existing.email ?? undefined,
        phone: phone ?? existing.phone ?? undefined,
        hashedEmail: hemSha256 ?? existing.hashedEmail ?? undefined,
        enrichedData: mergedEnrichment,
        lastSeenAt: eventTime > existing.lastSeenAt ? eventTime : existing.lastSeenAt,
        sessionCount:
          eventType === "page_view"
            ? { increment: 1 }
            : existing.sessionCount,
        referrer: referrer ?? existing.referrer ?? undefined,
        utmSource: utmSource ?? existing.utmSource ?? undefined,
        utmMedium: utmMedium ?? existing.utmMedium ?? undefined,
        utmCampaign: utmCampaign ?? existing.utmCampaign ?? undefined,
        intentScore: Math.max(existing.intentScore, intentScore),
      },
    });
  } else {
    visitor = await prisma.visitor.create({
      data: {
        orgId: integration.orgId,
        cursiveVisitorId: identityKey,
        hashedEmail: hemSha256,
        status,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        email: normalizedEmail,
        phone,
        enrichedData: mergedEnrichment,
        firstSeenAt: eventTime,
        lastSeenAt: eventTime,
        sessionCount: 1,
        pagesViewed: pagesEntry
          ? (pagesEntry as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        totalTimeSeconds: 0,
        referrer: referrer ?? null,
        utmSource: utmSource ?? null,
        utmMedium: utmMedium ?? null,
        utmCampaign: utmCampaign ?? null,
        intentScore,
      },
    });
  }

  let leadId: string | null = null;
  if (leadWorthy && normalizedEmail) {
    leadId = await upsertLead({
      orgId: integration.orgId,
      email: normalizedEmail,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      phone,
      visitorId: visitor.id,
      sourceDetail: integration.installedOnDomain ?? pageUrl ?? null,
      intentScore,
      enrichedData: mergedEnrichment,
      pageUrl: pageUrl ?? null,
    });
  }

  await prisma.cursiveIntegration.update({
    where: { orgId: integration.orgId },
    data: {
      lastEventAt: now,
      totalEventsCount: { increment: 1 },
    },
  });

  return { visitorId: visitor.id, leadId };
}

async function upsertLead(args: {
  orgId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  visitorId: string;
  sourceDetail: string | null;
  intentScore: number;
  enrichedData: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  pageUrl: string | null;
}): Promise<string> {
  const existing = await prisma.lead.findFirst({
    where: { orgId: args.orgId, email: args.email },
    select: { id: true },
  });
  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        visitorId: args.visitorId,
        firstName: args.firstName ?? undefined,
        lastName: args.lastName ?? undefined,
        phone: args.phone ?? undefined,
        lastActivityAt: new Date(),
        enrichedData: args.enrichedData,
        score: Math.max(0, args.intentScore),
      },
    });
    return existing.id;
  }
  const lead = await prisma.lead.create({
    data: {
      orgId: args.orgId,
      source: LeadSource.PIXEL_OUTREACH,
      sourceDetail: args.sourceDetail,
      status: LeadStatus.NEW,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      visitorId: args.visitorId,
      enrichedData: args.enrichedData,
      notes: args.pageUrl ? `First seen on ${args.pageUrl}` : null,
      score: args.intentScore,
    },
  });
  return lead.id;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unwrapEvents(parsed: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(parsed)) {
    return parsed.filter(
      (x): x is Record<string, unknown> =>
        typeof x === "object" && x !== null
    );
  }
  if (parsed && typeof parsed === "object") {
    const maybeResult = (parsed as Record<string, unknown>).result;
    if (Array.isArray(maybeResult)) {
      return maybeResult.filter(
        (x): x is Record<string, unknown> =>
          typeof x === "object" && x !== null
      );
    }
    return [parsed as Record<string, unknown>];
  }
  return [];
}

function verifyAuth(args: {
  rawBody: string;
  secret: string;
  sharedSecret: string | null;
  signature: string | null;
}): boolean {
  if (args.sharedSecret) {
    return timingSafeEquals(args.sharedSecret, args.secret);
  }
  if (args.signature) {
    const expected = crypto
      .createHmac("sha256", args.secret)
      .update(args.rawBody)
      .digest("hex");
    const presented = args.signature.startsWith("sha256=")
      ? args.signature.slice("sha256=".length)
      : args.signature;
    return timingSafeEquals(presented, expected);
  }
  return false;
}

function timingSafeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

function computeFingerprint(args: {
  pixelId: string;
  profileId: string | undefined;
  eventTimestamp: string | undefined;
  eventType: string | null;
}): string | null {
  if (!args.profileId || !args.eventTimestamp) return null;
  return sha256(
    [
      args.pixelId,
      args.profileId,
      args.eventTimestamp,
      args.eventType ?? "",
    ].join("|")
  );
}

function flatten(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      !(v instanceof Date)
    ) {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
      out[key] = v;
    } else {
      out[key] = v;
    }
  }
  return out;
}

function pickString(
  flat: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = flat[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function firstEmail(v: unknown): string | undefined {
  if (Array.isArray(v)) {
    for (const x of v) {
      if (typeof x === "string" && x.includes("@")) return x.trim();
    }
  } else if (typeof v === "string" && v.includes("@")) {
    const first = v.split(",")[0]?.trim();
    if (first) return first;
  }
  return undefined;
}

function pickValidationStatus(v: unknown): ValidationStatus {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t === "Valid (esp)") return "Valid (esp)";
  if (t === "Valid") return "Valid";
  if (t === "Catch-all") return "Catch-all";
  if (t === "Unknown") return "Unknown";
  if (t === "Invalid") return "Invalid";
  return null;
}

function computeDeliverabilityScore(args: {
  personalValidation: ValidationStatus;
  businessValidation: ValidationStatus;
  hasPhone: boolean;
  hasCompanyDomain: boolean;
  lastSeenIso: string | undefined;
  hasSkiptrace: boolean;
}): number {
  const best = bestValidation(args.personalValidation, args.businessValidation);
  let score = 0;
  if (best === "Valid (esp)") score += 40;
  else if (best === "Valid") score += 30;
  else if (best === "Catch-all") score += 15;
  else if (best === "Unknown") score += 5;
  if (args.hasPhone) score += 10;
  if (args.hasCompanyDomain) score += 10;
  if (args.lastSeenIso) {
    const seen = new Date(args.lastSeenIso).getTime();
    const ageMs = Date.now() - seen;
    if (ageMs > 0 && ageMs < 30 * 24 * 60 * 60 * 1000) score += 10;
  }
  if (args.hasSkiptrace) score += 20;
  return Math.min(100, score);
}

function bestValidation(
  a: ValidationStatus,
  b: ValidationStatus
): ValidationStatus {
  const rank: Record<string, number> = {
    "Valid (esp)": 5,
    Valid: 4,
    "Catch-all": 3,
    Unknown: 2,
    Invalid: 1,
  };
  const ar = a ? rank[a] ?? 0 : 0;
  const br = b ? rank[b] ?? 0 : 0;
  return ar >= br ? a : b;
}

function computeIntentScore(args: {
  identified: boolean;
  hasPageUrl: boolean;
  deliverability: number;
}): number {
  let score = 0;
  if (args.identified) score += 40;
  if (args.hasPageUrl) score += 10;
  if (args.deliverability >= 80) score += 30;
  else if (args.deliverability >= 60) score += 15;
  return Math.min(100, score);
}

function mergeEnrichment(
  existing: Prisma.JsonValue | null,
  incoming: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? ({ ...(existing as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  if (incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
    for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
      if (v != null && v !== "") base[k] = v;
    }
  }
  if (Object.keys(base).length === 0) return Prisma.JsonNull;
  return base as Prisma.InputJsonValue;
}

function pickHighestPriorityIdentity(
  current: string | null,
  profileId: string | undefined,
  uid: string | undefined,
  hemSha256: string | null,
  cookieId: string | undefined
): string {
  return profileId ?? uid ?? hemSha256 ?? current ?? cookieId ?? "";
}
