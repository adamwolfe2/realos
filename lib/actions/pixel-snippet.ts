"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { OrgType } from "@prisma/client";
import { generatePublicSiteKey } from "@/lib/api-keys/public-site-key";
import { invalidatePublicKeyCache } from "@/lib/visitors/pixel-ingest";

// ---------------------------------------------------------------------------
// First-party pixel snippet provisioning. Generates (or rotates) the public
// site key on the tenant's CursiveIntegration row, so the operator can paste
// the snippet on any site they control. The integration row is upserted so
// this works even when the tenant has not yet provisioned the AudienceLab
// pixel (the two systems coexist; first-party events fill the gap until the
// AL handshake completes).
// ---------------------------------------------------------------------------

const PORTAL_PATH = "/portal/settings/integrations";

export type ProvisionPixelResult = {
  ok: boolean;
  error?: string;
  publicSiteKey?: string;
  publicKeyPrefix?: string;
};

async function requireClientScope() {
  const scope = await requireScope();
  if (scope.orgType !== OrgType.CLIENT) {
    throw new ForbiddenError("Client context required");
  }
  return scope;
}

export async function provisionPixelSnippet(): Promise<ProvisionPixelResult> {
  let scope;
  try {
    scope = await requireClientScope();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not authorized",
    };
  }

  // If a key already exists, return it instead of rotating. Rotation is a
  // separate action (rotatePixelSnippet) so accidentally double-clicking
  // does not invalidate the snippet on every tenant site.
  const existing = await prisma.cursiveIntegration.findUnique({
    where: { orgId: scope.orgId },
    select: { publicSiteKey: true, publicKeyPrefix: true },
  });
  if (existing?.publicSiteKey) {
    return {
      ok: true,
      publicSiteKey: existing.publicSiteKey,
      publicKeyPrefix: existing.publicKeyPrefix ?? existing.publicSiteKey.slice(0, 12),
    };
  }

  const generated = generatePublicSiteKey();

  await prisma.cursiveIntegration.upsert({
    where: { orgId: scope.orgId },
    create: {
      orgId: scope.orgId,
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

  revalidatePath(PORTAL_PATH);
  return {
    ok: true,
    publicSiteKey: generated.raw,
    publicKeyPrefix: generated.prefix,
  };
}

export async function rotatePixelSnippet(): Promise<ProvisionPixelResult> {
  let scope;
  try {
    scope = await requireClientScope();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not authorized",
    };
  }

  const existing = await prisma.cursiveIntegration.findUnique({
    where: { orgId: scope.orgId },
    select: { publicSiteKey: true },
  });

  const generated = generatePublicSiteKey();

  await prisma.cursiveIntegration.upsert({
    where: { orgId: scope.orgId },
    create: {
      orgId: scope.orgId,
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

  if (existing?.publicSiteKey) {
    invalidatePublicKeyCache(existing.publicSiteKey);
  }

  revalidatePath(PORTAL_PATH);
  return {
    ok: true,
    publicSiteKey: generated.raw,
    publicKeyPrefix: generated.prefix,
  };
}
