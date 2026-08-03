"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireWritableWorkspace,
  tenantWhere,
  propertyInScope,
  auditPayload,
  ForbiddenError,
} from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { clientWriteLimiter, checkRateLimit } from "@/lib/rate-limit";
import {
  AuditAction,
  ApplicationStatus,
  LeadSource,
  ResidentStatus,
  WorkOrderPriority,
  WorkOrderStatus,
} from "@prisma/client";
import { ALLOWED_WRITE_ROLES } from "@/lib/auth/write-roles";

// ---------------------------------------------------------------------------
// Manual entry (P1-7/8/9): AppFolio-less orgs need Residents, Work orders,
// and Applications to be usable surfaces, not sync-only dead ends. Three
// server actions, one shared shape: validate → tenant + property-grant gate
// → create with externalSystem null (so a later AppFolio connect can't
// collide on the sync unique keys) → audit → revalidate.
// ---------------------------------------------------------------------------

export type ManualCreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

type Scope = Awaited<ReturnType<typeof requireWritableWorkspace>>;

// Manual entry is operational data entry: owners/admins + leasing agents.
// The set moved to lib/auth/write-roles.ts (2026-08-02) so the lead→lease
// link route shares it rather than re-deriving the same policy.

/** Shared entry gate: auth + role + rate limit + moduleResidents flag.
    Returns an error result, or null to proceed. */
async function gateManualWrite(
  scope: Scope,
): Promise<ManualCreateResult | null> {
  if (!ALLOWED_WRITE_ROLES.has(scope.role)) {
    return { ok: false, error: "Your role doesn't allow manual entry." };
  }
  const { allowed } = await checkRateLimit(
    clientWriteLimiter,
    `manual-create:${scope.userId}`,
  );
  if (!allowed) {
    return { ok: false, error: "Too many entries — try again in a minute." };
  }
  // Entitlement: these surfaces hang off the Residents module. The action
  // is the trust boundary, not the page.
  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: { moduleResidents: true },
  });
  if (!org?.moduleResidents) {
    return { ok: false, error: "The Residents module isn't active." };
  }
  return null;
}

/** Property must exist, belong to the org, be MARKETABLE (active lifecycle —
    otherwise the record saves but every list page filters it out), and be
    inside the caller's per-user property grant. Null when any check fails. */
async function assertProperty(scope: Scope, propertyId: string) {
  if (!propertyInScope(scope, propertyId)) return null;
  return prisma.property.findFirst({
    where: { id: propertyId, ...marketablePropertyWhere(scope.orgId) },
    select: { id: true },
  });
}

function fail(err: unknown): ManualCreateResult {
  if (err instanceof ForbiddenError) return { ok: false, error: err.message };
  throw err;
}

// --- Resident --------------------------------------------------------------

const residentSchema = z.object({
  propertyId: z.string().min(1).max(100),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  unitNumber: z.string().trim().max(60).optional(),
  status: z.nativeEnum(ResidentStatus).default(ResidentStatus.ACTIVE),
  moveInDate: z.string().date().optional().or(z.literal("")),
  moveOutDate: z.string().date().optional().or(z.literal("")),
  monthlyRent: z.coerce.number().min(0).max(1_000_000).optional(),
});

export async function createManualResident(
  raw: unknown,
): Promise<ManualCreateResult> {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    return fail(err);
  }
  const gateError = await gateManualWrite(scope);
  if (gateError) return gateError;
  const parsed = residentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Check the form — some fields are invalid." };
  }
  const d = parsed.data;
  if (!(await assertProperty(scope, d.propertyId))) {
    return { ok: false, error: "Property not found." };
  }

  const resident = await prisma.resident.create({
    data: {
      orgId: scope.orgId,
      propertyId: d.propertyId,
      firstName: d.firstName,
      lastName: d.lastName || null,
      email: d.email || null,
      phone: d.phone || null,
      unitNumber: d.unitNumber || null,
      status: d.status,
      moveInDate: d.moveInDate ? new Date(d.moveInDate) : null,
      moveOutDate: d.moveOutDate ? new Date(d.moveOutDate) : null,
      monthlyRentCents:
        d.monthlyRent !== undefined ? Math.round(d.monthlyRent * 100) : null,
    },
    select: { id: true },
  });

  await prisma.auditEvent
    .create({
      data: auditPayload(scope, {
        action: AuditAction.CREATE,
        entityType: "Resident",
        entityId: resident.id,
        description: "Manually added resident",
      }),
    })
    .catch(() => undefined);

  revalidatePath("/portal/residents");
  return { ok: true, id: resident.id };
}

