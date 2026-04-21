// Auth helper stub.
//
// The portal and admin surfaces sit behind Clerk middleware (see
// /middleware.ts). Programmatic sign-in for E2E requires either:
//   1. Clerk Testing Tokens (preferred) — see
//      https://clerk.com/docs/testing/playwright/overview
//   2. A dedicated test-mode bypass added to middleware that accepts a
//      signed header instead of a Clerk session cookie.
//
// Neither is wired up yet. For now, authenticated tests assert the redirect
// behavior only (unauth -> /sign-in) and leave the deep-flow tests skipped
// with a TODO. When option 1 lands, fill in `signIn()` below and remove the
// `test.skip` calls in e2e/portal/*.
//
// Keeping the helper in place so tests can switch over with a one-liner.

import type { Page } from "@playwright/test";

export async function signInAsOperator(_page: Page): Promise<void> {
  throw new Error(
    "signInAsOperator() is not implemented. Wire up @clerk/testing tokens or " +
      "add a test-mode bypass to middleware before un-skipping authed tests."
  );
}

export const AUTH_NOT_WIRED_MESSAGE =
  "Clerk test sign-in helper not wired yet. Asserting auth-redirect behavior only.";
