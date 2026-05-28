import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/audit/[id]
// Public, unauthenticated. Used by the form page to poll the
// QUEUED → RUNNING → READY transition before redirecting the user to
// /audit/[token]. Intentionally lightweight — no findings/sectionScores
// returned here, those are rendered server-side on the viewer page
// (and gated behind email capture).

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const audit = await prisma.prospectAudit.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      overallScore: true,
      shareToken: true,
      email: true,
      domain: true,
    },
  });
  if (!audit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: audit.id,
    status: audit.status,
    overallScore: audit.overallScore,
    shareToken: audit.shareToken,
    domain: audit.domain,
    hasEmail: Boolean(audit.email),
  });
}
