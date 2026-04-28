"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAgency, ForbiddenError, auditPayload } from "@/lib/tenancy/scope";
import { AuditAction, PixelRequestStatus, Prisma } from "@prisma/client";
import { sendPixelReadyCustomerEmail } from "@/lib/email/pixel-emails";

// ---------------------------------------------------------------------------
// Agency-only Cursive (AudienceLab) integration management.
//
// V4 pixels are provisioned in the AudienceLab UI, not via API. The agency
// pastes the pixel ID + segment ID here so:
//   - Incoming webhook events at /api/webhooks/cursive route to the right
//     tenant via cursivePixelId match
//   - The "Sync from segment" button can pull resolved visitors from the
//     AudienceLab REST API (POST /segments/{id}) to backfill / reconcile
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  orgId: z.string().min(1),
  cursivePixelId: z.string().trim().max(120).optional().nullable(),
  cursiveSegmentId: z.string().trim().max(120).optional().nullable(),
  installedOnDomain: z.string().trim().max(253).optional().nullable(),
});

export type SaveCursiveResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveCursiveSettings(
  raw: unknown,
): Promise<SaveCursiveResult> {
  let scope;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { orgId, cursivePixelId, cursiveSegmentId, installedOnDomain } =
    parsed.data;

  const target = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!target) return { ok: false, error: "Tenant not found" };

  const previous = await prisma.cursiveIntegration.findUnique({
    where: { orgId },
    select: {
      cursivePixelId: true,
      cursiveSegmentId: true,
      installedOnDomain: true,
    },
  });

  await prisma.cursiveIntegration.upsert({
    where: { orgId },
    create: {
      orgId,
      cursivePixelId: cursivePixelId || null,
      cursiveSegmentId: cursiveSegmentId || null,
      installedOnDomain: installedOnDomain || null,
      provisionedAt: cursivePixelId ? new Date() : null,
    },
    update: {
      cursivePixelId: cursivePixelId || null,
      cursiveSegmentId: cursiveSegmentId || null,
      installedOnDomain: installedOnDomain || null,
      provisionedAt:
        cursivePixelId && !previous?.cursivePixelId
          ? new Date()
          : undefined,
    },
  });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId },
      {
        action: AuditAction.SETTING_CHANGE,
        entityType: "CursiveIntegration",
        entityId: orgId,
        description: `Cursive settings updated by ${scope.email}`,
        diff: {
          from: previous ?? null,
          to: { cursivePixelId, cursiveSegmentId, installedOnDomain },
        },
      },
    ),
  });

  // Auto-fulfillment: if this save just introduced a pixel_id where there
  // wasn't one before, mark any pending PixelProvisionRequest fulfilled and
  // email the customer their install snippet.
  const transitionedToFulfilled =
    !!cursivePixelId && !previous?.cursivePixelId;
  if (transitionedToFulfilled) {
    await fulfillPendingRequests({
      orgId,
      pixelId: cursivePixelId,
    });
  }

  revalidatePath(`/admin/clients/${orgId}`);
  revalidatePath("/admin/pixel-requests");
  return { ok: true };
}

