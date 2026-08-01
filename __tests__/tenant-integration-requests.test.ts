import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Coverage gap: POST /api/tenant/integration-requests had zero test
// coverage. Covers auth, validation, unknown-integration 404, the dedup
// path (a second click while a request is already PENDING/IN_PROGRESS
// must return the existing row, not create a duplicate), the success path
// scoping the new row to scope.orgId, and that a failed audit/note write
// never fails the request itself (best-effort side effects).
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: {
    integrationRequest: { findFirst: vi.fn(), create: vi.fn() },
    auditEvent: { create: vi.fn() },
    clientNote: { create: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));

const mockRequireWritableWorkspace = vi.fn();
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return {
    ...actual,
    requireWritableWorkspace: () => mockRequireWritableWorkspace(),
  };
});

vi.mock("@/lib/integrations/catalog", () => ({
  findIntegration: (slug: string) =>
    slug === "ga4" ? { slug: "ga4", name: "Google Analytics 4" } : null,
}));

import { POST } from "@/app/api/tenant/integration-requests/route";
import { ForbiddenError } from "@/lib/tenancy/scope";

const SCOPE = { orgId: "org_1", userId: "user_1", email: "ops@example.com" };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/tenant/integration-requests", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireWritableWorkspace.mockResolvedValue(SCOPE);
  h.db.integrationRequest.findFirst.mockResolvedValue(null);
  h.db.integrationRequest.create.mockResolvedValue({ id: "req_1" });
  h.db.auditEvent.create.mockResolvedValue({});
  h.db.clientNote.create.mockResolvedValue({});
});

describe("POST /api/tenant/integration-requests", () => {
  it("surfaces a ForbiddenError's status", async () => {
    mockRequireWritableWorkspace.mockRejectedValue(new ForbiddenError("Trial expired"));
    const res = (await POST(req({ integrationSlug: "ga4" }))) as Response;
    expect(res.status).toBe(403);
  });

  it("rejects a missing integrationSlug", async () => {
    const res = (await POST(req({}))) as Response;
    expect(res.status).toBe(400);
  });

  it("404s for an unknown integration slug", async () => {
    const res = (await POST(req({ integrationSlug: "not-a-real-integration" }))) as Response;
    expect(res.status).toBe(404);
    expect(h.db.integrationRequest.create).not.toHaveBeenCalled();
  });

  it("dedupes against an existing PENDING/IN_PROGRESS request instead of creating a duplicate", async () => {
    h.db.integrationRequest.findFirst.mockResolvedValue({ id: "req_existing" });
    const res = (await POST(req({ integrationSlug: "ga4" }))) as Response;
    const json = await res.json();

    expect(json).toEqual({ ok: true, id: "req_existing", deduped: true });
    expect(h.db.integrationRequest.create).not.toHaveBeenCalled();
  });

  it("creates the request scoped to scope.orgId and writes audit + note best-effort", async () => {
    const res = (await POST(req({ integrationSlug: "ga4", message: "please enable" }))) as Response;
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, id: "req_1" });
    expect(h.db.integrationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org_1", integrationSlug: "ga4" }),
      }),
    );
    expect(h.db.auditEvent.create).toHaveBeenCalled();
    expect(h.db.clientNote.create).toHaveBeenCalled();
  });

  it("never fails the request itself when the audit-log write fails", async () => {
    h.db.auditEvent.create.mockRejectedValue(new Error("audit table down"));
    const res = (await POST(req({ integrationSlug: "ga4" }))) as Response;
    expect(res.status).toBe(200);
  });

  it("never fails the request itself when the client-note write fails", async () => {
    h.db.clientNote.create.mockRejectedValue(new Error("notes table down"));
    const res = (await POST(req({ integrationSlug: "ga4" }))) as Response;
    expect(res.status).toBe(200);
  });
});
