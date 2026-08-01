import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import {
  LeadSource,
  LeadStatus,
  Prisma,
  VisitorIdentificationStatus,
  LeadNotifyChannel,
} from "@prisma/client";
import { notifyLeadCaptured } from "@/lib/notifications/lead-notify";
import { backfillPropertyId } from "@/lib/tenancy/property-filter";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  resolvePropertyForChatPage,
  type PropertyAttributionInput,
} from "@/lib/chatbot/property-attribution";

// the upstream pixel provider event-processing core. Extracted from the shared
// /api/webhooks/cursive route so the per-tenant path-token route
// (/api/webhooks/cursive/[token]) can reuse the exact same shape
// matching, identity cascade, dedupe, deliverability scoring, and
// upsert flow.
//
// Routes own:
//  - rate limiting and request-body parsing
//  - auth (header secret OR path token)
//  - envelope creation (whole-body hash dedupe + retry queue)
//
// This module owns:
//  - per-event processing (processCursiveEvent)
//  - all helpers: identity cascade, deliverability score, etc.
//
// Routes that arrive via path-token already know the tenant binding,
// so they pass `integrationOverride`. The shared route falls back to
// looking up the integration via cursivePixelId on each event.

const DELIVERABILITY_FLOOR = 60;

type ValidationStatus =
  | "Valid (esp)"
  | "Valid"
  | "Catch-all"
  | "Unknown"
  | "Invalid"
  | null;

export type ResolvedIntegration = {
  orgId: string;
  cursivePixelId: string | null;
  installedOnDomain: string | null;
  // Optional: surfaced when the integration row was located via the
  // path-token route. Used by the auto-bind path that captures pixel_id
  // from the FIRST event of a one-flow setup, so we know which row to
  // write to without re-querying. propertyId is part of the composite
  // identity (orgId, propertyId) and may be null for legacy org-wide rows.
  id?: string;
  propertyId?: string | null;
};

export type CursiveProcessResult = {
  visitorId: string | null;
  leadId: string | null;
  skipped?: string;
};

