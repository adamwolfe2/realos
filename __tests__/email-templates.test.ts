import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Tests for the email template system:
 * - buildBaseHtml produces valid HTML
 * - All email domain files export expected functions
 * - Brand name is injected into email output
 */

// Mock Resend so email module can import without RESEND_API_KEY
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: "mock-id" }) },
  })),
}));

const EMAIL_DIR = path.resolve(__dirname, "../lib/email");

describe("email module structure", () => {
  it("lib/email/index.ts exists", () => {
    expect(fs.existsSync(path.join(EMAIL_DIR, "index.ts"))).toBe(true);
  });

  it("lib/email/notifications.ts exists", () => {
    expect(fs.existsSync(path.join(EMAIL_DIR, "notifications.ts"))).toBe(true);
  });

  it("lib/email/project-emails.ts exists", () => {
    expect(fs.existsSync(path.join(EMAIL_DIR, "project-emails.ts"))).toBe(
      true
    );
  });
});

describe("buildBaseHtml", () => {
  it("is exported from lib/email/index.ts", async () => {
    const mod = await import("@/lib/email/index");
    expect(mod.buildBaseHtml).toBeDefined();
    expect(typeof mod.buildBaseHtml).toBe("function");
  });

  it("returns a string starting with <!DOCTYPE html>", async () => {
    const { buildBaseHtml } = await import("@/lib/email/index");
    const html = buildBaseHtml({
      headline: "Test Headline",
      bodyHtml: "<p>Hello world</p>",
    });
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/);
  });

  it("includes the brand name in output", async () => {
    const { buildBaseHtml } = await import("@/lib/email/index");
    const html = buildBaseHtml({
      headline: "Test",
      bodyHtml: "<p>Body</p>",
    });
    // Default brand name is "Wholesail"
    expect(html).toContain("Wholesail");
  });

  it("includes the headline in output", async () => {
    const { buildBaseHtml } = await import("@/lib/email/index");
    const html = buildBaseHtml({
      headline: "Order Confirmed",
      bodyHtml: "<p>Your order is confirmed.</p>",
    });
    expect(html).toContain("Order Confirmed");
  });

  it("includes the body HTML in output", async () => {
    const { buildBaseHtml } = await import("@/lib/email/index");
    const html = buildBaseHtml({
      headline: "Test",
      bodyHtml: '<p class="custom">Custom body content</p>',
    });
    expect(html).toContain("Custom body content");
  });

  it("renders CTA button when ctaText and ctaUrl are provided", async () => {
    const { buildBaseHtml } = await import("@/lib/email/index");
    const html = buildBaseHtml({
      headline: "Test",
      bodyHtml: "<p>Body</p>",
      ctaText: "View Order",
      ctaUrl: "https://example.com/order/123",
    });
    expect(html).toContain("View Order");
    expect(html).toContain("https://example.com/order/123");
  });

  it("omits CTA button when ctaText/ctaUrl are not provided", async () => {
    const { buildBaseHtml } = await import("@/lib/email/index");
    const html = buildBaseHtml({
      headline: "Test",
      bodyHtml: "<p>Body</p>",
    });
    // Should not have a CTA anchor tag with background-color styling
    expect(html).not.toContain("display:inline-block;background-color:");
  });

  it("renders alert banner when alertBannerHtml is provided", async () => {
    const { buildBaseHtml } = await import("@/lib/email/index");
    const html = buildBaseHtml({
      headline: "Test",
      bodyHtml: "<p>Body</p>",
      alertBannerHtml: "<strong>Payment overdue!</strong>",
    });
    expect(html).toContain("Payment overdue!");
    expect(html).toContain("#FFFBEB"); // amber background
  });

  it("includes unsubscribe link when includeUnsubscribe is true", async () => {
    const { buildBaseHtml } = await import("@/lib/email/index");
    const html = buildBaseHtml({
      headline: "Test",
      bodyHtml: "<p>Body</p>",
      includeUnsubscribe: true,
    });
    expect(html).toContain("Unsubscribe");
    expect(html).toContain("email preferences");
  });

  it("omits unsubscribe link when includeUnsubscribe is false/undefined", async () => {
    const { buildBaseHtml } = await import("@/lib/email/index");
    const html = buildBaseHtml({
      headline: "Test",
      bodyHtml: "<p>Body</p>",
    });
    expect(html).not.toContain("Unsubscribe");
  });

  it("produces valid HTML structure with opening and closing tags", async () => {
    const { buildBaseHtml } = await import("@/lib/email/index");
    const html = buildBaseHtml({
      headline: "Test",
      bodyHtml: "<p>Body</p>",
    });
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("<body");
    expect(html).toContain("</body>");
    expect(html).toContain("<head>");
    expect(html).toContain("</head>");
  });
});

describe("email index.ts exports", () => {
  const content = fs.readFileSync(path.join(EMAIL_DIR, "index.ts"), "utf-8");

  const EXPECTED_EXPORTS = [
    "buildBaseHtml",
    "sendOrderConfirmation",
    "sendOrderShippedEmail",
    "sendOrderDeliveredEmail",
    "sendInvoiceEmail",
    "sendWelcomePartnerEmail",
    "sendInternalOrderNotification",
    "shouldSendEmail",
  ];

  for (const fn of EXPECTED_EXPORTS) {
    it(`exports ${fn}`, () => {
      expect(content).toContain(fn);
    });
  }
});

describe("email notifications.ts exports", () => {
  const content = fs.readFileSync(
    path.join(EMAIL_DIR, "notifications.ts"),
    "utf-8"
  );

  const EXPECTED_EXPORTS = [
    "notifyAdminNewIntake",
    "sendIntakeConfirmation",
    "sendIntakeNurtureDay3",
    "sendIntakeNurtureDay7",
    "notifyAdminCallBooked",
    "notifyClientStatusChange",
    "sendStripeOnboardingEmail",
    "notifyClientPortalLive",
  ];

  for (const fn of EXPECTED_EXPORTS) {
    it(`exports ${fn}`, () => {
      expect(content).toContain(`export function ${fn}`);
    });
  }
});

describe("email project-emails.ts exports", () => {
  const content = fs.readFileSync(
    path.join(EMAIL_DIR, "project-emails.ts"),
    "utf-8"
  );

  const EXPECTED_EXPORTS = [
    "sendPortalBuildingEmail",
    "sendAssetRequestEmail",
    "sendReadyForReviewEmail",
    "sendPortalLiveEmail",
  ];

  for (const fn of EXPECTED_EXPORTS) {
    it(`exports ${fn}`, () => {
      expect(content).toContain(`export async function ${fn}`);
    });
  }
});
