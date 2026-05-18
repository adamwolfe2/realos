"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  auditPayload,
  requireScope,
  ForbiddenError,
  type ScopedContext,
} from "@/lib/tenancy/scope";
import {
  encryptForOrg,
  decryptForOrg,
  generateStrongPassword,
} from "@/lib/vault/crypto";
import {
  vaultRevealLimiter,
  checkRateLimit,
} from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Credentials Vault — server actions
//
// Every mutation:
//   1. requireScope() to authenticate + resolve actor
//   2. canAccessVault(scope) gate — denies LEASING_AGENT by default
//   3. Tenant + property RBAC via tenantWhere + propertyWhereFragment
//   4. Audit log via AuditEvent (every action) + CredentialAccessLog
//      (per-credential timeline; survives soft-delete of the entry)
//   5. revalidatePath so /portal/vault re-reads
//
// Plaintext password lifecycle:
//   - Only crosses the wire on revealCredential (explicit operator click)
//   - Decryption happens inside this server file — never returned to the
//     client from list/get endpoints
//   - Rate-limited to 10 reveals/min/userId to defend against drained
//     vault attacks from a compromised session
//   - The reveal endpoint writes the audit row BEFORE returning plaintext
//     so a server crash mid-call doesn't lose the audit trail
// ---------------------------------------------------------------------------

// Role gate. By default agency staff + client owners + client admins can
// access the vault. Leasing agents are denied — they get scoped property
// access via the existing UserPropertyAccess but the vault is a separate
// trust tier (operator confirmed in §12 of the PRD).
const VAULT_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
]);

function canAccessVault(scope: ScopedContext): boolean {
  return VAULT_ROLES.has(scope.role);
}

async function requireVaultAccess(): Promise<ScopedContext> {
  const scope = await requireScope();
  if (!canAccessVault(scope)) {
    throw new ForbiddenError(
      "Your role doesn't have credential vault access. Ask an admin.",
    );
  }
  return scope;
}

export type VaultActionResult<T = Record<string, never>> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  platform: z.string().trim().max(40).optional(),
  websiteUrl: z.string().trim().max(500).optional(),
  username: z.string().trim().max(200).optional(),
  password: z.string().min(1, "Password is required").max(4000),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  propertyId: z.string().min(1).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

const updateSchema = createSchema.partial().extend({
  // password becomes optional on update — operator may rotate or just
  // edit metadata. When provided, lastRotatedAt advances.
  password: z.string().min(1).max(4000).optional(),
});

