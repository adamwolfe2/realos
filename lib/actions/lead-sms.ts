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
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";

// ---------------------------------------------------------------------------
// Server action: send a one-off SMS to a lead via Twilio.
// Mirrors sendLeadEmail() — tenant scope, opt-out check, audit log.
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  leadId: z.string().min(1),
  body: z.string().min(1).max(1600),
});

type Result =
  | { ok: true; sid: string }
  | { ok: false; error: string };

export async function checkSmsConfigured(): Promise<{ configured: boolean }> {
  return { configured: isSmsConfigured() };
}

export async function sendLeadSms(input: unknown): Promise<Result> {
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
  const { leadId, body } = parsed.data;

  if (!isSmsConfigured()) {
    return {
      ok: false,
      error: "SMS isn't configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.",
    };
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, orgId: scope.orgId },
    select: {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!lead) return { ok: false, error: "Lead not found" };
  if (!lead.phone) {
    return { ok: false, error: "Lead has no phone on file." };
  }

  const result = await sendSms({ to: lead.phone, body });
  if (!result.ok) return { ok: false, error: result.error };

  try {
    const now = new Date();
    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { lastActivityAt: now },
      }),
      prisma.auditEvent.create({
        data: auditPayload(scope as ScopedContext, {
          action: AuditAction.UPDATE,
          entityType: "Lead",
          entityId: lead.id,
          description: `Sent SMS to ${lead.phone}`,
          diff: {
            sid: result.sid,
            preview: body.slice(0, 80),
          } as Prisma.InputJsonValue,
        }),
      }),
    ]);
  } catch {
    // Best-effort — message already sent.
  }

  revalidatePath(`/portal/leads/${lead.id}`);
  return { ok: true, sid: result.sid };
}
