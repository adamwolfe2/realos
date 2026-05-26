import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  MarketplaceLeadPropertyType,
  MarketplaceSyncSourceKind,
} from "@prisma/client";
import { runSourceReplenish } from "@/lib/marketplace/cursive-sync";

// ---------------------------------------------------------------------------
// /api/admin/marketplace/sources
//
// GET  → list every source + run summary
// POST → create a new source and (optionally) trigger an immediate sync
//
// Both are admin-only. POST is the "one-click setup" flow for a fresh
// Cursive segment: register it, run a sync, return the summary so the
// operator can confirm leads landed in the pool.
// ---------------------------------------------------------------------------

export const maxDuration = 300;

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.nativeEnum(MarketplaceSyncSourceKind),
  externalId: z.string().min(1).max(200),
  defaultPropertyType: z.nativeEnum(MarketplaceLeadPropertyType),
  defaultMarket: z.string().optional().nullable(),
  minScoreFloor: z.number().int().min(0).max(100).optional(),
  baselineScore: z.number().int().min(0).max(100).optional(),
  defaultPriceCents: z.number().int().min(500).max(100_000).optional(),
  requireFullEnrichment: z.boolean().optional(),
  runImmediately: z.boolean().optional(),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const sources = await prisma.marketplaceSyncSource.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 3,
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          fetchedCount: true,
          upsertedCount: true,
          newCount: true,
          refreshedCount: true,
          expiredCount: true,
          failedCount: true,
          errorMessage: true,
        },
      },
      _count: { select: { leads: true } },
    },
  });

  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const source = await prisma.marketplaceSyncSource.create({
    data: {
      name: data.name,
      kind: data.kind,
      externalId: data.externalId,
      defaultPropertyType: data.defaultPropertyType,
      defaultMarket: data.defaultMarket ?? null,
      minScoreFloor: data.minScoreFloor ?? 50,
      baselineScore: data.baselineScore ?? 50,
      defaultPriceCents: data.defaultPriceCents ?? 5000,
      requireFullEnrichment: data.requireFullEnrichment ?? false,
      enabled: true,
    },
  });

  let syncSummary: unknown = null;
  if (data.runImmediately) {
    try {
      syncSummary = await runSourceReplenish(source);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      syncSummary = { status: "FAILED", errorMessage: message };
    }
  }

  return NextResponse.json({ source, syncSummary });
}
