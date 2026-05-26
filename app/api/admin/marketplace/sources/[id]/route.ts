import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { MarketplaceLeadPropertyType } from "@prisma/client";

// ---------------------------------------------------------------------------
// PATCH /api/admin/marketplace/sources/[id]
//
// Update a single MarketplaceSyncSource — used by the admin list to toggle
// requireFullEnrichment, enabled, or any tunable scoring/pricing field
// without recreating the source.
//
// DELETE /api/admin/marketplace/sources/[id]
//
// Remove a source and (via Prisma cascade) all of its leads + runs.
// ---------------------------------------------------------------------------

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  requireFullEnrichment: z.boolean().optional(),
  minScoreFloor: z.number().int().min(0).max(100).optional(),
  baselineScore: z.number().int().min(0).max(100).optional(),
  defaultPriceCents: z.number().int().min(500).max(100_000).optional(),
  defaultPropertyType: z.nativeEnum(MarketplaceLeadPropertyType).optional(),
  defaultMarket: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireAgency();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await prisma.marketplaceSyncSource.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ source: updated });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireAgency();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  await prisma.marketplaceSyncSource.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
