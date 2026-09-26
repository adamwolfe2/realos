import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { previewPath, verifyPreviewToken } from "../lib/security/preview-token";

describe("preview share tokens (TOKEN-CUID)", () => {
  const prev = process.env.PREVIEW_LINK_SECRET;
  beforeEach(() => {
    process.env.PREVIEW_LINK_SECRET = "test-secret";
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.PREVIEW_LINK_SECRET;
    else process.env.PREVIEW_LINK_SECRET = prev;
  });

  it("round-trips a signed path", () => {
    const path = previewPath("content", "cmabc123def456ghi789jk")!;
    const t = new URL(path, "https://x.test").searchParams.get("t")!;
    expect(verifyPreviewToken("content", "cmabc123def456ghi789jk", t)).toBe(true);
  });

  it("rejects missing, wrong-kind, wrong-id, and array tokens", () => {
    const path = previewPath("content", "id1aaaaaaaaaaaaaaaaaaa")!;
    const t = new URL(path, "https://x.test").searchParams.get("t")!;
    expect(verifyPreviewToken("content", "id1aaaaaaaaaaaaaaaaaaa", undefined)).toBe(false);
    expect(verifyPreviewToken("neighborhood", "id1aaaaaaaaaaaaaaaaaaa", t)).toBe(false);
    expect(verifyPreviewToken("content", "id2aaaaaaaaaaaaaaaaaaa", t)).toBe(false);
    expect(verifyPreviewToken("content", "id1aaaaaaaaaaaaaaaaaaa", [t])).toBe(false);
  });

  it("fails closed without a secret", () => {
    delete process.env.PREVIEW_LINK_SECRET;
    expect(previewPath("content", "x")).toBeNull();
    expect(verifyPreviewToken("content", "x", "anything")).toBe(false);
  });
});
