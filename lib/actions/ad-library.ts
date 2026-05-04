"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import {
  parseAdvertiserInput,
  scanAdvertiser,
} from "@/lib/integrations/ad-library";

// Server actions that drive the Ad Library widget on the property + org
// pages. All actions are tenant-scoped via requireScope().

export async function trackAdvertiserAction(input: {
  raw: string;
  propertyId?: string | null;
}): Promise<
  | { ok: true; advertiserId: string; ads: number }
  | { ok: false; error: string }
> {
  const scope = await requireScope();
  let parsed;
  try {
    parsed = parseAdvertiserInput(input.raw);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid input",
    };
  }

  // Validate property belongs to this tenant.
  let propertyId: string | null = null;
  if (input.propertyId) {
    const owned = await prisma.property.findFirst({
      where: { id: input.propertyId, orgId: scope.orgId },
      select: { id: true },
    });
    if (owned) propertyId = owned.id;
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
  revalidatePath("/portal/campaigns");

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
  const scope = await requireScope();
  const owned = await prisma.adLibraryAdvertiser.findFirst({
    where: { id: advertiserId, orgId: scope.orgId },
    select: { id: true, propertyId: true },
  });
  if (!owned) return { ok: false, error: "Advertiser not found" };

  const result = await scanAdvertiser(advertiserId);
  if (owned.propertyId) {
    revalidatePath(`/portal/properties/${owned.propertyId}`);
  }
  revalidatePath("/portal/campaigns");
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
  const scope = await requireScope();
  const owned = await prisma.adLibraryAdvertiser.findFirst({
    where: { id: advertiserId, orgId: scope.orgId },
    select: { id: true, propertyId: true },
  });
  if (!owned) return { ok: false, error: "Advertiser not found" };
  await prisma.adLibraryAdvertiser.delete({ where: { id: advertiserId } });
  if (owned.propertyId) {
    revalidatePath(`/portal/properties/${owned.propertyId}`);
  }
  revalidatePath("/portal/campaigns");
  return { ok: true };
}
