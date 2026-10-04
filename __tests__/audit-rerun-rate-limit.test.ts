import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// F-017: the public re-run route (gated only by the share token) must be
// rate limited per IP and cooled down per audit, returning a readable 429.

const h = vi.hoisted(() => ({
  db: { prospectAudit: { findUnique: vi.fn(), update: vi.fn() } },
  checkRateLimit: vi.fn(),
  releaseRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/audit/token", () => ({ isValidShareToken: () => true }));
vi.mock("@/lib/brand", () => ({ getSiteUrl: () => "http://localhost" }));
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit",
  );
  return {
    ...actual,
    auditStartLimiter: "ip-limiter",
    auditRerunLimiter: "audit-limiter",
    checkRateLimit: h.checkRateLimit,
    releaseRateLimit: h.releaseRateLimit,
  };
});

import { POST } from "@/app/api/audit/[id]/rerun/route";

const TOKEN = "tok_abc";
function call() {
  const req = new NextRequest(`http://localhost/api/audit/${TOKEN}/rerun`, {
    method: "POST",
    body: JSON.stringify({ shareToken: TOKEN }),
    headers: { "x-forwarded-for": "1.2.3.4" },
  });
  return POST(req, { params: Promise.resolve({ id: TOKEN }) });
}

const ok = { allowed: true, limit: 1, remaining: 0, reset: 0 };
const blocked = (ms: number) => ({
  allowed: false,
  limit: 1,
  remaining: 0,
  reset: Date.now() + ms,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.releaseRateLimit.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null)));
  h.db.prospectAudit.findUnique.mockResolvedValue({
    id: "audit_1",
    status: "READY",
    createdAt: new Date(Date.now() - 10 * 60_000),
  });
});

describe("POST /api/audit/[id]/rerun rate limits", () => {
  it("429s per IP before touching the DB", async () => {
    h.checkRateLimit.mockResolvedValueOnce(blocked(60_000));
    const res = await call();
    expect(res.status).toBe(429);
    expect(h.checkRateLimit).toHaveBeenCalledWith("ip-limiter", "rerun:1.2.3.4");
    expect(h.db.prospectAudit.findUnique).not.toHaveBeenCalled();
  });

  it("429s with a clear message during the per-audit cooldown and does not reset the audit", async () => {
    h.checkRateLimit.mockResolvedValueOnce(ok).mockResolvedValueOnce(blocked(30 * 60_000));
    const res = await call();
    expect(res.status).toBe(429);
    expect(h.checkRateLimit).toHaveBeenLastCalledWith("audit-limiter", "audit_1");
    expect((await res.json()).error).toMatch(/re-run recently.*30 minutes/);
    expect(h.db.prospectAudit.update).not.toHaveBeenCalled();
  });

  it("re-queues when both limits allow", async () => {
    h.checkRateLimit.mockResolvedValue(ok);
    const res = await call();
    expect(res.status).toBe(200);
    expect(h.db.prospectAudit.update).toHaveBeenCalledTimes(1);
  });

  it("releases the per-audit cooldown when the trigger fails", async () => {
    h.checkRateLimit.mockResolvedValue(ok);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await call();
    await vi.waitFor(() =>
      expect(h.releaseRateLimit).toHaveBeenCalledWith("audit-limiter", "audit_1"),
    );
  });

  it("releases the cooldown when the reset update throws, and does not on success", async () => {
    h.checkRateLimit.mockResolvedValue(ok);
    await call();
    expect(h.releaseRateLimit).not.toHaveBeenCalled();
    h.db.prospectAudit.update.mockRejectedValueOnce(new Error("db down"));
    await expect(call()).rejects.toThrow("db down");
    expect(h.releaseRateLimit).toHaveBeenCalledWith("audit-limiter", "audit_1");
  });
});
