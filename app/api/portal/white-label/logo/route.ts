import { NextRequest, NextResponse } from "next/server";
import { putPublic, delPublic } from "@/lib/blob-public";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { AuditAction, UserRole } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/portal/white-label/logo
//
// Tenant-scoped logo upload for the white-label workspace add-on.
// Multipart upload with a single `file` field. Validates:
//   * image MIME (png / jpeg / svg+xml only — narrower than the chatbot
//     avatar route because the logo gets dropped into the portal chrome
//     and outbound email bodies, where animated GIFs and webp aren't
//     reliably rendered by every mail client)
//   * 2MB max
//   * org has whiteLabel === true (gates the upload to paying customers)
//   * actor is a workspace admin (CLIENT_OWNER / CLIENT_ADMIN / AGENCY_*)
//
// Stores under `white-label/${orgId}/` on Vercel Blob with a random
// suffix. Best-effort deletes the prior blob to avoid orphans. Persists
// the resulting URL on Organization.whiteLabelLogoUrl so the brand
// resolver picks it up immediately.
//
// DELETE removes the URL + best-effort deletes the blob.
// ---------------------------------------------------------------------------

const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
]);

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

const ADMIN_ROLES = new Set<UserRole>([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
]);

async function assertWritable(
  clerkUserId: string,
  orgId: string,
): Promise<NextResponse | null> {
  // Combined entitlement + role check in one round trip.
  const [org, actor] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { whiteLabel: true, whiteLabelLogoUrl: true },
    }),
    prisma.user.findUnique({
      where: { clerkUserId },
      select: { role: true },
    }),
  ]);

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }
  if (!org.whiteLabel) {
    return NextResponse.json(
      {
        error:
          "White-label add-on isn't active. Activate from the marketplace.",
      },
      { status: 402 },
    );
  }
  if (!actor || !ADMIN_ROLES.has(actor.role)) {
    return NextResponse.json(
      { error: "Only workspace admins can manage white-label branding." },
      { status: 403 },
    );
  }
  return null;
}

export async function POST(req: NextRequest) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const denied = await assertWritable(scope.clerkUserId, scope.orgId);
  if (denied) return denied;

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        error:
          "No file provided. Send as multipart/form-data with a `file` field.",
      },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json(
      { error: "Logo too large. Files must be 2MB or smaller." },
      { status: 413 },
    );
  }
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported logo type. Use PNG, JPEG, or SVG." },
      { status: 415 },
    );
  }

  // Best-effort delete of the prior blob so we don't accumulate orphans
  // for orgs that re-upload regularly. Only acts on our own blob domain
  // — externally-hosted logos pasted via the form are left alone.
  const existing = await prisma.organization
    .findUnique({
      where: { id: scope.orgId },
      select: { whiteLabelLogoUrl: true },
    })
    .catch(() => null);
  if (
    existing?.whiteLabelLogoUrl &&
    /\.public\.blob\.vercel-storage\.com\//.test(existing.whiteLabelLogoUrl)
  ) {
    await delPublic(existing.whiteLabelLogoUrl).catch(() => undefined);
  }

  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "logo";
  let blob;
  try {
    blob = await putPublic(`white-label/${scope.orgId}/${safeName}`, file, {
      addRandomSuffix: true,
      contentType: file.type,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await prisma.organization.update({
    where: { id: scope.orgId },
    data: { whiteLabelLogoUrl: blob.url },
  });

  await prisma.auditEvent
    .create({
      data: {
        orgId: scope.orgId,
        userId: scope.userId,
        action: AuditAction.SETTING_CHANGE,
        entityType: "Organization",
        entityId: scope.orgId,
        description: "White-label logo uploaded",
        diff: {
          whiteLabelLogoUrl: blob.url,
          size: file.size,
          type: file.type,
        },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, url: blob.url });
}

export async function DELETE() {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const denied = await assertWritable(scope.clerkUserId, scope.orgId);
  if (denied) return denied;

  const existing = await prisma.organization
    .findUnique({
      where: { id: scope.orgId },
      select: { whiteLabelLogoUrl: true },
    })
    .catch(() => null);

  if (
    existing?.whiteLabelLogoUrl &&
    /\.public\.blob\.vercel-storage\.com\//.test(existing.whiteLabelLogoUrl)
  ) {
    await delPublic(existing.whiteLabelLogoUrl).catch(() => undefined);
  }

  await prisma.organization
    .update({
      where: { id: scope.orgId },
      data: { whiteLabelLogoUrl: null },
    })
    .catch(() => undefined);

  await prisma.auditEvent
    .create({
      data: {
        orgId: scope.orgId,
        userId: scope.userId,
        action: AuditAction.SETTING_CHANGE,
        entityType: "Organization",
        entityId: scope.orgId,
        description: "White-label logo removed",
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true });
}
