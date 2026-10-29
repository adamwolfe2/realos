// #181 review: when getScope() throws (a real lookup failure, not signed-out),
// POST /api/site-requests must return 503 and save nothing, so a signed-in
// client's request is never stored without its org link.
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { siteRequest: { create: h.create } } }));
vi.mock("@/lib/tenancy/scope", () => ({
  getScope: vi.fn(async () => {
    throw new Error("db down");
  }),
}));
vi.mock("@/lib/site-engine/intake-schema", () => ({
  intakeFormSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));

const { POST } = await import("@/app/api/site-requests/route");

describe("POST /api/site-requests scope failure", () => {
  it("returns 503 and does not create a SiteRequest", async () => {
    const res = await POST(
      new Request("http://localhost/api/site-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submittedByName: "A", submittedByEmail: "a@b.co", brandName: "B" }),
      }),
    );
    expect(res.status).toBe(503);
    expect(h.create).not.toHaveBeenCalled();
  });
});
