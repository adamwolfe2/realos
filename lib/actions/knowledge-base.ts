"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireWritableWorkspace,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// Property Knowledge Base save action (slice S1). Writes one PropertyKnowledgeBase
// row per property — structured floor plans + amenities + policies + lease +
// application + neighborhood facts that ground the chatbot (see
// lib/chatbot/build-system-prompt.ts). Mirrors savePropertyChatbotConfig:
// requireWritableWorkspace -> allowedPropertyIds RBAC -> ownership findFirst ->
// zod -> upsert -> auditEvent -> revalidatePath. Tenant isolation is the top
// concern: orgId comes ONLY from scope, never the client.
// ---------------------------------------------------------------------------

export type ActionResult = { ok: true } | { ok: false; error: string };

const TEXT_MAX = 4000;
const SHORT_MAX = 500;
const AMENITY_MAX = 80;
const AMENITY_COUNT_MAX = 60;
const FLOOR_PLAN_MAX = 40;

// Caps on the canonical money fields. priceMaxCents at 100M = $1,000,000/mo —
// absurdly high on purpose; it exists to reject garbage, not to constrain real
// rents. squareFeet capped at 100k to reject obvious bad input.
const SQFT_MAX = 100_000;
const PRICE_CENTS_MAX = 100_000_000;

const floorPlanSchema = z.object({
  type: z.string().trim().min(1, "Floor plan needs a type").max(SHORT_MAX),
  bedrooms: z.coerce.number().min(0).max(50).nullable().optional(),
  bathrooms: z.coerce.number().min(0).max(50).nullable().optional(),
  squareFeet: z.coerce
    .number()
    .int("Square feet must be a whole number")
    .min(1, "Square feet must be positive")
    .max(SQFT_MAX)
    .nullable()
    .optional(),
  priceMinCents: z.coerce.number().int().min(0).max(PRICE_CENTS_MAX).nullable().optional(),
  priceMaxCents: z.coerce.number().int().min(0).max(PRICE_CENTS_MAX).nullable().optional(),
  notes: z.string().trim().max(SHORT_MAX).nullable().optional(),
}).refine(
  (fp) =>
    fp.priceMinCents == null ||
    fp.priceMaxCents == null ||
    fp.priceMinCents <= fp.priceMaxCents,
  { message: "A floor plan's min rent can't exceed its max rent" },
);

// Normalize empty strings to null and trim, matching the chatbot-config pattern.
const text = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().max(max, `Field can't exceed ${max} characters`).nullable());

const amenityList = z
  .array(z.string())
  .optional()
  .transform((arr) =>
    (arr ?? [])
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length > 0)
      .slice(0, AMENITY_COUNT_MAX),
  )
  .pipe(z.array(z.string().max(AMENITY_MAX)));

const saveSchema = z.object({
  floorPlans: z.array(floorPlanSchema).max(FLOOR_PLAN_MAX).optional().default([]),
  communityAmenities: amenityList,
  unitAmenities: amenityList,
  petPolicy: text(TEXT_MAX),
  parkingInfo: text(TEXT_MAX),
  laundryInfo: text(SHORT_MAX),
  utilitiesIncluded: text(TEXT_MAX),
  smokingPolicy: text(SHORT_MAX),
  leaseTerms: text(TEXT_MAX),
  depositInfo: text(SHORT_MAX),
  currentSpecials: text(TEXT_MAX),
  applicationProcess: text(TEXT_MAX),
  applicationRequirements: text(TEXT_MAX),
  neighborhoodInfo: text(TEXT_MAX),
  transitInfo: text(SHORT_MAX),
  tourInfo: text(SHORT_MAX),
  additionalNotes: text(TEXT_MAX),
});

export type SaveKnowledgeBaseInput = {
  propertyId: string;
} & z.input<typeof saveSchema>;

export async function savePropertyKnowledgeBase(
  input: SaveKnowledgeBaseInput,
): Promise<ActionResult> {
  try {
    const scope = await requireWritableWorkspace();

    const propertyId =
      typeof input?.propertyId === "string" ? input.propertyId.trim() : "";
    if (!propertyId) return { ok: false, error: "Missing property" };

    // Per-property RBAC: a restricted user must not write a sibling property's
    // KB even by hand-crafting the payload.
    if (
      scope.allowedPropertyIds &&
      !scope.allowedPropertyIds.includes(propertyId)
    ) {
      return { ok: false, error: "You don't have access to this property" };
    }

    // Ownership: the property must belong to THIS org. orgId comes from scope
    // only — never the client — so a cross-tenant propertyId returns null here.
    const property = await prisma.property.findFirst({
      where: { id: propertyId, orgId: scope.orgId },
      select: { id: true },
    });
    if (!property) return { ok: false, error: "Property not found" };

    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
      };
    }

    // Normalize each floor plan to a clean, fully-keyed object (nulls for
    // absent numbers) so the stored Json is predictable for the prompt builder.
    const floorPlans = parsed.data.floorPlans.map((fp) => ({
      type: fp.type,
      bedrooms: fp.bedrooms ?? null,
      bathrooms: fp.bathrooms ?? null,
      squareFeet: fp.squareFeet ?? null,
      priceMinCents: fp.priceMinCents ?? null,
      priceMaxCents: fp.priceMaxCents ?? null,
      notes: fp.notes ?? null,
    }));

    const { floorPlans: _omit, ...rest } = parsed.data;
    void _omit;
    const data = {
      ...rest,
      floorPlans: floorPlans as unknown as Prisma.InputJsonValue,
    };

    const kb = await prisma.propertyKnowledgeBase.upsert({
      where: { propertyId },
      update: data as Prisma.PropertyKnowledgeBaseUncheckedUpdateInput,
      create: {
        ...(data as Prisma.PropertyKnowledgeBaseUncheckedCreateInput),
        propertyId,
        orgId: scope.orgId,
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "PropertyKnowledgeBase",
        entityId: kb.id,
        description: "Property knowledge base updated",
        diff: data as Prisma.InputJsonValue,
      }),
    });

    revalidatePath(`/portal/properties/${propertyId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("savePropertyKnowledgeBase failed", err);
    return { ok: false, error: "Failed to save knowledge base" };
  }
}
