import { NextResponse } from "next/server";
import { ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// DELETE /api/admin/proposals/[id]
//   Hard-deletes a proposal — allowed ONLY when status = DRAFT. Sent /
//   accepted proposals are records-of-financial-intent; they get voided,
//   never deleted.
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await requireAgency();
  const { id } = await ctx.params;
  const row = await prisma.proposal.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.status !== ProposalStatus.DRAFT) {
    return NextResponse.json(
      { error: "Only DRAFT proposals can be deleted; void instead." },
      { status: 409 },
    );
  }
  await prisma.proposal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
