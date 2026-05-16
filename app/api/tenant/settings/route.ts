import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { AuditAction, Prisma, UserRole } from "@prisma/client";

// Roles allowed to PATCH the organization settings (name, brand colors,
// logo, primary contact). Restricted client roles must not be able to
// change the lead-notification inbox or rebrand the tenant on behalf of
// an admin. Agency callers (including impersonators) are always allowed.
const ALLOWED_SETTINGS_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

// Per-tenant company + brand settings. The client team can change their own
// contact + brand tokens; agency-only fields (subscription tier, module
// flags, orgType, slug) live behind /api/admin/* instead.
const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  shortName: z.string().max(100).optional().nullable(),
  primaryContactName: z.string().max(200).optional().nullable(),
  primaryContactEmail: z.string().email().optional().nullable(),
  primaryContactPhone: z.string().max(40).optional().nullable(),
  primaryContactRole: z.string().max(100).optional().nullable(),
  hqAddressLine1: z.string().max(200).optional().nullable(),
  hqCity: z.string().max(100).optional().nullable(),
  hqState: z.string().max(40).optional().nullable(),
  hqPostalCode: z.string().max(20).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{3,8}$/)
    .optional()
    .nullable(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{3,8}$/)
    .optional()
    .nullable(),
  brandFont: z.string().max(100).optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  try {
    const scope = await requireScope();

    // Role gate — CLIENT_VIEWER / LEASING_AGENT / AL_PARTNER cannot
    // change brand or primary-contact settings. Lead notifications fan
    // out via primaryContactEmail; a low-trust user re-pointing that
    // email could exfiltrate every new lead the org receives.
    if (!ALLOWED_SETTINGS_ROLES.has(scope.role)) {
      return NextResponse.json(
        {
          error:
            "Only org owners and admins can change organization settings.",
        },
        { status: 403 },
      );
    }

    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data as Prisma.OrganizationUpdateInput;

    const updated = await prisma.organization.update({
      where: { id: scope.orgId },
      data,
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "Organization",
        entityId: scope.orgId,
        description: "Tenant settings updated",
        diff: parsed.data as Prisma.InputJsonValue,
      }),
    });

    return NextResponse.json({
      org: {
        id: updated.id,
        name: updated.name,
        shortName: updated.shortName,
        primaryContactName: updated.primaryContactName,
        primaryContactEmail: updated.primaryContactEmail,
        logoUrl: updated.logoUrl,
        primaryColor: updated.primaryColor,
        secondaryColor: updated.secondaryColor,
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
