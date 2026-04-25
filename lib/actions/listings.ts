"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";

// Manual listings management. Operators without AppFolio Plus/Max API access
// can paste availability directly into the portal so the chatbot's
// listings-summary endpoint and AI system prompt see real inventory.

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const createSchema = z.object({
  propertyId: z.string().min(1),
  unitType: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  unitNumber: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  bedrooms: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }),
  bathrooms: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }),
  priceDollars: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
    }),
  availableFrom: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v.length === 0) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }),
  isAvailable: z.boolean().optional().default(true),
});

function parseBool(value: FormDataEntryValue | null): boolean {
  if (value === null) return false;
  const v = String(value).toLowerCase();
  return v === "on" || v === "true" || v === "1" || v === "yes";
}

function firstString(v: FormDataEntryValue | null): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function createListing(
  formData: FormData
): Promise<ActionResult> {
  try {
    const scope = await requireScope();

    const raw = {
      propertyId: firstString(formData.get("propertyId")) ?? "",
      unitType: firstString(formData.get("unitType")),
      unitNumber: firstString(formData.get("unitNumber")),
      bedrooms: firstString(formData.get("bedrooms")),
      bathrooms: firstString(formData.get("bathrooms")),
      priceDollars: firstString(formData.get("priceDollars")),
      availableFrom: firstString(formData.get("availableFrom")),
      isAvailable: parseBool(formData.get("isAvailable")),
    };

    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { ok: false, error: first?.message ?? "Validation failed" };
    }

    // Property must belong to the caller's org. Reject otherwise.
    const property = await prisma.property.findFirst({
      where: { id: parsed.data.propertyId, orgId: scope.orgId },
      select: { id: true },
    });
    if (!property) {
      return { ok: false, error: "Property not found" };
    }

    const listing = await prisma.listing.create({
      data: {
        propertyId: parsed.data.propertyId,
        unitType: parsed.data.unitType,
        unitNumber: parsed.data.unitNumber,
        bedrooms: parsed.data.bedrooms,
        bathrooms: parsed.data.bathrooms,
        priceCents: parsed.data.priceDollars,
        availableFrom: parsed.data.availableFrom,
        isAvailable: parsed.data.isAvailable,
      },
      select: { id: true },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.CREATE,
        entityType: "Listing",
        entityId: listing.id,
        description: `Listing created manually for property ${property.id}`,
        diff: parsed.data as unknown as Prisma.InputJsonValue,
      }),
    });

    revalidatePath(`/portal/properties/${parsed.data.propertyId}`);
    return { ok: true, id: listing.id };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("createListing failed", err);
    return { ok: false, error: "Failed to create listing" };
  }
}

export async function deleteListing(
  listingId: string
): Promise<ActionResult> {
  try {
    const scope = await requireScope();

    const listing = await prisma.listing.findFirst({
      where: {
        id: listingId,
        property: { orgId: scope.orgId },
      },
      select: { id: true, propertyId: true },
    });
    if (!listing) {
      return { ok: false, error: "Listing not found" };
    }

    await prisma.listing.delete({ where: { id: listing.id } });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.DELETE,
        entityType: "Listing",
        entityId: listing.id,
        description: `Listing deleted manually`,
      }),
    });

    revalidatePath(`/portal/properties/${listing.propertyId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("deleteListing failed", err);
    return { ok: false, error: "Failed to delete listing" };
  }
}

export async function toggleListingAvailable(
  listingId: string,
  isAvailable: boolean
): Promise<ActionResult> {
  try {
    const scope = await requireScope();

    const listing = await prisma.listing.findFirst({
      where: {
        id: listingId,
        property: { orgId: scope.orgId },
      },
      select: { id: true, propertyId: true },
    });
    if (!listing) {
      return { ok: false, error: "Listing not found" };
    }

    await prisma.listing.update({
      where: { id: listing.id },
      data: { isAvailable },
    });

    revalidatePath(`/portal/properties/${listing.propertyId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("toggleListingAvailable failed", err);
    return { ok: false, error: "Failed to update listing" };
  }
}
