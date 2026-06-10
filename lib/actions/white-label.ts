"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireWritableWorkspace,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// White-label workspace server actions.
//
// Back the /portal/settings/white-label page. Every mutation here:
//   1. Resolves the actor via requireScope() (never trusts client orgId)
//   2. Re-checks Organization.whiteLabel === true so a downgraded org
//      can't keep editing branding after the add-on has lapsed.
//      Stripe webhook is the only path that flips whiteLabel ON; this
//      action only ever writes the OVERRIDE FIELDS (name/logo/color).
//   3. Restricts mutation to CLIENT_OWNER / CLIENT_ADMIN (matches the
//      role gate the rest of the settings surface uses)
//   4. Validates with zod (hex color uses the same regex as
//      lib/actions/popup-actions.ts and lib/actions/chatbot-config.ts).
//   5. Writes an AuditEvent so /admin sees who flipped branding.
//   6. revalidatePath so the portal chrome re-resolves the brand on
//      the next navigation.
// ---------------------------------------------------------------------------

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

// Identical regex used by popup-actions.ts + chatbot-config.ts. Kept
// inline here to keep this module self-contained (no shared "validation"
// helper file in this codebase yet).
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const stringOrNull = z
  .string()
  .optional()
  .transform((v) => (typeof v === "string" ? v.trim() : ""))
  .transform((v) => (v === "" ? null : v));

const saveSchema = z.object({
  whiteLabelBrandName: stringOrNull.pipe(
    z.string().max(80, "Brand name must be 80 characters or fewer").nullable(),
  ),
  whiteLabelLogoUrl: stringOrNull.pipe(
    z
      .string()
      .url("Logo URL must be a valid URL")
      .max(500)
      .nullable(),
  ),
  whiteLabelPrimaryColor: stringOrNull.pipe(
    z
      .string()
      .regex(HEX_COLOR, "Primary color must be a hex value like #1a1a2e")
      .nullable(),
  ),
});

function firstString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

const ALLOWED_ROLES = new Set<UserRole>([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
]);

// Save the white-label brand kit. Returns a typed ActionResult so the
// form-client can render server-side validation errors inline.
export async function saveWhiteLabelSettings(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const scope = await requireWritableWorkspace();

    // Org + actor row in one round trip. We need:
    //   * whiteLabel flag (entitlement check)
    //   * actor's role (admin gate)
    // Pulling both up-front keeps the action one query + one update.
    const [org, actor] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: scope.orgId },
        select: { whiteLabel: true },
      }),
      prisma.user.findUnique({
        where: { clerkUserId: scope.clerkUserId },
        select: { role: true },
      }),
    ]);

    if (!org) return { ok: false, error: "Organization not found" };
    if (!org.whiteLabel) {
      return {
        ok: false,
        error:
          "White-label add-on isn't active. Activate from the marketplace before editing branding.",
      };
    }
    if (!actor || !ALLOWED_ROLES.has(actor.role)) {
      return {
        ok: false,
        error: "Only workspace admins can edit white-label branding.",
      };
    }

    const raw = {
      whiteLabelBrandName: firstString(formData.get("whiteLabelBrandName")),
      whiteLabelLogoUrl: firstString(formData.get("whiteLabelLogoUrl")),
      whiteLabelPrimaryColor: firstString(
        formData.get("whiteLabelPrimaryColor"),
      ),
    };

    const parsed = saveSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { ok: false, error: first?.message ?? "Validation failed" };
    }

    await prisma.organization.update({
      where: { id: scope.orgId },
      data: {
        whiteLabelBrandName: parsed.data.whiteLabelBrandName,
        whiteLabelLogoUrl: parsed.data.whiteLabelLogoUrl,
        whiteLabelPrimaryColor: parsed.data.whiteLabelPrimaryColor,
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.SETTING_CHANGE,
        entityType: "Organization",
        entityId: scope.orgId,
        description: "White-label branding updated",
        diff: parsed.data as Prisma.InputJsonValue,
      }),
    });

    revalidatePath("/portal/settings/white-label");
    // Brand chrome lives on every page — bust the whole portal so the
    // sidebar logo + page header re-render with the new brand kit.
    revalidatePath("/portal", "layout");
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("saveWhiteLabelSettings failed", err);
    return { ok: false, error: "Failed to save white-label settings" };
  }
}
