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
import { assertQuota, QuotaExceededError } from "@/lib/content/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Claude resolves in 8-15s per format; 60s cap matches sibling routes.
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/portal/content
//
// Used by /portal/content/new. Creates a ContentDraft row, runs the
// initial Claude generation pass, and returns the persisted id so the
// caller can redirect into the editor.
//
// Differences vs the existing /api/portal/seo/drafts endpoint:
//   - propertyId is OPTIONAL (BLOG_POST / FAQ_BLOCK don't require one).
//   - quota is enforced via lib/content/quota.ts (the sibling shared
//     module) rather than the legacy rate-limit count.
//   - The draft lands as status=PENDING_REVIEW once generated. Submit-
//     for-approval is a no-op on first save (the user re-submits via
//     /api/portal/content/[id]/submit after editing).
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  format: z.nativeEnum(ContentFormat),
  title: z.string().min(1).max(140),
  brief: z.string().min(1).max(2000).optional(),
  targetQuery: z.string().max(200).optional().nullable(),
  targetWordCount: z.number().int().min(0).max(5000).optional(),
  propertyId: z.string().nullable().optional(),
});

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

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch (err) {
    const detail =
      err instanceof Error ? err.message.slice(0, 300) : "invalid";
    return NextResponse.json(
      { error: "Invalid body", detail },
      { status: 400 },
    );
  }

  // Quota gate — shared with lib/content/quota.ts so the meter UI and
  // every other content endpoint agree on counts.
  try {
    await assertQuota({ orgId: scope.orgId, format: payload.format });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: err.message,
          quota: {
            format: err.format,
            limit: err.limit,
            used: err.used,
          },
        },
        { status: 429 },
      );
    }
    throw err;
  }

  // Resolve property when supplied. Property is optional for the new
  // editor — operators can scaffold a generic blog post without
  // anchoring to a building.
  let property:
    | {
        id: string;
        orgId: string;
        name: string;
        city: string | null;
        state: string | null;
        addressLine1: string | null;
        propertyType: string | null;
        residentialSubtype: string | null;
        commercialSubtype: string | null;
        totalUnits: number | null;
        description: string | null;
      }
    | null = null;
  if (payload.propertyId) {
    const found = await prisma.property.findFirst({
      where: {
        id: payload.propertyId,
        ...tenantWhere<{ orgId?: string }>(scope),
      } as never,
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
      },
    });
    if (!found) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }
    if (
      scope.allowedPropertyIds &&
      !scope.allowedPropertyIds.includes(found.id)
    ) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }
    property = found;
  }

  const brief = payload.brief?.trim() || payload.title;

  // Create the placeholder row up front so the UI can resolve the id
  // even if generation later fails.
  const placeholder = await prisma.contentDraft.create({
    data: {
      orgId: scope.orgId,
      propertyId: property?.id ?? null,
      format: payload.format,
      brief,
      targetQuery: payload.targetQuery?.trim() || null,
      status: DraftStatus.GENERATING,
      aiContext: {
        title: payload.title,
        targetWordCount: payload.targetWordCount ?? null,
        targetKeywords: payload.targetQuery ? [payload.targetQuery] : [],
      },
    },
    select: { id: true },
  });

  // Build the drafter context. When no property is anchored, synthesize
  // a minimal placeholder so the SEO drafters (which all expect a
  // property block) still work for portfolio-level pieces.
  const ctx: DrafterContext = {
    brief,
    targetQuery: payload.targetQuery ?? undefined,
    property: property
      ? {
          name: property.name,
          city: property.city,
          state: property.state,
          addressLine1: property.addressLine1,
          propertyType: property.propertyType,
          residentialSubtype: property.residentialSubtype,
          commercialSubtype: property.commercialSubtype,
          totalUnits: property.totalUnits,
          description: property.description,
          facts: [],
        }
      : {
          name: payload.title,
          city: null,
          state: null,
          addressLine1: null,
          propertyType: null,
          residentialSubtype: null,
          commercialSubtype: null,
          totalUnits: null,
          description: null,
          facts: [],
        },
  };

  try {
    const result = await draftContent(payload.format, ctx);
    const now = new Date();
    const htmlBody = renderToHtml(payload.format, result.output, payload.title);

    await prisma.contentDraft.update({
      where: { id: placeholder.id },
      data: {
        output: result.output as never,
        outputMarkdown: result.markdown,
        htmlBody,
        model: result.model,
        estimatedScore: result.estimatedScore,
        status: DraftStatus.PENDING_REVIEW,
        generatedAt: now,
        submittedAt: now,
      },
    });

    return NextResponse.json({ ok: true, id: placeholder.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 500) : "Generation failed";
    // Roll the placeholder forward to REJECTED so it doesn't get stuck
    // in GENERATING forever — operators can delete it from the list.
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
      { error: "Generation failed", detail: message, id: placeholder.id },
      { status: 502 },
    );
  }
}

