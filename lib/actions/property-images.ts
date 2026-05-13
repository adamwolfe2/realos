"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  tenantWhere,
  ForbiddenError,
} from "@/lib/tenancy/scope";
import {
  refreshPropertyImagesFromWebsite,
  type RefreshResult,
} from "@/lib/property-images/refresh";

// ---------------------------------------------------------------------------
// Property image server actions.
//
// scrapePropertyImagesAction — runs the scraper on demand from the UI
//   (curation queue, property settings). Operator-initiated, so we
//   force=true and overwrite any existing values.
//
// setPropertyImagesAction — manual override. Operator pastes a URL or
//   uploads via Vercel Blob (separate component); this action just
//   writes the result.
// ---------------------------------------------------------------------------

const scrapeInput = z.object({
  propertyId: z.string().min(1),
  websiteUrl: z.string().optional(),
});

type ActionResult =
  | { ok: true; result: RefreshResult }
  | { ok: false; error: string };

export async function scrapePropertyImagesAction(
  input: unknown,
): Promise<ActionResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = scrapeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  // Verify the property is in this org BEFORE the scrape — never let an
  // operator scrape against another tenant's property id.
  const property = await prisma.property.findFirst({
    where: { id: parsed.data.propertyId, ...tenantWhere(scope) },
    select: { id: true },
  });
  if (!property) return { ok: false, error: "Property not found" };

  const result = await refreshPropertyImagesFromWebsite({
    propertyId: parsed.data.propertyId,
    websiteUrl: parsed.data.websiteUrl,
    force: true,
  });

  // Refresh affected surfaces.
  revalidatePath("/portal");
  revalidatePath("/portal/properties");
  revalidatePath("/portal/properties/curate");
  revalidatePath(`/portal/properties/${parsed.data.propertyId}`);

  return { ok: true, result };
}

const setInput = z.object({
  propertyId: z.string().min(1),
  heroImageUrl: z.string().url().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
});

export async function setPropertyImagesAction(input: unknown): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = setInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  // Tenant guard.
  const property = await prisma.property.findFirst({
    where: { id: parsed.data.propertyId, ...tenantWhere(scope) },
    select: { id: true },
  });
  if (!property) return { ok: false, error: "Property not found" };

  await prisma.property.update({
    where: { id: parsed.data.propertyId },
    data: {
      heroImageUrl: parsed.data.heroImageUrl ?? undefined,
      logoUrl: parsed.data.logoUrl ?? undefined,
      websiteUrl: parsed.data.websiteUrl ?? undefined,
    },
  });

  revalidatePath("/portal");
  revalidatePath("/portal/properties");
  revalidatePath(`/portal/properties/${parsed.data.propertyId}`);
  return { ok: true };
}
