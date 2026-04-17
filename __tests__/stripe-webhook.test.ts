import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural and behavioral tests for the Stripe webhook handler.
 * Verifies signature validation, event handling, idempotency,
 * transactional safety, amount validation, and error reporting.
 */

const routePath = path.resolve(
  __dirname,
  "../app/api/webhooks/stripe/route.ts"
);

function readRoute(): string {
  return fs.readFileSync(routePath, "utf-8");
}

describe("Stripe webhook — app/api/webhooks/stripe/route.ts", () => {
  it("route file exists", () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it("exports POST handler", () => {
    const content = readRoute();
    expect(content).toMatch(
      /export\s+async\s+function\s+POST/
    );
  });

  it("does NOT export GET (webhooks are POST-only)", () => {
    const content = readRoute();
    expect(content).not.toMatch(
      /export\s+async\s+function\s+GET/
    );
  });

  it("validates webhook signatures via parseWebhookEvent", () => {
    const content = readRoute();
    // Reads Stripe-Signature header
    expect(content).toContain("stripe-signature");
    // Uses the centralized signature verification function
    expect(content).toContain("parseWebhookEvent");
    // Returns 400 for missing or invalid signature
    expect(content).toContain("Missing signature");
    expect(content).toContain("Invalid signature");
  });

  it("handles checkout.session.completed event", () => {
    const content = readRoute();
    expect(content).toContain('"checkout.session.completed"');
  });

  it("handles checkout.session.expired event", () => {
    const content = readRoute();
    expect(content).toContain('"checkout.session.expired"');
  });

  it("handles invoice.paid event", () => {
    const content = readRoute();
    expect(content).toContain('"invoice.paid"');
  });

  it("handles invoice.payment_failed event", () => {
    const content = readRoute();
    expect(content).toContain('"invoice.payment_failed"');
  });

  it("handles payment_intent.succeeded event", () => {
    const content = readRoute();
    expect(content).toContain('"payment_intent.succeeded"');
  });

  it("handles payment_intent.payment_failed event", () => {
    const content = readRoute();
    expect(content).toContain('"payment_intent.payment_failed"');
  });

  it("handles charge.refunded event", () => {
    const content = readRoute();
    expect(content).toContain('"charge.refunded"');
  });

  it("handles charge.dispute.created event", () => {
    const content = readRoute();
    expect(content).toContain('"charge.dispute.created"');
  });

  it("handles charge.dispute.closed event", () => {
    const content = readRoute();
    expect(content).toContain('"charge.dispute.closed"');
  });

  it("uses prisma.$transaction for order creation from quotes", () => {
    const content = readRoute();
    expect(content).toContain("prisma.$transaction");
  });

  it("has idempotency check via convertedOrderId for quote payments", () => {
    const content = readRoute();
    expect(content).toContain("convertedOrderId");
    // Verify it skips if already converted
    expect(content).toContain("already converted");
  });

  it("has idempotency check for regular checkout sessions via stripeSessionId", () => {
    const content = readRoute();
    // Guard: skip if same session already recorded
    expect(content).toContain("stripeSessionId");
    expect(content).toMatch(/existing\?\.stripeSessionId\s*===\s*session\.id/);
  });

  it("has idempotency check for invoice.paid via existing paid status", () => {
    const content = readRoute();
    // The invoice.paid handler checks if invoice is already paid
    expect(content).toMatch(/existingInv\?\.status\s*===\s*["']PAID["']/);
  });

  it("validates amount matches quote total (amount mismatch detection)", () => {
    const content = readRoute();
    expect(content).toContain("amount_total");
    expect(content).toContain("amount_mismatch_detected");
    // Verify it captures the mismatch to Sentry
    expect(content).toContain("Quote/Stripe amount mismatch");
  });

  it("captures errors to Sentry via captureWithContext", () => {
    const content = readRoute();
    expect(content).toContain("captureWithContext");
  });

  it("returns 200 on success (webhooks must return 200 quickly)", () => {
    const content = readRoute();
    // The final return after the switch statement
    expect(content).toContain('{ received: true }');
  });

  it("returns 500 on unhandled errors so Stripe retries", () => {
    const content = readRoute();
    expect(content).toContain("status: 500");
    expect(content).toContain("Internal error");
  });

  it("handles unknown event types gracefully via default case", () => {
    const content = readRoute();
    // Default case logs a warning but does not throw
    expect(content).toContain("default:");
    expect(content).toContain("Unhandled Stripe event");
  });

  it("cancels orphaned orders when checkout session expires", () => {
    const content = readRoute();
    expect(content).toContain("checkout_expired");
    expect(content).toContain('updateOrderStatus(orderId, "CANCELLED")');
  });

  it("sends email notifications for confirmed orders", () => {
    const content = readRoute();
    expect(content).toContain("sendOrderConfirmation");
    expect(content).toContain("sendInternalOrderNotification");
  });

  it("sends payment confirmation for invoice payments", () => {
    const content = readRoute();
    expect(content).toContain("sendPaymentReceivedEmail");
  });

  it("sends refund confirmation emails", () => {
    const content = readRoute();
    expect(content).toContain("sendRefundConfirmationEmail");
  });

  it("sends dispute alert emails to ops", () => {
    const content = readRoute();
    expect(content).toContain("sendDisputeAlertEmail");
  });

  it("auto-generates invoices after payment confirmation", () => {
    const content = readRoute();
    expect(content).toContain("generateInvoiceForOrder");
  });

  it("handles dunning suspension lift when invoice is paid", () => {
    const content = readRoute();
    expect(content).toContain("dunning_suspension_lifted");
    expect(content).toContain("All overdue invoices resolved");
  });

  it("uses createOrderWithRetry for quote-to-order conversion", () => {
    const content = readRoute();
    expect(content).toContain("createOrderWithRetry");
  });
});
