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
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  FROM_EMAIL,
  BRAND_EMAIL,
} from "@/lib/email/shared";

// ---------------------------------------------------------------------------
// Server action: send a one-off email from the operator to a lead.
// Powers the in-app email composer on /portal/leads/[id]. Wraps Resend with
// tenant-scope verification, audit log, and lead-state bookkeeping
// (lastEmailSentAt, emailsSent counter) so the agency + client can see
// every reply they sent in the audit trail and trigger lead-cadence logic
// off real send activity.
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  leadId: z.string().min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
});

type SendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

export async function sendLeadEmail(input: unknown): Promise<SendResult> {
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
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }
  const { leadId, subject, body } = parsed.data;

  // Tenant scope: only allow sending to leads in the caller's org.
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, orgId: scope.orgId },
    select: {
      id: true,
      orgId: true,
      firstName: true,
      lastName: true,
      email: true,
      unsubscribedFromEmails: true,
      org: { select: { name: true } },
    },
  });
  if (!lead) {
    return { ok: false, error: "Lead not found" };
  }
  if (!lead.email || !isValidEmail(lead.email)) {
    return { ok: false, error: "Lead has no valid email on file" };
  }
  if (lead.unsubscribedFromEmails) {
    return {
      ok: false,
      error: "This lead has unsubscribed from emails. Reach out via phone or chatbot.",
    };
  }

  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "Email is not configured for this org yet." };
  }

  const greetingName = lead.firstName?.trim() || null;
  const html = buildBaseHtml({
    headline: subject,
    bodyHtml: `${
      greetingName
        ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${escapeHtml(greetingName)},</p>`
        : ""
    }${formatBodyAsHtml(body)}`,
  });

  let messageId: string | undefined;
  try {
    const r = await resend.emails.send({
      from: FROM_EMAIL,
      to: lead.email,
      subject,
      html,
      text: body,
      replyTo: BRAND_EMAIL,
    });
    if (r.error) {
      return { ok: false, error: r.error.message };
    }
    messageId = r.data?.id;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }

  // Bookkeeping: Lead state + audit row. Both best-effort — the email is
  // already in flight so we don't surface failures here as user errors.
  try {
    const now = new Date();
    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: {
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
          description: `Sent email to ${lead.email}: ${subject}`,
          diff: {
            subject,
            messageId: messageId ?? null,
          } as Prisma.InputJsonValue,
        }),
      }),
    ]);
  } catch {
    // Log but don't fail the action — the email was sent successfully.
  }

  revalidatePath(`/portal/leads/${lead.id}`);

  return { ok: true, messageId };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBodyAsHtml(body: string): string {
  // Convert plain text body into a sequence of paragraphs preserving
  // double-newline blocks.
  const blocks = body.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return blocks
    .map(
      (b) =>
        `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(
          b.trim(),
        )}</p>`,
    )
    .join("");
}
