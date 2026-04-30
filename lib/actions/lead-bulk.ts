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
import { AuditAction, LeadStatus, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Bulk lead actions: multi-select status update + bulk delete + bulk
// unsubscribe. Powers the toolbar that appears on the leads page when
// rows are checked.
//
// Every operation is tenant-scoped (only leads in the caller's org match)
// and produces an AuditEvent so the change is traceable in the audit log.
// ---------------------------------------------------------------------------

const STATUS_VALUES = Object.values(LeadStatus) as [LeadStatus, ...LeadStatus[]];

const updateStatusInput = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(500),
  status: z.enum(STATUS_VALUES),
});

const deleteInput = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(500),
});

type Result =
  | { ok: true; count: number }
  | { ok: false; error: string };

export async function bulkUpdateLeadStatus(input: unknown): Promise<Result> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = updateStatusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { leadIds, status } = parsed.data;

  // Tenant scope: only update leads we own. updateMany silently filters,
  // so we count the actual updates after.
  const result = await prisma.lead.updateMany({
    where: { id: { in: leadIds }, orgId: scope.orgId },
    data: { status, lastActivityAt: new Date() },
  });

  if (result.count > 0) {
    await prisma.auditEvent.create({
      data: auditPayload(scope as ScopedContext, {
        action: AuditAction.UPDATE,
        entityType: "Lead",
        description: `Bulk updated ${result.count} ${result.count === 1 ? "lead" : "leads"} to ${status}`,
        diff: {
          status,
          count: result.count,
          ids: leadIds.slice(0, 50),
        } as Prisma.InputJsonValue,
      }),
    });
  }

  revalidatePath("/portal/leads");
  return { ok: true, count: result.count };
}

export async function bulkUnsubscribeLeads(input: unknown): Promise<Result> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = deleteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { leadIds } = parsed.data;

  const now = new Date();
  const result = await prisma.lead.updateMany({
    where: { id: { in: leadIds }, orgId: scope.orgId },
    data: {
      unsubscribedFromEmails: true,
      unsubscribedAt: now,
      lastActivityAt: now,
    },
  });

  if (result.count > 0) {
    await prisma.auditEvent.create({
      data: auditPayload(scope as ScopedContext, {
        action: AuditAction.UPDATE,
        entityType: "Lead",
        description: `Unsubscribed ${result.count} ${result.count === 1 ? "lead" : "leads"} from emails`,
        diff: { count: result.count } as Prisma.InputJsonValue,
      }),
    });
  }

  revalidatePath("/portal/leads");
  return { ok: true, count: result.count };
}

export async function bulkDeleteLeads(input: unknown): Promise<Result> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = deleteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { leadIds } = parsed.data;

  const result = await prisma.lead.deleteMany({
    where: { id: { in: leadIds }, orgId: scope.orgId },
  });

  if (result.count > 0) {
    await prisma.auditEvent.create({
      data: auditPayload(scope as ScopedContext, {
        action: AuditAction.DELETE,
        entityType: "Lead",
        description: `Deleted ${result.count} ${result.count === 1 ? "lead" : "leads"}`,
        diff: {
          count: result.count,
          ids: leadIds.slice(0, 50),
        } as Prisma.InputJsonValue,
      }),
    });
  }

  revalidatePath("/portal/leads");
  return { ok: true, count: result.count };
}
