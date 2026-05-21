import { NextRequest, NextResponse } from "next/server";
import { putPublic, delPublic } from "@/lib/blob-public";
import { requireScope, ForbiddenError, tenantWhere } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { AuditAction } from "@prisma/client";
import { removeBackground } from "@/lib/images/remove-bg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/portal/properties/[id]/hero-image
//
// Per-property "profile picture" upload. Operators paste/drop an image of
// the building (a real exterior shot, a render, a lifestyle photo) and we
// store it on Property.heroImageUrl. The dashboard hero banner renders
// this image with a 3D-style drop-shadow + gradient base so the building
// "pops" off the page.
//
// Storage: public Vercel Blob (same store used for chatbot avatars + logos).
// Constraints: 6MB max (hero images are larger than avatars), JPEG / PNG
// / WebP. Tenant-scoped via requireScope() + tenantWhere() — operators
// can only mutate properties in their own org.
//
// Old hero image is best-effort deleted to keep the blob store clean,
// but only when the previous URL belongs to our blob domain (so a
// scraped og:image URL on someone else's CDN is left alone).
//
// DELETE clears Property.heroImageUrl and deletes the blob if we own it.
// ---------------------------------------------------------------------------

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_HERO_BYTES = 6 * 1024 * 1024; // 6MB — exterior building shots are larger than avatars

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const { id } = await ctx.params;

  // Property gate — tenant scope + (if applicable) per-user property
  // access list. A restricted user must not be able to mutate a sibling
  // property's image even by URL hacking.
  if (scope.allowedPropertyIds && !scope.allowedPropertyIds.includes(id)) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const property = await prisma.property.findFirst({
    where: { id, ...tenantWhere(scope) },
    select: { id: true, name: true, heroImageUrl: true },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
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
  if (file.size > MAX_HERO_BYTES) {
    return NextResponse.json(
      { error: "Image too large. Hero images must be 6MB or smaller." },
      { status: 413 },
    );
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use JPEG, PNG, or WebP." },
      { status: 415 },
    );
  }

  // Best-effort delete of the prior blob — only when we own it. Anything
  // pasted as an external URL (scraped og:image, manual paste from a CDN)
  // is left alone.
  if (
    property.heroImageUrl &&
    /\.public\.blob\.vercel-storage\.com\//.test(property.heroImageUrl)
  ) {
    await delPublic(property.heroImageUrl).catch(() => undefined);
  }

  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "hero";

  // Pipe through the background-removal service before persisting so the
  // dashboard hero treatment renders against the building silhouette
  // instead of a rectangular photo. Env-gated: if no provider key is
  // configured, this falls through to the raw upload — the original
  // file gets stored as-is and the operator sees the photo with its
  // background intact.
  let uploadBody: Buffer | File = file;
  let uploadContentType = file.type;
  let uploadName = safeName;
  let backgroundRemoved = false;
  try {
    const originalBytes = Buffer.from(await file.arrayBuffer());
    const bgResult = await removeBackground({
      buffer: originalBytes,
      filename: safeName,
      contentType: file.type,
    });
    if ("ok" in bgResult && bgResult.ok) {
      uploadBody = bgResult.buffer;
      uploadContentType = bgResult.contentType;
      // Re-suffix as .png so the eventual blob URL reads correctly.
      uploadName = safeName.replace(/\.[a-z0-9]+$/i, "") + ".png";
      backgroundRemoved = true;
    } else if ("error" in bgResult && bgResult.error) {
      // Soft failure: log and continue with the raw file. We never
      // block the upload on the BG-removal pipeline.
      console.warn("[hero-image] background removal failed:", bgResult.error);
      uploadBody = originalBytes;
    } else {
      // Skipped (no provider configured). Use the original bytes so we
      // don't re-read the File stream below.
      uploadBody = originalBytes;
    }
  } catch (err) {
    console.warn("[hero-image] background removal threw:", err);
  }

  let blob;
  try {
    blob = await putPublic(
      `property-heroes/${scope.orgId}/${property.id}/${uploadName}`,
      uploadBody,
      { addRandomSuffix: true, contentType: uploadContentType },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Persist + flag the image as operator-curated (resets imageScrapeAt so
  // the nightly og:image scraper doesn't overwrite it on the next run).
  await prisma.property.update({
    where: { id: property.id },
    data: {
      heroImageUrl: blob.url,
      imageScrapeAt: new Date(),
      imageScrapeError: null,
    },
  });

  await prisma.auditEvent
    .create({
      data: {
        orgId: scope.orgId,
        userId: scope.userId,
        action: AuditAction.SETTING_CHANGE,
        entityType: "Property",
        entityId: property.id,
        description: `Hero image uploaded for ${property.name}`,
        diff: {
          heroImageUrl: blob.url,
          size: file.size,
          type: file.type,
          backgroundRemoved,
        },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, url: blob.url, backgroundRemoved });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const { id } = await ctx.params;

  if (scope.allowedPropertyIds && !scope.allowedPropertyIds.includes(id)) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const property = await prisma.property.findFirst({
    where: { id, ...tenantWhere(scope) },
    select: { id: true, name: true, heroImageUrl: true },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  if (
    property.heroImageUrl &&
    /\.public\.blob\.vercel-storage\.com\//.test(property.heroImageUrl)
  ) {
    await delPublic(property.heroImageUrl).catch(() => undefined);
  }

  await prisma.property.update({
    where: { id: property.id },
    data: { heroImageUrl: null },
  });

  await prisma.auditEvent
    .create({
      data: {
        orgId: scope.orgId,
        userId: scope.userId,
        action: AuditAction.SETTING_CHANGE,
        entityType: "Property",
        entityId: property.id,
        description: `Hero image removed for ${property.name}`,
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true });
}
