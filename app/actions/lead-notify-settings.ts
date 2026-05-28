"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireScope, ForbiddenError, auditPayload } from "@/lib/tenancy/scope";
import { AuditAction, UserRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// updateLeadNotifySettings — server action behind the /portal/settings card.
//
// Same role gate as PATCH /api/tenant/settings (owners + admins only). A
// CLIENT_VIEWER / LEASING_AGENT could otherwise re-point the
// notifyLeadEmail to their personal address and quietly exfiltrate every
// inbound lead.
// ---------------------------------------------------------------------------

const ALLOWED_ROLES = new Set<UserRole>([
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

// Comma-separated list of email addresses (validated loosely — Resend will
// reject malformed addresses at send time, so we only need to guard against
// obvious junk and length-bomb payloads).
const recipientList = z
  .string()
  .max(2000)
  .nullable()
  .transform((raw) => {
    if (raw === null) return null;
    const trimmed = raw.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const schema = z.object({
  notifyLeadEmail: recipientList,
  notifyOnChatbotLead: z.boolean(),
  notifyOnPopupLead: z.boolean(),
  notifyOnFormLead: z.boolean(),
  notifyOnIngestLead: z.boolean(),
  notifyOnTourRequest: z.boolean(),
  notifyOnVisitorConvert: z.boolean(),
  notifyOnManualLead: z.boolean(),
});

export type UpdateLeadNotifyInput = z.input<typeof schema>;

export async function updateLeadNotifySettings(
  input: UpdateLeadNotifyInput,
): Promise<{ ok: true }> {
  const scope = await requireScope();
  if (!ALLOWED_ROLES.has(scope.role)) {
    throw new ForbiddenError(
      "Only org owners and admins can change lead-notification settings.",
    );
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Validation failed: " + parsed.error.message);
  }

  await prisma.organization.update({
    where: { id: scope.orgId },
    data: parsed.data,
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.UPDATE,
      entityType: "Organization",
      entityId: scope.orgId,
      description: "Lead notification settings updated",
    }),
  });

  revalidatePath("/portal/settings");
  return { ok: true };
}
