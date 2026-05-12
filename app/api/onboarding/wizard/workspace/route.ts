import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import {
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
} from "@prisma/client";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// POST /api/onboarding/wizard/workspace
//
// Step 1 of the self-serve onboarding wizard. Saves the workspace's
// display name + property type (residential / commercial / mixed) and
// the subtype if applicable, then advances onboardingStep to "property".
//
// Auth: signed-in user with a provisioned Organization. We resolve the
// org via the Clerk userId rather than trusting a body field.
// ---------------------------------------------------------------------------

const body = z.object({
  name: z.string().trim().min(1).max(120),
  propertyType: z.nativeEnum(PropertyType),
  residentialSubtype: z.nativeEnum(ResidentialSubtype).nullable().optional(),
  commercialSubtype: z.nativeEnum(CommercialSubtype).nullable().optional(),
});

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
    select: { id: true, orgId: true },
  });
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "User not provisioned" },
      { status: 404 },
    );
  }

  // Subtype must match the chosen type. Drop the other one to avoid
  // contradictory state.
  const residentialSubtype =
    parsed.propertyType === PropertyType.RESIDENTIAL ||
    parsed.propertyType === PropertyType.MIXED
      ? (parsed.residentialSubtype ?? null)
      : null;
  const commercialSubtype =
    parsed.propertyType === PropertyType.COMMERCIAL ||
    parsed.propertyType === PropertyType.MIXED
      ? (parsed.commercialSubtype ?? null)
      : null;

  await prisma.organization.update({
    where: { id: user.orgId },
    data: {
      name: parsed.name,
      propertyType: parsed.propertyType,
      residentialSubtype,
      commercialSubtype,
      onboardingStep: "integrations",
    },
  });

  return NextResponse.json({ ok: true, nextStep: "integrations" });
}
