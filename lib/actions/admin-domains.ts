"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAgency,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { AuditAction, Prisma } from "@prisma/client";
import {
  addDomainToProject,
  removeDomainFromProject,
  getDomainConfig,
  verifyDomain,
  computeSslStatus,
  isValidHostname,
  normalizeHostname,
  type DnsRecordHint,
} from "@/lib/integrations/vercel-domains";

// ---------------------------------------------------------------------------
// Agency-only custom domain management for tenants. Wraps Vercel's domains
// API plus our local DomainBinding table. Every mutation is audit-logged.
// ---------------------------------------------------------------------------

const addSchema = z.object({
  orgId: z.string().min(1),
  hostname: z.string().min(3).max(253),
  isPrimary: z.boolean().default(false),
});

export type AddDomainResult =
  | {
      ok: true;
      domainId: string;
      hostname: string;
      alreadyAttached: boolean;
      dnsRecords: DnsRecordHint[];
    }
  | { ok: false; error: string };

export async function addClientDomain(
  raw: unknown,
): Promise<AddDomainResult> {
  let scope;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const hostname = normalizeHostname(parsed.data.hostname);
  if (!isValidHostname(hostname)) {
    return { ok: false, error: `"${parsed.data.hostname}" is not a valid hostname.` };
  }

  const org = await prisma.organization.findUnique({
    where: { id: parsed.data.orgId },
    select: { id: true },
  });
  if (!org) return { ok: false, error: "Tenant not found" };

  // Reject if already on a different tenant in our DB.
  const conflict = await prisma.domainBinding.findUnique({
    where: { hostname },
    select: { orgId: true },
  });
  if (conflict && conflict.orgId !== org.id) {
    return {
      ok: false,
      error: `Hostname ${hostname} is already attached to another tenant in this workspace.`,
    };
  }

  const vercelResult = await addDomainToProject(hostname);
  if (!vercelResult.ok) {
    return { ok: false, error: vercelResult.error };
  }

  // If marked primary, demote any existing primary on this org first.
  if (parsed.data.isPrimary) {
    await prisma.domainBinding.updateMany({
      where: { orgId: org.id, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const binding = await prisma.domainBinding.upsert({
    where: { hostname },
    create: {
      orgId: org.id,
      hostname,
      isPrimary: parsed.data.isPrimary,
      vercelDomainId: vercelResult.domain.name,
      sslStatus: vercelResult.domain.verified ? "active" : "pending",
      dnsConfigured: false,
    },
    update: {
      orgId: org.id,
      isPrimary: parsed.data.isPrimary,
      vercelDomainId: vercelResult.domain.name,
    },
  });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId: org.id },
      {
        action: AuditAction.SETTING_CHANGE,
        entityType: "DomainBinding",
        entityId: binding.id,
        description: `${vercelResult.alreadyAttached ? "Re-bound" : "Added"} domain ${hostname}${parsed.data.isPrimary ? " (primary)" : ""}`,
        diff: { hostname, isPrimary: parsed.data.isPrimary },
      },
    ),
  });

  revalidatePath(`/admin/clients/${org.id}`);

  return {
    ok: true,
    domainId: binding.id,
    hostname,
    alreadyAttached: vercelResult.alreadyAttached,
    dnsRecords: vercelResult.dnsRecords,
  };
}

const idSchema = z.object({ domainId: z.string().min(1) });

export type VerifyResult =
  | {
      ok: true;
      verified: boolean;
      sslStatus: string;
      dnsConfigured: boolean;
    }
  | { ok: false; error: string };

export async function verifyClientDomain(raw: unknown): Promise<VerifyResult> {
  let scope;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid domainId" };

  const binding = await prisma.domainBinding.findUnique({
    where: { id: parsed.data.domainId },
    select: { id: true, hostname: true, orgId: true },
  });
  if (!binding) return { ok: false, error: "Domain not found" };

  let verified = false;
  let misconfigured = true;
  try {
    const verifyResult = await verifyDomain(binding.hostname);
    verified = verifyResult.verified;
    const config = await getDomainConfig(binding.hostname);
    misconfigured = config.misconfigured;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Vercel verify failed",
    };
  }

  const sslStatus = computeSslStatus(verified, misconfigured);
  const dnsConfigured = !misconfigured;

  await prisma.domainBinding.update({
    where: { id: binding.id },
    data: { sslStatus, dnsConfigured },
  });

  revalidatePath(`/admin/clients/${binding.orgId}`);
  return { ok: true, verified, sslStatus, dnsConfigured };
}

export async function removeClientDomain(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let scope;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid domainId" };

  const binding = await prisma.domainBinding.findUnique({
    where: { id: parsed.data.domainId },
    select: { id: true, hostname: true, orgId: true },
  });
  if (!binding) return { ok: false, error: "Domain not found" };

  const removeResult = await removeDomainFromProject(binding.hostname).catch(
    (err: unknown) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : "Vercel remove failed",
    }),
  );
  // Soft-fail Vercel removal — proceed to drop our row anyway, log the warning
  // in the audit event so an operator can clean up Vercel manually if needed.

  await prisma.domainBinding.delete({ where: { id: binding.id } });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId: binding.orgId },
      {
        action: AuditAction.DELETE,
        entityType: "DomainBinding",
        entityId: binding.id,
        description: `Removed domain ${binding.hostname}${
          removeResult.ok ? "" : ` (Vercel teardown failed: ${removeResult.error})`
        }`,
        diff: { hostname: binding.hostname },
      },
    ),
  });

  revalidatePath(`/admin/clients/${binding.orgId}`);
  return { ok: true };
}

export async function setPrimaryDomain(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let scope;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid domainId" };

  const binding = await prisma.domainBinding.findUnique({
    where: { id: parsed.data.domainId },
    select: { id: true, orgId: true, hostname: true },
  });
  if (!binding) return { ok: false, error: "Domain not found" };

  await prisma.$transaction([
    prisma.domainBinding.updateMany({
      where: { orgId: binding.orgId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.domainBinding.update({
      where: { id: binding.id },
      data: { isPrimary: true },
    }),
    prisma.auditEvent.create({
      data: auditPayload(
        { ...scope, orgId: binding.orgId },
        {
          action: AuditAction.SETTING_CHANGE,
          entityType: "DomainBinding",
          entityId: binding.id,
          description: `Set ${binding.hostname} as primary domain`,
          diff: { hostname: binding.hostname, isPrimary: true } as Prisma.InputJsonValue,
        },
      ),
    }),
  ]);

  revalidatePath(`/admin/clients/${binding.orgId}`);
  return { ok: true };
}
