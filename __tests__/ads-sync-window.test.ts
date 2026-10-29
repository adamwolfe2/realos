import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
const { resolveSyncWindow } = await import("@/lib/integrations/ads-sync");

const now = new Date("2026-10-17T12:00:00Z");
const day = (s: string) => new Date(`${s}T00:00:00Z`).getTime();

describe("ads sync window", () => {
  it("pulls just yesterday when the last sync was today", () => {
    const w = resolveSyncWindow(now, new Date("2026-10-17T06:00:00Z"));
    expect(w.startDate.getTime()).toBe(day("2026-10-16"));
    expect(w.endDate.getTime()).toBe(day("2026-10-16"));
  });

  it("re-pulls the days missed since the last successful sync", () => {
    const w = resolveSyncWindow(now, new Date("2026-10-12T06:00:00Z"));
    expect(w.startDate.getTime()).toBe(day("2026-10-12"));
    expect(w.endDate.getTime()).toBe(day("2026-10-16"));
  });

  it("gives a never-synced account 30 inclusive days", () => {
    const w = resolveSyncWindow(now, null);
    expect(w.startDate.getTime()).toBe(day("2026-09-17"));
    expect(w.endDate.getTime()).toBe(day("2026-10-16"));
  });

  it("caps a long outage at 30 days", () => {
    const w = resolveSyncWindow(now, new Date("2026-06-01T00:00:00Z"));
    expect(w.startDate.getTime()).toBe(day("2026-09-17"));
    expect(w.endDate.getTime()).toBe(day("2026-10-16"));
  });
});
