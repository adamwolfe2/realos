import { NextRequest, NextResponse } from "next/server";
import { getSellerSession } from "@/lib/marketplace/seller-auth";
import { ingestCsvLeads, type CsvRow } from "@/lib/marketplace/seller-ingest";

// POST /api/marketplace/seller/import-csv
//
// Body (JSON): { rows: CsvRow[] }
// Returns: { summary: CsvIngestSummary }
//
// The seller dashboard parses the CSV client-side and posts an array of
// normalised rows. Keeping CSV parsing on the client lets us avoid pulling
// in a server-side CSV library + makes the API contract explicit.
export const maxDuration = 60;

const MAX_ROWS_PER_IMPORT = 5000;

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
  if (rows.length > MAX_ROWS_PER_IMPORT) {
    return NextResponse.json(
      { error: "too_many_rows", limit: MAX_ROWS_PER_IMPORT },
      { status: 400 },
    );
  }

  const summary = await ingestCsvLeads(seller, rows);
  return NextResponse.json({ summary });
}
