"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { ForbiddenError, requireAudienceSync } from "@/lib/tenancy/scope";
import { encrypt, maybeDecrypt } from "@/lib/crypto";
import {
  geoFilterFn,
  listAlSegments,
  streamAlSegmentMembers,
  type AlMember,
  type GeoFilter,
} from "@/lib/integrations/al-segments";
import {
  AudienceDestinationType,
  AudienceSyncStatus,
  type AudienceDestination,
  type AudienceSegment,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Refresh segments — pull AL's segment list and upsert into the cache.
// Called from the dashboard "Refresh" button and on first load when the
// org has no cached segments yet.
// ---------------------------------------------------------------------------

export type RefreshSegmentsResult =
  | { ok: true; total: number; created: number; updated: number }
  | { ok: false; error: string };

export async function refreshAudienceSegments(): Promise<RefreshSegmentsResult> {
  const scope = await requireAudienceSyncOrThrow();
  const orgKey = await getOrgApiKeyOverride(scope.orgId);
  // Page through segments; cap at 200 for the first cut
  const allSegments: Array<{
    id: string;
    name: string;
    description?: string;
    memberCount?: number;
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
    allSegments.push(...result.data);
    if (result.data.length < 50) break;
    page++;
  }

  let created = 0;
  let updated = 0;
  for (const seg of allSegments) {
    const existing = await prisma.audienceSegment.findUnique({
      where: { orgId_alSegmentId: { orgId: scope.orgId, alSegmentId: seg.id } },
      select: { id: true },
    });
    if (existing) {
      await prisma.audienceSegment.update({
        where: { id: existing.id },
        data: {
          name: seg.name,
          description: seg.description ?? null,
          memberCount: seg.memberCount ?? 0,
          rawPayload: seg.raw as object,
          lastFetchedAt: new Date(),
        },
      });
      updated++;
    } else {
      await prisma.audienceSegment.create({
        data: {
          orgId: scope.orgId,
          alSegmentId: seg.id,
          name: seg.name,
          description: seg.description ?? null,
          memberCount: seg.memberCount ?? 0,
          rawPayload: seg.raw as object,
          lastFetchedAt: new Date(),
        },
      });
      created++;
    }
  }
  revalidatePath("/portal/audiences");
  return { ok: true, total: allSegments.length, created, updated };
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

  const segment = await prisma.audienceSegment.findFirst({
    where: { id: input.segmentId, orgId: scope.orgId },
  });
  if (!segment) return { ok: false, error: "Segment not found." };

  const destination = await prisma.audienceDestination.findFirst({
    where: { id: input.destinationId, orgId: scope.orgId },
  });
  if (!destination) return { ok: false, error: "Destination not found." };
  if (!destination.enabled) {
    return { ok: false, error: "Destination is disabled." };
  }

  const run = await prisma.audienceSyncRun.create({
    data: {
      orgId: scope.orgId,
      segmentId: segment.id,
      destinationId: destination.id,
      status: AudienceSyncStatus.RUNNING,
      filterSnapshot: (input.geoFilter as object) ?? undefined,
      triggeredByUserId: scope.userId,
    },
    select: { id: true },
  });

  try {
    const orgKey = await getOrgApiKeyOverride(scope.orgId);
    const members = await streamAlSegmentMembers(segment.alSegmentId, {
      apiKey: orgKey,
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
    select: { id: true, alSegmentId: true },
  });
  if (!segment) return { ok: false, error: "Segment not found." };

  const requested = Number.isFinite(count) && (count ?? 0) > 0
    ? Math.floor(count as number)
    : PREVIEW_DEFAULT;
  const cap = Math.min(requested, PREVIEW_MAX);

  const orgKey = await getOrgApiKeyOverride(scope.orgId);
  const result = await streamAlSegmentMembers(segment.alSegmentId, {
    apiKey: orgKey,
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
