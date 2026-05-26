import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { MarketplaceLeadPropertyType } from "@prisma/client";
import { getBuyerSession } from "@/lib/marketplace/auth";

// ---------------------------------------------------------------------------
// GET  /api/marketplace/streams       — list this buyer's streams
// POST /api/marketplace/streams       — create a stream
// ---------------------------------------------------------------------------

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  market: z.string().min(1).max(120).nullable().optional(),
  propertyType: z.nativeEnum(MarketplaceLeadPropertyType).nullable().optional(),
  minIntent: z.number().int().min(0).max(100).default(70),
  maxPriceCents: z.number().int().min(500).max(100_000).default(20000),
  weeklyBudgetCents: z.number().int().min(0).max(10_000_000).default(50000),
});

export async function GET() {
  const buyer = await getBuyerSession();
  if (!buyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const streams = await prisma.marketplaceStream.findMany({
    where: { buyerId: buyer.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ streams });
}

export async function POST(req: NextRequest) {
  const buyer = await getBuyerSession();
  if (!buyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
  const stream = await prisma.marketplaceStream.create({
    data: {
      buyerId: buyer.id,
      name: data.name,
      market: data.market ?? null,
      propertyType: data.propertyType ?? null,
      minIntent: data.minIntent,
      maxPriceCents: data.maxPriceCents,
      weeklyBudgetCents: data.weeklyBudgetCents,
      enabled: true,
    },
  });

  return NextResponse.json({ stream });
}
