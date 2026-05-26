import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
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

  // Run the ingest in the background to avoid Vercel's 5-min function
  // cap when the audience has tens of thousands of members. The seller
  // dashboard surfaces results from the latest sync row.
  after(async () => {
    try {
      await ingestSellerCursiveSegment(seller, parsed.data);
    } catch (err) {
      console.error("seller cursive ingest failed", seller.id, err);
    }
  });

  return NextResponse.json({
    ok: true,
    note: "Sync started in background. Refresh your dashboard in 1-3 minutes.",
  });
}
