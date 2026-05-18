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

// Property-RBAC gate. Returns the Prisma fragment to AND into a Lead
// where-clause so a restricted user can't mutate leads on properties
// they don't have access to. Pre-fix the bulk endpoints accepted any
// leadIds array and only checked orgId — meaning a leasing agent with
// access to Bldg A could pass leadIds for leads on Bldg B (visible to
// them via /api/tenant/leads before that was gated, or just by trying
// raw ids) and unsubscribe/delete/reassign them.
//
// A null gate (unrestricted scope) returns {} so the bulk op runs
// portfolio-wide.
function bulkLeadPropertyGate(
  scope: { allowedPropertyIds: string[] | null },
): Record<string, unknown> {
  if (!scope.allowedPropertyIds) return {};
  // Synthetic id mirror of propertyWhereFragment — empty allowed list
  // matches nothing, never the full org.
  if (scope.allowedPropertyIds.length === 0) {
    return { propertyId: "__no_property_access__" };
  }
  return { propertyId: { in: scope.allowedPropertyIds } };
}

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

  // Tenant scope + property-RBAC: only update leads we own AND that
  // live on a property the caller has access to. updateMany silently
  // filters, so we count the actual updates after.
  const result = await prisma.lead.updateMany({
    where: {
      id: { in: leadIds },
      orgId: scope.orgId,
      ...bulkLeadPropertyGate(scope),
    },
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
    where: {
      id: { in: leadIds },
      orgId: scope.orgId,
      ...bulkLeadPropertyGate(scope),
    },
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

// ---------------------------------------------------------------------------
// bulkAssignLeads — sets Lead.assignedToUserId on a batch of leads. When
// `userId` is omitted, the caller is assigned to themselves ("Assign to
// me"). When `userId === null`, the assignment is cleared.
// Tenant-scoped (only matches leads in the caller's org); when the userId
// is provided we additionally verify that user belongs to the same org so
// agency operators can't reassign leads to outsiders.
// ---------------------------------------------------------------------------

const assignInput = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(500),
  // null  -> clear assignment
  // undef -> assign to caller (scope.userId)
  userId: z.string().min(1).nullable().optional(),
});

export async function bulkAssignLeads(input: unknown): Promise<Result> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = assignInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { leadIds, userId } = parsed.data;

  let assigneeId: string | null;
  if (userId === null) {
    assigneeId = null;
  } else if (userId === undefined) {
    assigneeId = scope.userId;
  } else {
    // Verify the target user is in the same effective org so agency
    // operators can't reassign to users outside the tenant boundary.
    const target = await prisma.user.findFirst({
      where: { id: userId, orgId: scope.orgId },
      select: { id: true },
    });
    if (!target) return { ok: false, error: "Assignee not found in this org" };
    assigneeId = target.id;
  }

  const result = await prisma.lead.updateMany({
    where: {
      id: { in: leadIds },
      orgId: scope.orgId,
      ...bulkLeadPropertyGate(scope),
    },
    data: { assignedToUserId: assigneeId, lastActivityAt: new Date() },
  });

  if (result.count > 0) {
    await prisma.auditEvent.create({
      data: auditPayload(scope as ScopedContext, {
        action: AuditAction.UPDATE,
        entityType: "Lead",
        description: assigneeId
          ? `Assigned ${result.count} ${result.count === 1 ? "lead" : "leads"} to user ${assigneeId}`
          : `Unassigned ${result.count} ${result.count === 1 ? "lead" : "leads"}`,
        diff: {
          assignedToUserId: assigneeId,
          count: result.count,
          ids: leadIds.slice(0, 50),
        } as Prisma.InputJsonValue,
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
    where: {
      id: { in: leadIds },
      orgId: scope.orgId,
      ...bulkLeadPropertyGate(scope),
    },
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