const importSchema = z.object({
  csvText: z.string().min(1).max(2_000_000), // ~2MB cap
  defaultPropertyId: z.string().min(1).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function actorContext(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  const ipRaw = h.get("x-forwarded-for") ?? "";
  const ip = ipRaw ? ipRaw.split(",")[0].trim() : null;
  const userAgent = h.get("user-agent") ?? null;
  return { ip, userAgent };
}

async function ensurePropertyOwned(
  scope: ScopedContext,
  propertyId: string,
): Promise<boolean> {
  const owned = await prisma.property.findFirst({
    where: { id: propertyId, orgId: scope.orgId },
    select: { id: true },
  });
  if (!owned) return false;
  if (scope.allowedPropertyIds && !scope.allowedPropertyIds.includes(propertyId)) {
    return false;
  }
  return true;
}

function buildPropertyGate(scope: ScopedContext): Record<string, unknown> {
  if (!scope.allowedPropertyIds) return {};
  if (scope.allowedPropertyIds.length === 0) {
    // Restricted user with zero allowed properties sees only org-wide
    // credentials (propertyId IS NULL). Returning a synthetic id that
    // matches no rows is the wrong default here — vault scope falls
    // back to org-wide entries on purpose.
    return { propertyId: null };
  }
  return {
    OR: [
      { propertyId: null },
      { propertyId: { in: scope.allowedPropertyIds } },
    ],
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createCredential(
  input: unknown,
): Promise<VaultActionResult<{ id: string }>> {
  let scope: ScopedContext;
  try {
    scope = await requireVaultAccess();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  if (data.propertyId) {
    const ok = await ensurePropertyOwned(scope, data.propertyId);
    if (!ok) {
      return {
        ok: false,
        error: "Property does not belong to this org or your access scope",
      };
    }
  }

  const encrypted = await encryptForOrg(scope.orgId, data.password);

  const created = await prisma.credentialEntry.create({
    data: {
      orgId: scope.orgId,
      propertyId: data.propertyId ?? null,
      name: data.name,
      platform: data.platform ?? null,
      websiteUrl: data.websiteUrl ?? null,
      username: data.username ?? null,
      notes: data.notes ?? null,
      tags: data.tags,
      secretCiphertext: encrypted.secretCiphertext,
      secretIv: encrypted.secretIv,
      secretAuthTag: encrypted.secretAuthTag,
      createdById: scope.userId,
      lastRotatedAt: new Date(),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
    select: { id: true },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.CREATE,
      entityType: "CredentialEntry",
      entityId: created.id,
      description: `Created vault credential "${data.name}"`,
    }),
  });

  revalidatePath("/portal/vault");
  return { ok: true, data: { id: created.id } };
}

export async function updateCredential(
  id: string,
  input: unknown,
): Promise<VaultActionResult> {
  let scope: ScopedContext;
  try {
    scope = await requireVaultAccess();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  // Property RBAC re-validation. The existing row must already be in
  // the caller's scope; the new propertyId (if changed) must too.
  const existing = await prisma.credentialEntry.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      deletedAt: null,
      ...buildPropertyGate(scope),
    },
    select: { id: true, name: true, propertyId: true },
  });
  if (!existing) {
    return { ok: false, error: "Credential not found or out of scope" };
  }

  if (data.propertyId !== undefined && data.propertyId !== null) {
    const ok = await ensurePropertyOwned(scope, data.propertyId);
    if (!ok) {
      return {
        ok: false,
        error: "Property does not belong to this org or your access scope",
      };
    }
  }

  // If a password was supplied, re-encrypt + advance lastRotatedAt.
  // Otherwise keep the existing ciphertext untouched.
  const secretUpdate = data.password
    ? await (async () => {
        const enc = await encryptForOrg(scope.orgId, data.password!);
        return {
          secretCiphertext: enc.secretCiphertext,
          secretIv: enc.secretIv,
          secretAuthTag: enc.secretAuthTag,
          lastRotatedAt: new Date(),
        };
      })()
    : {};

  await prisma.credentialEntry.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.platform !== undefined ? { platform: data.platform || null } : {}),
      ...(data.websiteUrl !== undefined
        ? { websiteUrl: data.websiteUrl || null }
        : {}),
      ...(data.username !== undefined ? { username: data.username || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.propertyId !== undefined
        ? { propertyId: data.propertyId ?? null }
        : {}),
      ...(data.expiresAt !== undefined
        ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }
        : {}),
      ...secretUpdate,
    },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.UPDATE,
      entityType: "CredentialEntry",
      entityId: id,
      description: data.password
        ? `Rotated password on "${existing.name}"`
        : `Updated metadata on "${existing.name}"`,
    }),
  });

  revalidatePath("/portal/vault");
  return { ok: true };
}

export async function deleteCredential(
  id: string,
): Promise<VaultActionResult> {
  let scope: ScopedContext;
  try {
    scope = await requireVaultAccess();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const existing = await prisma.credentialEntry.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      deletedAt: null,
      ...buildPropertyGate(scope),
    },
    select: { id: true, name: true },
  });
  if (!existing) {
    return { ok: false, error: "Credential not found or out of scope" };
  }

  // Soft-delete preserves the audit trail and access logs. A nightly
  // cron can hard-delete rows where deletedAt < 90 days ago if we
  // ever need that — not in Phase 1.
  await prisma.credentialEntry.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: scope.userId },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.DELETE,
      entityType: "CredentialEntry",
      entityId: id,
      description: `Deleted vault credential "${existing.name}"`,
    }),
  });

  revalidatePath("/portal/vault");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reveal — the only path that exposes plaintext
