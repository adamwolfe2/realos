import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { syncPropertyFromDataforSeo } from "@/lib/seo/sync-orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow up to 60s so a synchronous first scan with 4 SERP calls +
// Lighthouse + backlinks + competitors comfortably fits.
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/portal/seo/scan/[propertyId]
//
// "Connect your website" — operator submits a URL (or leaves blank to
// re-use Property.websiteUrl). We:
//   1. Save the URL to Property.websiteUrl if provided
//   2. Trigger the DataforSEO sync orchestrator synchronously (up to
//      ~30s — auto-derives starter target queries, SERP scan, Lighthouse,
//      backlinks, competitor domains)
//   3. Return the sync stats so the UI can refresh immediately
//
// Tenant-scoped via requireScope + tenantWhere. Property-restricted
// users (UserPropertyAccess) cannot scan a sibling property's URL.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  websiteUrl: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .optional()
    .nullable(),
});

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    // Strip query + hash so the persisted URL is the canonical home.
    return `${u.protocol}//${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ propertyId: string }> },
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

  const { propertyId } = await ctx.params;

  if (scope.allowedPropertyIds && !scope.allowedPropertyIds.includes(propertyId)) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json();
    parsed = bodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...tenantWhere(scope) },
    select: { id: true, orgId: true, websiteUrl: true, name: true },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Persist the URL if the operator provided one. Normalize so we
  // always store https://hostname/path and never a bare domain.
  let websiteUrl = property.websiteUrl;
  if (parsed.websiteUrl !== undefined) {
    const normalized = parsed.websiteUrl
      ? normalizeUrl(parsed.websiteUrl)
      : null;
    if (parsed.websiteUrl && !normalized) {
      return NextResponse.json(
        { error: "Could not parse URL. Use the full https://yourdomain.com." },
        { status: 400 },
      );
    }
    if (normalized !== property.websiteUrl) {
      await prisma.property.update({
        where: { id: property.id },
        data: { websiteUrl: normalized },
      });
      websiteUrl = normalized;
    }
  }

  if (!websiteUrl) {
    return NextResponse.json(
      {
        error:
          "No website URL on file. Provide a websiteUrl in the request body to start the scan.",
      },
      { status: 400 },
    );
  }

  // Run the scan synchronously. Each stage has its own try/catch in the
  // orchestrator so a single failed call doesn't abort the rest. Total
  // wall time typically 10-20s; we cap maxDuration at 60s above.
  const stats = await syncPropertyFromDataforSeo({
    orgId: property.orgId,
    propertyId: property.id,
  });

  return NextResponse.json({
    ok: true,
    websiteUrl,
    stats,
  });
}
