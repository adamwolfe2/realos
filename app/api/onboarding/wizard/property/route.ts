import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import {
  PropertyType,
  PropertyLifecycle,
  PropertyLifecycleSource,
} from "@prisma/client";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// POST /api/onboarding/wizard/property
//
// Step 2 of the self-serve onboarding wizard. Creates the user's first
// property (or updates it if they came back to this step), then advances
// onboardingStep to "plan".
//
// The property is created with lifecycle=ACTIVE because the operator is
// explicitly self-declaring it during signup (no AppFolio classifier
// involvement yet). lifecycleSetBy=OPERATOR_OVERRIDE so the dashboard
// rollups count it immediately.
// ---------------------------------------------------------------------------

const body = z.object({
  name: z.string().trim().min(1).max(120),
  addressLine1: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  totalUnits: z.number().int().min(1).max(10000).optional().nullable(),
  yearBuilt: z.number().int().min(1700).max(2100).optional().nullable(),
});

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "property"
  );
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  let parsed;
  try {
    parsed = body.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid body", details: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      orgId: true,
      org: {
        select: {
          propertyType: true,
          residentialSubtype: true,
          commercialSubtype: true,
        },
      },
    },
  });
  if (!user || !user.org) {
    return NextResponse.json(
      { ok: false, error: "User not provisioned" },
      { status: 404 },
    );
  }

  // Reuse the first property if the user is editing during a wizard
  // resume; otherwise create a new one. Slug is best-effort unique
  // within the org by appending a numeric suffix on collision.
  const existing = await prisma.property.findFirst({
    where: {
      orgId: user.orgId,
      lifecycle: { in: [PropertyLifecycle.IMPORTED, PropertyLifecycle.ACTIVE] },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true },
  });

  const baseSlug = slugify(parsed.name);
  let slug = baseSlug;
  for (let i = 2; i < 50; i++) {
    const collide = await prisma.property.findFirst({
      where: { orgId: user.orgId, slug, NOT: existing ? { id: existing.id } : undefined },
      select: { id: true },
    });
    if (!collide) break;
    slug = `${baseSlug}-${i}`;
  }

  if (existing) {
    await prisma.property.update({
      where: { id: existing.id },
      data: {
        name: parsed.name,
        slug,
        addressLine1: parsed.addressLine1 ?? null,
        city: parsed.city ?? null,
        state: parsed.state ?? null,
        postalCode: parsed.postalCode ?? null,
        totalUnits: parsed.totalUnits ?? null,
        yearBuilt: parsed.yearBuilt ?? null,
        propertyType: user.org.propertyType ?? PropertyType.RESIDENTIAL,
        residentialSubtype: user.org.residentialSubtype,
        commercialSubtype: user.org.commercialSubtype,
        lifecycle: PropertyLifecycle.ACTIVE,
        lifecycleSetBy: PropertyLifecycleSource.OPERATOR,
        lifecycleSetAt: new Date(),
      },
    });
  } else {
    await prisma.property.create({
      data: {
        orgId: user.orgId,
        name: parsed.name,
        slug,
        addressLine1: parsed.addressLine1 ?? null,
        city: parsed.city ?? null,
        state: parsed.state ?? null,
        postalCode: parsed.postalCode ?? null,
        totalUnits: parsed.totalUnits ?? null,
        yearBuilt: parsed.yearBuilt ?? null,
        propertyType: user.org.propertyType ?? PropertyType.RESIDENTIAL,
        residentialSubtype: user.org.residentialSubtype,
        commercialSubtype: user.org.commercialSubtype,
        lifecycle: PropertyLifecycle.ACTIVE,
        lifecycleSetBy: PropertyLifecycleSource.OPERATOR,
        lifecycleSetAt: new Date(),
      },
    });
  }

  await prisma.organization.update({
    where: { id: user.orgId },
    data: { onboardingStep: "plan" },
  });

  return NextResponse.json({ ok: true, nextStep: "plan" });
}
