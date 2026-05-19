"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AuditAction,
  NeighborhoodPageStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import {
  generateNeighborhoodPage,
  slugifyNeighborhood,
} from "@/lib/neighborhood/generate";

// ---------------------------------------------------------------------------
// Server actions backing /portal/seo/neighborhoods.
//
// Every mutation:
//   1. requires an authenticated scope
//   2. role-gates to operator-admin tiers (CLIENT_OWNER / CLIENT_ADMIN,
//      plus AGENCY_OWNER / AGENCY_ADMIN when impersonating a client)
//   3. validates with zod
//   4. is tenant-scoped via tenantWhere()
//   5. writes an AuditEvent
//   6. revalidates the relevant portal + public surfaces
// ---------------------------------------------------------------------------

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const ADMIN_ROLES = new Set<UserRole>([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
]);

async function requireAdminScope() {
  const scope = await requireScope();
  const actor = await prisma.user.findUnique({
    where: { clerkUserId: scope.clerkUserId },
    select: { role: true },
  });
  if (!actor || !ADMIN_ROLES.has(actor.role)) {
    throw new ForbiddenError(
      "Only workspace admins can manage neighborhood pages.",
    );
  }
  return scope;
}

const createSchema = z.object({
  city: z.string().trim().min(2).max(100),
  state: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  neighborhood: z.string().trim().min(2).max(120),
  propertyId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  quality: z.enum(["default", "high"]).optional(),
});

const updateSchema = z.object({
  title: z.string().trim().min(4).max(160).optional(),
  metaDescription: z.string().trim().min(20).max(200).optional(),
  intro: z.string().trim().min(40).max(4000).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().max(80).nullable().optional(),
  neighborhood: z.string().trim().min(2).max(120).optional(),
  propertyId: z.string().trim().nullable().optional(),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(2).max(160),
        body: z.string().trim().min(20).max(6000),
      }),
    )
    .min(1)
    .max(10)
    .optional(),
  faqs: z
    .array(
      z.object({
        question: z.string().trim().min(4).max(240),
        answer: z.string().trim().min(10).max(2400),
      }),
    )
    .min(1)
    .max(20)
    .optional(),
  aiCitations: z.array(z.string().trim().min(4).max(280)).max(20).optional(),
});

// Generate a unique slug. If the base slug collides on this org, suffix
// `-2`, `-3`, ... up to -20 before giving up.
async function uniqueSlug(orgId: string, city: string, neighborhood: string) {
  const base = slugifyNeighborhood(city, neighborhood);
  let slug = base;
  for (let i = 2; i < 20; i++) {
    const existing = await prisma.neighborhoodPage.findUnique({
      where: { orgId_slug: { orgId, slug } },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createNeighborhoodPage(input: {
  city: string;
  state?: string | null;
  neighborhood: string;
  propertyId?: string | null;
  quality?: "default" | "high";
}): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const scope = await requireAdminScope();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { ok: false, error: first?.message ?? "Validation failed" };
    }
    const { city, state, neighborhood, propertyId, quality } = parsed.data;

    // Validate property belongs to the org if provided.
    if (propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, orgId: scope.orgId },
        select: { id: true },
      });
      if (!property) {
        return { ok: false, error: "Property not found in your workspace" };
      }
    }

    const generated = await generateNeighborhoodPage({
      orgId: scope.orgId,
      propertyId,
      city,
      state,
      neighborhood,
      quality,
    });

    const slug = await uniqueSlug(scope.orgId, city, neighborhood);

    const row = await prisma.neighborhoodPage.create({
      data: {
        orgId: scope.orgId,
        propertyId: propertyId ?? null,
        city,
        state: state ?? null,
        neighborhood,
        slug,
        title: generated.title,
        metaDescription: generated.metaDescription,
        intro: generated.intro,
        sections: generated.sections as unknown as Prisma.InputJsonValue,
        faqs: generated.faqs as unknown as Prisma.InputJsonValue,
        aiCitations:
          generated.aiCitations as unknown as Prisma.InputJsonValue,
        status: NeighborhoodPageStatus.DRAFT,
      },
      select: { id: true, slug: true },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.CREATE,
        entityType: "NeighborhoodPage",
        entityId: row.id,
        description: `Generated neighborhood page draft for ${neighborhood}, ${city}`,
      }),
    });

    revalidatePath("/portal/seo/neighborhoods");
    return { ok: true, data: row };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("createNeighborhoodPage failed", err);
    return { ok: false, error: "Failed to generate neighborhood page" };
  }
}

