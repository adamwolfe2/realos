import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { FLAG_TYPES } from "@/components/portal/conversations/flag-pill";

// ---------------------------------------------------------------------------
// /api/portal/conversations/[id]/flags
//
// Operator annotations on a chatbot conversation. Every call is tenant-scoped
// via requireScope + tenantWhere. POST adds a flag (optionally with a note),
// DELETE removes all rows of a given flag type.
//
// The operator treats flags as a set per conversation, but the underlying
// table allows multiple rows per type so notes can be stacked over time. The
// returned `flags` list is the full current set for the conversation.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  flag: z.enum(FLAG_TYPES),
  note: z.string().max(2000).optional(),
});

async function loadFlags(conversationId: string, orgId: string) {
  const rows = await prisma.conversationFlag.findMany({
    where: { conversationId, orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      flag: true,
      note: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    flag: r.flag,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function assertConversationAccess(id: string, orgId: string) {
  const row = await prisma.chatbotConversation.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  return !!row;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireScope();
    const { id } = await params;
    const ok = await assertConversationAccess(id, scope.orgId);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const flags = await loadFlags(id, scope.orgId);
    return NextResponse.json({ flags });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET flags failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireScope();
    const { id } = await params;
    const ok = await assertConversationAccess(id, scope.orgId);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await prisma.conversationFlag.create({
      data: {
        conversationId: id,
        orgId: scope.orgId,
        flag: parsed.data.flag,
        note: parsed.data.note ?? null,
        createdByUserId: scope.userId,
      },
    });

    const flags = await loadFlags(id, scope.orgId);
    return NextResponse.json({ flags });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST flag failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireScope();
    const { id } = await params;
    const ok = await assertConversationAccess(id, scope.orgId);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.pick({ flag: true }).safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await prisma.conversationFlag.deleteMany({
      where: {
        conversationId: id,
        orgId: scope.orgId,
        flag: parsed.data.flag,
      },
    });

    const flags = await loadFlags(id, scope.orgId);
    return NextResponse.json({ flags });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("DELETE flag failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
