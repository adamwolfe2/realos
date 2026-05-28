import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { scopeKey, type SignalScope, type SignalSnapshot } from "./types";

// Round-trip through JSON.stringify to satisfy Prisma's InputJsonValue
// constraint — our typed signal interfaces don't carry an index signature.
function asJson<T>(value: T | null | undefined): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// ----------------------------------------------------------------------------
// persistSnapshot — upsert a daily snapshot keyed on (scopeKey, capturedOn).
// Re-running on the same UTC day overwrites the row (so a re-compute after a
// provider outage replaces the partial result).
// ----------------------------------------------------------------------------
export async function persistSnapshot(
  scope: SignalScope,
  snap: SignalSnapshot,
): Promise<void> {
  const key = scopeKey(scope);
  const capturedOn = utcMidnightDate(snap.capturedOn);

  const scopeKind = scope.kind === "tenant" ? "TENANT" : "PROSPECT";
  const orgId = scope.kind === "tenant" ? scope.orgId : null;
  const propertyId = scope.kind === "tenant" ? scope.propertyId ?? null : null;
  const prospectAuditId =
    scope.kind === "prospect" ? scope.prospectAuditId : null;

  await prisma.dailySignalSnapshot.upsert({
    where: { scopeKey_capturedOn: { scopeKey: key, capturedOn } },
    create: {
      scopeKind,
      scopeKey: key,
      capturedOn,
      orgId,
      propertyId,
      prospectAuditId,
      seo: asJson(snap.seo),
      aeo: asJson(snap.aeo),
      reputation: asJson(snap.reputation),
      chatbot: asJson(snap.chatbot),
      leads: asJson(snap.leads),
      traffic: asJson(snap.traffic),
      overallScore: snap.overallScore,
      deltas7d: asJson(snap.deltas7d),
      computeMs: snap.computeMs,
      computeVersion: snap.computeVersion,
    },
    update: {
      scopeKind,
      orgId,
      propertyId,
      prospectAuditId,
      seo: asJson(snap.seo),
      aeo: asJson(snap.aeo),
      reputation: asJson(snap.reputation),
      chatbot: asJson(snap.chatbot),
      leads: asJson(snap.leads),
      traffic: asJson(snap.traffic),
      overallScore: snap.overallScore,
      deltas7d: asJson(snap.deltas7d),
      computeMs: snap.computeMs,
      computeVersion: snap.computeVersion,
    },
  });
}

function utcMidnightDate(iso: string): Date {
  // `iso` is YYYY-MM-DD from compute.ts. new Date(iso) parses as UTC midnight.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`persistSnapshot: invalid capturedOn ${iso}`);
  }
  return d;
}
