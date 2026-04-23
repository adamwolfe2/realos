import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { Prisma, VisitorIdentificationStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// First-party pixel ingest helpers.
//
// resolveOrgByPublicKey  — look up tenant from `pk_site_*` (cached lightly)
// upsertSession          — create or refresh a VisitorSession row
// recordEvent            — append a VisitorEvent and update aggregates
// recordIdentify         — promote anonymous Visitor -> identified
// hashDevice             — sha256(ua + ip), used for cross-browser dedupe
// ---------------------------------------------------------------------------

export type PublicKeyResolution = {
  orgId: string;
  installedOnDomain: string | null;
};

const orgKeyCache = new Map<string, { value: PublicKeyResolution | null; expires: number }>();
const CACHE_TTL_MS = 30 * 1000;

export async function resolveOrgByPublicKey(
  publicKey: string
): Promise<PublicKeyResolution | null> {
  const now = Date.now();
  const cached = orgKeyCache.get(publicKey);
  if (cached && cached.expires > now) return cached.value;

  const integration = await prisma.cursiveIntegration
    .findUnique({
      where: { publicSiteKey: publicKey },
      select: { orgId: true, installedOnDomain: true },
    })
    .catch(() => null);

  const value: PublicKeyResolution | null = integration
    ? {
        orgId: integration.orgId,
        installedOnDomain: integration.installedOnDomain ?? null,
      }
    : null;

  orgKeyCache.set(publicKey, { value, expires: now + CACHE_TTL_MS });
  return value;
}

export function invalidatePublicKeyCache(publicKey: string): void {
  orgKeyCache.delete(publicKey);
}

export function hashDevice(args: {
  userAgent: string | null;
  ipAddress: string | null;
}): string {
  const seed = `${args.userAgent ?? ""}|${args.ipAddress ?? ""}`;
  return crypto.createHash("sha256").update(seed).digest("hex");
}

export function generateSessionToken(): string {
  return `vst_${crypto.randomBytes(18).toString("hex")}`;
}

export function generateAnonymousId(): string {
  return `anon_${crypto.randomBytes(12).toString("hex")}`;
}

// ---------------------------------------------------------------------------
// Session upsert. Find by sessionToken first (single round trip), else create.
// ---------------------------------------------------------------------------

export type SessionInit = {
  orgId: string;
  anonymousId: string;
  sessionToken: string | null;
  url: string | null;
  referrer: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  language: string | null;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    term: string | null;
    content: string | null;
  };
};

export async function upsertSession(input: SessionInit): Promise<{
  sessionId: string;
  sessionToken: string;
  isNew: boolean;
  visitorId: string | null;
}> {
  const deviceHash = hashDevice({
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
  });

  if (input.sessionToken) {
    const existing = await prisma.visitorSession
      .findUnique({
        where: { sessionToken: input.sessionToken },
        select: { id: true, orgId: true, visitorId: true, sessionToken: true },
      })
      .catch(() => null);
    if (existing && existing.orgId === input.orgId) {
      // Touch lastEventAt so the feed shows liveness even before the next event.
      await prisma.visitorSession
        .update({
          where: { id: existing.id },
          data: { lastEventAt: new Date() },
        })
        .catch(() => null);
      return {
        sessionId: existing.id,
        sessionToken: existing.sessionToken,
        isNew: false,
        visitorId: existing.visitorId,
      };
    }
  }

  const token = input.sessionToken ?? generateSessionToken();

  // Try to attach an existing Visitor row by anonymousId so multi-session
  // aggregates roll up under the same person.
  const existingVisitor = await prisma.visitor
    .findFirst({
      where: { orgId: input.orgId, cursiveVisitorId: input.anonymousId },
      select: { id: true },
    })
    .catch(() => null);

  let visitorId = existingVisitor?.id ?? null;
  if (!visitorId) {
    const created = await prisma.visitor.create({
      data: {
        orgId: input.orgId,
        cursiveVisitorId: input.anonymousId,
        status: VisitorIdentificationStatus.ANONYMOUS,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        sessionCount: 1,
        referrer: input.referrer,
        utmSource: input.utm.source,
        utmMedium: input.utm.medium,
        utmCampaign: input.utm.campaign,
      },
    });
    visitorId = created.id;
  } else {
    await prisma.visitor.update({
      where: { id: visitorId },
      data: {
        lastSeenAt: new Date(),
        sessionCount: { increment: 1 },
      },
    });
  }

  const session = await prisma.visitorSession.create({
    data: {
      orgId: input.orgId,
      visitorId,
      anonymousId: input.anonymousId,
      sessionToken: token,
      deviceHash,
      firstUrl: input.url,
      firstReferrer: input.referrer,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      language: input.language,
      utmSource: input.utm.source,
      utmMedium: input.utm.medium,
      utmCampaign: input.utm.campaign,
      utmTerm: input.utm.term,
      utmContent: input.utm.content,
    },
    select: { id: true, sessionToken: true, visitorId: true },
  });

  return {
    sessionId: session.id,
    sessionToken: session.sessionToken,
    isNew: true,
    visitorId: session.visitorId,
  };
}

