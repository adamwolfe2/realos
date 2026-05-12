import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { connectAppfolio } from "@/lib/actions/appfolio-connect";
import { getPmsById } from "@/lib/integrations/pms/registry";

// ---------------------------------------------------------------------------
// POST /api/onboarding/wizard/integrations
//
// Step 2 of the self-serve onboarding wizard. Three modes:
//
//   { action: "skip" }
//     User opts to add properties manually. Just advance the step.
//
//   { action: "connect_pms", pmsId: "appfolio", credentials: {...} }
//     User connects a live PMS. Today only AppFolio has a real
//     connector; the credentials shape mirrors connectAppfolio's form
//     data. Yardi / Buildium / Entrata / RealPage are scaffolded as
//     "coming soon" and route through `action: "express_interest"`
//     below.
//
//   { action: "express_interest", pmsId: "yardi" }
//     User picked a coming-soon PMS. We record interest on the org
//     and ping our ops inbox so we know which connector to prioritize.
//     The wizard advances normally — they can still go through the
//     manual property step.
// ---------------------------------------------------------------------------

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("skip") }),
  z.object({
    action: z.literal("connect_pms"),
    pmsId: z.string().min(1),
    credentials: z.record(z.string(), z.string()),
  }),
  z.object({
    action: z.literal("express_interest"),
    pmsId: z.string().min(1),
  }),
]);

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

  if (parsed.action === "skip") {
    await prisma.organization.update({
      where: { id: user.orgId },
      data: { onboardingStep: "property" },
    });
    return NextResponse.json({ ok: true, nextStep: "property" });
  }

  if (parsed.action === "express_interest") {
    const pms = getPmsById(parsed.pmsId);
    if (!pms) {
      return NextResponse.json(
        { ok: false, error: `Unknown PMS "${parsed.pmsId}"` },
        { status: 400 },
      );
    }
    // Record the interest as an audit event so ops sees demand
    // signal for connector prioritization. Lightweight; the actual
    // sales follow-up happens out of band.
    await prisma.auditEvent.create({
      data: {
        orgId: user.orgId,
        action: "CREATE",
        entityType: "IntegrationRequest",
        entityId: parsed.pmsId,
        description: `Expressed interest in ${pms.name} connector during onboarding`,
        diff: { pmsId: parsed.pmsId, pmsName: pms.name },
      },
    });
    await prisma.organization.update({
      where: { id: user.orgId },
      data: { onboardingStep: "property" },
    });
    return NextResponse.json({ ok: true, nextStep: "property" });
  }

  if (parsed.action === "connect_pms") {
    const pms = getPmsById(parsed.pmsId);
    if (!pms) {
      return NextResponse.json(
        { ok: false, error: `Unknown PMS "${parsed.pmsId}"` },
        { status: 400 },
      );
    }

    if (pms.status !== "live") {
      // Defensive: the UI shouldn't let this happen, but if it does
      // we treat it as an interest expression.
      return NextResponse.json(
        {
          ok: false,
          error: `${pms.name} isn't self-serve yet. We'll be in touch about provisioning.`,
        },
        { status: 400 },
      );
    }

    if (pms.id === "appfolio") {
      const subdomain = parsed.credentials.subdomain?.trim();
      const clientId = parsed.credentials.clientId?.trim() || null;
      const clientSecret = parsed.credentials.clientSecret?.trim() || null;
      if (!subdomain) {
        return NextResponse.json(
          { ok: false, error: "AppFolio subdomain is required" },
          { status: 400 },
        );
      }

      // connectAppfolio expects a FormData payload because it's a
      // server action; we synthesize one here so we don't fork the
      // logic across two code paths.
      const fd = new FormData();
      fd.set("subdomain", subdomain);
      if (clientId) fd.set("clientId", clientId);
      if (clientSecret) fd.set("clientSecret", clientSecret);
      const result = await connectAppfolio(fd);
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error ?? "Failed to connect AppFolio" },
          { status: 400 },
        );
      }
    }

    // Advance the step. If the PMS import populated properties, the
    // user can skip the manual property step on the next page;
    // /onboarding's server component decides which sub-step to show.
    await prisma.organization.update({
      where: { id: user.orgId },
      data: { onboardingStep: "property" },
    });
    return NextResponse.json({ ok: true, nextStep: "property" });
  }

  return NextResponse.json({ ok: false, error: "Unhandled action" }, { status: 400 });
}
