"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { generateApiKey } from "@/lib/api-keys/generate";

// ---------------------------------------------------------------------------
// Portal-side API key management server actions.
//
// createApiKey — generates a new key for the caller's org. Returns the raw
// key exactly once; it is never retrievable afterwards because we only store
// the SHA-256 hash.
//
// revokeApiKey — soft-deletes by setting `revokedAt`. We keep the row for
// audit purposes so usage totals remain visible in the portal timeline.
// ---------------------------------------------------------------------------

const PORTAL_PATH = "/portal/settings/api-keys";

const SCOPE_CHOICES = [
  "ingest:lead",
  "ingest:visitor",
  "ingest:tour",
  "ingest:chatbot",
  "*",
] as const;

type ScopeChoice = (typeof SCOPE_CHOICES)[number];

const scopeSchema = z.enum(SCOPE_CHOICES);

// Allowed expiration windows. 'never' maps to null (no expiry); the
// finite windows are converted to a future timestamp at create time.
// Audit BUG #5 — operators expected an explicit choice here for
// security hygiene.
export const EXPIRATION_CHOICES = [
  { value: "30d", label: "30 days", days: 30 },
  { value: "60d", label: "60 days", days: 60 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "1y", label: "1 year", days: 365 },
  { value: "never", label: "Never expires", days: null as number | null },
] as const;

type ExpirationChoice = (typeof EXPIRATION_CHOICES)[number]["value"];
const expirationSchema = z.enum(
  EXPIRATION_CHOICES.map((c) => c.value) as [
    ExpirationChoice,
    ...ExpirationChoice[],
  ]
);

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  scopes: z
    .array(scopeSchema)
    .min(1, "At least one scope is required")
    .max(SCOPE_CHOICES.length),
  expiration: expirationSchema.default("90d"),
});

function expirationToDate(value: ExpirationChoice): Date | null {
  const choice = EXPIRATION_CHOICES.find((c) => c.value === value);
  if (!choice || choice.days == null) return null;
  return new Date(Date.now() + choice.days * 24 * 60 * 60 * 1000);
}

export type CreateApiKeyResult =
  | {
      ok: true;
      id: string;
      rawKey: string;
      prefix: string;
      name: string;
      scopes: string[];
    }
  | { ok: false; error: string };

export type RevokeApiKeyResult = { ok: true } | { ok: false; error: string };

function parseScopes(formData: FormData): ScopeChoice[] {
  const raw = formData.getAll("scopes").map((v) => v.toString());
  const seen = new Set<string>();
  const out: ScopeChoice[] = [];
  for (const value of raw) {
    if (seen.has(value)) continue;
    const parsed = scopeSchema.safeParse(value);
    if (parsed.success) {
      seen.add(value);
      out.push(parsed.data);
    }
  }
  // If operator picked "*", collapse the list.
  if (out.includes("*")) return ["*"];
  return out;
}

export async function createApiKey(
  formData: FormData
): Promise<CreateApiKeyResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    scopes: parseScopes(formData),
    expiration: formData.get("expiration")?.toString() ?? "90d",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: first };
  }

  try {
    const generated = generateApiKey();

    const record = await prisma.apiKey.create({
      data: {
        orgId: scope.orgId,
        name: parsed.data.name,
        keyPrefix: generated.prefix,
        keyHash: generated.hash,
        scopes: parsed.data.scopes,
        createdByUserId: scope.userId,
        expiresAt: expirationToDate(parsed.data.expiration),
      },
      select: {
        id: true,
        name: true,
        scopes: true,
        keyPrefix: true,
        expiresAt: true,
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.CREATE,
        entityType: "ApiKey",
        entityId: record.id,
        description: `Created API key "${record.name}"`,
        diff: {
          scopes: record.scopes,
          prefix: record.keyPrefix,
        } as Prisma.InputJsonValue,
      }),
    });

    revalidatePath(PORTAL_PATH);

    return {
      ok: true,
      id: record.id,
      rawKey: generated.raw,
      prefix: record.keyPrefix,
      name: record.name,
      scopes: record.scopes,
    };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("createApiKey failed", err);
    return { ok: false, error: "Failed to create API key" };
  }
}

