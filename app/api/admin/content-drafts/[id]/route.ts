import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/admin/content-drafts/[id]
//
// Fetch a full draft (output + markdown) for the admin review screen.
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await ctx.params;
  const draft = await prisma.contentDraft.findUnique({
    where: { id },
    include: {
      org: { select: { id: true, name: true } },
      property: { select: { id: true, name: true, websiteUrl: true } },
      recommendation: {
        select: {
          id: true,
          title: true,
          category: true,
          severity: true,
        },
      },
    },
  });
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ draft });
}
