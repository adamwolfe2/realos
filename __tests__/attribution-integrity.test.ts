import { describe, it, expect } from "vitest";
import { backfillPropertyId } from "@/lib/tenancy/property-filter";
import {
  classifyLeadChannel,
  type SessionSignal,
} from "@/lib/attribution/source-taxonomy";
import { LeadSource } from "@prisma/client";

// ---------------------------------------------------------------------------
// Guards for the 2026-07-29 attribution-integrity slice.
//
// Two defects this locks down:
//   1. Pixel writes discarded the building even when the matched integration
//      knew it, so every pixel lead/visitor landed unattributed.
//   2. Forward attribution passed only 2 args to classifyLeadChannel while
//      reverse passed 3, so the same lead classified into different channels
//      depending on which page the operator opened.
// ---------------------------------------------------------------------------

const sig = (
  utmSource: string | null,
  firstReferrer: string | null,
  utmMedium: string | null = null,
): SessionSignal => ({ utmSource, utmMedium, firstReferrer });

describe("backfillPropertyId — backfill only, never re-file", () => {
  it("backfills when the row has no building yet", () => {
    expect(backfillPropertyId(null, "prop_a")).toBe("prop_a");
  });

  it("keeps the existing building when a different one arrives", () => {
    // The regression that matters: a person browsing building B's site must
    // not drag an existing building-A lead across to B mid-pipeline.
    expect(backfillPropertyId("prop_a", "prop_b")).toBe("prop_a");
  });

  it("returns undefined when neither side knows a building", () => {
    // undefined (not null) so Prisma omits the column instead of nulling it.
    expect(backfillPropertyId(null, null)).toBeUndefined();
    expect(backfillPropertyId(undefined, undefined)).toBeUndefined();
  });

  it("is a no-op write when only the existing value is known", () => {
    expect(backfillPropertyId("prop_a", null)).toBe("prop_a");
  });
});

describe("classifyLeadChannel — the tier-2 contract both surfaces rely on", () => {
  it("promotes a Direct-looking lead using an email-matched session", () => {
    // Forward attribution used to skip this argument entirely, so this lead
    // showed as Chatbot on /portal/attribution and Zillow on
    // /portal/reverse-attribution. Both now pass the email match.
    const withMatch = classifyLeadChannel(
      LeadSource.CHATBOT,
      null,
      sig(null, "https://www.zillow.com/b/berkeley"),
    );
    expect(withMatch.id).toBe("zillow");

    const withoutMatch = classifyLeadChannel(LeadSource.CHATBOT, null, null);
    expect(withoutMatch.id).toBe("chatbot");

    // Same lead, two answers — this divergence is exactly what was shipping.
    expect(withMatch.id).not.toBe(withoutMatch.id);
  });

  it("prefers the lead's own session over an email-matched one", () => {
    const src = classifyLeadChannel(
      LeadSource.FORM,
      sig("google", null, "cpc"),
      sig(null, "https://www.zillow.com/"),
    );
    expect(src.id).toBe("google_ads");
  });

  it("ignores an email match that resolves no better than Direct", () => {
    const src = classifyLeadChannel(
      LeadSource.CHATBOT,
      null,
      sig(null, null),
    );
    expect(src.id).toBe("chatbot");
  });

  it("is deterministic for identical inputs", () => {
    // Both attribution surfaces must feed the SAME three arguments. Sharing
    // the classifier alone was not enough to keep them in agreement.
    const args = [
      LeadSource.PIXEL_OUTREACH,
      sig(null, "https://www.apartments.com/berkeley"),
      sig(null, "https://www.zillow.com/"),
    ] as const;
    expect(classifyLeadChannel(...args).id).toBe(
      classifyLeadChannel(...args).id,
    );
    expect(classifyLeadChannel(...args).id).toBe("apartments_com");
  });
});
