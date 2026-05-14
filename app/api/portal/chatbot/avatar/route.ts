import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { AuditAction } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/portal/chatbot/avatar
//
// Tenant-scoped image upload for the chatbot persona avatar. Accepts
// multipart/form-data with a single `file` field. Validates: image MIME
// type (jpeg/png/webp/gif), max 2MB. Uploads to Vercel Blob under
// `chatbot-avatars/${orgId}/` with a random suffix so re-uploads don't
// collide. Persists the resulting URL on TenantSiteConfig.chatbotAvatarUrl
// so the embed widget picks it up without the operator having to click
// Save on the config form.
//
// Previous avatar (if any) is best-effort deleted to avoid orphaned blobs
// piling up — only fires when the old URL is on our Vercel Blob domain,
// which keeps the legacy "paste any external URL" path safe.
//
// DELETE removes the persisted avatar URL + the underlying blob.
// ---------------------------------------------------------------------------

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB — generous; avatars are 80x80

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

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided. Send as multipart/form-data with a `file` field." },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      { error: "Image too large. Avatars must be 2MB or smaller." },
      { status: 413 },
    );
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error:
          "Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
      },
      { status: 415 },
    );
  }

  // Best-effort delete of the prior blob so we don't accumulate orphans
  // for orgs that re-upload regularly. Only acts on our own blob domain;
  // anything pasted as an external URL is left alone.
  const existing = await prisma.tenantSiteConfig
    .findUnique({
      where: { orgId: scope.orgId },
      select: { chatbotAvatarUrl: true },
    })
    .catch(() => null);
  if (
    existing?.chatbotAvatarUrl &&
    /\.public\.blob\.vercel-storage\.com\//.test(existing.chatbotAvatarUrl)
  ) {
    await del(existing.chatbotAvatarUrl).catch(() => undefined);
  }

  // Upload with a random suffix so a new file doesn't clobber any
  // cached URL still in flight at the widget edge.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "avatar";
  let blob;
  try {
    blob = await put(`chatbot-avatars/${scope.orgId}/${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Persist immediately so the avatar is live even before the operator
  // clicks Save on the wider config form. Upsert so a brand-new tenant
  // without a TenantSiteConfig row still gets a record created.
  await prisma.tenantSiteConfig.upsert({
    where: { orgId: scope.orgId },
    create: {
      orgId: scope.orgId,
      chatbotAvatarUrl: blob.url,
    },
    update: {
      chatbotAvatarUrl: blob.url,
    },
  });

  await prisma.auditEvent
    .create({
      data: {
        orgId: scope.orgId,
        userId: scope.userId,
        action: AuditAction.SETTING_CHANGE,
        entityType: "TenantSiteConfig",
        entityId: scope.orgId,
        description: "Chatbot avatar uploaded",
        diff: { chatbotAvatarUrl: blob.url, size: file.size, type: file.type },
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

  const existing = await prisma.tenantSiteConfig
    .findUnique({
      where: { orgId: scope.orgId },
      select: { chatbotAvatarUrl: true },
    })
    .catch(() => null);

  if (
    existing?.chatbotAvatarUrl &&
    /\.public\.blob\.vercel-storage\.com\//.test(existing.chatbotAvatarUrl)
  ) {
    await del(existing.chatbotAvatarUrl).catch(() => undefined);
  }

  await prisma.tenantSiteConfig
    .update({
      where: { orgId: scope.orgId },
      data: { chatbotAvatarUrl: "" },
    })
    .catch(() => undefined);

  await prisma.auditEvent
    .create({
      data: {
        orgId: scope.orgId,
        userId: scope.userId,
        action: AuditAction.SETTING_CHANGE,
        entityType: "TenantSiteConfig",
        entityId: scope.orgId,
        description: "Chatbot avatar removed",
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true });
}
