import { describe, it, expect, vi, beforeEach } from "vitest";

// alertFunnelStep emails ops when a self-serve operator signs up or finishes
// onboarding, with escaped org/contact data, and never throws.

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { organization: { findUnique: h.findUnique } },
}));
vi.mock("@/lib/email/shared", () => ({
  AGENCY_ADMIN_EMAIL: "ops@example.com",
  APP_URL: "https://app.example.com",
  buildBaseHtml: (o: { headline: string; bodyHtml: string; ctaUrl: string }) =>
    `${o.headline}|${o.bodyHtml}|${o.ctaUrl}`,
  escapeHtml: (s: string) => s.replace(/</g, "&lt;"),
  sendBrandedEmail: h.send,
}));

const { alertFunnelStep } = await import("@/lib/notifications/funnel-alert");

beforeEach(() => {
  h.findUnique.mockReset();
  h.send.mockReset().mockResolvedValue({ ok: true });
});

describe("alertFunnelStep", () => {
  it("emails ops with the workspace, contact and properties", async () => {
    h.findUnique.mockResolvedValue({
      name: "Acme <b>",
      users: [{ email: "op@acme.com" }],
      properties: [{ name: "Elm Flats", websiteUrl: "elm.com" }],
    });
    await alertFunnelStep({ orgId: "org_1", step: "onboarding_completed" });
    expect(h.send).toHaveBeenCalledTimes(1);
    const arg = h.send.mock.calls[0][0];
    expect(arg.to).toBe("ops@example.com");
    expect(arg.subject).toBe("Onboarding finished: Acme <b>");
    expect(arg.html).toContain("Acme &lt;b>");
    expect(arg.html).toContain("op@acme.com");
    expect(arg.html).toContain("Elm Flats (elm.com)");
    expect(arg.html).toContain("/admin/clients/org_1");
  });

  it("skips quietly when the org is gone and never throws on send failure", async () => {
    h.findUnique.mockResolvedValue(null);
    await expect(alertFunnelStep({ orgId: "x", step: "signup" })).resolves.toBeUndefined();
    expect(h.send).not.toHaveBeenCalled();

    h.findUnique.mockResolvedValue({ name: "A", users: [], properties: [] });
    h.send.mockRejectedValue(new Error("resend down"));
    await expect(alertFunnelStep({ orgId: "y", step: "signup" })).resolves.toBeUndefined();
  });
});
