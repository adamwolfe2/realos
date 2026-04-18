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

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  scopes: z
    .array(scopeSchema)
    .min(1, "At least one scope is required")
    .max(SCOPE_CHOICES.length),
});

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
      },
      select: {
        id: true,
        name: true,
        scopes: true,
        keyPrefix: true,
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
