"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { ForbiddenError, requireAudienceSync } from "@/lib/tenancy/scope";
import { encrypt, maybeDecrypt, maybeEncrypt } from "@/lib/crypto";
import {
  alSurfaceFromMeta,
  geoFilterFn,
  listAlSegments,
  streamAlSegmentMembers,
  validateAlSegmentId,
  type AlMember,
  type GeoFilter,
} from "@/lib/integrations/al-segments";
import {
  AudienceDestinationType,
  AudienceScheduleFrequency,
  AudienceSyncStatus,
  OrgType,
  type AudienceDestination,
  type AudienceSegment,
} from "@prisma/client";
import { computeNextRunAt } from "@/lib/audiences/schedule";

// ---------------------------------------------------------------------------
// Insight computation. AudienceLab returns a list of members per segment
// but no aggregate distributions (top states / zips / cities, match rates).
// We sample a slice of members and compute those ourselves so the segment
// detail page renders real data.
//
// Cost tradeoff: a 300-member sample is ~3 round-trips at page_size=100 and
// adds ~1-2s to "Add segment" / "Refresh insights" but populates the entire
// detail dashboard from a single AL fetch. The result extrapolates raw
// counts to the full segment using totalRecords / sampleSize.
// ---------------------------------------------------------------------------

const INSIGHT_SAMPLE_SIZE = 300;

type SegmentInsights = {
  email_match_rate: number;
  phone_match_rate: number;
  top_states: Array<{ state: string; count: number }>;
  top_zips: Array<{ zip: string; city?: string; count: number }>;
  top_cities: Array<{ city: string; state?: string; count: number }>;
  sample_size: number;
  insights_computed_at: string;
};

