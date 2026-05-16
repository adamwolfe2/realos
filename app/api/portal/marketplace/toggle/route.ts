import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { isValidModuleKey, getModuleByKey } from "@/lib/marketplace/catalog";
import { Prisma, AuditAction, UserRole } from "@prisma/client";

// Roles allowed to flip module flags. Module toggles activate paid
// features and change the org's monthly bill, so a CLIENT_VIEWER or
// LEASING_AGENT must not be able to enable them — only the org's
// owner / admin (or any AGENCY role, including impersonators).
const ALLOWED_TOGGLE_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/portal/marketplace/toggle
//
// Flips a single Organization.module<X> Boolean. Free-during-trial: no
// Stripe call. After trial we still allow the toggle here so the UI can
// optimistically activate; the route returns `requiresPayment: true` so
// the client can redirect into Stripe Checkout to actually charge for the
// add-on. We deliberately DO NOT silently bill — the user must confirm.
//
// Auth: requires a Clerk session bound to an Organization. AGENCY users
// impersonating a CLIENT can toggle on the client's behalf. Audit-logged
// either way.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  moduleKey: z.string().max(64),
  enabled: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const scope = await requireScope();

    // Role gate — module toggles change billing posture and feature
    // surface; restricted roles (CLIENT_VIEWER, LEASING_AGENT, AL_PARTNER)
    // must not be able to enable paid modules behind an admin's back.
    if (!ALLOWED_TOGGLE_ROLES.has(scope.role)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Only org owners and admins can change module subscriptions.",
        },
        { status: 403 },
      );
    }

    let parsed;
    try {
      parsed = bodySchema.parse(await req.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { ok: false, error: "Invalid request body", details: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    if (!isValidModuleKey(parsed.moduleKey)) {
      return NextResponse.json(
        { ok: false, error: `Unknown module "${parsed.moduleKey}"` },
        { status: 400 },
      );
    }

    const moduleDef = getModuleByKey(parsed.moduleKey);
    if (!moduleDef) {
      return NextResponse.json(
        { ok: false, error: "Module catalog mismatch" },
        { status: 500 },
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: {
        id: true,
        subscriptionStatus: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { ok: false, error: "Organization not found" },
        { status: 404 },
      );
    }

    // Free-during-trial gate. If the org is past trial AND the user is
    // turning a module ON for the first time, signal the client to start
    // a Stripe Checkout flow. We DO NOT flip the flag in that case —
    // activation happens in the webhook after payment confirms.
    const isTrialing =
      org.subscriptionStatus === "TRIALING" ||
      org.subscriptionStatus === null;
    const requiresPayment =
      parsed.enabled && !isTrialing && !!moduleDef.stripeLookupKey;

    if (requiresPayment) {
      return NextResponse.json({
        ok: true,
        flipped: false,
        requiresPayment: true,
        stripeLookupKey: moduleDef.stripeLookupKey,
        setupHref: moduleDef.setupHref,
      });
    }

    // Cast through `unknown` so we can index Prisma's strict update type
    // by the dynamic module column. The column name is allowlisted above
    // via isValidModuleKey, so this is safe.
    const updateData = {
      [parsed.moduleKey]: parsed.enabled,
    } as unknown as Prisma.OrganizationUpdateInput;

    await prisma.organization.update({
      where: { id: org.id },
      data: updateData,
    });

    // Audit-log so we can later debug "why is feature X enabled for this
    // tenant" without spelunking the Stripe webhook history.
    await prisma.auditEvent
      .create({
        data: {
          orgId: scope.orgId,
          userId: scope.userId,
          action: AuditAction.SETTING_CHANGE,
          entityType: "Organization.module",
          entityId: org.id,
          description: `${parsed.enabled ? "Activated" : "Deactivated"} ${moduleDef.name} via marketplace`,
          diff: {
            module: parsed.moduleKey,
            enabled: parsed.enabled,
            duringTrial: isTrialing,
          } as Prisma.InputJsonValue,
        },
      })
      .catch((err) => {
        // Best-effort; we don't want audit failures to undo a user-visible
        // toggle. Surface to Sentry instead.
        console.error("[marketplace/toggle] audit insert failed:", err);
      });

    return NextResponse.json({
      ok: true,
      flipped: true,
      requiresPayment: false,
      setupHref: moduleDef.setupHref,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 },
      );
    }
    console.error("[api/portal/marketplace/toggle] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to update module" },
      { status: 500 },
    );
  }
}
