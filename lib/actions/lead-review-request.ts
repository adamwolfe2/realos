"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  auditPayload,
  type ScopedContext,
} from "@/lib/tenancy/scope";
import { AuditAction, Prisma } from "@prisma/client";
import { sendReviewRequestEmail } from "@/lib/email/review-request";

// ---------------------------------------------------------------------------
// Manual "send Google review request" trigger for /portal/leads/[id].
// The cron at /api/cron/review-requests handles bulk sends 7-60 days
// post-signing; this endpoint lets the operator nudge a single resident
// (or re-send if the first one didn't land).
//
// Returns { ok: false, error } when:
//   - no email on file
//   - lead unsubscribed
//   - linked property has no googleReviewUrl
// On success, bumps Lead.reviewRequestSentAt and writes an AuditEvent.
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  leadId: z.string().min(1),
});

type Result =
  | { ok: true; sentAt: string }
  | { ok: false; error: string };

export async function sendManualReviewRequest(
  input: unknown,
): Promise<Result> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { leadId } = parsed.data;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, orgId: scope.orgId },
    select: {
      id: true,
      firstName: true,
      email: true,
      unsubscribedFromEmails: true,
      reviewRequestSentAt: true,
      property: {
        select: { name: true, googleReviewUrl: true },
      },
    },
  });
  if (!lead) {
    return { ok: false, error: "Lead not found" };
  }
  if (!lead.email) {
    return { ok: false, error: "This lead has no email on file." };
  }
  if (lead.unsubscribedFromEmails) {
    return {
      ok: false,
      error: "Lead has unsubscribed from email — can't send.",
    };
  }
  if (!lead.property?.googleReviewUrl) {
    return {
      ok: false,
      error:
        "The linked property has no Google review URL configured. Add one on the property settings page.",
    };
  }

  const r = await sendReviewRequestEmail({
    to: lead.email,
    firstName: lead.firstName,
    propertyName: lead.property.name,
    googleReviewUrl: lead.property.googleReviewUrl,
    leadId: lead.id,
  });
  if (!r.ok) {
    return { ok: false, error: r.error ?? "Send failed" };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.lead.update({
      where: { id: lead.id },
      data: {
        reviewRequestSentAt: now,
        lastEmailSentAt: now,
        emailsSent: { increment: 1 },
        lastActivityAt: now,
      },
    }),
    prisma.auditEvent.create({
      data: auditPayload(scope as ScopedContext, {
        action: AuditAction.UPDATE,
        entityType: "Lead",
        entityId: lead.id,
        description: `Sent review request to ${lead.email}${
          lead.reviewRequestSentAt ? " (re-send)" : ""
        }`,
        diff: {
          messageId: r.id ?? null,
          property: lead.property.name,
        } as Prisma.InputJsonValue,
      }),
    }),
  ]);

  revalidatePath(`/portal/leads/${lead.id}`);

  return { ok: true, sentAt: now.toISOString() };
}
