import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Regression: POST /api/marketplace/leads/[id]/checkout used to return the
// raw Stripe error message straight to the buyer on a failed checkout
// session creation. Structural check (route pulls in Stripe/Clerk-adjacent
// session/prisma deps that make full mocking heavy for a one-line message
// fix — same fs-source-check convention as feature-stripe-idempotency.test.ts)
// that the response body no longer echoes the caught error's message.

const src = fs.readFileSync(
  path.resolve(
    __dirname,
    "../app/api/marketplace/leads/[id]/checkout/route.ts",
  ),
  "utf-8",
);

describe("marketplace checkout — no raw error leak to buyer", () => {
  it("does not return the caught Stripe error message in the JSON response", () => {
    // The old bug: `{ error: "stripe_error", message }` where `message` was
    // `err.message`. Assert the response body is a static, non-interpolated
    // string instead.
    expect(src).not.toMatch(/error:\s*"stripe_error",\s*message,/);
    expect(src).toMatch(
      /message:\s*\n?\s*"We couldn't start checkout for this lead\./,
    );
  });

  it("still logs the real error server-side for debugging", () => {
    expect(src).toMatch(/console\.error\(\s*"marketplace checkout/);
  });
});
