"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";

function clampInt(n: unknown, min: number, max: number): number {
  const raw = Number(n);
  if (!Number.isFinite(raw)) return min;
  return Math.max(min, Math.min(max, Math.floor(raw)));
}

export async function setCatalogActive(args: {
  catalogItemId: string;
  active: boolean;
}): Promise<{ ok: true }> {
  await requireAgency();
  await prisma.proposalCatalogItem.update({
    where: { id: args.catalogItemId },
    data: { active: args.active },
  });
  revalidatePath("/admin/proposals/catalog");
  return { ok: true };
}

export async function updateCatalogItem(args: {
  catalogItemId: string;
  label?: string;
  description?: string;
  defaultPriceCents?: number;
}): Promise<{ ok: true }> {
  await requireAgency();
  const data: Prisma.ProposalCatalogItemUpdateInput = {};
  if (args.label !== undefined) data.label = args.label;
  if (args.description !== undefined) data.description = args.description;
  if (args.defaultPriceCents !== undefined) {
    data.defaultPriceCents = clampInt(args.defaultPriceCents, 0, 100_000_000);
  }
  await prisma.proposalCatalogItem.update({
    where: { id: args.catalogItemId },
    data,
  });
  revalidatePath("/admin/proposals/catalog");
  return { ok: true };
}

export async function seedCatalogDefaults(): Promise<{ ok: true }> {
  await requireAgency();
  try {
    const mod = await import("@/lib/proposals/catalog");
    if (typeof mod.ensureCatalogSeeded === "function") {
      await mod.ensureCatalogSeeded();
    }
  } catch (err) {
    console.error("[seedCatalogDefaults] failed:", err);
    throw new Error("Catalog helper not yet available");
  }
  revalidatePath("/admin/proposals/catalog");
  return { ok: true };
}
