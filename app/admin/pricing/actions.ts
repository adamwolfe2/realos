"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAgency, ForbiddenError, auditPayload } from "@/lib/tenancy/scope";
import {
  getFeaturePriceRows,
  isValidFeaturePriceKey,
} from "@/lib/billing/feature-prices";

export type SavePricesResult = { ok: true } | { ok: false; error: string };

// Parse a dollars string ("149", "149.50") into integer cents. Returns null
// on anything non-numeric or out of a sane range.
function dollarsToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 100000) return null;
  return Math.round(value * 100);
}

// Bulk-save every feature price + active flag from the admin pricing editor.
// One agency-gated action; upserts a FeaturePrice row per editable key.
export async function saveFeaturePrices(
  formData: FormData,
): Promise<SavePricesResult> {
  try {
    const scope = await requireAgency();

    // Iterate the canonical key set (base + every catalog feature) so a
    // crafted payload can't write arbitrary keys.
    const rows = await getFeaturePriceRows();
    const updates: Array<{ key: string; monthlyCents: number; active: boolean }> = [];

    for (const row of rows) {
      if (!isValidFeaturePriceKey(row.key)) continue;
      const rawPrice = formData.get(`price_${row.key}`);
      const cents = dollarsToCents(typeof rawPrice === "string" ? rawPrice : "");
      if (cents === null) {
        return {
          ok: false,
          error: `Invalid price for "${row.label}". Enter a dollar amount (0–100000).`,
        };
      }
      // Base platform can't be deactivated (every workspace needs it).
      const active = row.isBase
        ? true
        : formData.get(`active_${row.key}`) != null;
      updates.push({ key: row.key, monthlyCents: cents, active });
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.featurePrice.upsert({
          where: { key: u.key },
          update: { monthlyCents: u.monthlyCents, active: u.active },
          create: { key: u.key, monthlyCents: u.monthlyCents, active: u.active },
        }),
      ),
    );

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "FeaturePrice",
        entityId: "all",
        description: `Updated onboarding feature pricing (${updates.length} items)`,
        diff: {
          prices: updates.reduce<Record<string, number>>((acc, u) => {
            acc[u.key] = u.monthlyCents;
            return acc;
          }, {}),
        } as Prisma.InputJsonValue,
      }),
    });

    revalidatePath("/admin/pricing");
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    console.error("saveFeaturePrices failed", err);
    return { ok: false, error: "Failed to save prices" };
  }
}
