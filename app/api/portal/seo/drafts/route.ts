import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { ContentFormat, DraftStatus } from "@prisma/client";
import { draftContent, type DrafterContext } from "@/lib/seo/draft-writer";
import { notifyDraftSubmitted } from "@/lib/notifications/create";
import { sendDraftSubmittedEmail } from "@/lib/email/draft-submitted";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Claude generation typically resolves in 8-15s; cap at 60s for headroom.
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// /api/portal/seo/drafts
//
// GET  - list drafts (scoped to org, optionally filtered by propertyId or
//        status). Used by the operator inbox + the dashboard "in flight"
//        widget.
// POST - kick off a new draft. Returns the persisted row immediately with
//        status PENDING_REVIEW once generation completes. Generation runs
//        synchronously within the route's maxDuration window — Claude
//        completes well under 60s for every format.
// ---------------------------------------------------------------------------

const createSchema = z.object({
  propertyId: z.string().min(1),
  format: z.nativeEnum(ContentFormat),
  brief: z.string().min(8).max(2000),
  targetQuery: z.string().min(2).max(200).optional(),
  recommendationId: z.string().min(1).optional(),
  audience: z.string().max(200).optional(),
  voice: z.string().max(200).optional(),
});

const STATUS_VALUES = Object.values(DraftStatus) as DraftStatus[];

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

  const sp = req.nextUrl.searchParams;
  const propertyId = sp.get("propertyId");
  const statusParam = sp.get("status");
  const status =
    statusParam && (STATUS_VALUES as string[]).includes(statusParam)
      ? (statusParam as DraftStatus)
      : null;

  const where: Record<string, unknown> = { ...tenantWhere(scope) };
  if (propertyId) {
    if (
      scope.allowedPropertyIds &&
      !scope.allowedPropertyIds.includes(propertyId)
    ) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }
    where.propertyId = propertyId;
  }
  if (status) where.status = status;

  const drafts = await prisma.contentDraft.findMany({
    where: where as never,
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      propertyId: true,
      format: true,
      brief: true,
      targetQuery: true,
      status: true,
      estimatedScore: true,
      generatedAt: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNotes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ drafts });
}

export async function POST(req: NextRequest) {
  let scope;
  try {
    scope = await requireScope();
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

  // Tenant + property check
  const property = await prisma.property.findFirst({
    where: { id: parsed.propertyId, ...tenantWhere(scope) },
    select: {
      id: true,
      orgId: true,
      name: true,
      city: true,
      state: true,
      addressLine1: true,
      propertyType: true,
      residentialSubtype: true,
      commercialSubtype: true,
      totalUnits: true,
      description: true,
      org: { select: { name: true } },
    },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  if (
    scope.allowedPropertyIds &&
    !scope.allowedPropertyIds.includes(property.id)
  ) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // H1 fix — when a recommendationId is supplied, verify it belongs to this
  // org + property so a portal user can't link a draft to (and later close)
  // a recommendation in another tenant via the admin approve flow.
  if (parsed.recommendationId) {
    const rec = await prisma.seoActionRecommendation
      .findFirst({
        where: {
          id: parsed.recommendationId,
          orgId: property.orgId,
          propertyId: property.id,
        },
        select: { id: true },
      })
      .catch(() => null);
    if (!rec) {
      return NextResponse.json(
        { error: "Invalid recommendation" },
        { status: 400 },
      );
    }
  }

  // H2 fix — sliding-window rate limit. Beyond 30 drafts/24h per org or
  // 5 drafts/hour per user, ask the caller to slow down. Combined with the
  // in-flight cap below, this bounds DoS / spend risk.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [perOrgDay, perUserHour] = await Promise.all([
    prisma.contentDraft.count({
      where: {
        orgId: property.orgId,
        createdAt: { gte: oneDayAgo },
      },
    }),
    prisma.contentDraft.count({
      where: {
        orgId: property.orgId,
        createdAt: { gte: oneHourAgo },
      },
    }),
  ]);
  if (perOrgDay >= 30 || perUserHour >= 5) {
    return NextResponse.json(
      {
        error:
          "Draft rate limit hit. Limits: 30 per org per day, 5 per hour. Try again later.",
      },
      { status: 429 },
    );
  }

  // Pull operator-confirmed facts for AEO grounding. Best-effort -
  // missing PropertyMention rows shouldn't block draft generation.
  const factRows = await prisma.propertyMention
    .findMany({
      where: { propertyId: property.id, flagged: false },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { excerpt: true },
    })
    .catch(() => [] as Array<{ excerpt: string }>);
  const facts = factRows.map((f) => f.excerpt).filter(Boolean);

  // Rate limit: max 10 in-flight drafts per org. Past 10, ask the
  // operator to wait or cancel old ones.
  const inFlight = await prisma.contentDraft.count({
    where: {
      orgId: property.orgId,
      status: { in: [DraftStatus.GENERATING, DraftStatus.PENDING_REVIEW] },
    },
  });
  if (inFlight >= 10) {
    return NextResponse.json(
      {
        error:
          "Maximum 10 in-flight drafts. Review or dismiss existing drafts first.",
      },
      { status: 429 },
    );
  }

  // Create the placeholder row up front so the UI can poll its id.
  const placeholder = await prisma.contentDraft.create({
    data: {
      orgId: property.orgId,
      propertyId: property.id,
      format: parsed.format,
      brief: parsed.brief,
      targetQuery: parsed.targetQuery ?? null,
      recommendationId: parsed.recommendationId ?? null,
      status: DraftStatus.GENERATING,
    },
  });

  // Generate inline — Claude resolves in 8-15s per format. If anything
  // goes wrong we flip the placeholder to REJECTED with reviewNotes.
  const ctx: DrafterContext = {
    brief: parsed.brief,
    targetQuery: parsed.targetQuery,
    audience: parsed.audience,
    voice: parsed.voice,
    property: {
      name: property.name,
      city: property.city,
      state: property.state,
      addressLine1: property.addressLine1,
      propertyType: property.propertyType,
      residentialSubtype: property.residentialSubtype,
      commercialSubtype: property.commercialSubtype,
      totalUnits: property.totalUnits,
      description: property.description,
      facts,
    },
  };

  try {
    const result = await draftContent(parsed.format, ctx);
    const submittedAt = new Date();
    const updated = await prisma.contentDraft.update({
      where: { id: placeholder.id },
      data: {
        output: result.output as never,
        outputMarkdown: result.markdown,
        model: result.model,
        estimatedScore: result.estimatedScore,
        status: DraftStatus.PENDING_REVIEW,
        generatedAt: submittedAt,
        submittedAt,
      },
    });

    // Notify the agency that a draft needs review. Fire-and-forget.
    void notifyDraftSubmitted({
      draftId: updated.id,
      format: updated.format,
      brief: updated.brief,
      clientOrgName: property.org?.name ?? "Client",
      propertyName: property.name,
    }).catch(() => undefined);
    void sendDraftSubmittedEmail({
      draftId: updated.id,
      format: updated.format,
      brief: updated.brief,
      targetQuery: updated.targetQuery,
      estimatedScore: updated.estimatedScore,
      clientOrgName: property.org?.name ?? "Client",
      propertyName: property.name,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, draft: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 500) : "Generation failed";
    await prisma.contentDraft
      .update({
        where: { id: placeholder.id },
        data: {
          status: DraftStatus.REJECTED,
          reviewNotes: `Auto-rejected: ${message}`,
          reviewedAt: new Date(),
        },
      })
      .catch(() => undefined);
    return NextResponse.json(
      { error: "Generation failed", detail: message },
      { status: 502 },
    );
  }
}
