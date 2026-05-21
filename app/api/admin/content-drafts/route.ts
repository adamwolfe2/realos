import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DraftStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/admin/content-drafts
//
// Cross-tenant queue of drafts pending review. Includes the org + property
// names so the queue UI can group by client.
// Filters: ?status=PENDING_REVIEW (default), ?orgId=, ?format=
// ---------------------------------------------------------------------------

const STATUS_VALUES = Object.values(DraftStatus) as DraftStatus[];

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const sp = req.nextUrl.searchParams;
  const statusParam = sp.get("status") ?? DraftStatus.PENDING_REVIEW;
  const status = (STATUS_VALUES as string[]).includes(statusParam)
    ? (statusParam as DraftStatus)
    : DraftStatus.PENDING_REVIEW;
  const orgId = sp.get("orgId");
  const format = sp.get("format");

  const drafts = await prisma.contentDraft.findMany({
    where: {
      status,
      ...(orgId ? { orgId } : {}),
      ...(format ? { format: format as never } : {}),
    },
    orderBy: [
      { submittedAt: "asc" },
      { createdAt: "asc" },
    ],
    take: 200,
    select: {
      id: true,
      orgId: true,
      propertyId: true,
      format: true,
      brief: true,
      targetQuery: true,
      status: true,
      estimatedScore: true,
      model: true,
      generatedAt: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNotes: true,
      createdAt: true,
      org: { select: { id: true, name: true } },
      property: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ drafts });
}
