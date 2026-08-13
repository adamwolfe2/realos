import { describe, expect, it } from "vitest";
import { decideHeal } from "@/lib/audit/self-heal";
import { ProspectAuditStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Prospect-audit self-heal policy (2026-08-13).
//
// Two production bugs this policy replaces (both observed 2026-08-13):
//  1. A dropped fire-and-forget trigger stranded livehigby.com's audit in
//     QUEUED forever — the old watchdog would have flipped it to FAILED,
//     killing a retryable lead-magnet conversion that had cost $0.
//  2. The old 90s watchdog was SHORTER than the run route's 120s
//     maxDuration, so a poll at t+91s could fail a scan mid-flight.
// ---------------------------------------------------------------------------

const T0 = 1_700_000_000_000;
const sec = (n: number) => n * 1000;

describe("decideHeal", () => {
  it("re-triggers a QUEUED audit stalled past 60s (dropped trigger = retryable)", () => {
    expect(
      decideHeal(ProspectAuditStatus.QUEUED, T0, T0, T0 + sec(61)),
    ).toBe("retrigger");
  });

  it("leaves a fresh QUEUED audit alone (trigger may still be in flight)", () => {
    expect(
      decideHeal(ProspectAuditStatus.QUEUED, T0, T0, T0 + sec(30)),
    ).toBeNull();
  });

  it("NEVER fails a QUEUED audit, no matter how old", () => {
    expect(
      decideHeal(ProspectAuditStatus.QUEUED, T0, T0, T0 + sec(3600)),
    ).toBe("retrigger");
  });

  it("does not touch a RUNNING scan inside the 150s window — 100s is a NORMAL scan", () => {
    // Regression guard on bug 2: run route maxDuration is 120s and real
    // scans take 75-110s. The dead-scan window must stay ABOVE that.
    expect(
      decideHeal(ProspectAuditStatus.RUNNING, T0, T0, T0 + sec(100)),
    ).toBeNull();
    expect(
      decideHeal(ProspectAuditStatus.RUNNING, T0, T0, T0 + sec(120)),
    ).toBeNull();
  });

  it("fails a RUNNING scan with no DB write for >150s (function died mid-scan)", () => {
    expect(
      decideHeal(ProspectAuditStatus.RUNNING, T0, T0, T0 + sec(151)),
    ).toBe("fail");
  });

  it("measures RUNNING staleness from updatedAt, not createdAt", () => {
    // An audit that sat QUEUED for 5 minutes before the retrigger landed
    // must not be reaped 150s after CREATION while the scan is healthy.
    const createdAt = T0;
    const runStartedAt = T0 + sec(300); // RUNNING flip stamps updatedAt
    expect(
      decideHeal(
        ProspectAuditStatus.RUNNING,
        createdAt,
        runStartedAt,
        runStartedAt + sec(60),
      ),
    ).toBeNull();
  });

  it("terminal states are never touched", () => {
    for (const s of [
      ProspectAuditStatus.READY,
      ProspectAuditStatus.FAILED,
    ]) {
      expect(decideHeal(s, T0, T0, T0 + sec(9999))).toBeNull();
    }
  });
});