// --- Work order ------------------------------------------------------------

const workOrderSchema = z.object({
  propertyId: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  category: z.string().trim().max(80).optional(),
  unitNumber: z.string().trim().max(60).optional(),
  priority: z.nativeEnum(WorkOrderPriority).default(WorkOrderPriority.NORMAL),
  status: z.nativeEnum(WorkOrderStatus).default(WorkOrderStatus.NEW),
  scheduledFor: z.string().date().optional().or(z.literal("")),
});

export async function createManualWorkOrder(
  raw: unknown,
): Promise<ManualCreateResult> {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    return fail(err);
  }
  const gateError = await gateManualWrite(scope);
  if (gateError) return gateError;
  const parsed = workOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Check the form — some fields are invalid." };
  }
  const d = parsed.data;
  if (!(await assertProperty(scope, d.propertyId))) {
    return { ok: false, error: "Property not found." };
  }

  const workOrder = await prisma.workOrder.create({
    data: {
      orgId: scope.orgId,
      propertyId: d.propertyId,
      title: d.title,
      description: d.description || null,
      category: d.category || null,
      unitNumber: d.unitNumber || null,
      priority: d.priority,
      status: d.status,
      reportedAt: new Date(),
      scheduledFor: d.scheduledFor ? new Date(d.scheduledFor) : null,
    },
    select: { id: true },
  });

  await prisma.auditEvent
    .create({
      data: auditPayload(scope, {
        action: AuditAction.CREATE,
        entityType: "WorkOrder",
        entityId: workOrder.id,
        description: "Manually logged work order",
      }),
    })
    .catch(() => undefined);

  revalidatePath("/portal/work-orders");
  return { ok: true, id: workOrder.id };
}

// --- Application -----------------------------------------------------------

const applicationSchema = z.object({
  propertyId: z.string().min(1).max(100),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  unitName: z.string().trim().max(60).optional(),
  status: z.nativeEnum(ApplicationStatus).default(ApplicationStatus.SUBMITTED),
  desiredMoveIn: z.string().date().optional().or(z.literal("")),
});

export async function createManualApplication(
  raw: unknown,
): Promise<ManualCreateResult> {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    return fail(err);
  }
  const gateError = await gateManualWrite(scope);
  if (gateError) return gateError;
  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Check the form — some fields are invalid." };
  }
  const d = parsed.data;
  if (!(await assertProperty(scope, d.propertyId))) {
    return { ok: false, error: "Property not found." };
  }

  // Application requires a Lead. Reuse an existing lead when the email
  // already exists in this org (keeps the funnel history in one place),
  // otherwise create a MANUAL-source lead.
  const existingLead = d.email
    ? await prisma.lead.findFirst({
        where: { ...tenantWhere(scope), email: d.email },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    : null;

  const leadId =
    existingLead?.id ??
    (
      await prisma.lead.create({
        data: {
          orgId: scope.orgId,
          propertyId: d.propertyId,
          firstName: d.firstName,
          lastName: d.lastName || null,
          email: d.email || null,
          phone: d.phone || null,
          source: LeadSource.MANUAL,
          sourceDetail: "Manual application entry",
        },
        select: { id: true },
      })
    ).id;

  const now = new Date();
  const application = await prisma.application.create({
    data: {
      leadId,
      propertyId: d.propertyId,
      status: d.status,
      unitName: d.unitName || null,
      appliedAt: now,
      receivedAt: now,
      desiredMoveIn: d.desiredMoveIn ? new Date(d.desiredMoveIn) : null,
      applicantData: {
        firstName: d.firstName,
        lastName: d.lastName || null,
        email: d.email || null,
        phone: d.phone || null,
        manual: true,
      },
    },
    select: { id: true },
  });

  await prisma.auditEvent
    .create({
      data: auditPayload(scope, {
        action: AuditAction.CREATE,
        entityType: "Application",
        entityId: application.id,
        description: "Manually logged application",
      }),
    })
    .catch(() => undefined);

  revalidatePath("/portal/applications");
  return { ok: true, id: application.id };
}
