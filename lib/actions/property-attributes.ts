"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWritableWorkspace } from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// Update the operator-editable property attributes (assetCategory +
// profileTags) added in the #68 schema migration. Without this server
// action the filter chips on /portal/properties (#54) are dead UI —
// there's no way to actually assign attributes to a property.
//
// Norman audit pass 2026-05-21: closing the loop on the half-built
// #68 + #54 pair.
//
// Validation:
//   - assetCategory: trimmed, ≤80 chars, NULL when empty so an
//     unset category lands as a real NULL instead of an empty string
//     that filters would treat as "has value".
//   - profileTags: array of trimmed lowercase strings, deduped,
//     each ≤40 chars, max 10 tags per property.
//   - Caller must belong to the same org as the property.
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  propertyId: z.string().min(1),
  assetCategory: z.string().trim().max(80).optional().nullable(),
  profileTags: z
    .array(z.string().trim().max(40))
    .max(10)
    .transform((arr) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const raw of arr) {
        const v = raw.toLowerCase().trim();
        if (!v) continue;
        if (seen.has(v)) continue;
        seen.add(v);
        out.push(v);
      }
      return out;
    }),
});

export type SavePropertyAttributesResult =
  | { ok: true; propertyId: string }
  | { ok: false; error: string };

export async function savePropertyAttributes(
  raw: unknown,
): Promise<SavePropertyAttributesResult> {
  const scope = await requireWritableWorkspace();
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Invalid attributes payload.",
    };
  }
  const data = parsed.data;

  // Tenant guard: the property must live under the caller's org.
  const property = await prisma.property.findFirst({
    where: { id: data.propertyId, orgId: scope.orgId },
    select: { id: true },
  });
  if (!property) {
    return { ok: false, error: "Property not found." };
  }

  const normalisedCategory =
    data.assetCategory && data.assetCategory.trim().length > 0
      ? data.assetCategory.trim()
      : null;

  await prisma.property.update({
    where: { id: property.id },
    data: {
      assetCategory: normalisedCategory,
      profileTags: data.profileTags,
    },
  });

  revalidatePath("/portal/properties");
  revalidatePath(`/portal/properties/${property.id}`);
  return { ok: true, propertyId: property.id };
}
