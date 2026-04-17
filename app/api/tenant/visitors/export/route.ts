import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere, ForbiddenError } from "@/lib/tenancy/scope";

// GET /api/tenant/visitors/export
// Downloads a CSV of visitors with hashed emails for manual upload to
// Google Ads + Meta Custom Audiences. SHA-256 hashing is done at the
// webhook-ingest step, so this is a straight read of the Visitor rows.
export async function GET() {
  try {
    const scope = await requireScope();
    const visitors = await prisma.visitor.findMany({
      where: { ...tenantWhere(scope), hashedEmail: { not: null } },
      select: {
        hashedEmail: true,
        firstName: true,
        lastName: true,
        utmSource: true,
        utmCampaign: true,
        intentScore: true,
      },
      orderBy: { lastSeenAt: "desc" },
      take: 50_000,
    });

    const header =
      "email,first_name,last_name,utm_source,utm_campaign,intent_score";
    const lines = [header];
    for (const v of visitors) {
      lines.push(
        [
          v.hashedEmail ?? "",
          csvField(v.firstName),
          csvField(v.lastName),
          csvField(v.utmSource),
          csvField(v.utmCampaign),
          String(v.intentScore ?? 0),
        ].join(",")
      );
    }

    const csv = lines.join("\n");
    const filename = `visitors-${scope.orgId}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function csvField(raw: string | null | undefined): string {
  if (!raw) return "";
  const needsQuote = /[,"\n\r]/.test(raw);
  const escaped = raw.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}
