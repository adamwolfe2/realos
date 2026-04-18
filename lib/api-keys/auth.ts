import "server-only";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashApiKey } from "./generate";
import { getIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// API key authentication for the generic ingestion endpoints.
//
// authenticateApiKey reads `Authorization: Bearer <key>`, hashes, looks up the
// ApiKey row by keyHash, confirms it is not revoked, and fires-and-forgets an
// update of lastUsedAt / lastUsedIp / usageCount so the happy path stays fast.
//
// requireScope covers the scope-check: an API key may have "*" (full ingest
// access) or named scopes like "ingest:lead". Unknown scopes fail closed.
// ---------------------------------------------------------------------------

const WILDCARD_SCOPE = "*";

export type AuthenticatedApiKey = {
  orgId: string;
  keyId: string;
  keyHash: string;
  scopes: string[];
};

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const trimmed = header.trim();
  if (!/^bearer\s+/i.test(trimmed)) return null;
  const raw = trimmed.replace(/^bearer\s+/i, "").trim();
  return raw.length > 0 ? raw : null;
}

export async function authenticateApiKey(
  req: NextRequest
): Promise<AuthenticatedApiKey | null> {
  const raw = extractBearer(req);
  if (!raw) return null;

  const keyHash = hashApiKey(raw);

  const record = await prisma.apiKey
    .findUnique({
      where: { keyHash },
      select: {
        id: true,
        orgId: true,
        keyHash: true,
        scopes: true,
        revokedAt: true,
      },
    })
    .catch(() => null);

  if (!record || record.revokedAt) return null;

  // Fire-and-forget usage tracking. We deliberately do not await so the
  // ingestion endpoint is not blocked on an extra write per request.
  const ip = getIp(req);
  void prisma.apiKey
    .update({
      where: { id: record.id },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: ip || null,
        usageCount: { increment: 1 },
      },
    })
    .catch((err) => {
      console.warn("[api-keys] usage update failed", err);
    });

  return {
    orgId: record.orgId,
    keyId: record.id,
    keyHash: record.keyHash,
    scopes: record.scopes,
  };
}

export function requireScope(scopes: string[], required: string): boolean {
  if (!Array.isArray(scopes)) return false;
  return scopes.includes(WILDCARD_SCOPE) || scopes.includes(required);
}
