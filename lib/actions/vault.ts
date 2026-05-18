"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  auditPayload,
  requireScope,
  tenantWhere,
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
    // Restricted user with an empty allow-list sees NOTHING. Pre-fix
    // we exposed all org-wide credentials (`propertyId: null`) here,
    // which was wrong on both threat-model and provisioning-glitch
    // axes: a CLIENT_ADMIN whose every UserPropertyAccess row got
    // revoked (deleted property, mid-onboarding state) would silently
    // get every banking + GA4 + root-domain credential in the org.
    // Match the synthetic-id pattern used in lead-bulk.ts so the
    // gate is consistent across the codebase.
    return { id: "__no_property_access__" };
  }
  return {
    OR: [
      { propertyId: null },
      { propertyId: { in: scope.allowedPropertyIds } },
    ],
  };
}

/**
 * Validate a propertyId assignment on create/update. Returns null if
 * the value is fine, or an error string otherwise.
 *
 * - null/undefined = org-wide → only unrestricted users may set this.
 *   A restricted operator (allowedPropertyIds non-null) cannot scope a
 *   credential org-wide; that would promote it out of their visibility
 *   into every other admin's table.
 * - non-null propertyId → must belong to the org AND be in the
 *   caller's allowed set.
 */
async function validatePropertyAssignment(
  scope: ScopedContext,
  propertyId: string | null,
): Promise<string | null> {
  if (propertyId === null) {
    if (scope.allowedPropertyIds) {
      return "Restricted users cannot create or promote credentials to org-wide scope. Ask an admin.";
    }
    return null;
  }
  const ok = await ensurePropertyOwned(scope, propertyId);
  if (!ok) {
    return "Property does not belong to this org or your access scope";
  }
  return null;
}

/**
 * Ensure the caller's org has the vault module enabled. Module gating
 * happens at the page level for UX (pitch screen vs blank), but every
 * server action must also enforce — the actions are callable directly
 * from any authenticated session and a tenant whose moduleVault is
 * toggled OFF must not retain access to anything still in the table.
 */
