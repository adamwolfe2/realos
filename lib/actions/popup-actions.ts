"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AuditAction,
  PopupPosition,
  PopupStatus,
  PopupTrigger,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditPayload, requireScope } from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// Popup module server actions.
//
// Back the /portal/popups editor. Every mutation:
//   1. Resolves the actor via requireScope() — never trusts client orgId
//   2. Validates input with zod (we use safeParse so malformed input
//      becomes a typed error rather than throwing)
//   3. Writes a Prisma row scoped on orgId (defense-in-depth even though
//      the route handler is already auth-gated)
//   4. Writes an AuditEvent so /admin sees who changed what when
//   5. revalidatePath so the portal nav badge + list refresh
// ---------------------------------------------------------------------------

export type ActionResult<T = Record<string, never>> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Zod schema mirrors the PopupCampaign model. Anything optional in the
// schema must be optional here AND in the action signature; we use
// `nullable()` where the DB column is nullable (NOT `optional()`) so
// the operator can deliberately clear a field by sending null.
const upsertSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  status: z.nativeEnum(PopupStatus).default(PopupStatus.DRAFT),
  headline: z.string().trim().min(1, "Headline is required").max(120),
  body: z.string().trim().min(1, "Body is required").max(600),
  ctaText: z.string().trim().min(1, "CTA text is required").max(40),
  ctaUrl: z.string().trim().max(500).default("#"),
  offerCode: z.string().trim().max(40).nullable().optional(),
  secondaryText: z.string().trim().max(40).nullable().optional(),
  trigger: z.nativeEnum(PopupTrigger).default(PopupTrigger.EXIT_INTENT),
  triggerThreshold: z.coerce.number().int().min(0).max(600).default(0),
  targetUrlPatterns: z.array(z.string().trim().max(200)).default([]),
  frequency: z.enum(["session", "always", "once_per_day"]).default("session"),
  position: z.nativeEnum(PopupPosition).default(PopupPosition.CENTER),
  primaryColor: z.string().regex(HEX_COLOR).default("#2563EB"),
  textColor: z.string().regex(HEX_COLOR).default("#0F172A"),
  backgroundColor: z.string().regex(HEX_COLOR).default("#FFFFFF"),
  heroImageUrl: z.string().trim().url().nullable().optional().or(z.literal("").transform(() => null)),
  captureEmail: z.boolean().default(true),
  capturePhone: z.boolean().default(false),
  propertyId: z.string().min(1).nullable().optional(),
});

export async function createPopup(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const scope = await requireScope();
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }

  // If the operator picked a property, sanity-check it belongs to the
  // org. Without this, a malicious client could pass an arbitrary
  // propertyId and link the popup to another tenant's property.
  if (parsed.data.propertyId) {
    const propertyOwned = await prisma.property.findFirst({
      where: { id: parsed.data.propertyId, orgId: scope.orgId },
      select: { id: true },
    });
    if (!propertyOwned) {
      return {
        ok: false,
        error: "Property does not belong to this organization.",
      };
    }
  }

  const created = await prisma.popupCampaign.create({
    data: {
      orgId: scope.orgId,
      ...parsed.data,
      targetUrlPatterns: parsed.data.targetUrlPatterns,
    },
    select: { id: true },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.CREATE,
      entityType: "PopupCampaign",
      entityId: created.id,
      description: `Created popup "${parsed.data.name}"`,
    }),
  });

  revalidatePath("/portal/popups");
  return { ok: true, data: { id: created.id } };
}

export async function updatePopup(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const scope = await requireScope();
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Missing popup id." };
  }
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }

  // IDOR defense — refuse to update a popup that doesn't belong to the
  // caller's org. updateMany returns affected count; 0 means scope
  // mismatch.
  if (parsed.data.propertyId) {
    const propertyOwned = await prisma.property.findFirst({
      where: { id: parsed.data.propertyId, orgId: scope.orgId },
      select: { id: true },
    });
    if (!propertyOwned) {
      return {
        ok: false,
        error: "Property does not belong to this organization.",
      };
    }
  }

  const updated = await prisma.popupCampaign.updateMany({
    where: { id, orgId: scope.orgId },
    data: parsed.data,
  });
  if (updated.count === 0) {
    return { ok: false, error: "Popup not found." };
  }

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.UPDATE,
      entityType: "PopupCampaign",
      entityId: id,
      description: `Updated popup "${parsed.data.name}"`,
      diff: parsed.data as Prisma.InputJsonValue,
    }),
  });

  revalidatePath("/portal/popups");
  revalidatePath(`/portal/popups/${id}`);
  return { ok: true };
}

export async function setPopupStatus(
  id: string,
  status: PopupStatus,
): Promise<ActionResult> {
  const scope = await requireScope();
  const updated = await prisma.popupCampaign.updateMany({
    where: { id, orgId: scope.orgId },
    data: { status },
  });
  if (updated.count === 0) {
    return { ok: false, error: "Popup not found." };
  }
  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.UPDATE,
      entityType: "PopupCampaign",
      entityId: id,
      description: `Popup status set to ${status}`,
    }),
  });
  revalidatePath("/portal/popups");
  revalidatePath(`/portal/popups/${id}`);
  return { ok: true };
}

export async function deletePopup(id: string): Promise<ActionResult> {
  const scope = await requireScope();
  const target = await prisma.popupCampaign.findFirst({
    where: { id, orgId: scope.orgId },
    select: { name: true },
  });
  if (!target) return { ok: false, error: "Popup not found." };

  await prisma.popupCampaign.deleteMany({
    where: { id, orgId: scope.orgId },
  });
  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.DELETE,
      entityType: "PopupCampaign",
      entityId: id,
      description: `Deleted popup "${target.name}"`,
    }),
  });
  revalidatePath("/portal/popups");
  return { ok: true };
}

/**
 * Form-action thin wrapper for creating a popup from the new-popup
 * page. Consumed via `<form action={createPopupFromForm}>` so we don't
 * need a client component just to call createPopup. Redirects into the
 * editor on success.
 */
export async function createPopupFromForm(formData: FormData): Promise<void> {
  const name = (formData.get("name") ?? "").toString().trim() || "Untitled popup";
  const result = await createPopup({
    name,
    status: PopupStatus.DRAFT,
    headline: name,
    body: "Tell visitors why they should claim this offer.",
    ctaText: "Claim offer",
    ctaUrl: "#",
  });
  if (result.ok && result.data) {
    redirect(`/portal/popups/${result.data.id}`);
  }
  // Errors fall through — the page renders with no new row and the
  // operator can retry. We avoid throwing so we don't trigger the
  // global error boundary on a soft validation failure.
}

function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Validation failed.";
  return issue.message ?? "Validation failed.";
}
