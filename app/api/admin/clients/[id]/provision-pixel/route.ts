import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency, ForbiddenError } from "@/lib/tenancy/scope";
import { generatePublicSiteKey } from "@/lib/api-keys/public-site-key";
import { invalidatePublicKeyCache } from "@/lib/visitors/pixel-ingest";

// POST /api/admin/clients/[id]/provision-pixel
//
// Agency-only. Generates (or returns existing) first-party visitor pixel
// public site key on the tenant's CursiveIntegration row. The operator pastes
// the resulting <script> on their marketing site and visitor events flow into
// /portal/visitors.
//
// This used to call AudienceLab's hosted pixel. We replaced that with the
// first-party ingest so deploys don't depend on AudienceLab credentials and
// operators see the same key whether agency provisions or they self-serve.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;

  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.cursiveIntegration.findUnique({
    where: { orgId: org.id },
    select: { publicSiteKey: true, publicKeyPrefix: true },
  });

  if (existing?.publicSiteKey) {
    return NextResponse.json({
      ok: true,
      provisioned: false,
      hostname: org.slug,
      publicSiteKey: existing.publicSiteKey,
      publicKeyPrefix:
        existing.publicKeyPrefix ?? existing.publicSiteKey.slice(0, 12),
    });
  }

  const generated = generatePublicSiteKey();

  await prisma.cursiveIntegration.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id,
      publicSiteKey: generated.raw,
      publicKeyPrefix: generated.prefix,
      publicKeyIssuedAt: new Date(),
    },
    update: {
      publicSiteKey: generated.raw,
      publicKeyPrefix: generated.prefix,
      publicKeyIssuedAt: new Date(),
    },
  });

  invalidatePublicKeyCache(generated.raw);

  return NextResponse.json({
    ok: true,
    provisioned: true,
    hostname: org.slug,
    publicSiteKey: generated.raw,
    publicKeyPrefix: generated.prefix,
  });
}
