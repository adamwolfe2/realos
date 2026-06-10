import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireWritableWorkspace,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/portal/seo/scan/[propertyId]
//
// "Connect your website" — operator submits a URL (or leaves blank to
// re-use Property.websiteUrl). We:
//   1. Save the URL to Property.websiteUrl if provided
//   2. Enqueue a SeoScanJob row (status=QUEUED) and return 202 with
//      { jobId } immediately
//   3. /api/cron/seo-scan-worker (every minute) claims + drains the
//      queue. Each stage of the orchestrator updates progressStage +
//      progressPct so the UI can render "Querying competitors… (4/10)".
//   4. UI polls /api/portal/seo/scan/[propertyId]/status which returns
//      the latest job row alongside the coverage snapshot.
//
// We never run the orchestrator synchronously here — DataforSEO's
// Lighthouse stage alone routinely takes 30-40s and chained with the
// other 9 calls blows past Vercel's 60s synchronous-route ceiling.
//
// Tenant-scoped via requireScope + tenantWhere. Property-restricted
// users (UserPropertyAccess) cannot enqueue a sibling property's scan.
//
// Dedupe: if there's already a QUEUED or RUNNING job for this property
// we return the existing jobId instead of creating a duplicate. Operators
// who mash the button repeatedly get one scan, not five.
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
    scope = await requireWritableWorkspace();
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

  // Persist the URL if the operator provided one. Normalize so we always
  // store https://hostname/path and never a bare domain. Stripping the
  // path's trailing slash makes downstream URL matching consistent.
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

  // Dedupe — return any existing in-flight job for this property instead
  // of stacking duplicates. Operators mashing "Re-scan" should get one
  // scan, not five queued behind it.
  const inflight = await prisma.seoScanJob.findFirst({
    where: {
      propertyId: property.id,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, progressStage: true, progressPct: true },
  });
  if (inflight) {
    return NextResponse.json(
      { ok: true, jobId: inflight.id, status: inflight.status, deduped: true },
      { status: 202 },
    );
  }

  const job = await prisma.seoScanJob.create({
    data: {
      orgId: property.orgId,
      propertyId: property.id,
      status: "QUEUED",
      progressStage: "Queued for next worker tick",
      progressPct: 0,
    },
    select: { id: true, status: true },
  });

  return NextResponse.json(
    { ok: true, jobId: job.id, status: job.status, websiteUrl },
    { status: 202 },
  );
}