export async function processCursiveEvent(
  ev: Record<string, unknown>,
  integrationOverride?: ResolvedIntegration,
  // Org property list, keyed by orgId, reused across every event in one
  // webhook POST. A batch can carry hundreds of events for the same org —
  // fetching properties per event would multiply the query count for no
  // reason. Callers looping over a batch should create one Map and pass it
  // to every call; a fresh Map per call is also safe (no cross-request state).
  orgPropertiesCache?: Map<string, PropertyAttributionInput[]>,
): Promise<CursiveProcessResult> {
  const flat = flatten(ev);

  const pixelId = pickString(flat, "pixel_id", "resolution.pixel_id");

  // Path-token routes pass the integration up front; if the event
  // also carries a pixel_id, require it to match so a stolen token
  // can't be used to inject events for a different tenant.
  let integration: ResolvedIntegration | null;
  if (integrationOverride) {
    if (
      pixelId &&
      integrationOverride.cursivePixelId &&
      pixelId !== integrationOverride.cursivePixelId
    ) {
      return { visitorId: null, leadId: null, skipped: "pixel_id mismatch" };
    }
    // One-flow setup: the integration was created with a webhook token
    // but no cursivePixelId — the customer pasted the token URL into AL,
    // and this is the first event arriving on that URL. Auto-bind the
    // pixel_id (and accountId, when AL includes it) so the operator
    // never had to copy-paste those out of the AL dashboard. After this
    // write the row is fully wired and subsequent events flow through
    // the normal path. Race-safe: updateMany scoped to
    // {id, cursivePixelId: null} ensures only one of two concurrent
    // first-events wins the bind; the loser observes a now-populated
    // pixelId via the mismatch guard above.
    if (
      pixelId &&
      !integrationOverride.cursivePixelId &&
      integrationOverride.id
    ) {
      const accountId = pickString(
        flat,
        "account_id",
        "cursive_account_id",
        "resolution.account_id",
      );
      try {
        await prisma.cursiveIntegration.updateMany({
          where: { id: integrationOverride.id, cursivePixelId: null },
          data: {
            cursivePixelId: pixelId,
            cursiveAccountId: accountId ?? undefined,
            provisionedAt: new Date(),
          },
        });
        // Reflect the bind locally so downstream code (fingerprint,
        // updateMany at the end of this function) uses the captured ID.
        integrationOverride = {
          ...integrationOverride,
          cursivePixelId: pixelId,
        };
      } catch (err) {
        // Non-fatal: log and proceed. Visitor processing still works
        // for this event because we already have the integration's
        // orgId; the bind will retry on the next event.
        console.warn(
          "[cursive] auto-bind pixel_id failed; will retry on next event",
          err,
        );
      }
    }
    integration = integrationOverride;
  } else {
    if (!pixelId) {
      return { visitorId: null, leadId: null, skipped: "no pixel_id" };
    }
    // The pixel id is globally unique across Cursive's system, so a
    // findFirst by pixelId resolves to exactly one row regardless of
    // whether it's a per-property or legacy org-wide pixel. We fetch
    // propertyId too so downstream visitor/event writes can attribute
    // to the right property for multi-property tenants.
    const found = await prisma.cursiveIntegration.findFirst({
      where: { cursivePixelId: pixelId },
      select: {
        orgId: true,
        propertyId: true,
        cursivePixelId: true,
        installedOnDomain: true,
      },
    });
    if (!found) {
      return { visitorId: null, leadId: null, skipped: "unknown pixel" };
    }
    integration = found;
  }

  // Pixel-hit pulse counter. Bumps on EVERY processed event regardless of
  // whether it carries identity, so the integrations UI can show real-time
  // pulse separately from resolved-identity throughput. Runs BEFORE the
  // resolution gate below — that gate bails on anonymous page_views and
  // would never let the counter tick on a freshly installed pixel, even
  // though the pixel was firing thousands of hits per hour. Best-effort:
  // a failure here is non-fatal because the actual event processing
  // (Visitor upsert, etc.) below is what the tenant cares about.
  if (integration.cursivePixelId) {
    try {
      await prisma.cursiveIntegration.updateMany({
        where: {
          orgId: integration.orgId,
          cursivePixelId: integration.cursivePixelId,
        },
        data: {
          lastPixelHitAt: new Date(),
          totalPixelHitsCount: { increment: 1 },
        },
      });
    } catch (err) {
      console.warn("[cursive] pixel-hit telemetry bump failed", err);
    }
  }

  const eventType =
    pickString(flat, "event", "event_type", "event_data.event_type") ?? null;
  const eventTimestamp = pickString(
    flat,
    "event_timestamp",
    "activity_start_date",
  );
  const profileId = pickString(flat, "profile_id");
  const uid = pickString(flat, "uid");
  const cookieId = pickString(flat, "cookie_id");

  // The upstream provider asserts its OWN verification via
  // PERSONAL_VERIFIED_EMAILS (empty string when it can't verify). On the feed
  // we actually receive this is the only deliverability signal present, so it
  // is both the preferred address to store and the quality gate below.
  const verifiedEmail =
    firstEmail(flat["resolution.PERSONAL_VERIFIED_EMAILS"]) ??
    firstEmail(flat["PERSONAL_VERIFIED_EMAILS"]);

  const emailRaw =
    pickString(flat, "email_raw") ??
    verifiedEmail ??
    firstEmail(flat["resolution.PERSONAL_EMAILS"]) ??
    firstEmail(flat["PERSONAL_EMAILS"]) ??
    pickString(flat, "resolution.BUSINESS_EMAIL", "BUSINESS_EMAIL");

  const normalizedEmail = emailRaw ? emailRaw.toLowerCase().trim() : null;
  const hemSha256 =
    pickString(flat, "hem_sha256") ??
    (normalizedEmail ? sha256(normalizedEmail) : null);
  const firstName = pickString(flat, "resolution.FIRST_NAME", "FIRST_NAME");
  const lastName = pickString(flat, "resolution.LAST_NAME", "LAST_NAME");

  // Resolution gate. AL's per-pixel webhook fires on every pixel event,
  // including anonymous page_views with cookie IDs only. We ack those
  // with 200 so AL doesn't retry, but never persist them. Only events
  // carrying real identity data become Visitor rows.
  const isResolution = Boolean(
    hemSha256 || normalizedEmail || firstName || lastName,
  );
  if (!isResolution) {
    return { visitorId: null, leadId: null, skipped: "unresolved event" };
  }

  // For path-token routes pixel_id may be absent in the event (AL only
  // populates it sometimes); use the integration's pixelId so dedupe
  // fingerprint is still tenant-scoped.
  const fingerprintPixel = pixelId ?? integration.cursivePixelId ?? "";
  const fingerprint = computeFingerprint({
    pixelId: fingerprintPixel,
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
    profileId ?? uid ?? hemSha256 ?? cookieId ?? `anon:${fingerprintPixel}:${Date.now()}`;

  const phone =
    pickString(
      flat,
      "resolution.MOBILE_PHONE",
      "MOBILE_PHONE",
      "resolution.PERSONAL_PHONE",
      "resolution.DIRECT_NUMBER",
    ) ?? null;

  const personalValidation = pickValidationStatus(
    flat["resolution.PERSONAL_EMAIL_VALIDATION_STATUS"] ??
      flat["PERSONAL_EMAIL_VALIDATION_STATUS"],
  );
  const businessValidation = pickValidationStatus(
    flat["resolution.BUSINESS_EMAIL_VALIDATION_STATUS"] ??
      flat["BUSINESS_EMAIL_VALIDATION_STATUS"],
  );
  const personalLastSeen = pickString(
    flat,
    "resolution.PERSONAL_EMAIL_LAST_SEEN_BY_ESP_DATE",
    "PERSONAL_EMAIL_LAST_SEEN_BY_ESP_DATE",
  );

  const companyDomain = pickString(
    flat,
    "resolution.COMPANY_DOMAIN",
    "COMPANY_DOMAIN",
  );
  const hasSkiptrace =
    pickString(
      flat,
      "resolution.SKIPTRACE_MATCH_SCORE",
      "SKIPTRACE_MATCH_SCORE",
    ) != null;

  const deliverability = computeDeliverabilityScore({
    personalValidation,
    businessValidation,
    hasPhone: Boolean(phone),
    hasCompanyDomain: Boolean(companyDomain),
    lastSeenIso: personalLastSeen,
    hasSkiptrace,
  });

  const identified = Boolean(normalizedEmail && firstName && lastName);

  // Lead gate. TWO regimes, because the provider ships two payload shapes:
  //
  //  1. Rich feed — carries validation status, skiptrace, company domain,
  //     phone, ESP last-seen. computeDeliverabilityScore was written for this
  //     and the 60 floor is calibrated against its five signals.
  //  2. Basic feed — what we ACTUALLY receive today. Across every resolution
  //     blob ever stored (276/276 on the live tenant) the payload is exactly:
  //     FIRST_NAME, LAST_NAME, GENDER, AGE_RANGE, HEM_SHA256, PERSONAL_CITY,
  //     PERSONAL_STATE, PERSONAL_ZIP, PERSONAL_EMAILS,
  //     PERSONAL_VERIFIED_EMAILS, REFERRER_URL. NOT ONE scoring field is
  //     present, and no visitor has ever had a phone — so every event scored
  //     0/100 against a floor of 60 and the pixel could never produce a lead.
  //     Zero pixel leads existed in production before this fix (2026-07-29).
  //
  // So: honor the provider's own verification assertion when that's all we
  // get, and keep the score path intact for richer payloads.
  const leadWorthy = evaluateLeadGate({
    identified,
    hasVerifiedEmail: Boolean(verifiedEmail),
    deliverability,
  });

  const status = identified
    ? VisitorIdentificationStatus.IDENTIFIED
    : VisitorIdentificationStatus.ANONYMOUS;

  const referrer = pickString(
    flat,
    "event_data.referrer",
    "event_data.referer",
    "referrer",
  );
  const utmSource = pickString(flat, "event_data.utm_source", "utm_source");
  const utmMedium = pickString(flat, "event_data.utm_medium", "utm_medium");
  const utmCampaign = pickString(
    flat,
    "event_data.utm_campaign",
    "utm_campaign",
  );
  const pageUrl = pickString(
    flat,
    "page_url",
    "landing_url",
    "event_data.url",
    "event_data.page_url",
  );

  // Property attribution. CONSERVATIVE RULE (decided 2026-07-31): a pixel
  // row explicitly bound to a property (integration.propertyId set) keeps
  // that binding always — no behavior change for bound pixels. URL
  // inference only runs for legacy org-wide rows (propertyId null), and
  // only helps when it can name a specific building; an ambiguous/no-match
  // URL leaves attribution null exactly like today. Gated on pageUrl so a
  // single-property org's legacy pixel doesn't auto-bind every URL-less
  // event to its one property (that fallback is fine for chatbot, not for
  // an anonymous pixel visitor), and so URL-less events skip the property
  // query entirely.
  const attributedPropertyId =
    integration.propertyId ??
    (pageUrl
      ? await resolveAttributedPropertyId(
          integration.orgId,
          pageUrl,
          orgPropertiesCache,
        )
      : null);

  const now = new Date();
  const eventTime = eventTimestamp ? new Date(eventTimestamp) : now;
  const intentScore = computeIntentScore({
    identified,
    hasPageUrl: Boolean(pageUrl),
    deliverability,
  });

  const identityCandidates = [profileId, uid, hemSha256, cookieId].filter(
    (v): v is string => Boolean(v),
  );
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
    incomingResolution,
  );

  const pagesEntry = pageUrl
    ? [{ url: pageUrl, ts: eventTime.toISOString(), type: eventType }]
    : undefined;

  let visitor;
  if (existing) {
    // Append the new page view to the rolling pagesViewed JSON. Cap at the
    // last MAX_PAGES_VIEWED entries so a chatty browser cannot blow up the
    // row size.
    const MAX_PAGES_VIEWED = 50;
    let mergedPages: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
    if (pagesEntry) {
      const prevArr = Array.isArray(existing.pagesViewed)
        ? (existing.pagesViewed as unknown[])
        : [];
      const next = [...prevArr, ...pagesEntry].slice(-MAX_PAGES_VIEWED);
      mergedPages = next as unknown as Prisma.InputJsonValue;
    }
    visitor = await prisma.visitor.update({
      where: { id: existing.id },
      data: {
        // First-write-wins: backfill the building only when this visitor has
        // none yet. A person can browse two buildings' sites; re-filing them
        // on every event would make the row flap and would change which
        // operator sees them under per-property access.
        propertyId: backfillPropertyId(existing.propertyId, attributedPropertyId),
        cursiveVisitorId: pickHighestPriorityIdentity(
          existing.cursiveVisitorId,
          profileId,
          uid,
          hemSha256,
          cookieId,
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
        lastSeenAt:
          eventTime > existing.lastSeenAt ? eventTime : existing.lastSeenAt,
        sessionCount:
          eventType === "page_view"
            ? { increment: 1 }
            : existing.sessionCount,
        referrer: referrer ?? existing.referrer ?? undefined,
        utmSource: utmSource ?? existing.utmSource ?? undefined,
        utmMedium: utmMedium ?? existing.utmMedium ?? undefined,
        utmCampaign: utmCampaign ?? existing.utmCampaign ?? undefined,
        intentScore: Math.max(existing.intentScore, intentScore),
        pagesViewed: mergedPages,
      },
    });
  } else {
    // Two parallel webhooks for the same identity can both miss the
    // findFirst above and both reach this create branch — the second
    // throws P2002 on cursiveVisitorId/email unique constraints. Catch
    // and fall back to find+update so AL doesn't see a 500 and retry
    // the entire batch.
    try {
      visitor = await prisma.visitor.create({
        data: {
          orgId: integration.orgId,
          // Per-property pixels are a first-class setup (CursiveIntegration is
          // unique on (orgId, propertyId)). Null only for legacy org-wide rows
          // whose URL didn't resolve to a specific property.
          propertyId: attributedPropertyId ?? null,
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
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const winner = orClauses.length
          ? await prisma.visitor.findFirst({
              where: { orgId: integration.orgId, OR: orClauses },
            })
          : null;
        if (!winner) throw err;
        visitor = await prisma.visitor.update({
          where: { id: winner.id },
          data: {
            propertyId: backfillPropertyId(winner.propertyId, attributedPropertyId),
            lastSeenAt:
              eventTime > winner.lastSeenAt ? eventTime : winner.lastSeenAt,
            sessionCount:
              eventType === "page_view"
                ? { increment: 1 }
                : winner.sessionCount,
            firstName: firstName ?? winner.firstName ?? undefined,
            lastName: lastName ?? winner.lastName ?? undefined,
            email: normalizedEmail ?? winner.email ?? undefined,
            hashedEmail: hemSha256 ?? winner.hashedEmail ?? undefined,
            intentScore: Math.max(winner.intentScore, intentScore),
            enrichedData: mergedEnrichment,
          },
        });
      } else {
        throw err;
      }
    }
  }

  let leadId: string | null = null;
  if (leadWorthy && normalizedEmail) {
    const upserted = await upsertLead({
      orgId: integration.orgId,
      propertyId: attributedPropertyId ?? null,
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
    leadId = upserted.id;

    // Instant operator email — only on the first time we see this email.
    // Cursive sends multiple events per visitor; firing per event would
    // spam the operator with duplicates of the same lead identity.
    if (upserted.isNew) {
      void notifyLeadCaptured({
        orgId: integration.orgId,
        leadId,
        propertyId: attributedPropertyId ?? null,
        // PIXEL, not INGEST: this is a resolved anonymous browser, not an
        // inbound enquiry. Defaults to no email; the lead still appears in
        // the dashboard. Operators can opt in per workspace.
        channel: LeadNotifyChannel.PIXEL,
        lead: {
          name:
            [firstName, lastName].filter(Boolean).join(" ") || normalizedEmail,
          email: normalizedEmail,
          phone,
          sourceLabel: integration.installedOnDomain
            ? `Cursive pixel on ${integration.installedOnDomain}`
            : "Cursive pixel",
          intent: pageUrl ?? null,
        },
      }).catch(() => {});
    }
  }

  // Engagement bridge: when AL fires a page_view event with a page_url, mirror
  // it as a VisitorSession + VisitorEvent so the portal session timeline + the
  // dashboard visitor metrics actually populate. Wrapped so a session-write
  // failure never breaks the visitor write — the AL ack still succeeds.
  if (eventType === "page_view" && pageUrl) {
    try {
      await recordPageViewSession({
        orgId: integration.orgId,
        visitorId: visitor.id,
        anonymousId: profileId ?? uid ?? cookieId ?? `al:${visitor.id}`,
        pageUrl,
        eventTime,
        referrer: referrer ?? null,
        utmSource: utmSource ?? null,
        utmMedium: utmMedium ?? null,
        utmCampaign: utmCampaign ?? null,
        // Wave 3 Phase 3: reuse the SAME attribution already resolved above
        // (integration.propertyId ?? URL inference) — never re-run inference
        // for the session/event rows.
        propertyId: attributedPropertyId ?? null,
      });
    } catch (err) {
      // Non-fatal: log via Sentry breadcrumb when configured but never throw.
      console.error("[cursive-bridge] session write failed", err);
    }
  }

  // Bump activity counters on the SPECIFIC integration row that
  // matched the pixel id (could be per-property or legacy org-wide).
  // updateMany with the explicit pixelId keeps this race-safe even
  // with multiple per-property pixels in the same org.
  if (integration.cursivePixelId) {
    await prisma.cursiveIntegration.updateMany({
      where: {
        orgId: integration.orgId,
        cursivePixelId: integration.cursivePixelId,
      },
      data: {
        lastEventAt: now,
        totalEventsCount: { increment: 1 },
      },
    });
  }

  return { visitorId: visitor.id, leadId };
}

// ---------------------------------------------------------------------------
// Page-view → session bridge
//
// AL provides identity but not engagement, and our schema has VisitorSession
// + VisitorEvent built for first-party pixel events. The session timeline UI
// reads from those tables, so when AL fires a page_view event we materialize
// it here. Bucketing rule: append to the most recent open session (lastEventAt
// within 30 min) OR start a new one. Time-on-site is left at 0 — AL does not
// emit visibilitychange/unload pings, so we do not have honest dwell data.
// ---------------------------------------------------------------------------

const SESSION_IDLE_MS = 30 * 60 * 1000;

async function recordPageViewSession(args: {
  orgId: string;
  visitorId: string;
  anonymousId: string;
  pageUrl: string;
  eventTime: Date;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** Same attribution already resolved for the Visitor/Lead write. */
  propertyId: string | null;
}): Promise<void> {
  const path = pathFromUrl(args.pageUrl);

  const idleThreshold = new Date(args.eventTime.getTime() - SESSION_IDLE_MS);
  const recentSession = await prisma.visitorSession.findFirst({
    where: {
      orgId: args.orgId,
      visitorId: args.visitorId,
      lastEventAt: { gte: idleThreshold },
    },
    orderBy: { lastEventAt: "desc" },
    select: { id: true, startedAt: true, propertyId: true },
  });

  // Effective attribution for THIS event, computed once and reused for both
  // the session backfill and the event write below. Without this, a
  // session already attributed by an earlier event (recentSession.propertyId
  // set) but whose current event's URL doesn't resolve (args.propertyId ===
  // null) would write this event with propertyId NULL under a
  // property-scoped session — orphaning it from property-filtered reads,
  // which is exactly what VisitorEvent.propertyId's "copied from the parent
  // session" comment promises never happens.
  const sessionPropertyId = recentSession
    ? backfillPropertyId(recentSession.propertyId, args.propertyId) ?? null
    : args.propertyId;

  let sessionId: string;
  if (recentSession) {
    sessionId = recentSession.id;
    await prisma.visitorSession.update({
      where: { id: recentSession.id },
      data: {
        lastEventAt: args.eventTime,
        pageviewCount: { increment: 1 },
        // Backfill only — same first-write-wins rule as Visitor.propertyId
        // so an already-attributed session never gets re-filed mid-visit.
        propertyId: sessionPropertyId,
      },
    });
  } else {
    const created = await prisma.visitorSession.create({
      data: {
        orgId: args.orgId,
        visitorId: args.visitorId,
        propertyId: args.propertyId,
        anonymousId: args.anonymousId,
        sessionToken: crypto.randomUUID(),
        firstUrl: args.pageUrl,
        firstReferrer: args.referrer,
        utmSource: args.utmSource,
        utmMedium: args.utmMedium,
        utmCampaign: args.utmCampaign,
        startedAt: args.eventTime,
        lastEventAt: args.eventTime,
        pageviewCount: 1,
        totalTimeSeconds: 0,
        maxScrollDepth: 0,
      },
      select: { id: true },
    });
    sessionId = created.id;
  }

  await prisma.visitorEvent.create({
    data: {
      orgId: args.orgId,
      sessionId,
      visitorId: args.visitorId,
      propertyId: sessionPropertyId,
      type: "pageview",
      url: args.pageUrl,
      path,
      occurredAt: args.eventTime,
    },
  });
}

function pathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return (u.pathname || "/") + (u.search || "");
  } catch {
    return url.length < 256 ? url : null;
  }
}

async function upsertLead(args: {
  orgId: string;
  /** Building this pixel belongs to; null for legacy org-wide pixels. */
  propertyId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  visitorId: string;
  sourceDetail: string | null;
  intentScore: number;
  enrichedData: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  pageUrl: string | null;
}): Promise<{ id: string; isNew: boolean }> {
  const existing = await prisma.lead.findFirst({
    where: { orgId: args.orgId, email: args.email },
    select: { id: true, propertyId: true },
  });
  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        // Backfill only. Never re-file an existing lead onto another building:
        // that would move it between operators' views mid-pipeline.
        propertyId: backfillPropertyId(existing.propertyId, args.propertyId),
        visitorId: args.visitorId,
        firstName: args.firstName ?? undefined,
        lastName: args.lastName ?? undefined,
        phone: args.phone ?? undefined,
        lastActivityAt: new Date(),
        enrichedData: args.enrichedData,
        score: Math.max(0, args.intentScore),
      },
    });
    return { id: existing.id, isNew: false };
  }
  // Race-safe create: catch P2002 on (orgId, email) unique and fall back
  // to find+update with the same data the update branch would have written.
  try {
    const lead = await prisma.lead.create({
      data: {
        orgId: args.orgId,
        propertyId: args.propertyId,
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
    return { id: lead.id, isNew: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const winner = await prisma.lead.findFirst({
        where: { orgId: args.orgId, email: args.email },
        select: { id: true, propertyId: true },
      });
      if (!winner) throw err;
      await prisma.lead.update({
        where: { id: winner.id },
        data: {
          propertyId: backfillPropertyId(winner.propertyId, args.propertyId),
          visitorId: args.visitorId,
          firstName: args.firstName ?? undefined,
          lastName: args.lastName ?? undefined,
          phone: args.phone ?? undefined,
          lastActivityAt: new Date(),
          enrichedData: args.enrichedData,
          score: Math.max(0, args.intentScore),
        },
      });
      return { id: winner.id, isNew: false };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------

export function unwrapEvents(parsed: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(parsed)) {
    return parsed.filter(
      (x): x is Record<string, unknown> => typeof x === "object" && x !== null,
    );
  }
  if (parsed && typeof parsed === "object") {
    const maybeResult = (parsed as Record<string, unknown>).result;
    if (Array.isArray(maybeResult)) {
      return maybeResult.filter(
        (x): x is Record<string, unknown> =>
          typeof x === "object" && x !== null,
      );
    }
    return [parsed as Record<string, unknown>];
  }
  return [];
}

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function isUniqueConstraintError(err: unknown): boolean {
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
    [args.pixelId, args.profileId, args.eventTimestamp, args.eventType ?? ""]
      .join("|"),
  );
}

function flatten(
  obj: Record<string, unknown>,
  prefix = "",
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

/**
 * Should this resolved identity become a Lead?
 *
 * Exported for test: the basic feed scores 0/100 on computeDeliverabilityScore
 * because it carries none of that function's inputs, so before 2026-07-29 the
 * `deliverability >= FLOOR` arm alone made lead creation unreachable.
 */
export function evaluateLeadGate(args: {
  identified: boolean;
  hasVerifiedEmail: boolean;
  deliverability: number;
}): boolean {
  if (!args.identified) return false;
  return args.hasVerifiedEmail || args.deliverability >= DELIVERABILITY_FLOOR;
}

export function computeDeliverabilityScore(args: {
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
  b: ValidationStatus,
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
  incoming: unknown,
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

/**
 * Legacy org-wide pixel rows (propertyId null) get URL-based attribution.
 * Fetches the org's property list once per webhook POST via the caller-
 * supplied cache (keyed by orgId) instead of once per event.
 */
async function resolveAttributedPropertyId(
  orgId: string,
  pageUrl: string | undefined,
  cache?: Map<string, PropertyAttributionInput[]>,
): Promise<string | null> {
  let properties = cache?.get(orgId);
  if (!properties) {
    // marketablePropertyWhere excludes EXCLUDED/ARCHIVED junk rows (parking
    // lots, "Do not use" placeholders) — a junk row's slug could otherwise
    // win attribution over a real building, or inflate the property count
    // and defeat the single-property fallback. take:500 matches every
    // other property-count site in the codebase.
    properties = await prisma.property.findMany({
      where: marketablePropertyWhere(orgId),
      select: { id: true, slug: true, name: true },
      take: 500,
    });
    cache?.set(orgId, properties);
  }
  // requireUrlMatch: the pixel path never falls back to "single property,
  // must be that one" — an unrelated site with the pixel installed
  // shouldn't get bound. Chatbot callers (resolvePropertyForChatPage called
  // directly elsewhere) keep the fallback via the default.
  return resolvePropertyForChatPage(pageUrl, properties, {
    requireUrlMatch: true,
  });
}

function pickHighestPriorityIdentity(
  current: string | null,
  profileId: string | undefined,
  uid: string | undefined,
  hemSha256: string | null,
  cookieId: string | undefined,
): string {
  return profileId ?? uid ?? hemSha256 ?? current ?? cookieId ?? "";
}
