import { describe, expect, it } from "vitest";
import { resolveAttribution, touchFromUrl } from "@/lib/attribution/touch";

describe("resolveAttribution", () => {
  it("classifies the real Zillow click (utm + zgRef) from the page URL when no touch is sent", () => {
    const r = resolveAttribution({
      touch: undefined,
      pageUrl: "https://www.liveatthelair.com/availability?utm_medium=cpc&utm_source=zillow&zgRef=zillow",
    });
    expect(r?.trafficSource).toBe("zillow");
    expect(r?.attribution.sourceLabel).toBe("Zillow");
  });

  it("uses the embed's first touch, not the current page", () => {
    const r = resolveAttribution({
      touch: { first: { referrer: "https://www.google.com/" }, last: { utmSource: "instagram" } },
      pageUrl: "https://www.liveattheden.com/floor-plans",
    });
    expect(r?.trafficSource).toBe("google_organic");
    expect(r?.attribution.last?.utmSource).toBe("instagram");
  });

  it("maps click ids when utm_source is missing", () => {
    expect(resolveAttribution({ touch: { first: { gclid: "abc" } } })?.trafficSource).toBe("google_ads");
    expect(resolveAttribution({ touch: { first: { fbclid: "x" } } })?.trafficSource).toBe("facebook");
    expect(resolveAttribution({ touch: { first: { zgRef: "zillow" } } })?.trafficSource).toBe("zillow");
  });

  it("gclid makes a utm_source=google visit Google Ads even without a paid medium", () => {
    expect(
      resolveAttribution({ touch: { first: { utmSource: "google", gclid: "Cj0K" } } })?.trafficSource,
    ).toBe("google_ads");
  });

  it("paid medium on google is Google Ads", () => {
    expect(
      resolveAttribution({ touch: { first: { utmSource: "google", utmMedium: "cpc" } } })?.trafficSource,
    ).toBe("google_ads");
  });

  it("unknown external referrer is a referral labelled with its host", () => {
    const r = resolveAttribution({ touch: { first: { referrer: "https://www.berkeleyside.org/housing" } } });
    expect(r?.trafficSource).toBe("referral");
    expect(r?.attribution.sourceLabel).toBe("berkeleyside.org");
  });

  it("a valid touch with no signal is Direct", () => {
    expect(resolveAttribution({ touch: { first: { landingUrl: "https://x.com/" } } })?.trafficSource).toBe("direct");
    expect(resolveAttribution({ touch: {} })?.trafficSource).toBe("direct");
  });

  it("no touch and an untagged page is unknown (null), not Direct", () => {
    expect(resolveAttribution({ touch: undefined, pageUrl: "https://www.liveatthelair.com/" })).toBeNull();
  });

  it("malformed or oversized touch never throws and falls back to the page URL", () => {
    expect(
      resolveAttribution({ touch: { first: { utmSource: "z".repeat(5000) } }, pageUrl: "https://a.com/?utm_source=reddit" })
        ?.trafficSource,
    ).toBe("reddit");
    expect(resolveAttribution({ touch: "garbage", pageUrl: null })).toBeNull();
    expect(resolveAttribution({ touch: { first: 42 } })).toBeNull();
  });
});

describe("touchFromUrl", () => {
  it("returns null for bad URLs and untagged pages", () => {
    expect(touchFromUrl("not a url")).toBeNull();
    expect(touchFromUrl("https://a.com/x")).toBeNull();
  });
});

describe("no false credit from our own hops or old leads", () => {
  it("a visitor returning from AppFolio / LeaseStack / Calendly is not a referral", () => {
    for (const r of [
      "https://sgrealestate.appfolio.com/listings/rental_applications/new",
      "https://leasestack.co/portal",
      "https://calendly.com/tc/tour",
      "https://the-lair-abc.vercel.app/",
    ]) {
      expect(resolveAttribution({ touch: { first: { referrer: r } } })?.trafficSource).toBe("direct");
    }
  });

  it("only fills a lead created in the last 24h; an older lead stays untracked", async () => {
    const { attributionFill } = await import("@/lib/attribution/touch");
    const a = resolveAttribution({ touch: { first: { utmSource: "zillow" } } });
    const now = new Date("2026-11-11T12:00:00Z");
    expect(attributionFill({ trafficSource: null, createdAt: new Date("2026-11-11T11:50:00Z") }, a, now).trafficSource).toBe("zillow");
    expect(attributionFill({ trafficSource: null, createdAt: new Date("2026-09-01T00:00:00Z") }, a, now)).toEqual({});
    expect(attributionFill({ trafficSource: "google_organic", createdAt: new Date("2026-11-11T11:59:00Z") }, a, now)).toEqual({});
  });
});

describe("AppFolio-reported lead source", () => {
  it("maps real platforms, flags them, and labels them per AppFolio", async () => {
    const { attributionFromReportedSource, trafficSourceLabel } = await import("@/lib/attribution/touch");
    const z = attributionFromReportedSource("Zillow", "appfolio");
    expect(z?.trafficSource).toBe("zillow");
    expect(z?.attribution.reportedBy).toBe("appfolio");
    expect(trafficSourceLabel({ trafficSource: z!.trafficSource, attribution: z!.attribution })).toBe("Zillow (per AppFolio)");
    expect(attributionFromReportedSource("Apartments.com", "appfolio")?.trafficSource).toBe("apartments_com");
    expect(attributionFromReportedSource("Craigslist", "appfolio")?.trafficSource).toBe("craigslist");
  });
  it("never guesses a channel from a mechanism or unknown text", async () => {
    const { attributionFromReportedSource } = await import("@/lib/attribution/touch");
    for (const v of ["Website", "Walk-in", "Phone", "Email", "Chatbot", "Referral", "Other", "Drive by", "", null]) {
      expect(attributionFromReportedSource(v as string | null, "appfolio")).toBeNull();
    }
  });
});
