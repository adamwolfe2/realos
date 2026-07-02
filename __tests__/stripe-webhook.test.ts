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

  it("invoice.paid reverses the lifecycle pause (TenantStatus.PAUSED -> ACTIVE)", () => {
    const content = readRoute();
    // Without this the 14-day-overdue chatbot pause never lifted after payment.
    expect(content).toContain("org.status === TenantStatus.PAUSED");
    expect(content).toContain("updateData.status = TenantStatus.ACTIVE");
    // Must read status to make the decision.
    expect(content).toMatch(/select:\s*\{[^}]*status:\s*true/);
  });

  it("uses createOrderWithRetry for quote-to-order conversion", () => {
    const content = readRoute();
    expect(content).toContain("createOrderWithRetry");
  });
});

describe("Stripe webhook — money/audit writes must not be swallowed (Batch A)", () => {
  it("payment_intent/charge/dispute handlers no longer swallow errors", () => {
    const content = readRoute();
    // Regression: these five handlers used to wrap their body in try/catch
    // that only logged + returned void, so the outer dispatcher 200'd and
    // Stripe never retried — silently dropping a PAID build-fee credit and
    // the refund/dispute audit trail. The swallow markers must stay gone.
    expect(content).not.toContain("payment_intent.succeeded handler failed");
    expect(content).not.toContain("payment_intent.payment_failed handler failed");
    expect(content).not.toContain("charge.refunded handler failed");
    expect(content).not.toContain("charge.dispute.created handler failed");
    expect(content).not.toContain("charge.dispute.closed handler failed");
  });

  it("credits the website-build fee via an atomic increment (no read-modify-write)", () => {
    const content = readRoute();
    // Atomic increment avoids a double-credit race across concurrent
    // deliveries AND removes the pre-read that made retries unsafe.
    expect(content).toMatch(/buildFeePaidCents:\s*\{\s*increment:/);
    // The old non-idempotent `(org.buildFeePaidCents ?? 0) + amount` pattern
    // must not come back.
    expect(content).not.toMatch(/\(org\.buildFeePaidCents\s*\?\?\s*0\)\s*\+/);
  });

  it("money/audit handlers dispatch through the processStripeEventOnce dedupe fence", () => {
    const content = readRoute();
    // A retry after a partial write must be a no-op, not a double side effect.
    expect(content).toContain("processStripeEventOnce");
    // The dispatcher must thread event.id into these handlers so the fence
    // has a stable idempotency key.
    expect(content).toMatch(
      /handlePaymentIntentSucceeded\([\s\S]*?event\.id/,
    );
  });
});

describe("Stripe webhook — paused-dunning enforcement (Batch B)", () => {
  it("invoice.payment_failed does not clobber an internal PAUSED with PAST_DUE", () => {
    const content = readRoute();
    // After the 14-day escalation sets PAUSED, Stripe's smart-retry
    // payment_failed deliveries must NOT revert the org to PAST_DUE (which
    // re-arms dunning and lifts the read-only lock).
    expect(content).toMatch(
      /if\s*\(\s*org\.subscriptionStatus\s*===\s*SubscriptionStatus\.PAUSED\s*\)\s*\{\s*return/,
    );
  });

  it("subscription.updated only blocks the PAUSED->PAST_DUE downgrade", () => {
    const content = readRoute();
    // Guard is scoped: PAUSED->ACTIVE / PAUSED->CANCELED still apply.
    expect(content).toContain("clobbersPause");
    expect(content).toMatch(
      /org\.subscriptionStatus\s*===\s*SubscriptionStatus\.PAUSED\s*&&\s*newStatus\s*===\s*SubscriptionStatus\.PAST_DUE/,
    );
  });
});

describe("Stripe webhook — billing correctness fixes (Batch C)", () => {
  it("Fix 1: handleSubscriptionUpserted persists cancel_at_period_end flag", () => {
    const content = readRoute();
    expect(content).toContain("cancelAtPeriodEnd");
    expect(content).toContain("cancel_at_period_end");
    expect(content).toContain("currentPeriodEnd");
    expect(content).toContain("current_period_end");
  });

  it("Fix 2: non-proposal trial_will_end notifies org via email", () => {
    const content = readRoute();
    expect(content).toContain("notifyOrgTrialWillEnd");
    expect(content).toContain("sendTrialEndingSoonEmail");
    expect(content).toContain("trial ends");
  });

  it("Fix 2: non-proposal trial_will_end logs to Sentry when org has no email", () => {
    const content = readRoute();
    expect(content).toContain("trial_will_end: org has no email to notify");
  });

  it("Fix 3: handleSubscriptionUpserted uses processStripeEventOnce for audit", () => {
    const content = readRoute();
    // The fence must appear inside handleSubscriptionUpserted — verify the
    // function now accepts an eventId and threads it to processStripeEventOnce.
    expect(content).toMatch(
      /handleSubscriptionUpserted\([^)]*eventId[^)]*\)/,
    );
  });

  it("Fix 3: handleInvoicePaymentFailed uses processStripeEventOnce for audit", () => {
    const content = readRoute();
    expect(content).toMatch(
      /handleInvoicePaymentFailed\([^)]*eventId[^)]*\)/,
    );
  });

  it("Fix 3: handleSubscriptionDeleted uses processStripeEventOnce for audit", () => {
    const content = readRoute();
    expect(content).toMatch(
      /handleSubscriptionDeleted\([^)]*eventId[^)]*\)/,
    );
  });

  it("Fix 4: handleDisputeCreated sends ops email (notifyOpsOfDispute)", () => {
    const content = readRoute();
    expect(content).toContain("notifyOpsOfDispute");
    expect(content).toContain("Dispute OPENED");
  });

  it("Fix 5: cleanup-stripe-events cron file exists", () => {
    const cronPath = path.resolve(
      __dirname,
      "../app/api/cron/cleanup-stripe-events/route.ts"
    );
    expect(fs.existsSync(cronPath)).toBe(true);
  });

  it("Fix 5: cleanup-stripe-events cron deletes rows older than 30 days", () => {
    const cronPath = path.resolve(
      __dirname,
      "../app/api/cron/cleanup-stripe-events/route.ts"
    );
    const content = fs.readFileSync(cronPath, "utf-8");
    expect(content).toContain("processedStripeEvent.deleteMany");
    expect(content).toContain("30");
  });
});
