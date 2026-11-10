import { describe, expect, it } from "vitest";
import { optimizedAvatarUrl } from "@/lib/chatbot/avatar-url";

const BLOB = "https://abc123.public.blob.vercel-storage.com/chatbot-avatars/x/jenny-1.png";

describe("optimizedAvatarUrl", () => {
  it("routes Blob avatars through the image optimizer at 128px", () => {
    expect(optimizedAvatarUrl(BLOB, "https://leasestack.co")).toBe(
      `https://leasestack.co/_next/image?url=${encodeURIComponent(BLOB)}&w=128&q=75`,
    );
  });
  it("returns a relative URL when origin is empty (same-app pages)", () => {
    expect(optimizedAvatarUrl(BLOB, "")).toBe(`/_next/image?url=${encodeURIComponent(BLOB)}&w=128&q=75`);
  });
  it("passes null/empty through as null", () => {
    expect(optimizedAvatarUrl(null, "https://leasestack.co")).toBeNull();
    expect(optimizedAvatarUrl("", "https://leasestack.co")).toBeNull();
  });
  it("leaves non-Blob, SVG, http and malformed URLs untouched", () => {
    for (const u of [
      "https://img.clerk.com/a.png",
      "https://abc.public.blob.vercel-storage.com/a.svg",
      "https://abc.public.blob.vercel-storage.com/a%2Esvg",
      "http://abc.public.blob.vercel-storage.com/a.png",
      "not a url",
    ]) expect(optimizedAvatarUrl(u, "https://leasestack.co")).toBe(u);
  });
});
