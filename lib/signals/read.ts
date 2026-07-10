import "server-only";

import { prisma } from "@/lib/db";
import {
  scopeKey,
  type AeoSignal,
  type ChatbotSignal,
  type LeadsSignal,
  type ReputationSignal,
  type SeoSignal,
  type SignalScope,
  type SignalSnapshot,
  type TrafficSignal,
} from "./types";

// ----------------------------------------------------------------------------
// Read helpers — translate raw Prisma rows into the SignalSnapshot JSON shape
// the UI expects. Benchmarks are a Phase 2 concept (seeded "average
// multifamily" / "average commercial" snapshots used as comparison rails on
// /audit and /portal/insights); for now the helper returns null so callers
// can render a neutral state.
// ----------------------------------------------------------------------------

export async function getLatestSnapshot(
  scope: SignalScope,
): Promise<SignalSnapshot | null> {
  const key = scopeKey(scope);
  const row = await prisma.dailySignalSnapshot.findFirst({
    where: { scopeKey: key },
    orderBy: { capturedOn: "desc" },
  });
  if (!row) return null;
  return rowToSnapshot(row);
}

export async function getSnapshotSeries(
  scope: SignalScope,
  days: number,
): Promise<
  Array<{
    capturedOn: string;
    overallScore: number | null;
    seo: SeoSignal | null;
    aeo: AeoSignal | null;
    reputation: ReputationSignal | null;
    chatbot: ChatbotSignal | null;
    leads: LeadsSignal | null;
  }>
> {
  const key = scopeKey(scope);
  const rows = await prisma.dailySignalSnapshot.findMany({
    where: { scopeKey: key },
    orderBy: { capturedOn: "desc" },
    take: Math.max(1, Math.min(days, 365)),
  });
  return rows
    .map((r) => ({
      capturedOn: toIsoDate(r.capturedOn),
      overallScore: r.overallScore,
      seo: (r.seo as unknown as SeoSignal | null) ?? null,
      aeo: (r.aeo as unknown as AeoSignal | null) ?? null,
      reputation:
        (r.reputation as unknown as ReputationSignal | null) ?? null,
      chatbot: (r.chatbot as unknown as ChatbotSignal | null) ?? null,
      leads: (r.leads as unknown as LeadsSignal | null) ?? null,
    }))
    .reverse(); // oldest → newest for charting
}

export async function getBenchmarkSnapshot(
  _kind: "multifamily" | "commercial",
): Promise<SignalSnapshot | null> {
  // TODO(phase 2): seed a synthetic "average multifamily" / "average
  // commercial" snapshot and return it here. Until then the UI falls back to
  // its neutral state when this resolves to null.
  return null;
}

// ── helpers ─────────────────────────────────────────────────────────────────

type DailySignalRow = Awaited<
  ReturnType<typeof prisma.dailySignalSnapshot.findFirst>
>;

function rowToSnapshot(row: NonNullable<DailySignalRow>): SignalSnapshot {
  return {
    capturedOn: toIsoDate(row.capturedOn),
    scopeKey: row.scopeKey,
    seo: (row.seo as unknown as SeoSignal | null) ?? null,
    aeo: (row.aeo as unknown as AeoSignal | null) ?? null,
    reputation:
      (row.reputation as unknown as ReputationSignal | null) ?? null,
    chatbot: (row.chatbot as unknown as ChatbotSignal | null) ?? null,
    leads: (row.leads as unknown as LeadsSignal | null) ?? null,
    traffic: (row.traffic as unknown as TrafficSignal | null) ?? null,
    overallScore: row.overallScore ?? 0,
    deltas7d:
      (row.deltas7d as unknown as Record<string, number> | null) ?? null,
    computeMs: row.computeMs ?? 0,
    computeVersion: row.computeVersion,
  };
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
