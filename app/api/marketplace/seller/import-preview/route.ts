import { NextRequest, NextResponse } from "next/server";
import { getSellerSession } from "@/lib/marketplace/seller-auth";
import { previewDedup } from "@/lib/marketplace/dedup";
import type { CsvRow } from "@/lib/marketplace/csv-client";

// ---------------------------------------------------------------------------
// POST /api/marketplace/seller/import-preview
//
// Read-only counterpart to import-csv. Takes the SAME body shape ({ rows })
// but runs the dedup classifier against the seller's existing leads WITHOUT
// writing anything. Returns the 3-bucket preview (new / exact-match /
// possible-dup) the wizard's step 4 renders.
//
// The wizard calls this once to render the dedup preview, then calls
// import-csv with the user-confirmed subset of rows.
// ---------------------------------------------------------------------------

export const maxDuration = 60;

const MAX_ROWS_PER_PREVIEW = 5000;

export async function POST(req: NextRequest) {
  const seller = await getSellerSession();
  if (!seller) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { rows?: CsvRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "no_rows" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS_PER_PREVIEW) {
    return NextResponse.json(
      { error: "too_many_rows", limit: MAX_ROWS_PER_PREVIEW },
      { status: 400 },
    );
  }

  const preview = await previewDedup(seller, rows);
  return NextResponse.json({ preview });
}
