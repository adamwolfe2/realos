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
    const r = resolveAttribution({ touch: { first: { referrer: "https://www.berkeley.edu/housing" } } });
    expect(r?.trafficSource).toBe("referral");
    expect(r?.attribution.sourceLabel).toBe("berkeley.edu");
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
