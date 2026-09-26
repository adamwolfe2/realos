// ---------------------------------------------------------------------------
// Internal-call capability token.
//
// Problem: a module whose first line is `"use server"` registers EVERY
// exported async function as a network-reachable Server Action — including
// helpers a file only meant to expose to its own trusted in-process callers
// (a guarded wrapper in the same module, a cron handler, a script). Two such
// "auth-free internal" helpers (executeSegmentPush, runCursiveSegmentSync)
// took an `orgId` straight from their argument and did no authorization,
// so any client could invoke the raw action ID and act on any tenant.
//
// Fix: require these internals to be handed this capability token. A Server
// Action's arguments are deserialized from the client wire format, which can
// carry JSON-ish values but NEVER a live JS `Symbol` reference — so a browser
// / curl caller cannot reconstruct INTERNAL_CALL and the assert below fails
// closed. Legitimate callers are all in-process (the guarded wrapper, the
// cron handler, a CLI script); they `import { INTERNAL_CALL }` and pass it,
// and because that call is a direct function call (not a network Action
// invocation) the symbol passes through untouched.
//
// This is defense that the framework itself does not provide: it makes the
// "callers MUST authorize before invoking this" comment a compile-time (the
// required parameter) AND runtime (this assert) guarantee.
// ---------------------------------------------------------------------------

export const INTERNAL_CALL: unique symbol = Symbol("leasestack.internal-call");
export type InternalCall = typeof INTERNAL_CALL;

/**
 * Throws unless the caller supplied the in-process INTERNAL_CALL token.
 * Use at the top of any `"use server"` helper that must not be reachable as
 * a standalone Server Action.
 */
export function assertInternalCall(token: unknown): asserts token is InternalCall {
  if (token !== INTERNAL_CALL) {
    throw new Error(
      "Forbidden: this internal function must be called in-process with the INTERNAL_CALL token, not invoked directly.",
    );
  }
}