// ---------------------------------------------------------------------------
// renderToHtml — turn a structured drafter output into the TipTap-
// compatible HTML body the editor opens with. The drafters return
// shape-per-format; we know the BLOG_POST + NEIGHBORHOOD_PAGE shapes
// because draft-writer.ts owns the schemas. Anything else falls back
// to wrapping the markdown in <p> blocks.
// ---------------------------------------------------------------------------
function renderToHtml(
  format: ContentFormat,
  output: Record<string, unknown>,
  fallbackTitle: string,
): string {
  const e = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  if (format === "BLOG_POST") {
    const title =
      typeof output.title === "string" ? output.title : fallbackTitle;
    const intro =
      typeof output.intro === "string" ? output.intro : "";
    const sections = Array.isArray(output.sections) ? output.sections : [];
    const faqs = Array.isArray(output.faqs) ? output.faqs : [];
    const closing =
      typeof output.closing === "string" ? output.closing : "";
    const parts: string[] = [`<h1>${e(title)}</h1>`];
    if (intro) parts.push(`<p>${e(intro)}</p>`);
    for (const s of sections as Array<Record<string, unknown>>) {
      const heading = typeof s.heading === "string" ? s.heading : "";
      const body = typeof s.body === "string" ? s.body : "";
      if (heading) parts.push(`<h2>${e(heading)}</h2>`);
      const paragraphs = body
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      for (const p of paragraphs) parts.push(`<p>${e(p)}</p>`);
    }
    if (faqs.length > 0) {
      parts.push(`<h2>Frequently asked questions</h2>`);
      for (const f of faqs as Array<Record<string, unknown>>) {
        const q = typeof f.question === "string" ? f.question : "";
        const a = typeof f.answer === "string" ? f.answer : "";
        if (q) parts.push(`<h3>${e(q)}</h3>`);
        if (a) parts.push(`<blockquote><p>${e(a)}</p></blockquote>`);
      }
    }
    if (closing) parts.push(`<p>${e(closing)}</p>`);
    return parts.join("\n");
  }

  if (format === "NEIGHBORHOOD_PAGE") {
    const title =
      typeof output.title === "string" ? output.title : fallbackTitle;
    const intro = typeof output.intro === "string" ? output.intro : "";
    const sections = Array.isArray(output.sections) ? output.sections : [];
    const faqs = Array.isArray(output.faqs) ? output.faqs : [];
    const parts: string[] = [`<h1>${e(title)}</h1>`];
    if (intro) parts.push(`<p>${e(intro)}</p>`);
    for (const s of sections as Array<Record<string, unknown>>) {
      const heading = typeof s.heading === "string" ? s.heading : "";
      const body = typeof s.body === "string" ? s.body : "";
      if (heading) parts.push(`<h2>${e(heading)}</h2>`);
      if (body) parts.push(`<p>${e(body)}</p>`);
    }
    if (faqs.length > 0) {
      parts.push(`<h2>FAQs</h2>`);
      for (const f of faqs as Array<Record<string, unknown>>) {
        const q = typeof f.question === "string" ? f.question : "";
        const a = typeof f.answer === "string" ? f.answer : "";
        if (q) parts.push(`<h3>${e(q)}</h3>`);
        if (a) parts.push(`<blockquote><p>${e(a)}</p></blockquote>`);
      }
    }
    return parts.join("\n");
  }

  // Default: wrap each markdown-ish line in <p>.
  const md =
    typeof (output as { markdown?: unknown }).markdown === "string"
      ? ((output as { markdown: string }).markdown)
      : "";
  if (md) {
    return md
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) =>
        p.startsWith("# ")
          ? `<h1>${e(p.slice(2))}</h1>`
          : p.startsWith("## ")
            ? `<h2>${e(p.slice(3))}</h2>`
            : p.startsWith("### ")
              ? `<h3>${e(p.slice(4))}</h3>`
              : `<p>${e(p)}</p>`,
      )
      .join("\n");
  }
  return `<h1>${e(fallbackTitle)}</h1><p></p>`;
}
