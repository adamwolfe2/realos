"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { propertyInScope, requireWritableWorkspace, type ScopedContext } from "@/lib/tenancy/scope";
import {
  parseAdvertiserInput,
  scanAdvertiser,
} from "@/lib/integrations/ad-library";

// Server actions that drive the Ad Library widget on the property + org
// pages. All actions are tenant-scoped via requireScope().

// Restricted users only touch their own buildings' competitors, never an
// org-wide row; full-portfolio users touch any row in the org.
function canTouch(scope: ScopedContext, propertyId: string | null): boolean {
  return propertyId ? propertyInScope(scope, propertyId) : !scope.allowedPropertyIds;
}

const trackInput = z.object({
  raw: z.string().min(1).max(500),
  propertyId: z.string().min(1).max(64).nullish(),
});

export async function trackAdvertiserAction(input: {
  raw: string;
  propertyId?: string | null;
}): Promise<
  | { ok: true; advertiserId: string; ads: number }
  | { ok: false; error: string }
> {
  const scope = await requireWritableWorkspace();
  const valid = trackInput.safeParse(input);
  if (!valid.success) return { ok: false, error: "Invalid input" };
  let parsed;
  try {
    parsed = parseAdvertiserInput(valid.data.raw);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid input",
    };
  }

  // The property must be this org's and inside the caller's grant. An
  // unknown id is an error, not a silent fall back to an org-wide row, and
  // a property-restricted user can't create org-wide rows at all.
  const requested = valid.data.propertyId ?? null;
  if (!canTouch(scope, requested)) {
    return { ok: false, error: "You don't have access to that property." };
  }
  let propertyId: string | null = null;
  if (requested) {
    const owned = await prisma.property.findFirst({
      where: { id: requested, orgId: scope.orgId },
      select: { id: true },
    });
    if (!owned) return { ok: false, error: "Property not found." };
    propertyId = owned.id;
  }

  // ponytail: (orgId, searchValue) is unique, so re-tracking moves the row
  // between properties. Until the per-property unique key lands, never let
  // a caller move a row that sits outside their grant.
  const existing = await prisma.adLibraryAdvertiser.findUnique({
    where: { orgId_searchValue: { orgId: scope.orgId, searchValue: parsed.searchValue } },
    select: { propertyId: true },
  });
  if (existing && !canTouch(scope, existing.propertyId)) {
    return { ok: false, error: "That advertiser is tracked under a property you can't access." };
  }

  // Upsert by (orgId, searchValue) so re-pasting the same input doesn't
  // create duplicates.
  const advertiser = await prisma.adLibraryAdvertiser.upsert({
    where: {
      orgId_searchValue: {
        orgId: scope.orgId,
        searchValue: parsed.searchValue,
      },
    },
    update: {
      searchKind: parsed.searchKind,
      displayName: parsed.displayName,
      propertyId,
    },
    create: {
      orgId: scope.orgId,
      searchKind: parsed.searchKind,
      searchValue: parsed.searchValue,
      displayName: parsed.displayName,
      propertyId,
    },
  });

  // Fire an immediate scan so the UI populates without a second click.
  const scan = await scanAdvertiser(advertiser.id);

  if (propertyId) {
    revalidatePath(`/portal/properties/${propertyId}`);
  }
  revalidatePath("/portal/ads");

  return scan.ok
    ? { ok: true, advertiserId: advertiser.id, ads: scan.found }
    : { ok: false, error: scan.error ?? "Scan failed" };
}

export async function rescanAdvertiserAction(
  advertiserId: string,
): Promise<
  | { ok: true; found: number; newCount: number; inactiveCount: number }
  | { ok: false; error: string }
> {
  const scope = await requireWritableWorkspace();
  const owned = await prisma.adLibraryAdvertiser.findFirst({
    where: { id: advertiserId, orgId: scope.orgId },
    select: { id: true, propertyId: true },
  });
  if (!owned || !canTouch(scope, owned.propertyId)) return { ok: false, error: "Advertiser not found" };

  const result = await scanAdvertiser(advertiserId);
  if (owned.propertyId) {
    revalidatePath(`/portal/properties/${owned.propertyId}`);
  }
  revalidatePath("/portal/ads");
  return result.ok
    ? {
        ok: true,
        found: result.found,
        newCount: result.newCount,
        inactiveCount: result.inactiveCount,
      }
    : { ok: false, error: result.error ?? "Scan failed" };
}

export async function untrackAdvertiserAction(
  advertiserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const scope = await requireWritableWorkspace();
  const owned = await prisma.adLibraryAdvertiser.findFirst({
    where: { id: advertiserId, orgId: scope.orgId },
    select: { id: true, propertyId: true },
  });
  if (!owned || !canTouch(scope, owned.propertyId)) return { ok: false, error: "Advertiser not found" };
  await prisma.adLibraryAdvertiser.delete({ where: { id: advertiserId } });
  if (owned.propertyId) {
    revalidatePath(`/portal/properties/${owned.propertyId}`);
  }
  revalidatePath("/portal/ads");
  return { ok: true };
}