async function requireModuleEnabled(scope: ScopedContext): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: { moduleVault: true },
  });
  if (!org?.moduleVault) {
    return "Credentials vault is not enabled on this org.";
  }
  return null;
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

  const moduleErr = await requireModuleEnabled(scope);
  if (moduleErr) return { ok: false, error: moduleErr };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  // Property assignment is validated centrally — also blocks
  // restricted users from creating org-wide credentials.
  const propertyErr = await validatePropertyAssignment(
    scope,
    data.propertyId ?? null,
  );
  if (propertyErr) return { ok: false, error: propertyErr };

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

  const moduleErr = await requireModuleEnabled(scope);
  if (moduleErr) return { ok: false, error: moduleErr };

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
      ...tenantWhere(scope),
      deletedAt: null,
      ...buildPropertyGate(scope),
    },
    select: { id: true, name: true, propertyId: true },
  });
  if (!existing) {
    return { ok: false, error: "Credential not found or out of scope" };
  }

  // When the operator is changing the propertyId, validate the new
  // value the same way create does — including the block on
  // restricted users promoting credentials to org-wide.
  if (data.propertyId !== undefined) {
    const propertyErr = await validatePropertyAssignment(
      scope,
      data.propertyId ?? null,
    );
    if (propertyErr) return { ok: false, error: propertyErr };
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

  const moduleErr = await requireModuleEnabled(scope);
  if (moduleErr) return { ok: false, error: moduleErr };

  const existing = await prisma.credentialEntry.findFirst({
    where: {
      id,
      ...tenantWhere(scope),
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

  const moduleErr = await requireModuleEnabled(scope);
  if (moduleErr) return { ok: false, error: moduleErr };

  // Per-user rate limit — defends against a compromised session
  // draining the whole vault. 30/min/userId; the audit log captures
  // every reveal for anomaly detection.
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
      ...tenantWhere(scope),
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

  // Decrypt FIRST, then write the audit row. Pre-fix the audit + access
  // log + lastRevealedAt were written inside a transaction, and then
  // decrypt ran outside. If decrypt threw (corrupt ciphertext, KEK
  // rotation gap, schema drift), the audit log would record a
  // successful reveal that didn't actually happen — flooding the
  // anomaly-detection signal with false positives. Order swapped:
  // decrypt is cheap, has no DB side effects, and a failure here
  // returns a clean error without polluting the audit trail.
  let password: string;
  try {
    password = await decryptForOrg(scope.orgId, {
      secretCiphertext: cred.secretCiphertext,
      secretIv: cred.secretIv,
      secretAuthTag: cred.secretAuthTag,
    });
  } catch (err) {
    console.warn("[vault] reveal decrypt failed for credentialId=" + id, err);
    return {
      ok: false,
      error:
        "Could not decrypt this credential. Either the master key was rotated or the row is corrupt — contact support.",
    };
  }

  const { ip, userAgent } = await actorContext();

  // Audit + access log + lastRevealedAt bump — all inside one
  // transaction so partial state on a DB hiccup is impossible. We
  // don't await the audit BEFORE returning plaintext (decrypt already
  // succeeded), but we await it BEFORE returning so the response only
  // includes the password if the audit row also persisted. If the
  // transaction throws AFTER decrypt, we discard the in-memory
  // plaintext and surface a clean error to the operator.
  try {
    await prisma.$transaction([
      prisma.credentialAccessLog.create({
        data: {
          credentialId: id,
          orgId: scope.orgId,
          userId: scope.userId,
          userEmail: scope.email,
          // When an agency user impersonates a tenant, actualOrgId differs
          // from orgId — we tag the access log so the tenant's audit view
          // shows "Adam (impersonating) revealed this".
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
  } catch (err) {
    console.warn("[vault] reveal audit write failed for credentialId=" + id, err);
    // Audit failed → refuse to return plaintext. We deliberately do
    // NOT return a successful reveal without an audit trail.
    return {
      ok: false,
      error: "Could not record the reveal in the audit log. Try again.",
    };
  }

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

  const moduleErr = await requireModuleEnabled(scope);
  if (moduleErr) return { ok: false, error: moduleErr };

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { csvText, defaultPropertyId } = parsed.data;

  if (defaultPropertyId) {
    const propertyErr = await validatePropertyAssignment(scope, defaultPropertyId);
    if (propertyErr) {
      return {
        ok: false,
        error: "Default property: " + propertyErr,
      };
    }
  } else if (scope.allowedPropertyIds) {
    // Restricted users must pick a default property or set property_slug
    // on every row. Org-wide imports are blocked the same way org-wide
    // creates are.
    return {
      ok: false,
      error:
        "Restricted users must select a default property. Org-wide imports are not allowed for your role.",
    };
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

  // Strip C0 control characters (except tab/newline, which CSV doesn't
  // carry into a cell anyway because the parser handles them). CSV
  // cells can pick up null bytes, zero-width chars, and terminal-
  // escape sequences from copy/paste — none of which belong in a
  // credential field. Render surfaces (reveal modal, audit log) trust
  // the contents.
  //
  // Build the regex from char codes to avoid the editor mangling
  // literal control chars in source.
  const C0_PATTERN = new RegExp(
    "[" +
      String.fromCharCode(0x00) + "-" + String.fromCharCode(0x08) +
      String.fromCharCode(0x0b) +
      String.fromCharCode(0x0c) +
      String.fromCharCode(0x0e) + "-" + String.fromCharCode(0x1f) +
      String.fromCharCode(0x7f) +
      "]",
    "g",
  );
  function sanitize(s: string | undefined, max: number): string | null {
    if (!s) return null;
    const cleaned = s.replace(C0_PATTERN, "").trim();
    if (cleaned === "") return null;
    return cleaned.slice(0, max);
  }

  const errors: string[] = [];
  let created = 0;
  let skipped = 0;

  // Cap the per-row count cheaply before doing any encryption.
  // 5000 rows × ~3KB ciphertext = ~15MB DB writes — generous, but
  // bounded. Above that, ask the operator to chunk their CSV.
  const MAX_ROWS = 5000;
  if (rows.length - 1 > MAX_ROWS) {
    return {
      ok: false,
      error: `CSV has ${rows.length - 1} data rows; cap is ${MAX_ROWS} per import. Split into chunks.`,
    };
  }

  // First pass: validate every row and stage the encrypted payloads
  // in-memory. Pre-fix this was a sequential loop of fetch-DEK +
  // create-row, each round-tripping to the DB twice per row. For
  // 2000 rows that's 4000 DB hits and any halfway failure left a
  // partial vault in place. New approach: encrypt-all-then-bulk-
  // create lets us share a single DEK fetch via encryptForOrg's
  // internal cache and atomically commit the batch.
  type StagedRow = {
    rowNumber: number;
    propertyId: string | null;
    payload: Prisma.CredentialEntryCreateManyInput;
  };
  const staged: StagedRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = sanitize(row[iName], 120);
    const passwordRaw = row[iPassword] ?? "";
    // Don't sanitize the password — control chars in the secret are
    // the operator's problem and stripping them would corrupt the
    // value silently. We DO cap length though so a 2MB CSV cell
    // can't blow up the GCM auth-tag computation.
    const password = passwordRaw.slice(0, 4000);
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
      staged.push({
        rowNumber: r + 1,
        propertyId,
        payload: {
          orgId: scope.orgId,
          propertyId,
          name,
          platform: iPlatform !== -1 ? sanitize(row[iPlatform], 40) : null,
          websiteUrl: iUrl !== -1 ? sanitize(row[iUrl], 500) : null,
          username: iUsername !== -1 ? sanitize(row[iUsername], 200) : null,
          notes: iNotes !== -1 ? sanitize(row[iNotes], 4000) : null,
          tags: [],
          secretCiphertext: encrypted.secretCiphertext,
          secretIv: encrypted.secretIv,
          secretAuthTag: encrypted.secretAuthTag,
          createdById: scope.userId,
          lastRotatedAt: new Date(),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Row ${r + 1}: ${msg}`);
      skipped += 1;
    }
  }

  // Second pass: commit all staged rows in a single transaction so a
  // mid-batch DB error doesn't leave the vault half-loaded. Chunk by
  // 500 inside the transaction to keep individual statements small.
  if (staged.length > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        const CHUNK = 500;
        for (let i = 0; i < staged.length; i += CHUNK) {
          const slice = staged.slice(i, i + CHUNK);
          await tx.credentialEntry.createMany({
            data: slice.map((s) => s.payload),
          });
        }
      });
      created = staged.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // Whole batch rolled back. Move every staged row to the
      // skipped/error bucket and let the operator retry.
      errors.push(`Transaction failed, no rows imported: ${msg}`);
      skipped += staged.length;
      created = 0;
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
