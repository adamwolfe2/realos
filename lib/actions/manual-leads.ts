"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction, LeadNotifyChannel, LeadSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireWritableWorkspace,
  propertyInScope,
  auditPayload,
  ForbiddenError,
} from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { clientWriteLimiter, checkRateLimit } from "@/lib/rate-limit";
import { findOldestLeadByEmail, normalizeLeadEmail } from "@/lib/leads/find-by-email";
import { notifyLeadCaptured } from "@/lib/notifications/lead-notify";
import { runAfter } from "@/lib/after";

// ---------------------------------------------------------------------------
// Manual "Add lead" (F-015): walk-in, phone and listing-site inquiries for
// operators without a capture integration. Spec:
// .claude/specs/2026-10-16-manual-add-lead.md. Gate → validate → property
// grant + marketable check → email dedupe → create → audit → one notify.
// Dedupe is app-level (Lead.email has no unique index), so two concurrent
// submits with the same email can both create; same ceiling as the public
// capture routes.
// ---------------------------------------------------------------------------

export type ManualLeadResult =
  | { ok: true; id: string }
  | { ok: false; error: string; duplicate?: true; leadId?: string };

// Operators may only claim sources they can actually know about; never
// CHATBOT / GOOGLE_ADS etc., which would fake attribution.
const MANUAL_SOURCES = [LeadSource.MANUAL, LeadSource.REFERRAL, LeadSource.OTHER] as const;

const SOURCE_LABELS: Record<(typeof MANUAL_SOURCES)[number], string> = {
  MANUAL: "Walk-in / phone",
  REFERRAL: "Referral",
  OTHER: "Other",
};

const leadSchema = z
  .object({
    propertyId: z.string().min(1).max(100),
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().max(120).optional(),
    email: z.string().trim().email().max(320).optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional(),
    source: z.enum(MANUAL_SOURCES),
    sourceDetail: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(4000).optional(),
  })
  .refine((d) => Boolean(d.email || d.phone), { message: "email or phone required" });

export async function createManualLead(raw: unknown): Promise<ManualLeadResult> {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const { allowed } = await checkRateLimit(clientWriteLimiter, `manual-lead:${scope.userId}`);
  if (!allowed) return { ok: false, error: "Too many entries, try again in a minute." };

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Check the form: add a name and an email or phone." };
  }
  const d = parsed.data;

  // Same message for out-of-grant and cross-tenant so neither leaks.
  const property = propertyInScope(scope, d.propertyId)
    ? await prisma.property.findFirst({
        where: { id: d.propertyId, ...marketablePropertyWhere(scope.orgId) },
        select: { id: true },
      })
    : null;
  if (!property) return { ok: false, error: "Property not found." };

  const email = d.email ? normalizeLeadEmail(d.email) : null;
  if (email) {
    const existing = await findOldestLeadByEmail(scope.orgId, email, {
      id: true,
      propertyId: true,
    });
    if (existing) {
      // Link only when the caller can see that lead. propertyInScope passes
      // null, but an org-level lead is hidden from restricted users' lists.
      const visible = existing.propertyId
        ? propertyInScope(scope, existing.propertyId)
        : !scope.allowedPropertyIds;
      return {
        ok: false,
        duplicate: true,
        error: "A lead with this email already exists.",
        ...(visible ? { leadId: existing.id } : {}),
      };
    }
  }

  const lead = await prisma.lead.create({
    data: {
      orgId: scope.orgId,
      propertyId: property.id,
      firstName: d.firstName,
      lastName: d.lastName || null,
      email,
      phone: d.phone || null,
      source: d.source,
      sourceDetail: d.sourceDetail || null,
      notes: d.notes || null,
    },
    select: { id: true },
  });

  await prisma.auditEvent
    .create({
      data: auditPayload(scope, {
        action: AuditAction.CREATE,
        entityType: "Lead",
        entityId: lead.id,
        description: "Manually added lead",
      }),
    })
    .catch((err) => console.error("[manual-lead] audit failed", lead.id, err));

  await runAfter("manual-leads.notify", () =>
    notifyLeadCaptured({
      orgId: scope.orgId,
      leadId: lead.id,
      propertyId: property.id,
      channel: LeadNotifyChannel.MANUAL,
      lead: {
        name: [d.firstName, d.lastName].filter(Boolean).join(" "),
        email,
        phone: d.phone || null,
        sourceLabel: d.sourceDetail
          ? `${SOURCE_LABELS[d.source]}: ${d.sourceDetail}`
          : SOURCE_LABELS[d.source],
      },
    }),
  );

  revalidatePath("/portal/leads");
  return { ok: true, id: lead.id };
}