export async function revokeApiKey(
  id: string
): Promise<RevokeApiKeyResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  if (!id || typeof id !== "string") {
    return { ok: false, error: "Invalid key id" };
  }

  try {
    const existing = await prisma.apiKey.findFirst({
      where: { id, orgId: scope.orgId },
      select: { id: true, name: true, revokedAt: true },
    });
    if (!existing) {
      return { ok: false, error: "API key not found" };
    }
    if (existing.revokedAt) {
      return { ok: true };
    }

    await prisma.apiKey.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.DELETE,
        entityType: "ApiKey",
        entityId: existing.id,
        description: `Revoked API key "${existing.name}"`,
      }),
    });

    revalidatePath(PORTAL_PATH);
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("revokeApiKey failed", err);
    return { ok: false, error: "Failed to revoke API key" };
  }
}

// ---------------------------------------------------------------------------
// rotateApiKey — create a fresh key with the same name + scopes +
// expiration policy as the source, mark the old one revoked, and return
// the new raw key in one round-trip. Audit BUG #5 — operators expected
// to be able to rotate a key without manually creating + revoking +
// updating every consumer separately.
//
// The new key's rotatedFromKeyId points to the old one so the audit
// chain stays intact. Existing callers using the old key get a 401 on
// the next request and need to swap to the new one.
// ---------------------------------------------------------------------------

export type RotateApiKeyResult =
  | {
      ok: true;
      id: string;
      rawKey: string;
      prefix: string;
      name: string;
      scopes: string[];
      expiresAt: string | null;
    }
  | { ok: false; error: string };

export async function rotateApiKey(id: string): Promise<RotateApiKeyResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not authorized",
    };
  }

  if (!id || typeof id !== "string") {
    return { ok: false, error: "Invalid key id" };
  }

  try {
    const existing = await prisma.apiKey.findFirst({
      where: { id, orgId: scope.orgId },
      select: {
        id: true,
        name: true,
        scopes: true,
        revokedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    if (!existing) {
      return { ok: false, error: "API key not found" };
    }
    if (existing.revokedAt) {
      return {
        ok: false,
        error: "Key is already revoked. Create a new one instead of rotating.",
      };
    }

    // Carry the same expiration policy across rotation. If the original
    // had a finite expiry, the new key gets an equivalent window from
    // now (so rotating a 30-day key gives you another 30 days of
    // runway). 'never' stays 'never'.
    let newExpiresAt: Date | null = null;
    if (existing.expiresAt) {
      const originalWindowDays = Math.max(
        1,
        Math.round(
          (existing.expiresAt.getTime() - existing.createdAt.getTime()) /
            (24 * 60 * 60 * 1000)
        )
      );
      newExpiresAt = new Date(
        Date.now() + originalWindowDays * 24 * 60 * 60 * 1000
      );
    }

    const generated = generateApiKey();

    // Create new + revoke old in a single Prisma sequence. We don't need
    // a strict transaction here because both writes are idempotent and
    // independent — worst case a partial failure leaves the user with
    // either two active keys or zero, both recoverable from the UI.
    const created = await prisma.apiKey.create({
      data: {
        orgId: scope.orgId,
        name: existing.name,
        keyPrefix: generated.prefix,
        keyHash: generated.hash,
        scopes: existing.scopes,
        createdByUserId: scope.userId,
        expiresAt: newExpiresAt,
        rotatedFromKeyId: existing.id,
      },
      select: {
        id: true,
        name: true,
        scopes: true,
        keyPrefix: true,
        expiresAt: true,
      },
    });

    await prisma.apiKey.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "ApiKey",
        entityId: created.id,
        description: `Rotated API key "${existing.name}" — old key revoked, new key issued`,
        diff: {
          previousKeyId: existing.id,
          newKeyPrefix: created.keyPrefix,
          scopes: created.scopes,
        } as Prisma.InputJsonValue,
      }),
    });

    revalidatePath(PORTAL_PATH);

    return {
      ok: true,
      id: created.id,
      rawKey: generated.raw,
      prefix: created.keyPrefix,
      name: created.name,
      scopes: created.scopes,
      expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
    };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("rotateApiKey failed", err);
    return { ok: false, error: "Failed to rotate API key" };
  }
}