export async function updateNeighborhoodPage(
  id: string,
  edits: z.input<typeof updateSchema>,
): Promise<ActionResult> {
  try {
    const scope = await requireAdminScope();
    const parsed = updateSchema.safeParse(edits);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { ok: false, error: first?.message ?? "Validation failed" };
    }

    const existing = await prisma.neighborhoodPage.findFirst({
      where: { id, orgId: scope.orgId },
      select: { id: true, slug: true },
    });
    if (!existing) return { ok: false, error: "Page not found" };

    if (
      parsed.data.propertyId !== undefined &&
      parsed.data.propertyId !== null
    ) {
      const property = await prisma.property.findFirst({
        where: { id: parsed.data.propertyId, orgId: scope.orgId },
        select: { id: true },
      });
      if (!property) {
        return { ok: false, error: "Property not found in your workspace" };
      }
    }

    await prisma.neighborhoodPage.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.metaDescription !== undefined
          ? { metaDescription: parsed.data.metaDescription }
          : {}),
        ...(parsed.data.intro !== undefined ? { intro: parsed.data.intro } : {}),
        ...(parsed.data.city !== undefined ? { city: parsed.data.city } : {}),
        ...(parsed.data.state !== undefined ? { state: parsed.data.state } : {}),
        ...(parsed.data.neighborhood !== undefined
          ? { neighborhood: parsed.data.neighborhood }
          : {}),
        ...(parsed.data.propertyId !== undefined
          ? { propertyId: parsed.data.propertyId }
          : {}),
        ...(parsed.data.sections !== undefined
          ? {
              sections: parsed.data.sections as unknown as Prisma.InputJsonValue,
            }
          : {}),
        ...(parsed.data.faqs !== undefined
          ? { faqs: parsed.data.faqs as unknown as Prisma.InputJsonValue }
          : {}),
        ...(parsed.data.aiCitations !== undefined
          ? {
              aiCitations:
                parsed.data.aiCitations as unknown as Prisma.InputJsonValue,
            }
          : {}),
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "NeighborhoodPage",
        entityId: existing.id,
        description: "Neighborhood page edited",
      }),
    });

    revalidatePath("/portal/seo/neighborhoods");
    revalidatePath(`/portal/seo/neighborhoods/${existing.id}`);
    revalidatePath(`/n/${existing.slug}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("updateNeighborhoodPage failed", err);
    return { ok: false, error: "Failed to update page" };
  }
}

export async function publishNeighborhoodPage(
  id: string,
): Promise<ActionResult> {
  try {
    const scope = await requireAdminScope();
    const existing = await prisma.neighborhoodPage.findFirst({
      where: { id, orgId: scope.orgId },
      select: { id: true, slug: true },
    });
    if (!existing) return { ok: false, error: "Page not found" };

    await prisma.neighborhoodPage.update({
      where: { id: existing.id },
      data: {
        status: NeighborhoodPageStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "NeighborhoodPage",
        entityId: existing.id,
        description: "Neighborhood page published",
      }),
    });

    revalidatePath("/portal/seo/neighborhoods");
    revalidatePath(`/portal/seo/neighborhoods/${existing.id}`);
    revalidatePath(`/n/${existing.slug}`);
    revalidatePath("/sitemap.xml");
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("publishNeighborhoodPage failed", err);
    return { ok: false, error: "Failed to publish page" };
  }
}

export async function archiveNeighborhoodPage(
  id: string,
): Promise<ActionResult> {
  try {
    const scope = await requireAdminScope();
    const existing = await prisma.neighborhoodPage.findFirst({
      where: { id, orgId: scope.orgId },
      select: { id: true, slug: true },
    });
    if (!existing) return { ok: false, error: "Page not found" };

    await prisma.neighborhoodPage.update({
      where: { id: existing.id },
      data: { status: NeighborhoodPageStatus.ARCHIVED },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "NeighborhoodPage",
        entityId: existing.id,
        description: "Neighborhood page archived",
      }),
    });

    revalidatePath("/portal/seo/neighborhoods");
    revalidatePath(`/n/${existing.slug}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("archiveNeighborhoodPage failed", err);
    return { ok: false, error: "Failed to archive page" };
  }
}

