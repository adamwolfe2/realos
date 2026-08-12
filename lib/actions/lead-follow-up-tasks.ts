"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AuditAction,
  LeadFollowUpChannel,
  LeadFollowUpDraftStatus,
  LeadFollowUpTaskStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ForbiddenError,
  auditPayload,
  requireWritableWorkspace,
  type ScopedContext,
} from "@/lib/tenancy/scope";
import { propertyWhereFragment } from "@/lib/tenancy/property-filter";
import { sendLeadEmail } from "@/lib/actions/lead-email";
import { sendLeadSms } from "@/lib/actions/lead-sms";

const statusInputSchema = z.object({
  taskId: z.string().min(1),
  action: z.enum(["approve", "dismiss", "snooze"]),
  reason: z.string().trim().max(500).optional(),
});

const sendInputSchema = z.object({
  taskId: z.string().min(1),
  draftId: z.string().min(1),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1).max(8000),
});

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function updateLeadFollowUpTaskStatus(
  input: unknown,
): Promise<ActionResult> {
  const scopeResult = await getWritableScope();
  if (!scopeResult.ok) return scopeResult;
  const scope = scopeResult.scope;

  const parsed = statusInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { taskId, action, reason } = parsed.data;

  const task = await findScopedTask(scope, taskId);
  if (!task) return { ok: false, error: "Follow-up task not found" };
  if (task.status === LeadFollowUpTaskStatus.SENT || task.status === LeadFollowUpTaskStatus.EDITED_SENT) {
    return { ok: false, error: "This follow-up was already sent." };
  }

  const next =
    action === "approve"
      ? LeadFollowUpTaskStatus.APPROVED
      : action === "dismiss"
        ? LeadFollowUpTaskStatus.DISMISSED
        : LeadFollowUpTaskStatus.SNOOZED;
  const now = new Date();
  const dueAt =
    action === "snooze" ? new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) : task.dueAt;

  await prisma.$transaction([
    prisma.leadFollowUpTask.update({
      where: { id: task.id },
      data: {
        status: next,
        dueAt,
        dismissedReason: action === "dismiss" ? (reason || "Dismissed by operator") : null,
      },
    }),
    prisma.auditEvent.create({
      data: auditPayload(scope as ScopedContext, {
        action: AuditAction.UPDATE,
        entityType: "LeadFollowUpTask",
        entityId: task.id,
        description: `AI follow-up task ${action}`,
        diff: {
          previousStatus: task.status,
          nextStatus: next,
          reason: reason ?? null,
          dueAt: dueAt?.toISOString() ?? null,
        } as Prisma.InputJsonValue,
      }),
    }),
  ]);

  revalidateTaskPaths(task);
  return {
    ok: true,
    message:
      action === "approve"
        ? "Follow-up approved."
        : action === "dismiss"
          ? "Follow-up dismissed."
          : "Follow-up snoozed for 3 days.",
  };
}

export async function sendLeadFollowUpDraft(input: unknown): Promise<ActionResult> {
  const scopeResult = await getWritableScope();
  if (!scopeResult.ok) return scopeResult;
  const scope = scopeResult.scope;

  const parsed = sendInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { taskId, draftId, subject, body } = parsed.data;

  const task = await findScopedTask(scope, taskId);
  if (!task) return { ok: false, error: "Follow-up task not found" };
  if (!task.leadId) return { ok: false, error: "Follow-up is not linked to a lead." };
  if (task.status === LeadFollowUpTaskStatus.SENT || task.status === LeadFollowUpTaskStatus.EDITED_SENT) {
    return { ok: false, error: "This follow-up was already sent." };
  }

  const draft = task.drafts.find((d) => d.id === draftId);
  if (!draft || draft.status !== LeadFollowUpDraftStatus.DRAFT) {
    return { ok: false, error: "Draft not found or already handled." };
  }

  let sendResult: { ok: true } | { ok: false; error: string };
  if (draft.channel === LeadFollowUpChannel.EMAIL) {
    const finalSubject = subject || draft.subject || "Following up";
    sendResult = await sendLeadEmail({
      leadId: task.leadId,
      subject: finalSubject,
      body,
      skipAutoGreeting: true,
    });
  } else if (draft.channel === LeadFollowUpChannel.SMS) {
    sendResult = await sendLeadSms({ leadId: task.leadId, body });
  } else {
    return {
      ok: false,
      error: "Only email and SMS drafts can be sent from LeaseStack today.",
    };
  }

  if (!sendResult.ok) return sendResult;

  const finalStatus =
    body.trim() === draft.body.trim() && (subject ?? draft.subject ?? null) === (draft.subject ?? null)
      ? LeadFollowUpTaskStatus.SENT
      : LeadFollowUpTaskStatus.EDITED_SENT;
  const finalDraftStatus =
    finalStatus === LeadFollowUpTaskStatus.SENT
      ? LeadFollowUpDraftStatus.SENT
      : LeadFollowUpDraftStatus.EDITED_SENT;
  const now = new Date();

  await prisma.$transaction([
    prisma.leadFollowUpDraft.update({
      where: { id: draft.id },
      data: {
        status: finalDraftStatus,
        editedBody: body.trim() === draft.body.trim() ? null : body,
        sentAt: now,
      },
    }),
    prisma.leadFollowUpTask.update({
      where: { id: task.id },
      data: {
        status: finalStatus,
        dismissedReason: null,
      },
    }),
    prisma.auditEvent.create({
      data: auditPayload(scope as ScopedContext, {
        action: AuditAction.UPDATE,
        entityType: "LeadFollowUpTask",
        entityId: task.id,
        description: "Sent AI follow-up draft",
        diff: {
          draftId: draft.id,
          channel: draft.channel,
          previousStatus: task.status,
          nextStatus: finalStatus,
          edited: finalStatus === LeadFollowUpTaskStatus.EDITED_SENT,
        } as Prisma.InputJsonValue,
      }),
    }),
  ]);

  revalidateTaskPaths(task);
  return { ok: true, message: "Follow-up sent and marked complete." };
}

async function getWritableScope(): Promise<
  | { ok: true; scope: ScopedContext }
  | { ok: false; error: string }
> {
  try {
    return { ok: true, scope: await requireWritableWorkspace() };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

function findScopedTask(scope: ScopedContext, taskId: string) {
  return prisma.leadFollowUpTask.findFirst({
    where: {
      id: taskId,
      orgId: scope.orgId,
      ...propertyWhereFragment(scope, null),
    },
    include: {
      drafts: true,
      lead: { select: { id: true } },
    },
  });
}

function revalidateTaskPaths(task: { leadId: string | null }) {
  revalidatePath("/portal/conversations/insights");
  revalidatePath("/portal/leads");
  if (task.leadId) revalidatePath(`/portal/leads/${task.leadId}`);
}