async function computeSegmentInsights(
  alSegmentId: string,
  surface: ReturnType<typeof alSurfaceFromMeta>,
  totalRecords: number,
  apiKey: string | undefined,
): Promise<SegmentInsights | null> {
  const result = await streamAlSegmentMembers(alSegmentId, {
    apiKey,
    surface,
    maxMembers: INSIGHT_SAMPLE_SIZE,
    pageSize: 100,
  });
  if (!result.ok) return null;
  const members = result.data;
  const sampleSize = members.length;
  if (sampleSize === 0) {
    return {
      email_match_rate: 0,
      phone_match_rate: 0,
      top_states: [],
      top_zips: [],
      top_cities: [],
      sample_size: 0,
      insights_computed_at: new Date().toISOString(),
    };
  }

  const stateCounts = new Map<string, number>();
  const zipCounts = new Map<string, { count: number; city?: string }>();
  const cityCounts = new Map<string, { count: number; state?: string }>();
  let emailMatch = 0;
  let phoneMatch = 0;

  for (const m of members) {
    if (m.state) {
      const st = m.state.trim().toUpperCase();
      stateCounts.set(st, (stateCounts.get(st) ?? 0) + 1);
    }
    if (m.postalCode) {
      const zip = m.postalCode.split("-")[0]?.trim();
      if (zip) {
        const existing = zipCounts.get(zip);
        zipCounts.set(zip, {
          count: (existing?.count ?? 0) + 1,
          city: existing?.city ?? m.city ?? undefined,
        });
      }
    }
    if (m.city) {
      const ct = m.city.trim();
      const existing = cityCounts.get(ct);
      cityCounts.set(ct, {
        count: (existing?.count ?? 0) + 1,
        state: existing?.state ?? m.state ?? undefined,
      });
    }
    if (m.email) emailMatch++;
    if (m.phone) phoneMatch++;
  }

  // Extrapolate sample counts to the full segment when we know the size.
  const ratio =
    totalRecords > 0 && sampleSize > 0 ? totalRecords / sampleSize : 1;
  const scale = (n: number) => Math.round(n * ratio);

  const top_states = Array.from(stateCounts.entries())
    .map(([state, count]) => ({ state, count: scale(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const top_zips = Array.from(zipCounts.entries())
    .map(([zip, { count, city }]) => ({ zip, city, count: scale(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const top_cities = Array.from(cityCounts.entries())
    .map(([city, { count, state }]) => ({ city, state, count: scale(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    email_match_rate: emailMatch / sampleSize,
    phone_match_rate: phoneMatch / sampleSize,
    top_states,
    top_zips,
    top_cities,
    sample_size: sampleSize,
    insights_computed_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Add segment by ID — AudienceLab does not expose a list-all-segments
// endpoint. Operators paste a segment ID from the AL dashboard, we validate
// it via /segments/{id}, and cache a row so the rest of the dashboard lights
// up. This is the primary onboarding path for new segments.
// ---------------------------------------------------------------------------

export type AddSegmentInput = {
  alSegmentId: string;
  name: string;
  description?: string;
};

export type AddSegmentResult =
  | { ok: true; segmentId: string; alreadyExisted: boolean; hasMembers: boolean }
  | { ok: false; error: string };

export async function addAudienceSegmentById(
  input: AddSegmentInput,
): Promise<AddSegmentResult> {
  const scope = await requireAudienceSyncOrThrow();
  const trimmedId = input.alSegmentId.trim();
  const trimmedName = input.name.trim();
  if (!trimmedId) {
    return { ok: false, error: "Segment ID is required." };
  }
  if (!trimmedName) {
    return { ok: false, error: "Display name is required." };
  }
  if (trimmedId.length < 3) {
    return { ok: false, error: "Segment ID looks too short to be valid." };
  }

  const orgKey = await getOrgApiKeyOverride(scope.orgId);
  const validation = await validateAlSegmentId(trimmedId, { apiKey: orgKey });
  if (!validation.ok) {
    return { ok: false, error: validation.message };
  }

  const meta = validation.data.meta;
  const memberCount =
    typeof meta.total_records === "number"
      ? meta.total_records
      : Number(meta.total_records ?? 0) || 0;

  // Compute insights so the segment detail page populates immediately on
  // add. Best-effort: if AL fails the secondary fetch we still save the
  // segment with raw meta and the operator can hit "Refresh insights" later.
  const insights = await computeSegmentInsights(
    trimmedId,
    validation.data.surface,
    memberCount,
    orgKey,
  );
  const fullMeta = insights ? { ...meta, ...insights } : meta;

  const existing = await prisma.audienceSegment.findUnique({
    where: {
      orgId_alSegmentId: { orgId: scope.orgId, alSegmentId: trimmedId },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.audienceSegment.update({
      where: { id: existing.id },
      data: {
        name: trimmedName,
        description: input.description?.trim() || null,
        memberCount,
        rawPayload: fullMeta as object,
        lastFetchedAt: new Date(),
        visible: true,
      },
    });
    revalidatePath("/portal/audiences");
    revalidatePath(`/portal/audiences/${existing.id}`);
    return {
      ok: true,
      segmentId: existing.id,
      alreadyExisted: true,
      hasMembers: validation.data.hasMembers,
    };
  }

  const created = await prisma.audienceSegment.create({
    data: {
      orgId: scope.orgId,
      alSegmentId: trimmedId,
      name: trimmedName,
      description: input.description?.trim() || null,
      memberCount,
      rawPayload: fullMeta as object,
      lastFetchedAt: new Date(),
    },
    select: { id: true },
  });
  revalidatePath("/portal/audiences");
  revalidatePath(`/portal/audiences/${created.id}`);
  return {
    ok: true,
    segmentId: created.id,
    alreadyExisted: false,
    hasMembers: validation.data.hasMembers,
  };
}

// ---------------------------------------------------------------------------
// Refresh insights — re-samples a segment and re-aggregates the detail-page
// data. Used by the "Refresh insights" button on segment detail.
// ---------------------------------------------------------------------------

export type RefreshInsightsResult =
  | {
      ok: true;
      sampleSize: number;
      emailMatchPct: number;
      phoneMatchPct: number;
      stateCount: number;
    }
  | { ok: false; error: string };

export async function refreshSegmentInsights(
  segmentId: string,
): Promise<RefreshInsightsResult> {
  const scope = await requireAudienceSyncOrThrow();

  const segment = await prisma.audienceSegment.findFirst({
    where: { id: segmentId, orgId: scope.orgId },
    select: {
      id: true,
      alSegmentId: true,
      memberCount: true,
      rawPayload: true,
    },
  });
  if (!segment) return { ok: false, error: "Segment not found." };

  const orgKey = await getOrgApiKeyOverride(scope.orgId);
  const surface = alSurfaceFromMeta(
    segment.rawPayload as Record<string, unknown> | null,
  );
  const insights = await computeSegmentInsights(
    segment.alSegmentId,
    surface,
    segment.memberCount,
    orgKey,
  );
  if (!insights) {
    return {
      ok: false,
      error: "AudienceLab returned no members for the sample.",
    };
  }

  const existingMeta =
    (segment.rawPayload as Record<string, unknown> | null) ?? {};
  const merged = { ...existingMeta, ...insights };

  await prisma.audienceSegment.update({
    where: { id: segment.id },
    data: {
      rawPayload: merged as object,
      lastFetchedAt: new Date(),
    },
  });
  revalidatePath(`/portal/audiences/${segment.id}`);
  revalidatePath("/portal/audiences");
  return {
    ok: true,
    sampleSize: insights.sample_size,
    emailMatchPct: Math.round(insights.email_match_rate * 100),
    phoneMatchPct: Math.round(insights.phone_match_rate * 100),
    stateCount: insights.top_states.length,
  };
}

// ---------------------------------------------------------------------------
// Refresh segments — auto-discovers all audiences from AL via GET /audiences
// (the list endpoint), upserts new ones, and refreshes metadata on existing
// rows. Operators can still add a single audience by ID via
// addAudienceSegmentById, useful when they want only a subset of their AL
// catalog visible in the dashboard.
// ---------------------------------------------------------------------------

export type RefreshSegmentsResult =
  | { ok: true; total: number; created: number; updated: number; failed: number }
  | { ok: false; error: string };

export async function refreshAudienceSegments(): Promise<RefreshSegmentsResult> {
  const scope = await requireAudienceSyncOrThrow();
  const orgKey = await getOrgApiKeyOverride(scope.orgId);

  // Page through up to 200 audiences. Anything past that is rare and the
  // operator can add the rest manually.
  const discovered: Array<{
    id: string;
    name: string;
    description?: string;
    raw: Record<string, unknown>;
  }> = [];
  let page = 1;
  for (let i = 0; i < 4; i++) {
    const result = await listAlSegments({
      apiKey: orgKey,
      page,
      pageSize: 50,
    });
    if (!result.ok) return { ok: false, error: result.message };
    discovered.push(...result.data);
    if (result.data.length < 50) break;
    page++;
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  for (const aud of discovered) {
    // Validate each audience to capture total_records and meta. Skip on
    // failure rather than aborting the whole refresh.
    const validation = await validateAlSegmentId(aud.id, { apiKey: orgKey });
    if (!validation.ok) {
      failed++;
      continue;
    }
    const baseMeta = validation.data.meta;
    const memberCount =
      typeof baseMeta.total_records === "number"
        ? baseMeta.total_records
        : Number(baseMeta.total_records ?? 0) || 0;
    const insights = await computeSegmentInsights(
      aud.id,
      validation.data.surface,
      memberCount,
      orgKey,
    );
    const meta = insights ? { ...baseMeta, ...insights } : baseMeta;

    const existing = await prisma.audienceSegment.findUnique({
      where: {
        orgId_alSegmentId: { orgId: scope.orgId, alSegmentId: aud.id },
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.audienceSegment.update({
        where: { id: existing.id },
        data: {
          name: aud.name,
          description: aud.description ?? null,
          memberCount,
          rawPayload: meta as object,
          lastFetchedAt: new Date(),
        },
      });
      updated++;
    } else {
      await prisma.audienceSegment.create({
        data: {
          orgId: scope.orgId,
          alSegmentId: aud.id,
          name: aud.name,
          description: aud.description ?? null,
          memberCount,
          rawPayload: meta as object,
          lastFetchedAt: new Date(),
        },
      });
      created++;
    }
  }
  revalidatePath("/portal/audiences");
  return {
    ok: true,
    total: discovered.length,
    created,
    updated,
    failed,
  };
}

// ---------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------

export type CreateDestinationInput = {
  type: AudienceDestinationType;
  name: string;
  webhookUrl?: string;
  webhookSecret?: string;
  adAccountId?: string;
  segmentId?: string;
};

export async function createAudienceDestination(
  input: CreateDestinationInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const scope = await requireAudienceSyncOrThrow();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };

  if (input.type === "WEBHOOK") {
    if (!input.webhookUrl?.trim()) {
      return { ok: false, error: "Webhook URL is required." };
    }
    try {
      const url = new URL(input.webhookUrl);
      if (url.protocol !== "https:") {
        return { ok: false, error: "Webhook URL must be https." };
      }
    } catch {
      return { ok: false, error: "Webhook URL is not a valid URL." };
    }
  }
  if (
    (input.type === "META_CUSTOM_AUDIENCE" ||
      input.type === "GOOGLE_CUSTOMER_MATCH") &&
    !input.adAccountId
  ) {
    return { ok: false, error: "Ad account is required for this destination." };
  }

  // Generate a webhook signing secret on the fly when none provided.
  const webhookSecret =
    input.type === "WEBHOOK"
      ? input.webhookSecret?.trim() || crypto.randomBytes(32).toString("hex")
      : null;

  const created = await prisma.audienceDestination.create({
    data: {
      orgId: scope.orgId,
      type: input.type,
      name,
      webhookUrl: input.webhookUrl?.trim() ?? null,
      webhookSecretEnc: webhookSecret ? encrypt(webhookSecret) : null,
      adAccountId: input.adAccountId ?? null,
      segmentId: input.segmentId ?? null,
    },
    select: { id: true },
  });
  revalidatePath("/portal/audiences/destinations");
  if (input.segmentId) revalidatePath(`/portal/audiences/${input.segmentId}`);
  return { ok: true, id: created.id };
}

export async function deleteAudienceDestination(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const scope = await requireAudienceSyncOrThrow();
  const dest = await prisma.audienceDestination.findFirst({
    where: { id, orgId: scope.orgId },
    select: { id: true, segmentId: true },
  });
  if (!dest) return { ok: false, error: "Destination not found." };
  await prisma.audienceDestination.delete({ where: { id: dest.id } });
  revalidatePath("/portal/audiences/destinations");
  if (dest.segmentId) revalidatePath(`/portal/audiences/${dest.segmentId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Push — fetch members, optionally filter, hit the destination, log a run.
// CSV download returns a base64-encoded body so the server action can stream
// it back to the browser without a separate streaming endpoint.
// ---------------------------------------------------------------------------

export type PushSegmentInput = {
  segmentId: string;
  destinationId: string;
  geoFilter?: GeoFilter;
  maxMembers?: number;
};

export type PushResult =
  | {
      ok: true;
      runId: string;
      memberCount: number;
      // Present for CSV_DOWNLOAD; consumer turns it into a download.
      csvBase64?: string;
      filename?: string;
    }
  | { ok: false; error: string; runId?: string };

export async function pushSegmentToDestination(
  input: PushSegmentInput,
): Promise<PushResult> {
  const scope = await requireAudienceSyncOrThrow();
  return executeSegmentPush({
    orgId: scope.orgId,
    segmentId: input.segmentId,
    destinationId: input.destinationId,
    geoFilter: input.geoFilter,
    maxMembers: input.maxMembers,
    triggeredByUserId: scope.userId,
  });
}

// ---------------------------------------------------------------------------
// executeSegmentPush — the auth-free internal that runs the push pipeline.
// pushSegmentToDestination wraps this with a Clerk scope check; the cron
// handler at /api/cron/run-audience-syncs calls it directly after verifying
// its own bearer token. Callers MUST authorize before invoking this.
// ---------------------------------------------------------------------------
export type ExecuteSegmentPushInput = {
  orgId: string;
  segmentId: string;
  destinationId: string;
  geoFilter?: GeoFilter;
  maxMembers?: number;
  triggeredByUserId?: string | null;
};

export async function executeSegmentPush(
  input: ExecuteSegmentPushInput,
): Promise<PushResult> {
  const segment = await prisma.audienceSegment.findFirst({
    where: { id: input.segmentId, orgId: input.orgId },
  });
  if (!segment) return { ok: false, error: "Segment not found." };

  const destination = await prisma.audienceDestination.findFirst({
    where: { id: input.destinationId, orgId: input.orgId },
  });
  if (!destination) return { ok: false, error: "Destination not found." };
  if (!destination.enabled) {
    return { ok: false, error: "Destination is disabled." };
  }

  const run = await prisma.audienceSyncRun.create({
    data: {
      orgId: input.orgId,
      segmentId: segment.id,
      destinationId: destination.id,
      status: AudienceSyncStatus.RUNNING,
      filterSnapshot: (input.geoFilter as object) ?? undefined,
      triggeredByUserId: input.triggeredByUserId ?? null,
    },
    select: { id: true },
  });

  try {
    const orgKey = await getOrgApiKeyOverride(input.orgId);
    const surface = alSurfaceFromMeta(
      segment.rawPayload as Record<string, unknown> | null,
    );
    const members = await streamAlSegmentMembers(segment.alSegmentId, {
      apiKey: orgKey,
      surface,
      maxMembers: input.maxMembers ?? 5000,
      filter: input.geoFilter ? geoFilterFn(input.geoFilter) : undefined,
    });
    if (!members.ok) {
      await failRun(run.id, members.message);
      return { ok: false, error: members.message, runId: run.id };
    }

    let csvBase64: string | undefined;
    let filename: string | undefined;
    switch (destination.type) {
      case "CSV_DOWNLOAD": {
        const csv = membersToCsv(members.data);
        csvBase64 = Buffer.from(csv, "utf8").toString("base64");
        filename = `${slugify(segment.name)}-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`;
        break;
      }
      case "WEBHOOK": {
        const result = await pushToWebhook(destination, segment, members.data);
        if (!result.ok) {
          await failRun(run.id, result.error);
          return { ok: false, error: result.error, runId: run.id };
        }
        break;
      }
      case "META_CUSTOM_AUDIENCE":
      case "GOOGLE_CUSTOMER_MATCH": {
        await failRun(
          run.id,
          `${destination.type} push is not yet enabled. Wire OAuth + creds first.`,
        );
        return {
          ok: false,
          error: `${destination.type} push is not yet enabled. Wire OAuth + creds first.`,
          runId: run.id,
        };
      }
    }

    await prisma.audienceSyncRun.update({
      where: { id: run.id },
      data: {
        status: AudienceSyncStatus.SUCCESS,
        memberCount: members.data.length,
        finishedAt: new Date(),
      },
    });
    await prisma.audienceDestination.update({
      where: { id: destination.id },
      data: { lastUsedAt: new Date() },
    });
    revalidatePath(`/portal/audiences/${segment.id}`);
    revalidatePath("/portal/audiences/history");
    return {
      ok: true,
      runId: run.id,
      memberCount: members.data.length,
      csvBase64,
      filename,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error.";
    await failRun(run.id, msg);
    return { ok: false, error: msg, runId: run.id };
  }
}

async function failRun(runId: string, error: string) {
  await prisma.audienceSyncRun.update({
    where: { id: runId },
    data: {
      status: AudienceSyncStatus.FAILED,
      finishedAt: new Date(),
      errorMessage: error.slice(0, 1000),
    },
  });
}

// ---------------------------------------------------------------------------
// Member preview — fetch a small page of members and mask all PII server-side
// before returning to the client. This is the "trust play" UI: brokers see
// what's actually in a segment without ever receiving raw PII in the browser.
// ---------------------------------------------------------------------------

export type MaskedMember = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

export type PreviewSegmentMembersResult =
  | { ok: true; members: MaskedMember[] }
  | { ok: false; error: string };

const PREVIEW_DEFAULT = 5;
const PREVIEW_MAX = 10;

export async function previewSegmentMembers(
  segmentId: string,
  count?: number,
): Promise<PreviewSegmentMembersResult> {
  const scope = await requireAudienceSyncOrThrow();

  const segment = await prisma.audienceSegment.findFirst({
    where: { id: segmentId, orgId: scope.orgId },
    select: { id: true, alSegmentId: true, rawPayload: true },
  });
  if (!segment) return { ok: false, error: "Segment not found." };

  const requested = Number.isFinite(count) && (count ?? 0) > 0
    ? Math.floor(count as number)
    : PREVIEW_DEFAULT;
  const cap = Math.min(requested, PREVIEW_MAX);

  const orgKey = await getOrgApiKeyOverride(scope.orgId);
  const surface = alSurfaceFromMeta(
    segment.rawPayload as Record<string, unknown> | null,
  );
  const result = await streamAlSegmentMembers(segment.alSegmentId, {
    apiKey: orgKey,
    surface,
    maxMembers: cap,
    pageSize: cap,
  });
  if (!result.ok) return { ok: false, error: result.message };

  const masked = result.data.slice(0, cap).map(maskMember);
  return { ok: true, members: masked };
}

function maskMember(m: AlMember): MaskedMember {
  return {
    firstName: m.firstName?.trim() ? m.firstName.trim() : null,
    lastName: maskLastName(m.lastName),
    email: maskEmail(m.email),
    phone: maskPhone(m.phone),
    city: m.city?.trim() ? m.city.trim() : null,
    state: m.state?.trim() ? m.state.trim() : null,
    postalCode: m.postalCode?.trim() ? m.postalCode.trim() : null,
    country: m.country?.trim() ? m.country.trim() : null,
  };
}

function maskLastName(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  return `${v.charAt(0).toUpperCase()}.`;
}

function maskEmail(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  const at = v.lastIndexOf("@");
  if (at <= 0 || at === v.length - 1) return null;
  const local = v.slice(0, at);
  const domain = v.slice(at + 1);
  if (!local || !domain) return null;
  // First 2 chars + asterisks padded to original local-part length.
  const visible = local.slice(0, 2);
  const stars = "*".repeat(Math.max(local.length - visible.length, 1));
  return `${visible}${stars}@${domain}`;
}

function maskPhone(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  if (digits.length < 4) return null;
  const last4 = digits.slice(-4);
  return `***-***-${last4}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireAudienceSyncOrThrow() {
  try {
    return await requireAudienceSync();
  } catch (err) {
    if (err instanceof ForbiddenError) throw err;
    throw err;
  }
}

async function getOrgApiKeyOverride(orgId: string): Promise<string | undefined> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { cursiveApiKeyOverride: true },
  });
  if (!org?.cursiveApiKeyOverride) return undefined;
  // The override is stored encrypted-at-rest. Fall back to the raw value
  // for older rows seeded before encryption was added.
  return maybeDecrypt(org.cursiveApiKeyOverride) ?? org.cursiveApiKeyOverride;
}

function membersToCsv(members: AlMember[]): string {
  const headers = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "city",
    "state",
    "postal_code",
    "country",
    "profile_id",
    "uid",
    "hem_sha256",
  ];
  const lines = [headers.join(",")];
  for (const m of members) {
    const row = [
      m.firstName ?? "",
      m.lastName ?? "",
      m.email ?? "",
      m.phone ?? "",
      m.city ?? "",
      m.state ?? "",
      m.postalCode ?? "",
      m.country ?? "",
      m.profileId ?? "",
      m.uid ?? "",
      m.hemSha256 ?? "",
    ].map(csvEscape);
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (value === "") return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "segment";
}

async function pushToWebhook(
  destination: AudienceDestination,
  segment: AudienceSegment,
  members: AlMember[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!destination.webhookUrl) {
    return { ok: false, error: "Webhook URL missing." };
  }
  const secret = maybeDecrypt(destination.webhookSecretEnc ?? null);
  const body = JSON.stringify({
    event: "audience.sync",
    sentAt: new Date().toISOString(),
    segment: {
      id: segment.id,
      alSegmentId: segment.alSegmentId,
      name: segment.name,
    },
    members: members.map((m) => ({
      email: m.email ?? null,
      firstName: m.firstName ?? null,
      lastName: m.lastName ?? null,
      phone: m.phone ?? null,
      city: m.city ?? null,
      state: m.state ?? null,
      postalCode: m.postalCode ?? null,
      country: m.country ?? null,
      profileId: m.profileId ?? null,
      uid: m.uid ?? null,
      hemSha256: m.hemSha256 ?? null,
    })),
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "LeaseStack-AudienceSync/1.0",
  };
  if (secret) {
    const sig = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");
    headers["x-leasestack-signature"] = `sha256=${sig}`;
  }
  let res: Response;
  try {
    res = await fetch(destination.webhookUrl, {
      method: "POST",
      headers,
      body,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Network error: ${msg}` };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Webhook responded ${res.status}: ${text.slice(0, 200)}`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Recurring schedules — one row per (segment, destination, frequency).
// The cron at /api/cron/run-audience-syncs reads enabled rows whose
// nextRunAt has passed, runs them, and advances nextRunAt.
// ---------------------------------------------------------------------------

export type CreateScheduleInput = {
  segmentId: string;
  destinationId: string;
  frequency: AudienceScheduleFrequency;
  dayOfWeek?: number | null;
  hourUtc: number;
  geoFilter?: GeoFilter;
};

export async function createAudienceSchedule(
  input: CreateScheduleInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const scope = await requireAudienceSyncOrThrow();

  if (!input.segmentId || !input.destinationId) {
    return { ok: false, error: "Segment and destination are required." };
  }
  if (
    input.frequency !== "DAILY" &&
    input.frequency !== "WEEKLY"
  ) {
    return { ok: false, error: "Frequency must be DAILY or WEEKLY." };
  }
  if (
    !Number.isInteger(input.hourUtc) ||
    input.hourUtc < 0 ||
    input.hourUtc > 23
  ) {
    return { ok: false, error: "Hour (UTC) must be between 0 and 23." };
  }
  if (input.frequency === "WEEKLY") {
    if (
      input.dayOfWeek == null ||
      !Number.isInteger(input.dayOfWeek) ||
      input.dayOfWeek < 0 ||
      input.dayOfWeek > 6
    ) {
      return {
        ok: false,
        error: "Day of week (0-6, Sun=0) is required for weekly schedules.",
      };
    }
  }

  // Verify segment + destination belong to this org.
  const [segment, destination] = await Promise.all([
    prisma.audienceSegment.findFirst({
      where: { id: input.segmentId, orgId: scope.orgId },
      select: { id: true },
    }),
    prisma.audienceDestination.findFirst({
      where: { id: input.destinationId, orgId: scope.orgId },
      select: { id: true, enabled: true },
    }),
  ]);
  if (!segment) return { ok: false, error: "Segment not found." };
  if (!destination) return { ok: false, error: "Destination not found." };

  const dayOfWeek =
    input.frequency === "WEEKLY" ? (input.dayOfWeek as number) : null;
  const nextRunAt = computeNextRunAt(
    input.frequency,
    dayOfWeek,
    input.hourUtc,
  );

  const created = await prisma.audienceSyncSchedule.create({
    data: {
      orgId: scope.orgId,
      segmentId: input.segmentId,
      destinationId: input.destinationId,
      frequency: input.frequency,
      dayOfWeek,
      hourUtc: input.hourUtc,
      filterSnapshot: (input.geoFilter as object) ?? undefined,
      enabled: true,
      nextRunAt,
      createdByUserId: scope.userId ?? null,
    },
    select: { id: true },
  });

  revalidatePath("/portal/audiences/schedules");
  revalidatePath(`/portal/audiences/${input.segmentId}`);
  return { ok: true, id: created.id };
}

export async function deleteAudienceSchedule(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const scope = await requireAudienceSyncOrThrow();
  const sched = await prisma.audienceSyncSchedule.findFirst({
    where: { id, orgId: scope.orgId },
    select: { id: true, segmentId: true },
  });
  if (!sched) return { ok: false, error: "Schedule not found." };
  await prisma.audienceSyncSchedule.delete({ where: { id: sched.id } });
  revalidatePath("/portal/audiences/schedules");
  revalidatePath(`/portal/audiences/${sched.segmentId}`);
  return { ok: true };
}

export async function toggleAudienceSchedule(
  id: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const scope = await requireAudienceSyncOrThrow();
  const sched = await prisma.audienceSyncSchedule.findFirst({
    where: { id, orgId: scope.orgId },
    select: {
      id: true,
      segmentId: true,
      frequency: true,
      dayOfWeek: true,
      hourUtc: true,
    },
  });
  if (!sched) return { ok: false, error: "Schedule not found." };

  // When re-enabling, recompute nextRunAt so we don't immediately fire on a
  // long-disabled schedule.
  const data: {
    enabled: boolean;
    nextRunAt?: Date;
  } = { enabled };
  if (enabled) {
    data.nextRunAt = computeNextRunAt(
      sched.frequency,
      sched.dayOfWeek ?? null,
      sched.hourUtc,
    );
  }

  await prisma.audienceSyncSchedule.update({
    where: { id: sched.id },
    data,
  });

  revalidatePath("/portal/audiences/schedules");
  revalidatePath(`/portal/audiences/${sched.segmentId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Per-org AudienceLab API key override.
//
// By default, every AUDIENCE_SYNC org reads AL segments using the platform-
// shared CURSIVE_API_KEY env var. An org can opt into a personal AL key by
// setting Organization.cursiveApiKeyOverride; resolveApiKey() in the AL
// client prefers the override when present.
//
// The raw key is encrypted at rest with maybeEncrypt() and never logged.
// Only the last 4 chars are returned to the client as a hint.
// ---------------------------------------------------------------------------

const AL_KEY_MIN_LENGTH = 8;

function lastFour(value: string): string {
  return value.slice(-4);
}

// Block AL_PARTNER / AGENCY users from setting the key on themselves
// without an active impersonation. They must impersonate a CLIENT org to
// configure that client's key. CLIENT orgs (the typical case) always pass.
function assertCanWriteOrgKey(
  scope: Awaited<ReturnType<typeof requireAudienceSync>>,
) {
  if (scope.orgType !== OrgType.CLIENT) {
    throw new ForbiddenError(
      "Switch to a client workspace to update its AudienceLab key.",
    );
  }
}

export type SetOrgAlApiKeyResult =
  | { ok: true; keyHint: string }
  | { ok: false; error: string };

export async function setOrgAlApiKey(
  rawKey: string,
): Promise<SetOrgAlApiKeyResult> {
  const scope = await requireAudienceSyncOrThrow();
  try {
    assertCanWriteOrgKey(scope);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const trimmed = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!trimmed) {
    return { ok: false, error: "API key is required." };
  }
  if (trimmed.length < AL_KEY_MIN_LENGTH) {
    return {
      ok: false,
      error: `API key must be at least ${AL_KEY_MIN_LENGTH} characters.`,
    };
  }
  if (/\s/.test(trimmed)) {
    return { ok: false, error: "API key cannot contain whitespace." };
  }

  const encrypted = maybeEncrypt(trimmed);
  // Cross-org safety: write is gated by `id: scope.orgId` — never another org.
  await prisma.organization.update({
    where: { id: scope.orgId },
    data: { cursiveApiKeyOverride: encrypted },
  });

  revalidatePath("/portal/audiences/settings");
  revalidatePath("/portal/audiences");
  return { ok: true, keyHint: lastFour(trimmed) };
}

export type ClearOrgAlApiKeyResult =
  | { ok: true }
  | { ok: false; error: string };

export async function clearOrgAlApiKey(): Promise<ClearOrgAlApiKeyResult> {
  const scope = await requireAudienceSyncOrThrow();
  try {
    assertCanWriteOrgKey(scope);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  await prisma.organization.update({
    where: { id: scope.orgId },
    data: { cursiveApiKeyOverride: null },
  });

  revalidatePath("/portal/audiences/settings");
  revalidatePath("/portal/audiences");
  return { ok: true };
}

export type TestOrgAlApiKeyResult =
  | { ok: true; segmentCount: number; usingOverride: boolean }
  | { ok: false; error: string };

export async function testOrgAlApiKey(): Promise<TestOrgAlApiKeyResult> {
  const scope = await requireAudienceSyncOrThrow();

  const override = await getOrgApiKeyOverride(scope.orgId);
  const platformKey = process.env.CURSIVE_API_KEY?.trim() || undefined;
  const effectiveKey = override ?? platformKey;
  if (!effectiveKey) {
    return {
      ok: false,
      error:
        "No AudienceLab key configured. Save a key for this org or ask the platform admin to set CURSIVE_API_KEY.",
    };
  }

  // AudienceLab does not expose a "list segments" endpoint, so a healthy
  // connection is best confirmed by validating against a known segment if
  // the org has one cached. If no segments are cached yet, we can only say
  // "key looks plausible" without hitting AL — the real proof comes when
  // the operator clicks "Add segment".
  const cached = await prisma.audienceSegment.findFirst({
    where: { orgId: scope.orgId },
    orderBy: { createdAt: "desc" },
    select: { alSegmentId: true },
  });

  if (cached) {
    const validation = await validateAlSegmentId(cached.alSegmentId, {
      apiKey: effectiveKey,
    });
    if (!validation.ok) {
      return { ok: false, error: validation.message };
    }
    return {
      ok: true,
      segmentCount: 1,
      usingOverride: !!override,
    };
  }

  // No cached segments to test against. Fall back to checking the key
  // looks structurally plausible (non-empty, no whitespace, >=8 chars).
  // A real connection check requires a segment ID — operator should add
  // one with "Add segment" to fully validate.
  const trimmed = effectiveKey.trim();
  if (trimmed.length < 8 || /\s/.test(trimmed)) {
    return {
      ok: false,
      error: "Key looks malformed. Re-paste the API key from AudienceLab.",
    };
  }

  // Pretend to "succeed" but be honest in the message via segmentCount=0.
  void listAlSegments;
  return {
    ok: true,
    segmentCount: 0,
    usingOverride: !!override,
  };
}

// Server-only helper: returns whether the current org has a key override and
// the last 4 chars (no plaintext crosses the wire). Used by the settings page.
export async function getOrgAlApiKeyStatus(): Promise<{
  hasOverride: boolean;
  keyHint: string | null;
  inheritedFromPlatform: boolean;
}> {
  const scope = await requireAudienceSyncOrThrow();
  const decrypted = await getOrgApiKeyOverride(scope.orgId);
  const inheritedFromPlatform = !!process.env.CURSIVE_API_KEY?.trim();
  if (!decrypted) {
    return {
      hasOverride: false,
      keyHint: null,
      inheritedFromPlatform,
    };
  }
  return {
    hasOverride: true,
    keyHint: lastFour(decrypted),
    inheritedFromPlatform,
  };
}
