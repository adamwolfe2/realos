import { describe, expect, it } from "vitest";
import { AdPlatform } from "@prisma/client";
import { pickCallouts, sortCreatives, type CreativeItem } from "@/app/portal/ads/ad-creative-gallery";

const base = { platform: AdPlatform.META, name: "", status: "ACTIVE", format: "image", thumbnailUrl: null, headline: null, body: null, landingUrl: null, campaignName: null };
const ad = (id: string, spendCents: number, leads: number, clicks = 10, impressions = 1000): CreativeItem =>
  ({ ...base, id, spendCents, leads, clicks, impressions });

const cheap = ad("cheap", 10000, 10);   // $10 per lead
const pricey = ad("pricey", 30000, 3);  // $100 per lead
const burner = ad("burner", 50000, 0);  // spend, no leads
const idle = ad("idle", 0, 0, 0, 0);

describe("creative gallery ranking", () => {
  it("cost per lead: cheapest first, no-lead ads last by spend", () => {
    expect(sortCreatives([idle, burner, pricey, cheap], "cpl").map((i) => i.id)).toEqual(["cheap", "pricey", "burner", "idle"]);
  });

  it("other sorts", () => {
    expect(sortCreatives([cheap, burner, pricey], "spend").map((i) => i.id)).toEqual(["burner", "pricey", "cheap"]);
    expect(sortCreatives([pricey, cheap, burner], "leads").map((i) => i.id)).toEqual(["cheap", "pricey", "burner"]);
    expect(sortCreatives([ad("lo", 1, 0, 1, 1000), ad("hi", 1, 0, 50, 1000)], "ctr")[0].id).toBe("hi");
  });

  it("calls out the best cost per lead and the biggest spend with no leads", () => {
    expect(pickCallouts([cheap, pricey, burner, idle])).toEqual({ bestId: "cheap", worstId: "burner" });
  });

  it("falls back to the highest cost per lead when every paid ad has leads", () => {
    expect(pickCallouts([cheap, pricey])).toEqual({ bestId: "cheap", worstId: "pricey" });
  });

  it("never marks the same ad best and worst, and nothing with no data", () => {
    expect(pickCallouts([cheap])).toEqual({ bestId: "cheap", worstId: null });
    expect(pickCallouts([idle])).toEqual({ bestId: null, worstId: null });
  });
});
