import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { applyAssets } = await import("@/lib/integrations/google-ads");
type Creative = Parameters<typeof applyAssets>[0];

const base: Creative = {
  externalAdId: "1",
  externalCampaignId: null,
  name: "Ad",
  status: "ENABLED",
  format: "image",
  thumbnailUrl: null,
  imageUrl: null,
  videoId: null,
  headline: null,
  body: null,
  ctaType: null,
  landingUrl: null,
};

describe("applyAssets", () => {
  it("fills image URL from a resolved marketing image asset", () => {
    const assets = new Map([["customers/1/assets/9", { imageUrl: "https://img/x.png", youtubeVideoId: null }]]);
    const out = applyAssets(base, "customers/1/assets/9", null, assets);
    expect(out.thumbnailUrl).toBe("https://img/x.png");
    expect(out.imageUrl).toBe("https://img/x.png");
    expect(out.videoId).toBeNull();
  });

  it("derives a YouTube thumbnail and videoId from a video asset", () => {
    const assets = new Map([["customers/1/assets/7", { imageUrl: null, youtubeVideoId: "abc123" }]]);
    const out = applyAssets({ ...base, format: "video" }, null, "customers/1/assets/7", assets);
    expect(out.videoId).toBe("abc123");
    expect(out.thumbnailUrl).toBe("https://img.youtube.com/vi/abc123/hqdefault.jpg");
  });

  it("keeps inline image-ad URLs and leaves unresolved assets null", () => {
    const inline = { ...base, thumbnailUrl: "https://inline/a.png", imageUrl: "https://inline/a.png" };
    const out = applyAssets(inline, "customers/1/assets/missing", null, new Map());
    expect(out.thumbnailUrl).toBe("https://inline/a.png");
    expect(applyAssets(base, "customers/1/assets/missing", null, new Map()).thumbnailUrl).toBeNull();
  });
});
