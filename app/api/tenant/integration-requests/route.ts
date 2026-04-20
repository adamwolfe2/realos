import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireScope, auditPayload, ForbiddenError } from "@/lib/tenancy/scope";
import {
  AuditAction,
  IntegrationRequestStatus,
  NoteType,
} from "@prisma/client";
import { findIntegration } from "@/lib/integrations/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = z.object({
  integrationSlug: z.string().min(1),
  message: z.string().max(2000).optional(),
});

// POST /api/tenant/integration-requests
// Tenant-scoped: operator clicks "Request activation" on an integration tile.
// Creates an IntegrationRequest row (dedupe: if there's already a pending
// one, return the existing id) and a pinned ClientNote so the agency admin
// sees the request in the client detail page without building a dedicated
// admin queue for it.
export async function POST(req: NextRequest) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  let parsed;
  try {
    parsed = body.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid body", details: err.issues },
        { status: 400 }
      );
    }
    throw err;
  }

  const def = findIntegration(parsed.integrationSlug);
  if (!def) {
    return NextResponse.json(
      { error: "Unknown integration" },
      { status: 404 }
    );
  }

  const existing = await prisma.integrationRequest.findFirst({
    where: {
      orgId: scope.orgId,
      integrationSlug: def.slug,
      status: {
        in: [
          IntegrationRequestStatus.PENDING,
          IntegrationRequestStatus.IN_PROGRESS,
        ],
      },
    },
  });

  if (existing) {
    return NextResponse.json({ ok: true, id: existing.id, deduped: true });
  }

  const request = await prisma.integrationRequest.create({
    data: {
      orgId: scope.orgId,
      integrationSlug: def.slug,
      requestedByEmail: scope.email,
      message: parsed.message ?? null,
      status: IntegrationRequestStatus.PENDING,
    },
  });

  // Side effects: audit + pinned note on the client record so the agency
  // team notices the request without needing a dedicated admin queue UI.
  await Promise.all([
    prisma.auditEvent
      .create({
        data: auditPayload(scope, {
          action: AuditAction.CREATE,
          entityType: "IntegrationRequest",
          entityId: request.id,
          description: `Requested activation of ${def.name}`,
        }),
      })
      .catch((err) => {
        console.error("[integration-request] audit failed:", err);
      }),
    prisma.clientNote
      .create({
        data: {
          orgId: scope.orgId,
          authorUserId: scope.userId,
          noteType: NoteType.SUPPORT,
          pinned: true,
          body:
            `Integration activation requested: ${def.name}.\n\n` +
            (parsed.message
              ? `From ${scope.email}:\n${parsed.message}`
              : `From ${scope.email}.`),
        },
      })
      .catch((err) => {
        console.error("[integration-request] note failed:", err);
      }),
  ]);

  return NextResponse.json({ ok: true, id: request.id });
}
