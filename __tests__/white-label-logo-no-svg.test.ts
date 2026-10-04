import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";

// F-078: SVG logos are script-capable and were stored as image/svg+xml on
// the public blob host. The route must reject them before any upload.

const h = vi.hoisted(() => ({
  db: {
    organization: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
  putPublic: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/blob-public", () => ({
  putPublic: h.putPublic,
  delPublic: vi.fn(),
}));
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return {
    ...actual,
    requireWritableWorkspace: vi.fn().mockResolvedValue({
      orgId: "org_1",
      userId: "u_1",
      clerkUserId: "clerk_1",
    }),
  };
});

import { POST } from "@/app/api/portal/white-label/logo/route";

beforeEach(() => {
  vi.clearAllMocks();
  h.db.organization.findUnique.mockResolvedValue({
    whiteLabel: true,
    whiteLabelLogoUrl: null,
  });
  h.db.user.findUnique.mockResolvedValue({ role: UserRole.CLIENT_OWNER });
});

describe("POST /api/portal/white-label/logo", () => {
  it("rejects image/svg+xml with 415 and never uploads", async () => {
    const fd = new FormData();
    fd.append(
      "file",
      new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], "logo.svg", {
        type: "image/svg+xml",
      }),
    );
    const req = new NextRequest("http://localhost/api/portal/white-label/logo", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req);
    expect(res.status).toBe(415);
    expect((await res.json()).error).toBe("Unsupported logo type. Use PNG or JPEG.");
    expect(h.putPublic).not.toHaveBeenCalled();
  });
});
