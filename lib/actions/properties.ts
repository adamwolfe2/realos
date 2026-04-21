"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAgency,
  requireScope,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import {
  AuditAction,
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
  OrgType,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Property CRUD. Both operators (CLIENT) and agency users (AGENCY) can call
// these — agency must pass an explicit orgId, operators are scoped to their
// own org.
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const createSchema = z.object({
  // orgId is optional from operator path (defaults to scope.orgId), required
  // from admin path. We re-check authorization below.
  orgId: z.string().optional(),
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(SLUG_RE, "Lowercase letters, numbers and dashes only."),
  propertyType: z.nativeEnum(PropertyType).default(PropertyType.RESIDENTIAL),
  residentialSubtype: z.nativeEnum(ResidentialSubtype).optional().nullable(),
  commercialSubtype: z.nativeEnum(CommercialSubtype).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(60).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  description: z.string().max(8000).optional().nullable(),
  heroImageUrl: z.string().url().optional().nullable().or(z.literal("")),
  virtualTourUrl: z.string().url().optional().nullable().or(z.literal("")),
  yearBuilt: z.number().int().min(1700).max(2100).optional().nullable(),
  totalUnits: z.number().int().min(1).max(10000).optional().nullable(),
});

export type CreatePropertyResult =
  | { ok: true; propertyId: string }
  | { ok: false; error: string };

export async function createProperty(
  raw: unknown,
): Promise<CreatePropertyResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  const data = parsed.data;

  // Authorization: agency users can pick the orgId; operators must match scope.
  let targetOrgId: string;
  if (scope.isAgency) {
    if (!data.orgId) {
      return {
        ok: false,
        error: "Agency users must pass an orgId.",
      };
    }
    const target = await prisma.organization.findUnique({
      where: { id: data.orgId },
      select: { id: true, orgType: true },
    });
    if (!target || target.orgType !== OrgType.CLIENT) {
      return { ok: false, error: "Tenant not found or not a CLIENT." };
    }
    targetOrgId = target.id;
  } else {
    if (data.orgId && data.orgId !== scope.orgId) {
      return { ok: false, error: "Cannot create properties for another tenant." };
    }
    targetOrgId = scope.orgId;
  }

  // Slug uniqueness within tenant
  const existing = await prisma.property.findFirst({
    where: { orgId: targetOrgId, slug: data.slug },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: `A property with slug "${data.slug}" already exists.` };
  }

  const created = await prisma.property.create({
    data: {
      orgId: targetOrgId,
      name: data.name,
      slug: data.slug,
      propertyType: data.propertyType,
      residentialSubtype: data.residentialSubtype ?? null,
      commercialSubtype: data.commercialSubtype ?? null,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      state: data.state || null,
      postalCode: data.postalCode || null,
      description: data.description || null,
      heroImageUrl: data.heroImageUrl || null,
      virtualTourUrl: data.virtualTourUrl || null,
      yearBuilt: data.yearBuilt ?? null,
      totalUnits: data.totalUnits ?? null,
    },
  });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId: targetOrgId },
      {
        action: AuditAction.CREATE,
        entityType: "Property",
        entityId: created.id,
        description: `Created property "${data.name}" (${data.slug})`,
        diff: { name: data.name, slug: data.slug },
      },
    ),
  });

  revalidatePath(`/portal/properties`);
  if (scope.isAgency) revalidatePath(`/admin/clients/${targetOrgId}`);
  return { ok: true, propertyId: created.id };
}

const updateSchema = createSchema.extend({
  propertyId: z.string().min(1),
});

export type UpdatePropertyResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateProperty(
  raw: unknown,
): Promise<UpdatePropertyResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  const data = parsed.data;

  const existing = await prisma.property.findUnique({
    where: { id: data.propertyId },
    select: { id: true, orgId: true, slug: true },
  });
  if (!existing) return { ok: false, error: "Property not found" };

  if (!scope.isAgency && existing.orgId !== scope.orgId) {
    return { ok: false, error: "Cannot modify another tenant's property." };
  }

  if (data.slug !== existing.slug) {
    const conflict = await prisma.property.findFirst({
      where: { orgId: existing.orgId, slug: data.slug },
      select: { id: true },
    });
    if (conflict && conflict.id !== existing.id) {
      return { ok: false, error: `Slug "${data.slug}" is already in use.` };
    }
  }

  await prisma.property.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      slug: data.slug,
      propertyType: data.propertyType,
      residentialSubtype: data.residentialSubtype ?? null,
      commercialSubtype: data.commercialSubtype ?? null,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      state: data.state || null,
      postalCode: data.postalCode || null,
      description: data.description || null,
      heroImageUrl: data.heroImageUrl || null,
      virtualTourUrl: data.virtualTourUrl || null,
      yearBuilt: data.yearBuilt ?? null,
      totalUnits: data.totalUnits ?? null,
    },
  });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId: existing.orgId },
      {
        action: AuditAction.UPDATE,
        entityType: "Property",
        entityId: existing.id,
        description: `Updated property "${data.name}"`,
        diff: { name: data.name, slug: data.slug },
      },
    ),
  });

  revalidatePath(`/portal/properties`);
  revalidatePath(`/portal/properties/${existing.id}`);
  if (scope.isAgency) revalidatePath(`/admin/clients/${existing.orgId}`);
  return { ok: true };
}

export async function deleteProperty(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let scope;
  try {
    // Agency-only — destructive, easier to gate strictly than risk
    // operator-side confusion about cascade behavior.
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = z.object({ propertyId: z.string().min(1) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid propertyId" };

  const existing = await prisma.property.findUnique({
    where: { id: parsed.data.propertyId },
    select: { id: true, orgId: true, name: true },
  });
  if (!existing) return { ok: false, error: "Property not found" };

  await prisma.property.delete({ where: { id: existing.id } });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId: existing.orgId },
      {
        action: AuditAction.DELETE,
        entityType: "Property",
        entityId: existing.id,
        description: `Deleted property "${existing.name}"`,
      },
    ),
  });

  revalidatePath(`/portal/properties`);
  revalidatePath(`/admin/clients/${existing.orgId}`);
  return { ok: true };
}
