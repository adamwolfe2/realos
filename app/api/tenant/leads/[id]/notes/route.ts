import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  tenantWhere,
  ForbiddenError,
} from "@/lib/tenancy/scope";
import { NoteType } from "@prisma/client";

const body = z.object({ body: z.string().min(1).max(5000) });

// DECISION: lead notes live on ClientNote with noteType=LEAD_INTERACTION. The
// lead id is embedded in the body as "[lead:<id>]" so we can query back
// without adding a dedicated LeadNote model. Keeps the schema tight.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireScope();
    const { id } = await params;

    const owned = await prisma.lead.findFirst({
      where: { id, ...tenantWhere(scope) },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const note = await prisma.clientNote.create({
      data: {
        orgId: scope.orgId,
        authorUserId: scope.userId,
        noteType: NoteType.LEAD_INTERACTION,
        body: `[lead:${id}] ${parsed.data.body}`,
      },
    });

    await prisma.lead.update({
      where: { id },
      data: { lastActivityAt: new Date() },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
