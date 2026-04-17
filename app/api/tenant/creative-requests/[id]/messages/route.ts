import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  tenantWhere,
  ForbiddenError,
} from "@/lib/tenancy/scope";
import { CreativeRequestStatus, Prisma } from "@prisma/client";

const schema = z.object({
  content: z.string().min(1).max(5000),
  attachmentUrls: z.array(z.string().url()).max(10).optional(),
});

type CreativeMessage = {
  role: "client" | "agency";
  from: "client" | "agency";
  content: string;
  attachmentUrls: string[];
  timestamp: string;
  userId?: string | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireScope();
    const { id } = await params;

    // Agency callers only reach this endpoint when impersonating, in which
    // case tenantWhere(scope) uses the impersonated orgId. Direct
    // /api/admin/* agency-scoped access lives in its own route.
    const current = await prisma.creativeRequest.findFirst({
      where: { id, ...tenantWhere(scope) },
      select: { id: true, messages: true, status: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const role: "client" | "agency" = scope.isAgency ? "agency" : "client";
    const existingMessages = Array.isArray(current.messages)
      ? (current.messages as unknown as CreativeMessage[])
      : [];
    const next: CreativeMessage[] = [
      ...existingMessages,
      {
        role,
        from: role,
        content: data.content,
        attachmentUrls: data.attachmentUrls ?? [],
        timestamp: new Date().toISOString(),
        userId: scope.userId,
      },
    ];

    // First agency reply advances SUBMITTED → IN_REVIEW.
    const shouldAdvance =
      role === "agency" && current.status === CreativeRequestStatus.SUBMITTED;

    await prisma.creativeRequest.update({
      where: { id },
      data: {
        messages: next as unknown as Prisma.InputJsonValue,
        status: shouldAdvance
          ? CreativeRequestStatus.IN_REVIEW
          : current.status,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
