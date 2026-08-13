import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  requireWritableWorkspace,
  ForbiddenError,
  tenantWhere,
  propertyInScope,
} from "@/lib/tenancy/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /api/portal/seo/aeo/custom-prompts
//
// Operator-managed AEO prompts, run verbatim against every enabled engine in
// each scan alongside the generated prompts. Same shape as
// /api/portal/seo/target-queries: GET list, POST create (capped), PATCH
// toggle active. Cost note: each active prompt = 1 call per engine per scan,
// hence the hard cap of 10 active per property.
// ---------------------------------------------------------------------------

const MAX_ACTIVE_PER_PROPERTY = 10;

const createSchema = z.object({
  propertyId: z.string().min(1),
  prompt: z.string().trim().min(10).max(300),
  /** Funnel tag (2026-08-14): branded / tof / bof. Optional — untagged
   *  prompts behave exactly as before. */
  tag: z.enum(["branded", "tof", "bof"]).optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});

export async function GET(req: NextRequest) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const propertyId = req.nextUrl.searchParams.get("propertyId");
  const where: Record<string, unknown> = { ...tenantWhere(scope) };
  if (propertyId) {
    if (!propertyInScope(scope, propertyId)) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }
    where.propertyId = propertyId;
  } else if (scope.allowedPropertyIds) {
    where.propertyId = { in: scope.allowedPropertyIds };
  }

  const prompts = await prisma.aeoCustomPrompt.findMany({
    where: where as never,
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return NextResponse.json({
    prompts: prompts.map((p) => ({
      id: p.id,
      propertyId: p.propertyId,
      prompt: p.prompt,
      tag: p.tag,
      active: p.active,
      createdAt: p.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  let parsed: z.infer<typeof createSchema>;
  try {
    parsed = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const property = await prisma.property.findFirst({
    where: { id: parsed.propertyId, ...tenantWhere(scope) },
    select: { id: true, orgId: true },
  });
  if (!property || !propertyInScope(scope, property.id)) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Cost cap — each active prompt fans out to every engine on every scan.
  const activeCount = await prisma.aeoCustomPrompt.count({
    where: { orgId: property.orgId, propertyId: property.id, active: true },
  });
  if (activeCount >= MAX_ACTIVE_PER_PROPERTY) {
    return NextResponse.json(
      {
        error: `Maximum ${MAX_ACTIVE_PER_PROPERTY} active custom prompts per property. Mark an old one inactive first.`,
      },
      { status: 400 },
    );
  }

  const text = parsed.prompt.trim();
  const created = await prisma.aeoCustomPrompt
    .upsert({
      where: {
        orgId_propertyId_prompt: {
          orgId: property.orgId,
          propertyId: property.id,
          prompt: text,
        },
      },
      create: {
        orgId: property.orgId,
        propertyId: property.id,
        prompt: text,
        tag: parsed.tag ?? null,
        addedBy: scope.userId,
        active: true,
      },
      update: { active: true, ...(parsed.tag ? { tag: parsed.tag } : {}) },
    })
    .catch(() => null);

  if (!created) {
    return NextResponse.json(
      { error: "Could not save prompt" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, prompt: created });
}

export async function PATCH(req: NextRequest) {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  let parsed: z.infer<typeof patchSchema>;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Re-activation counts against the same cap as creation.
  if (parsed.active) {
    const row = await prisma.aeoCustomPrompt.findFirst({
      where: { id: parsed.id, ...tenantWhere(scope) },
      select: { propertyId: true, orgId: true, active: true },
    });
    if (!row || !propertyInScope(scope, row.propertyId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!row.active) {
      const activeCount = await prisma.aeoCustomPrompt.count({
        where: {
          orgId: row.orgId,
          propertyId: row.propertyId,
          active: true,
        },
      });
      if (activeCount >= MAX_ACTIVE_PER_PROPERTY) {
        return NextResponse.json(
          {
            error: `Maximum ${MAX_ACTIVE_PER_PROPERTY} active custom prompts per property.`,
          },
          { status: 400 },
        );
      }
    }
  }

  const result = await prisma.aeoCustomPrompt.updateMany({
    where: {
      id: parsed.id,
      ...tenantWhere(scope),
      ...(scope.allowedPropertyIds
        ? { propertyId: { in: scope.allowedPropertyIds } }
        : {}),
    },
    data: { active: parsed.active },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
