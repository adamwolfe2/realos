import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { AuditAction, Prisma } from "@prisma/client";

const patchSchema = z.object({
  siteTitle: z.string().max(200).optional().nullable(),
  tagline: z.string().max(300).optional().nullable(),
  heroHeadline: z.string().max(300).optional().nullable(),
  heroSubheadline: z.string().max(500).optional().nullable(),
  heroImageUrl: z.string().url().optional().nullable(),
  aboutCopy: z.string().max(10_000).optional().nullable(),
  primaryCtaText: z.string().max(100).optional().nullable(),
  primaryCtaUrl: z.string().url().optional().nullable(),
  phoneNumber: z.string().max(40).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(400).optional().nullable(),
  ogImageUrl: z.string().url().optional().nullable(),
  showListings: z.boolean().optional(),
  showFloorPlans: z.boolean().optional(),
  showAmenities: z.boolean().optional(),
  showReviews: z.boolean().optional(),
  showBlog: z.boolean().optional(),
  enableExitIntent: z.boolean().optional(),
  enableChatbot: z.boolean().optional(),
  enablePixel: z.boolean().optional(),
  chatbotAvatarUrl: z.string().url().optional().nullable(),
  chatbotPersonaName: z.string().max(100).optional().nullable(),
  chatbotGreeting: z.string().max(500).optional().nullable(),
  chatbotKnowledgeBase: z.string().max(50_000).optional().nullable(),
  chatbotIdleTriggerSeconds: z.number().int().min(0).max(600).optional(),
  exitIntentHeadline: z.string().max(200).optional().nullable(),
  exitIntentBody: z.string().max(500).optional().nullable(),
  exitIntentCtaText: z.string().max(100).optional().nullable(),
  exitIntentOfferCode: z.string().max(100).optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  try {
    const scope = await requireScope();
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const config = await prisma.tenantSiteConfig.upsert({
      where: { orgId: scope.orgId },
      update: data as Prisma.TenantSiteConfigUpdateInput,
      create: {
        ...(data as Prisma.TenantSiteConfigUncheckedCreateInput),
        orgId: scope.orgId,
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "TenantSiteConfig",
        entityId: config.id,
        description: "Tenant site config updated",
        diff: parsed.data as Prisma.InputJsonValue,
      }),
    });

    // Revalidate the tenant marketing site so the next render picks up the
    // new copy. Sprint 07 builds out the actual paths; for now just bust
    // the catch-all.
    revalidatePath("/tenant-site", "layout");

    return NextResponse.json({ config });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
