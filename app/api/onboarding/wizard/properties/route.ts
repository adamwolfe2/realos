import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import {
  AuditAction,
  PropertyType,
  PropertyLifecycle,
  PropertyLifecycleSource,
  SubscriptionStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeTrialEndsAt } from "@/lib/onboarding/steps";
import { SELF_SERVE_PROPERTY_CAP } from "@/lib/billing/catalog";
import { scaffoldPropertyIntegrations } from "@/lib/onboarding/scaffold";

// ---------------------------------------------------------------------------
// POST /api/onboarding/wizard/properties
//
// Multi-property step. The operator adds one or more properties (each its own
// website / pixel / chatbot downstream) and picks how they manage them (a PMS,
// a CRM, or nothing — manual). We create the Property rows (manual,
// backendPlatform=NONE, lifecycle=ACTIVE), record the CRM choice as a demand
// signal, START the 14-day trial, and finish onboarding (onboardingStep=done).
//
// Idempotent on resume: properties are matched to existing operator rows by
// name (updated in place) so re-submitting doesn't duplicate the portfolio.
// ---------------------------------------------------------------------------

const propertySchema = z.object({
  name: z.string().trim().min(1).max(120),
  addressLine1: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  totalUnits: z.number().int().min(1).max(10000).optional().nullable(),
  yearBuilt: z.number().int().min(1700).max(2100).optional().nullable(),
});

const body = z.object({
  properties: z.array(propertySchema).min(1).max(SELF_SERVE_PROPERTY_CAP),
  // How they manage these properties. Recorded as a demand signal; the actual
  // connection (where supported) happens post-onboarding in the portal.
  crm: z
    .enum([
      "appfolio",
      "yardi",
      "buildium",
      "entrata",
      "realpage",
      "salesforce",
      "hubspot",
      "other",
      "none",
    ])
    .default("none"),
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
          trialStartedAt: true,
          trialEndsAt: true,
          moduleChatbot: true,
          modulePixel: true,
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
  const orgId = user.orgId;
  const org = user.org;

  // Existing operator-created properties (for resume idempotency). Match
  // incoming rows to these by name so a re-submit updates rather than dupes.
  const existing = await prisma.property.findMany({
    where: {
      orgId,
      lifecycle: { in: [PropertyLifecycle.IMPORTED, PropertyLifecycle.ACTIVE] },
    },
    select: { id: true, name: true, slug: true },
  });
  const usedSlugs = new Set(existing.map((p) => p.slug));
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]));

  function uniqueSlug(name: string, keepSlug?: string): string {
    const base = slugify(name);
    if (keepSlug && keepSlug.startsWith(base)) return keepSlug;
    let slug = base;
    for (let i = 2; usedSlugs.has(slug) && i < 200; i++) slug = `${base}-${i}`;
    usedSlugs.add(slug);
    return slug;
  }

  const common = {
    propertyType: org.propertyType ?? PropertyType.RESIDENTIAL,
    residentialSubtype: org.residentialSubtype,
    commercialSubtype: org.commercialSubtype,
    lifecycle: PropertyLifecycle.ACTIVE,
    lifecycleSetBy: PropertyLifecycleSource.OPERATOR,
    lifecycleSetAt: new Date(),
  };

  const scaffoldProps: Array<{ id: string; name: string; websiteUrl: string | null }> = [];
  for (const p of parsed.properties) {
    const match = byName.get(p.name.toLowerCase());
    const fields = {
      addressLine1: p.addressLine1 ?? null,
      city: p.city ?? null,
      state: p.state ?? null,
      postalCode: p.postalCode ?? null,
      totalUnits: p.totalUnits ?? null,
      yearBuilt: p.yearBuilt ?? null,
      ...common,
    };
    if (match) {
      const row = await prisma.property.update({
        where: { id: match.id },
        data: { name: p.name, ...fields },
        select: { id: true, name: true, websiteUrl: true },
      });
      scaffoldProps.push(row);
    } else {
      const row = await prisma.property.create({
        data: { orgId, name: p.name, slug: uniqueSlug(p.name), ...fields },
        select: { id: true, name: true, websiteUrl: true },
      });
      scaffoldProps.push(row);
    }
  }

  // S3 — eager per-property scaffolding: give each property its own ready-to-use
  // chatbot config + a queued pixel provision request for the features that are
  // actually enabled, so the workspace lands set-up-ready (no blank properties).
  await scaffoldPropertyIntegrations(orgId, scaffoldProps, {
    chatbot: org.moduleChatbot,
    pixel: org.modulePixel,
  }).catch(() => undefined);

  // Record the CRM/PMS choice as a demand signal. "none" still logs so we can
  // see how many operators run fully manual.
  await prisma.auditEvent
    .create({
      data: {
        orgId,
        userId: user.id,
        action: AuditAction.CREATE,
        entityType: "Organization",
        entityId: orgId,
        description: `Onboarding CRM choice: ${parsed.crm}`,
        diff: { crm: parsed.crm } as Prisma.InputJsonValue,
      },
    })
    .catch(() => undefined);

  // Start the trial now (preserve an existing start so resume can't extend it).
  const now = new Date();
  const trialStartedAt = org.trialStartedAt ?? now;
  const trialEndsAt = org.trialEndsAt ?? computeTrialEndsAt(trialStartedAt);

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      subscriptionStatus: SubscriptionStatus.TRIALING,
      trialStartedAt,
      trialEndsAt,
      onboardingStep: "done",
    },
  });

  return NextResponse.json({
    ok: true,
    nextStep: "done",
    trialEndsAt: trialEndsAt.toISOString(),
  });
}
