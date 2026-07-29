import { describe, it, expect } from "vitest";
import {
  evaluateLeadGate,
  computeDeliverabilityScore,
} from "@/lib/webhooks/cursive-process";

// ---------------------------------------------------------------------------
// Regression guard for the 2026-07-29 "pixel has never produced a lead" defect.
//
// computeDeliverabilityScore was written against a RICH upstream payload
// (validation status, skiptrace, company domain, phone, ESP last-seen) and its
// 60-point floor calibrated for it. The feed we actually receive carries NONE
// of those fields — verified against all 276 resolution blobs stored on the
// live tenant, whose complete key set is:
//
//   FIRST_NAME, LAST_NAME, GENDER, AGE_RANGE, HEM_SHA256, PERSONAL_CITY,
//   PERSONAL_STATE, PERSONAL_ZIP, PERSONAL_EMAILS, PERSONAL_VERIFIED_EMAILS,
//   REFERRER_URL
//
// so every event scored 0/100 and the pixel produced 0 leads, ever.
// ---------------------------------------------------------------------------

/** Exactly what the basic feed gives the scorer: nothing it can use. */
const BASIC_FEED_SCORE_INPUT = {
  personalValidation: null,
  businessValidation: null,
  hasPhone: false, // 0 of 400 sampled visitors had a phone
  hasCompanyDomain: false,
  lastSeenIso: undefined,
  hasSkiptrace: false,
} as const;

describe("the defect: basic feed cannot reach the deliverability floor", () => {
  it("scores 0 out of 100 on the payload we actually receive", () => {
    expect(computeDeliverabilityScore({ ...BASIC_FEED_SCORE_INPUT })).toBe(0);
  });

  it("cannot reach 60 even with every non-validation signal present", () => {
    // phone + company domain + recent ESP sighting, but no validation status
    // and no skiptrace — still short of the floor. The floor is unreachable
    // without the fields this feed never sends.
    const best = computeDeliverabilityScore({
      personalValidation: null,
      businessValidation: null,
      hasPhone: true,
      hasCompanyDomain: true,
      lastSeenIso: new Date().toISOString(),
      hasSkiptrace: false,
    });
    expect(best).toBeLessThan(60);
  });
});

describe("evaluateLeadGate", () => {
  it("creates a lead when the provider verified the email, despite score 0", () => {
    // The fix. 217 of 276 live identities carry a non-empty
    // PERSONAL_VERIFIED_EMAILS and were being discarded.
    expect(
      evaluateLeadGate({
        identified: true,
        hasVerifiedEmail: true,
        deliverability: 0,
      }),
    ).toBe(true);
  });

  it("still rejects an identified visitor with no verification and no score", () => {
    // The other 59. Unverified stays out — this is a quality gate, not an
    // open door.
    expect(
      evaluateLeadGate({
        identified: true,
        hasVerifiedEmail: false,
        deliverability: 0,
      }),
    ).toBe(false);
  });

  it("keeps honoring the score path for richer payloads", () => {
    expect(
      evaluateLeadGate({
        identified: true,
        hasVerifiedEmail: false,
        deliverability: 60,
      }),
    ).toBe(true);
    expect(
      evaluateLeadGate({
        identified: true,
        hasVerifiedEmail: false,
        deliverability: 59,
      }),
    ).toBe(false);
  });

  it("never creates a lead from an unidentified visitor", () => {
    // No name/email pair — a verified-email flag must not smuggle one through.
    expect(
      evaluateLeadGate({
        identified: false,
        hasVerifiedEmail: true,
        deliverability: 100,
      }),
    ).toBe(false);
  });
});
