// ---------------------------------------------------------------------------
// PATCH /api/admin/clients/[id]/content-quota
//
// Admin-only. Writes Organization.contentQuotaOverride. The `id` param is
// the Organization.id; the slug is named `[id]` to match the convention
// used by every other route under app/api/admin/clients/[id]/* and to
// avoid Next.js's "different slug names for the same dynamic path" error
// that fires when sibling dynamic dirs disagree on their param name.
//
// Request body:
//   { overrides: Record<ContentFormat, number | null> }
//
// Semantics:
//   * Non-null, finite integer ≥ 0 → set that format's per-month cap.
//   * null (or omitted)            → revert to plan default.
//
// The stored Json drops null entries so getQuotaForOrg's parseOverride
// only ever sees real numbers.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FORMATS = [
  "BLOG_POST",
  "NEIGHBORHOOD_PAGE",
  "PROPERTY_DESCRIPTION",
  "META_REWRITE",
  "FAQ_BLOCK",
  "AD_COPY",
] as const;

type AllowedFormat = (typeof ALLOWED_FORMATS)[number];

const overrideValue = z.union([
  z.null(),
  z.number().int().nonnegative().max(100_000),
]);

const bodySchema = z.object({
  overrides: z.record(z.string(), overrideValue),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id: orgId } = await ctx.params;

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    const json = await req.json();
    parsedBody = bodySchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? `Invalid body: ${err.issues.map((i) => i.message).join(", ")}`
            : "Invalid JSON body",
      },
      { status: 400 },
    );
  }

  // Strip nulls + reject keys outside the canonical format set so a stray
  // override blob can't pollute the JSON column with unrelated fields.
  const clean: Partial<Record<AllowedFormat, number>> = {};
  for (const [key, value] of Object.entries(parsedBody.overrides)) {
    if (!(ALLOWED_FORMATS as readonly string[]).includes(key)) continue;
    if (value === null) continue;
    clean[key as AllowedFormat] = value;
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      // Empty object collapses to JSON `{}` — explicit "no overrides".
      contentQuotaOverride:
        Object.keys(clean).length === 0
          ? (null as unknown as Prisma.InputJsonValue)
          : (clean as Prisma.InputJsonValue),
    },
    select: { id: true, contentQuotaOverride: true },
  });

  return NextResponse.json({
    orgId: updated.id,
    overrides: updated.contentQuotaOverride ?? {},
  });
}