async function fulfillPendingRequests(args: {
  orgId: string;
  pixelId: string;
}): Promise<void> {
  const pending = await prisma.pixelProvisionRequest.findMany({
    where: { orgId: args.orgId, status: PixelRequestStatus.PENDING },
    select: { id: true, requestedByUserId: true, websiteUrl: true },
  });
  if (pending.length === 0) return;

  await prisma.pixelProvisionRequest.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: {
      status: PixelRequestStatus.FULFILLED,
      fulfilledAt: new Date(),
      fulfilledPixelId: args.pixelId,
    },
  });

  // Look up requester emails so we can notify each one. Org primary contact
  // is the fallback if the original requester user no longer exists.
  const requesterIds = pending
    .map((p) => p.requestedByUserId)
    .filter((id): id is string => Boolean(id));
  const [requesters, org] = await Promise.all([
    requesterIds.length
      ? prisma.user.findMany({
          where: { id: { in: requesterIds } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : Promise.resolve(
          [] as Array<{
            id: string;
            email: string;
            firstName: string | null;
            lastName: string | null;
          }>,
        ),
    prisma.organization.findUnique({
      where: { id: args.orgId },
      select: { primaryContactEmail: true, primaryContactName: true, name: true },
    }),
  ]);
  const userById = new Map(requesters.map((u) => [u.id, u]));

  const installSnippet = buildInstallSnippet(args.pixelId);

  for (const p of pending) {
    const user = p.requestedByUserId
      ? userById.get(p.requestedByUserId)
      : undefined;
    const userName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
      : "";
    const to = user?.email ?? org?.primaryContactEmail ?? null;
    const customerName =
      userName || org?.primaryContactName || org?.name || "there";
    if (!to) continue;
    void sendPixelReadyCustomerEmail({
      to,
      customerName,
      websiteUrl: p.websiteUrl,
      installSnippet,
    }).catch(() => undefined);
  }
}

function buildInstallSnippet(pixelId: string): string {
  // AudienceLab serves the V4 pixel script keyed by pixel_id. We mirror the
  // shape the AL UI hands operators today; if AL changes the canonical URL
  // we update this single helper.
  return `<script async src="https://api.audiencelab.io/pixel/${pixelId}.js"></script>`;
}

// ---------------------------------------------------------------------------
// Sync from segment — pulls resolved visitors from the AudienceLab segments
// REST API and feeds them through the same processing path as the webhook.
// Useful for backfill, reconciliation, or pulling pre-pixel-install history.
// ---------------------------------------------------------------------------

const AL_BASE = process.env.CURSIVE_API_URL ?? "https://api.audiencelab.io";
const PAGE_SIZE = 50;
const MAX_PAGES = 20; // safety cap; ~1000 resolutions per sync

export type SyncSegmentResult =
  | { ok: true; pulled: number; created: number; updated: number }
  | { ok: false; error: string };

export async function syncCursiveSegment(
  orgId: string,
): Promise<SyncSegmentResult> {
  let scope;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const integration = await prisma.cursiveIntegration.findUnique({
    where: { orgId },
    select: { cursiveSegmentId: true, installedOnDomain: true },
  });
  if (!integration?.cursiveSegmentId) {
    return {
      ok: false,
      error: "No cursiveSegmentId set on this tenant. Bind one first.",
    };
  }

  const apiKey = process.env.CURSIVE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "CURSIVE_API_KEY env var not configured on the server.",
    };
  }

  let pulled = 0;
  let created = 0;
  let updated = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${AL_BASE}/segments/${encodeURIComponent(integration.cursiveSegmentId)}?page=${page}&page_size=${PAGE_SIZE}`;
    const res = await fetch(url, {
      headers: { "X-Api-Key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Cursive segment fetch failed (${res.status}): ${body.slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as Record<string, unknown>;
    const items = extractItems(json);
    if (items.length === 0) break;

    for (const item of items) {
      pulled++;
      const result = await upsertResolutionAsVisitor(
        orgId,
        item,
        integration.installedOnDomain,
      );
      if (result === "created") created++;
      else if (result === "updated") updated++;
    }

    if (items.length < PAGE_SIZE) break;
  }

  await prisma.cursiveIntegration.update({
    where: { orgId },
    data: { lastSegmentSyncAt: new Date() },
  });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId },
      {
        action: AuditAction.SETTING_CHANGE,
        entityType: "CursiveIntegration",
        entityId: orgId,
        description: `Synced ${pulled} resolutions from Cursive segment`,
        diff: { pulled, created, updated },
      },
    ),
  });

  revalidatePath(`/admin/clients/${orgId}`);
  return { ok: true, pulled, created, updated };
}

function extractItems(json: Record<string, unknown>): Array<Record<string, unknown>> {
  // AudienceLab segments responses we've seen come back in a few shapes.
  const candidates: unknown[] = [
    json.results,
    json.data,
    json.result,
    json.items,
    json.resolutions,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c.filter(
        (x): x is Record<string, unknown> =>
          typeof x === "object" && x !== null,
      );
    }
  }
  return [];
}

async function upsertResolutionAsVisitor(
  orgId: string,
  item: Record<string, unknown>,
  installedOnDomain: string | null,
): Promise<"created" | "updated" | "skipped"> {
  const profileId = pickString(item, "profile_id", "id");
  const uid = pickString(item, "uid");
  const cookieId = pickString(item, "cookie_id");
  const hemSha256 = pickString(item, "hem_sha256");
  const emailRaw = pickString(item, "email_raw", "email", "PERSONAL_EMAIL");
  const normalizedEmail = emailRaw ? emailRaw.toLowerCase().trim() : null;
  const firstName = pickString(item, "FIRST_NAME", "first_name", "firstName");
  const lastName = pickString(item, "LAST_NAME", "last_name", "lastName");
  const phone = pickString(
    item,
    "MOBILE_PHONE",
    "PERSONAL_PHONE",
    "phone",
  );

  const identity = profileId ?? uid ?? hemSha256 ?? cookieId;
  if (!identity && !normalizedEmail) return "skipped";

  const orClauses: Prisma.VisitorWhereInput[] = [];
  if (identity) orClauses.push({ cursiveVisitorId: identity });
  if (normalizedEmail) orClauses.push({ email: normalizedEmail });
  if (hemSha256) orClauses.push({ hashedEmail: hemSha256 });

  const existing = await prisma.visitor.findFirst({
    where: { orgId, OR: orClauses },
  });

  if (existing) {
    await prisma.visitor.update({
      where: { id: existing.id },
      data: {
        cursiveVisitorId: identity ?? existing.cursiveVisitorId ?? undefined,
        firstName: firstName ?? existing.firstName ?? undefined,
        lastName: lastName ?? existing.lastName ?? undefined,
        email: normalizedEmail ?? existing.email ?? undefined,
        phone: phone ?? existing.phone ?? undefined,
        hashedEmail: hemSha256 ?? existing.hashedEmail ?? undefined,
        enrichedData: item as unknown as Prisma.InputJsonValue,
        lastSeenAt: new Date(),
        status:
          firstName && lastName && normalizedEmail
            ? "IDENTIFIED"
            : existing.status,
      },
    });
    return "updated";
  }

  await prisma.visitor.create({
    data: {
      orgId,
      cursiveVisitorId: identity ?? `seg:${normalizedEmail ?? Date.now()}`,
      hashedEmail: hemSha256 ?? null,
      status:
        firstName && lastName && normalizedEmail ? "IDENTIFIED" : "ANONYMOUS",
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      email: normalizedEmail,
      phone: phone ?? null,
      enrichedData: item as unknown as Prisma.InputJsonValue,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      sessionCount: 1,
      totalTimeSeconds: 0,
      referrer: installedOnDomain,
      intentScore: firstName && lastName && normalizedEmail ? 70 : 30,
    },
  });
  return "created";
}

function pickString(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}
