import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression for RISK-009: POST /api/site-requests/upload is public,
// unauthenticated, and previously had NO rate limiting at all — unlike every
// other comparable public endpoint in this app (tours, popup lead, chatbot
// lead, etc). A script could hammer it with 25MB uploads all day for free.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  putPublic: vi.fn(async () => ({
    url: "https://blob.example/site-engine/intake/abc/logo.png",
    pathname: "site-engine/intake/abc/logo.png",
  })),
}));

vi.mock("@/lib/rate-limit", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    checkRateLimit: h.checkRateLimit,
  };
});

vi.mock("@/lib/blob-public", () => ({ putPublic: h.putPublic }));

// Stub the Upstash clients so constructing a Ratelimit instance at module
// scope never opens a real network client during tests.
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
  },
}));
vi.mock("@upstash/redis", () => ({
  Redis: class {},
}));

import { POST } from "@/app/api/site-requests/upload/route";

function uploadRequest(file: File) {
  const form = new FormData();
  form.append("file", file);
  return {
    headers: new Headers({ "x-forwarded-for": "203.0.113.5" }),
    formData: async () => form,
  } as unknown as Request;
}

beforeEach(() => {
  h.checkRateLimit.mockReset();
  h.putPublic.mockClear();
});

describe("POST /api/site-requests/upload — per-IP rate limiting", () => {
  it("returns 429 and never touches blob storage once the IP is rate-limited", async () => {
    h.checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      limit: 15,
      remaining: 0,
      reset: Date.now() + 3_600_000,
    });

    const file = new File(["x".repeat(10)], "logo.png", { type: "image/png" });
    const res = await POST(uploadRequest(file));

    expect(res.status).toBe(429);
    expect(h.putPublic).not.toHaveBeenCalled();
  });

  it("proceeds to upload when the IP is within the limit", async () => {
    h.checkRateLimit.mockResolvedValueOnce({
      allowed: true,
      limit: 15,
      remaining: 14,
      reset: Date.now() + 3_600_000,
    });

    const file = new File(["x".repeat(10)], "logo.png", { type: "image/png" });
    const res = await POST(uploadRequest(file));

    expect(res.status).toBe(200);
    expect(h.putPublic).toHaveBeenCalledTimes(1);
  });
});