// ---------------------------------------------------------------------------
// Event recording. Updates session aggregates in the same transaction-ish
// pattern used across ingest helpers. We deliberately do not wrap in a
// Prisma transaction because the Neon HTTP adapter does not support
// interactive transactions; the two writes are individually idempotent
// enough at this scale.
// ---------------------------------------------------------------------------

export type EventInput = {
  orgId: string;
  sessionId: string;
  visitorId: string | null;
  type: string;
  url: string | null;
  path: string | null;
  title: string | null;
  referrer: string | null;
  scrollDepth: number | null;
  timeOnPageSeconds: number | null;
  properties: Record<string, unknown> | null;
  occurredAt: Date;
};

const ALLOWED_TYPES = new Set([
  "pageview",
  "identify",
  "scroll",
  "timing",
  "click",
  "form_submit",
  "unload",
  "custom",
]);

export function normaliseEventType(value: string | undefined): string {
  if (!value) return "custom";
  const lower = value.toLowerCase().trim();
  return ALLOWED_TYPES.has(lower) ? lower : "custom";
}

export async function recordEvent(input: EventInput): Promise<void> {
  await prisma.visitorEvent.create({
    data: {
      orgId: input.orgId,
      sessionId: input.sessionId,
      visitorId: input.visitorId,
      type: input.type,
      url: input.url,
      path: input.path,
      title: input.title,
      referrer: input.referrer,
      scrollDepth: input.scrollDepth,
      timeOnPageSeconds: input.timeOnPageSeconds,
      properties: input.properties
        ? (input.properties as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      occurredAt: input.occurredAt,
    },
  });

  const sessionUpdate: Prisma.VisitorSessionUpdateInput = {
    lastEventAt: input.occurredAt,
  };
  if (input.type === "pageview") {
    sessionUpdate.pageviewCount = { increment: 1 };
  }
  if (typeof input.scrollDepth === "number" && input.scrollDepth > 0) {
    // Postgres-side max via raw not necessary for our scale; do read-modify-write.
    const current = await prisma.visitorSession
      .findUnique({
        where: { id: input.sessionId },
        select: { maxScrollDepth: true },
      })
      .catch(() => null);
    const next = Math.max(
      current?.maxScrollDepth ?? 0,
      Math.min(100, Math.max(0, Math.round(input.scrollDepth)))
    );
    sessionUpdate.maxScrollDepth = next;
  }
  if (typeof input.timeOnPageSeconds === "number" && input.timeOnPageSeconds > 0) {
    sessionUpdate.totalTimeSeconds = { increment: Math.round(input.timeOnPageSeconds) };
  }

  await prisma.visitorSession
    .update({ where: { id: input.sessionId }, data: sessionUpdate })
    .catch((err) => {
      console.warn("[pixel-ingest] session aggregate update failed", err);
    });

  if (input.visitorId) {
    const visitorUpdate: Prisma.VisitorUpdateInput = {
      lastSeenAt: input.occurredAt,
    };
    if (input.timeOnPageSeconds && input.timeOnPageSeconds > 0) {
      visitorUpdate.totalTimeSeconds = { increment: Math.round(input.timeOnPageSeconds) };
    }
    if (input.url || input.path) {
      // Mirror page into Visitor.pagesViewed so the existing feed (which
      // reads pagesViewed) keeps showing the latest page even before the
      // /portal/visitors page gets the new session-aware query path.
      const existing = await prisma.visitor
        .findUnique({
          where: { id: input.visitorId },
          select: { pagesViewed: true },
        })
        .catch(() => null);
      const pages = Array.isArray(existing?.pagesViewed)
        ? [...(existing!.pagesViewed as unknown[])]
        : [];
      pages.push({
        url: input.url ?? input.path,
        ts: input.occurredAt.toISOString(),
        type: input.type,
      });
      // Cap at last 50 entries to keep the JSON column sane.
      const trimmed = pages.slice(-50);
      visitorUpdate.pagesViewed = trimmed as unknown as Prisma.InputJsonValue;
    }
    await prisma.visitor
      .update({ where: { id: input.visitorId }, data: visitorUpdate })
      .catch((err) => {
        console.warn("[pixel-ingest] visitor aggregate update failed", err);
      });
  }

  // Recompute intent score on signals that move it: scroll milestones, timing.
  if (
    input.visitorId &&
    (input.type === "scroll" || input.type === "timing" || input.type === "identify")
  ) {
    await recomputeIntentScore(input.visitorId);
  }

  // Touch CursiveIntegration.lastEventAt so the dashboard "last event" badge
  // reflects first-party pixel traffic too.
  await prisma.cursiveIntegration
    .update({
      where: { orgId: input.orgId },
      data: {
        lastEventAt: input.occurredAt,
        totalEventsCount: { increment: 1 },
      },
    })
    .catch(() => null);
}

// ---------------------------------------------------------------------------
// Intent score — computed from first-party behavioral signals.
// Mirrors the AudienceLab webhook's computeIntentScore but uses session data.
// ---------------------------------------------------------------------------

export async function recomputeIntentScore(visitorId: string): Promise<void> {
  const visitor = await prisma.visitor
    .findUnique({
      where: { id: visitorId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        sessionCount: true,
        totalTimeSeconds: true,
        sessions: {
          orderBy: { maxScrollDepth: "desc" },
          take: 1,
          select: { maxScrollDepth: true, pageviewCount: true },
        },
      },
    })
    .catch(() => null);

  if (!visitor) return;

  let score = 0;
  if (visitor.email) score += 40;
  if (visitor.firstName && visitor.lastName) score += 10;
  const sessionCount = visitor.sessionCount ?? 0;
  if (sessionCount > 1) score += 10;
  if (sessionCount > 3) score += 5;
  const totalTime = visitor.totalTimeSeconds ?? 0;
  if (totalTime > 120) score += 10;
  if (totalTime > 300) score += 5;
  const bestSession = visitor.sessions[0];
  if (bestSession) {
    if (bestSession.maxScrollDepth >= 75) score += 10;
    if (bestSession.pageviewCount >= 3) score += 5;
  }

  await prisma.visitor
    .update({
      where: { id: visitorId },
      data: { intentScore: Math.min(100, score) },
    })
    .catch(() => null);
}

// ---------------------------------------------------------------------------
// identify() — promote a session's Visitor to IDENTIFIED with email/name.
// ---------------------------------------------------------------------------

export type IdentifyInput = {
  orgId: string;
  visitorId: string | null;
  sessionId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  traits: Record<string, unknown> | null;
};

export async function recordIdentify(input: IdentifyInput): Promise<void> {
  if (!input.visitorId) return;

  const existing = await prisma.visitor
    .findUnique({
      where: { id: input.visitorId },
      select: { enrichedData: true },
    })
    .catch(() => null);

  const merged: Record<string, unknown> = (() => {
    const base =
      existing?.enrichedData &&
      typeof existing.enrichedData === "object" &&
      !Array.isArray(existing.enrichedData)
        ? { ...(existing.enrichedData as Record<string, unknown>) }
        : {};
    if (input.traits && typeof input.traits === "object") {
      for (const [k, v] of Object.entries(input.traits)) {
        if (v != null && v !== "") base[k] = v;
      }
    }
    return base;
  })();

  await prisma.visitor.update({
    where: { id: input.visitorId },
    data: {
      status: VisitorIdentificationStatus.IDENTIFIED,
      email: input.email ?? undefined,
      firstName: input.firstName ?? undefined,
      lastName: input.lastName ?? undefined,
      phone: input.phone ?? undefined,
      enrichedData:
        Object.keys(merged).length > 0
          ? (merged as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      lastSeenAt: new Date(),
    },
  });

  await recomputeIntentScore(input.visitorId);
}