// ---------------------------------------------------------------------------

export async function revealCredential(
  id: string,
): Promise<VaultActionResult<{ password: string; username: string | null }>> {
  let scope: ScopedContext;
  try {
    scope = await requireVaultAccess();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  // Per-user rate limit — defends against a compromised session
  // draining the whole vault. 10/min is comfortable for any legitimate
  // operator workflow and slow enough that audit alerting can catch
  // anomalous patterns.
  const rl = await checkRateLimit(vaultRevealLimiter, scope.userId);
  if (!rl.allowed) {
    return {
      ok: false,
      error: "Too many reveals. Wait a minute and try again.",
    };
  }

  const cred = await prisma.credentialEntry.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      deletedAt: null,
      ...buildPropertyGate(scope),
    },
    select: {
      id: true,
      name: true,
      username: true,
      secretCiphertext: true,
      secretIv: true,
      secretAuthTag: true,
    },
  });
  if (!cred) {
    return { ok: false, error: "Credential not found or out of scope" };
  }

  const { ip, userAgent } = await actorContext();

  // Write the audit + access log BEFORE returning plaintext. A server
  // crash between decrypt and audit-write would otherwise drop the
  // trail of a successful reveal — the worst-case failure mode for
  // a credentials vault.
  await prisma.$transaction([
    prisma.credentialAccessLog.create({
      data: {
        credentialId: id,
        orgId: scope.orgId,
        userId: scope.userId,
        userEmail: scope.email,
        // When an agency user impersonates a tenant, actualOrgId differs
        // from orgId — we tag the access log so the tenant's audit view
        // shows "Adam (impersonating) revealed this" instead of just
        // "Adam revealed this" from inside SG Real Estate's portal.
        asImpersonatorId: scope.isImpersonating ? scope.userId : null,
        action: "reveal",
        ipAddress: ip,
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
      },
    }),
    prisma.credentialEntry.update({
      where: { id },
      data: { lastRevealedAt: new Date() },
    }),
    prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.EXPORT,
        entityType: "CredentialEntry",
        entityId: id,
        description: `Revealed vault credential "${cred.name}"`,
      }),
    }),
  ]);

  const password = await decryptForOrg(scope.orgId, {
    secretCiphertext: cred.secretCiphertext,
    secretIv: cred.secretIv,
    secretAuthTag: cred.secretAuthTag,
  });

  return {
    ok: true,
    data: { password, username: cred.username },
  };
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

