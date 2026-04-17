import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAgency, ForbiddenError } from "@/lib/tenancy/scope";
import { provisionTenant } from "@/lib/build/provision-tenant";
import {
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// POST /api/admin/intakes/[id]/convert
// Agency-only. Converts an IntakeSubmission into a provisioned Organization
// via lib/build/provision-tenant.ts. Optional overrides let ops:
//   - override the tenant slug
//   - attach a custom domain
//   - seed a first property name
// All overrides are optional; defaults flow from the submission.
// ---------------------------------------------------------------------------

const overrides = z.object({
  slug: z.string().min(2).max(60).optional(),
  customDomain: z.string().min(3).max(253).optional(),
  firstPropertyName: z.string().min(1).max(200).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;

  const submission = await prisma.intakeSubmission.findUnique({
    where: { id },
  });
  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (submission.orgId) {
    return NextResponse.json(
      { error: "Already converted", orgId: submission.orgId },
      { status: 409 }
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsedBody = overrides.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  const selected =
    (submission.selectedModules as Array<string> | null) ?? [];
  const modules = {
    website: selected.includes("website") || true,
    pixel: selected.includes("pixel"),
    chatbot: selected.includes("chatbot"),
    googleAds: selected.includes("googleAds"),
    metaAds: selected.includes("metaAds"),
    seo: selected.includes("seo"),
    email: selected.includes("email"),
    outboundEmail: selected.includes("outboundEmail"),
    referrals: selected.includes("referrals"),
    creativeStudio: selected.includes("creativeStudio"),
    leadCapture: selected.includes("leadCapture") || true,
  };

  try {
    const result = await provisionTenant({
      name: submission.companyName,
      shortName: submission.shortName ?? undefined,
      slug: parsedBody.data.slug ?? submission.shortName ?? submission.companyName,
      propertyType: submission.propertyType as PropertyType,
      residentialSubtype:
        (submission.residentialSubtype as ResidentialSubtype | null) ??
        undefined,
      commercialSubtype:
        (submission.commercialSubtype as CommercialSubtype | null) ?? undefined,
      primaryContact: {
        name: submission.primaryContactName,
        email: submission.primaryContactEmail,
        phone: submission.primaryContactPhone ?? undefined,
        role: submission.primaryContactRole ?? undefined,
      },
      hq: {
        city: submission.hqCity ?? undefined,
        state: submission.hqState ?? undefined,
      },
      modules,
      bringYourOwnSite: false,
      customDomain: parsedBody.data.customDomain,
      firstPropertyName: parsedBody.data.firstPropertyName,
      intakeSubmissionId: submission.id,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[POST /api/admin/intakes/[id]/convert]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Tenant provisioning failed",
      },
      { status: 500 }
    );
  }
}
