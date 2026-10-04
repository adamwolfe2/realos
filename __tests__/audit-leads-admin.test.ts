import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  requireAgency: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  sendBrandedEmail: vi.fn(),
  trackServer: vi.fn(),
}));

vi.mock("@/lib/tenancy/scope", () => ({ requireAgency: h.requireAgency }));
vi.mock("@/lib/db", () => ({
  prisma: {
    prospectAudit: {
      findMany: h.findMany,
      findUnique: h.findUnique,
      findFirst: h.findFirst,
      create: h.create,
      updateMany: h.updateMany,
    },
  },
}));
vi.mock("@/components/admin/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/lib/analytics-server", () => ({ trackServer: h.trackServer }));
vi.mock("@/lib/rate-limit", () => ({
  auditEmailCaptureLimiter: {},
  checkRateLimit: async () => ({ allowed: true }),
  getIp: () => "1.2.3.4",
}));
vi.mock("@/lib/email/shared", async () => {
  const real = await vi.importActual<typeof import("@/lib/escape-html")>(
    "@/lib/escape-html",
  );
  return {
    AGENCY_ADMIN_EMAIL: "ops@example.test",
    APP_URL: "https://app.test",
    buildBaseHtml: (o: { bodyHtml: string }) => o.bodyHtml,
    escapeHtml: real.escapeHtml,
    sendBrandedEmail: h.sendBrandedEmail,
  };
});
vi.mock("@/lib/audit/rate-limit", () => ({
  checkAuditStartLimit: async () => ({ allowed: true }),
}));

import AdminAuditLeadsPage from "@/app/admin/audit-leads/page";
import { POST } from "@/app/api/audit/[id]/capture-email/route";
import { POST as startPOST } from "@/app/api/audit/start/route";

beforeEach(() => {
  vi.clearAllMocks();
  h.sendBrandedEmail.mockResolvedValue({ ok: true });
});

describe("/admin/audit-leads", () => {
  it("rejects non-agency callers before reading any data", async () => {
    h.requireAgency.mockRejectedValue(new Error("forbidden"));
    await expect(AdminAuditLeadsPage()).rejects.toThrow("forbidden");
    expect(h.findMany).not.toHaveBeenCalled();
  });

  it("reads newest 200 for agency", async () => {
    h.requireAgency.mockResolvedValue({});
    h.findMany.mockResolvedValue([]);
    await AdminAuditLeadsPage();
    expect(h.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200, orderBy: { createdAt: "desc" } }),
    );
  });
});

describe("capture-email internal alert", () => {
  const req = () =>
    new NextRequest("http://x/api/audit/a1/capture-email", {
      method: "POST",
      body: JSON.stringify({ email: "Op@Example.com" }),
    });
  const ctx = { params: Promise.resolve({ id: "a1" }) };

  it("notifies on success", async () => {
    h.findUnique.mockResolvedValue({ id: "a1", domain: "acme.com" });
    h.updateMany.mockResolvedValue({ count: 1 });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect(h.sendBrandedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ops@example.test",
        subject: "Audit lead: acme.com",
      }),
    );
  });

  it("does not notify on 409 (already captured)", async () => {
    h.findUnique.mockResolvedValue({ id: "a1", domain: "acme.com" });
    h.updateMany.mockResolvedValue({ count: 0 });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(409);
    expect(h.sendBrandedEmail).not.toHaveBeenCalled();
  });

  it("still succeeds when the alert email fails", async () => {
    h.findUnique.mockResolvedValue({ id: "a1", domain: "acme.com" });
    h.updateMany.mockResolvedValue({ count: 1 });
    h.sendBrandedEmail.mockRejectedValue(new Error("resend down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
  });
});

describe("audit/start with an email supplied", () => {
  const startReq = (body: object) =>
    new NextRequest("http://x/api/audit/start", {
      method: "POST",
      body: JSON.stringify(body),
    });

  beforeEach(() => {
    h.findFirst.mockResolvedValue(null);
    h.create.mockResolvedValue({ id: "a2", shareToken: "t", status: "QUEUED" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  });

  it("sends the internal alert and the capture event", async () => {
    const res = await startPOST(
      startReq({ url: "https://acme.com", email: "op@acme.com" }),
    );
    expect(res.status).toBe(200);
    expect(h.sendBrandedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Audit lead: acme.com" }),
    );
    expect(h.trackServer).toHaveBeenCalledWith(
      expect.objectContaining({ event: "audit_email_captured", distinctId: "audit:a2" }),
    );
  });

  it("does not alert when no email was supplied", async () => {
    await startPOST(startReq({ url: "https://acme.com" }));
    expect(h.sendBrandedEmail).not.toHaveBeenCalled();
  });
});

describe("alert html escaping", () => {
  it("escapes domain and email in the alert body", async () => {
    const { notifyAuditLead } = await import("@/lib/audit/notify");
    await notifyAuditLead({
      auditId: "a1",
      domain: "<img src=x>.com",
      email: "o<script>@x.com",
    });
    const html = h.sendBrandedEmail.mock.calls[0][0].html as string;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
});