// Tiny inline CSV parser — purpose-built for the operator-paste flow.
// Handles quoted fields with embedded commas and escaped quotes (""),
// and tolerates either CRLF or LF row endings. We deliberately do not
// pull in a csv-parse dep for this — operator-supplied CSV is small
// (hundreds of rows) and the failure modes we care about (truncated
// rows, ragged columns) are easier to surface with our own loop.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      cur.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export async function importCredentialsFromCsv(
  input: unknown,
): Promise<VaultActionResult<{ created: number; skipped: number; errors: string[] }>> {
  let scope: ScopedContext;
  try {
    scope = await requireVaultAccess();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { csvText, defaultPropertyId } = parsed.data;

  if (defaultPropertyId) {
    const ok = await ensurePropertyOwned(scope, defaultPropertyId);
    if (!ok) {
      return {
        ok: false,
        error: "Default property does not belong to this org or your access scope",
      };
    }
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      ok: false,
      error:
        "CSV must have a header row + at least one data row. Required columns: name, password. Optional: url, username, notes, platform, property_slug",
    };
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (key: string) => header.indexOf(key);
  const iName = idx("name");
  const iPassword = idx("password");
  const iUrl = idx("url") !== -1 ? idx("url") : idx("website") !== -1 ? idx("website") : idx("website_url");
  const iUsername = idx("username") !== -1 ? idx("username") : idx("email");
  const iNotes = idx("notes");
  const iPlatform = idx("platform");
  const iPropertySlug = idx("property_slug") !== -1 ? idx("property_slug") : idx("property");

  if (iName === -1 || iPassword === -1) {
    return {
      ok: false,
      error: "CSV missing required columns: name, password",
    };
  }

  // Pre-resolve property_slug → propertyId for the rows that need it.
  const propertySlugs = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    if (iPropertySlug !== -1) {
      const slug = rows[r][iPropertySlug]?.trim();
      if (slug) propertySlugs.add(slug);
    }
  }
  const propertyBySlug = new Map<string, string>();
  if (propertySlugs.size > 0) {
    const props = await prisma.property.findMany({
      where: { orgId: scope.orgId, slug: { in: Array.from(propertySlugs) } },
      select: { id: true, slug: true },
    });
    for (const p of props) {
      if (p.slug) propertyBySlug.set(p.slug, p.id);
    }
  }

  const errors: string[] = [];
  let created = 0;
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = row[iName]?.trim();
    const password = row[iPassword] ?? "";
    if (!name || !password) {
      errors.push(`Row ${r + 1}: missing name or password`);
      skipped += 1;
      continue;
    }
    let propertyId: string | null = defaultPropertyId ?? null;
    if (iPropertySlug !== -1) {
      const slug = row[iPropertySlug]?.trim();
      if (slug) {
        const resolved = propertyBySlug.get(slug);
        if (!resolved) {
          errors.push(`Row ${r + 1}: unknown property slug "${slug}"`);
          skipped += 1;
          continue;
        }
        if (scope.allowedPropertyIds && !scope.allowedPropertyIds.includes(resolved)) {
          errors.push(`Row ${r + 1}: property "${slug}" is outside your access scope`);
          skipped += 1;
          continue;
        }
        propertyId = resolved;
      }
    }

    try {
      const encrypted = await encryptForOrg(scope.orgId, password);
      await prisma.credentialEntry.create({
        data: {
          orgId: scope.orgId,
          propertyId,
          name: name.slice(0, 120),
          platform: iPlatform !== -1 ? row[iPlatform]?.trim().slice(0, 40) || null : null,
          websiteUrl: iUrl !== -1 ? row[iUrl]?.trim().slice(0, 500) || null : null,
          username: iUsername !== -1 ? row[iUsername]?.trim().slice(0, 200) || null : null,
          notes: iNotes !== -1 ? row[iNotes]?.trim().slice(0, 4000) || null : null,
          tags: [],
          secretCiphertext: encrypted.secretCiphertext,
          secretIv: encrypted.secretIv,
          secretAuthTag: encrypted.secretAuthTag,
          createdById: scope.userId,
          lastRotatedAt: new Date(),
        },
      });
      created += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Row ${r + 1}: ${msg}`);
      skipped += 1;
    }
  }

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.CREATE,
      entityType: "CredentialEntry",
      description: `Imported ${created} credentials from CSV (skipped ${skipped})`,
      diff: {
        created,
        skipped,
        errors: errors.slice(0, 20),
      } as Prisma.InputJsonValue,
    }),
  });

  revalidatePath("/portal/vault");
  return { ok: true, data: { created, skipped, errors } };
}

// ---------------------------------------------------------------------------
// Misc helpers exposed to the UI
// ---------------------------------------------------------------------------

export async function generatePasswordAction(length = 24): Promise<string> {
  // Generation doesn't require vault access — anyone can use the
  // generator (it's just a password-creation tool). The actual save
  // path still gates via canAccessVault.
  return generateStrongPassword(length);
}
