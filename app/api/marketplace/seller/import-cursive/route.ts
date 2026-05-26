import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MarketplaceLeadPropertyType } from "@prisma/client";
import { getSellerSession } from "@/lib/marketplace/seller-auth";
import { ingestSellerCursiveSegment } from "@/lib/marketplace/seller-ingest";

// POST /api/marketplace/seller/import-cursive
//
// Wires a Cursive segment to this seller. Runs an immediate sync so the
// seller sees leads land in their dashboard.
export const maxDuration = 300;

const Schema = z.object({
  name: z.string().min(1).max(120),
  segmentId: z.string().min(1).max(200),
  kind: z.enum(["CURSIVE_AUDIENCE", "CURSIVE_SEGMENT"]),
  defaultPropertyType: z.nativeEnum(MarketplaceLeadPropertyType),
  defaultMarket: z.string().optional(),
  minScoreFloor: z.number().int().min(0).max(100).optional(),
  baselineScore: z.number().int().min(0).max(100).optional(),
  defaultPriceCents: z.number().int().min(500).max(100_000).optional(),
});

export async function POST(req: NextRequest) {
  const seller = await getSellerSession();
  if (!seller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await ingestSellerCursiveSegment(seller, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "ingest_failed", message },
      { status: 500 },
    );
  }
}
