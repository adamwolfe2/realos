"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { sendPixelRequestOpsEmail } from "@/lib/email/pixel-emails";
import { OrgType, PixelRequestStatus } from "@prisma/client";

// Portal-side Cursive (AudienceLab) pixel server actions.
//
// AudienceLab does not expose a programmatic pixel-creation API — pixels are
// created in the AL dashboard. So `connectPixel` queues a request that ops
// fulfills manually; the customer is told upfront that we'll email them when
// the pixel is live (typically within one business day). `disconnectPixel`
// just clears the integration row and any pending request — nothing to call
// upstream.

const PORTAL_PATH = "/portal/settings/integrations";

const connectSchema = z.object({
  websiteName: z
    .string()
    .trim()
    .min(1, "Website name is required")
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  websiteUrl: z
    .string()
    .trim()
    .min(1, "Website URL is required")
    .max(500),
  // Optional LeaseStack property scope. Empty / unset = legacy
  // org-wide pixel (current behavior for single-property tenants).
  // Multi-property tenants pass the chosen property id so each
  // domain's pixel ends up on its own row.
  leasestackPropertyId: z
    .string()
    .trim()
    .max(60)
    .optional()
    .nullable(),
});

export type ConnectPixelResult =
  | { ok: true; queued?: boolean }
  | { ok: false; error: string };

function normalizeUrl(raw: string): URL {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return new URL(withScheme);
}

async function requireClientScope() {
  const scope = await requireScope();
  if (scope.orgType !== OrgType.CLIENT) {
    throw new ForbiddenError("Client context required");
  }
  return scope;
}

export async function connectPixel(
  formData: FormData
): Promise<ConnectPixelResult> {
  let scope;
  try {
    scope = await requireClientScope();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not authorized",
    };
  }

  const parsed = connectSchema.safeParse({
    websiteName: formData.get("websiteName")?.toString() ?? "",
    websiteUrl: formData.get("websiteUrl")?.toString() ?? "",
    leasestackPropertyId:
      formData.get("leasestackPropertyId")?.toString() || null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let websiteUrl: URL;
  try {
    websiteUrl = normalizeUrl(parsed.data.websiteUrl);
  } catch {
    return { ok: false, error: "Please enter a valid website URL." };
  }
  if (websiteUrl.protocol !== "https:" && websiteUrl.protocol !== "http:") {
    return { ok: false, error: "Website URL must be http or https." };
  }

  // Resolve target propertyId for this connection. Empty / unset =
  // legacy org-wide row. Validate the id belongs to the caller's org;
  // a bogus id silently downgrades to NULL rather than failing the
  // request.
  const requestedPropertyId =
    parsed.data.leasestackPropertyId &&
    parsed.data.leasestackPropertyId.length > 0
      ? parsed.data.leasestackPropertyId
      : null;
  let scopePropertyId: string | null = null;
  if (requestedPropertyId) {
    const found = await prisma.property.findFirst({
      where: { id: requestedPropertyId, orgId: scope.orgId },
      select: { id: true },
    });
    if (found) scopePropertyId = found.id;
  }

  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: {
      id: true,
      name: true,
      modulePixel: true,
      moduleChatbot: true,
      // Pull only the row matching the chosen scope so the duplicate-
      // pixel check is scope-aware: a pixel on Telegraph Commons
      // shouldn't block adding one for Yosemite Avenue.
      cursiveIntegrations: {
        where: { propertyId: scopePropertyId },
        select: { cursivePixelId: true },
        take: 1,
      },
    },
  });
  if (!org) return { ok: false, error: "Organization not found" };
  if (!org.modulePixel && !org.moduleChatbot) {
    return {
      ok: false,
      error:
        "Pixel module is not enabled for your workspace. Contact your account manager.",
    };
  }
  if (org.cursiveIntegrations[0]?.cursivePixelId) {
    return {
      ok: false,
      error: scopePropertyId
        ? "A pixel is already connected for this property."
        : "A pixel is already connected for this workspace.",
    };
  }

  const websiteName = parsed.data.websiteName ?? org.name;

  // Look up the requesting user's email so ops can reply directly.
  const user = await prisma.user.findUnique({
    where: { id: scope.userId },
    select: { id: true, email: true },
  });

  // Idempotent: if a pending request already exists for this org we just
  // return success rather than queueing duplicates.
  const existing = await prisma.pixelProvisionRequest.findFirst({
    where: { orgId: org.id, status: PixelRequestStatus.PENDING },
    select: { id: true },
  });

  let requestId = existing?.id;
  if (!existing) {
    const created = await prisma.pixelProvisionRequest.create({
      data: {
        orgId: org.id,
        websiteName,
        websiteUrl: websiteUrl.toString(),
        requestedByUserId: user?.id ?? null,
      },
      select: { id: true },
    });
    requestId = created.id;

    // Best-effort ops notification. Don't fail the request if email is down.
    void sendPixelRequestOpsEmail({
      orgName: org.name,
      orgId: org.id,
      websiteName,
      websiteUrl: websiteUrl.toString(),
      requestedByEmail: user?.email ?? null,
      requestId: created.id,
    }).catch(() => undefined);
  }

  // Pre-create the integration row so installedOnDomain is captured
  // even before ops fulfills. Writes to the row matching the chosen
  // scope: NULL for org-wide, or the validated property id for a
  // per-property connection.
  //
  // Manual find-then-update-or-create instead of upsert because
  // Prisma's compound unique key doesn't accept NULL on the
  // propertyId leg.
  const existingRow = await prisma.cursiveIntegration.findFirst({
    where: { orgId: org.id, propertyId: scopePropertyId },
    select: { id: true },
  });
  if (existingRow) {
    await prisma.cursiveIntegration.update({
      where: { id: existingRow.id },
      data: { installedOnDomain: websiteUrl.hostname },
    });
  } else {
    await prisma.cursiveIntegration.create({
      data: {
        orgId: org.id,
        propertyId: scopePropertyId,
        installedOnDomain: websiteUrl.hostname,
      },
    });
  }

  revalidatePath(PORTAL_PATH);
  return { ok: true, queued: true };
}

export async function disconnectPixel(): Promise<ConnectPixelResult> {
  let scope;
  try {
    scope = await requireClientScope();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not authorized",
    };
  }

  await prisma.$transaction([
    prisma.cursiveIntegration.updateMany({
      where: { orgId: scope.orgId },
      data: {
        cursivePixelId: null,
        pixelScriptUrl: null,
        installedOnDomain: null,
      },
    }),
    prisma.pixelProvisionRequest.updateMany({
      where: { orgId: scope.orgId, status: PixelRequestStatus.PENDING },
      data: { status: PixelRequestStatus.CANCELLED },
    }),
  ]);

  await prisma.organization.update({
    where: { id: scope.orgId },
    data: { modulePixel: false },
  });

  revalidatePath(PORTAL_PATH);
  return { ok: true };
}
