import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { DraftStatus, Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /api/portal/content/[id]
//
// GET    — fetch the draft, scoped to the operator's org.
// PATCH  — autosave hook from the editor. Persists htmlBody,
//          outputMarkdown, aiContext, chatThread, and an optional title
//          (which we merge into aiContext + ensure the H1 reflects).
// DELETE — only allowed for drafts the operator owns AND are still in
//          GENERATING or PENDING_REVIEW state. Once approved or shipped
//          the audit trail must persist.
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  htmlBody: z.string().max(200_000).optional(),
  outputMarkdown: z.string().max(200_000).optional(),
  title: z.string().max(280).optional(),
  aiContext: z.record(z.unknown()).optional(),
  chatThread: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(20_000),
        ts: z.string().optional(),
      }),
    )
    .max(200)
    .optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function loadDraft(id: string) {
  const scope = await requireScope();
  const draft = await prisma.contentDraft.findFirst({
    where: { id, ...tenantWhere<{ orgId?: string }>(scope) } as never,
    select: {
      id: true,
      orgId: true,
      propertyId: true,
      format: true,
      brief: true,
      targetQuery: true,
      status: true,
      htmlBody: true,
      outputMarkdown: true,
      output: true,
      aiContext: true,
      chatThread: true,
      estimatedScore: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!draft) return { scope, draft: null as null };
  if (
    scope.allowedPropertyIds &&
    draft.propertyId &&
    !scope.allowedPropertyIds.includes(draft.propertyId)
  ) {
    return { scope, draft: null as null };
  }
  return { scope, draft };
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const { draft } = await loadDraft(id);
    if (!draft) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const { draft } = await loadDraft(id);
    if (!draft) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let parsed: z.infer<typeof patchSchema>;
    try {
      parsed = patchSchema.parse(await req.json());
    } catch (err) {
      const detail =
        err instanceof Error ? err.message.slice(0, 300) : "invalid";
      return NextResponse.json(
        { error: "Invalid body", detail },
        { status: 400 },
      );
    }

    const data: Prisma.ContentDraftUpdateInput = {};
    if (parsed.htmlBody !== undefined) data.htmlBody = parsed.htmlBody;
    if (parsed.outputMarkdown !== undefined) {
      data.outputMarkdown = parsed.outputMarkdown;
    }
    if (parsed.aiContext !== undefined) {
      data.aiContext = parsed.aiContext as Prisma.InputJsonValue;
    }
    if (parsed.chatThread !== undefined) {
      data.chatThread = parsed.chatThread as unknown as Prisma.InputJsonValue;
    }
    if (parsed.title !== undefined) {
      const existingCtx =
        draft.aiContext && typeof draft.aiContext === "object"
          ? (draft.aiContext as Record<string, unknown>)
          : {};
      data.aiContext = {
        ...existingCtx,
        title: parsed.title,
      } as Prisma.InputJsonValue;
    }

    const updated = await prisma.contentDraft.update({
      where: { id: draft.id },
      data,
      select: { id: true, updatedAt: true, status: true },
    });

    return NextResponse.json({ ok: true, draft: updated });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const { draft } = await loadDraft(id);
    if (!draft) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      draft.status !== DraftStatus.GENERATING &&
      draft.status !== DraftStatus.PENDING_REVIEW
    ) {
      return NextResponse.json(
        {
          error:
            "Only drafts in GENERATING or PENDING_REVIEW can be deleted.",
        },
        { status: 409 },
      );
    }
    await prisma.contentDraft.delete({ where: { id: draft.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}