export async function regenerateNeighborhoodPage(
  id: string,
  opts?: { quality?: "default" | "high" },
): Promise<ActionResult> {
  try {
    const scope = await requireAdminScope();
    const existing = await prisma.neighborhoodPage.findFirst({
      where: { id, orgId: scope.orgId },
      select: {
        id: true,
        slug: true,
        city: true,
        state: true,
        neighborhood: true,
        propertyId: true,
      },
    });
    if (!existing) return { ok: false, error: "Page not found" };

    const generated = await generateNeighborhoodPage({
      orgId: scope.orgId,
      propertyId: existing.propertyId,
      city: existing.city,
      state: existing.state,
      neighborhood: existing.neighborhood,
      quality: opts?.quality,
    });

    await prisma.neighborhoodPage.update({
      where: { id: existing.id },
      data: {
        title: generated.title,
        metaDescription: generated.metaDescription,
        intro: generated.intro,
        sections: generated.sections as unknown as Prisma.InputJsonValue,
        faqs: generated.faqs as unknown as Prisma.InputJsonValue,
        aiCitations:
          generated.aiCitations as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "NeighborhoodPage",
        entityId: existing.id,
        description: "Neighborhood page regenerated via Claude",
      }),
    });

    revalidatePath("/portal/seo/neighborhoods");
    revalidatePath(`/portal/seo/neighborhoods/${existing.id}`);
    revalidatePath(`/n/${existing.slug}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("regenerateNeighborhoodPage failed", err);
    return { ok: false, error: "Failed to regenerate page" };
  }
}

// Used internally by the AEO module + sitemap. Exporting a typed shape
// helper to keep public-render call sites simple.
export type NeighborhoodPageSection = { heading: string; body: string };
export type NeighborhoodPageFaq = { question: string; answer: string };

export type StoredNeighborhoodPage = {
  id: string;
  orgId: string;
  propertyId: string | null;
  city: string;
  state: string | null;
  neighborhood: string;
  slug: string;
  title: string;
  metaDescription: string;
  intro: string;
  sections: NeighborhoodPageSection[];
  faqs: NeighborhoodPageFaq[];
  aiCitations: string[] | null;
  status: NeighborhoodPageStatus;
  publishedAt: Date | null;
  updatedAt: Date;
};

export function parseStored(
  raw: Awaited<
    ReturnType<typeof prisma.neighborhoodPage.findFirst>
  > extends infer T
    ? T
    : never,
): StoredNeighborhoodPage | null {
  if (!raw) return null;
  const r = raw as unknown as Record<string, unknown>;
  return {
    id: r.id as string,
    orgId: r.orgId as string,
    propertyId: (r.propertyId as string | null) ?? null,
    city: r.city as string,
    state: (r.state as string | null) ?? null,
    neighborhood: r.neighborhood as string,
    slug: r.slug as string,
    title: r.title as string,
    metaDescription: r.metaDescription as string,
    intro: r.intro as string,
    sections: Array.isArray(r.sections)
      ? (r.sections as NeighborhoodPageSection[])
      : [],
    faqs: Array.isArray(r.faqs) ? (r.faqs as NeighborhoodPageFaq[]) : [],
    aiCitations: Array.isArray(r.aiCitations)
      ? (r.aiCitations as string[])
      : null,
    status: r.status as NeighborhoodPageStatus,
    publishedAt: (r.publishedAt as Date | null) ?? null,
    updatedAt: r.updatedAt as Date,
  };
}
