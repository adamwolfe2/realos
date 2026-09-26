import { describe, it, expect } from "vitest";
import {
  INTERNAL_CALL,
  assertInternalCall,
} from "@/lib/security/internal-call";

// ---------------------------------------------------------------------------
// Regression: the two "auth-free internal" helpers (executeSegmentPush,
// runCursiveSegmentSync) live in `"use server"` modules, which register EVERY
// export as a network-reachable Server Action. They take orgId from their
// argument and do no scope check, so a direct invocation was a cross-tenant
// read/write (audiences: csvBase64 PII exfil; cursive: visitor injection).
//
// The fix requires them to be handed the in-process INTERNAL_CALL capability.
// A Server Action deserializes its arguments from the client wire format,
// which can never carry a live JS Symbol — so a browser/curl caller cannot
// reconstruct INTERNAL_CALL and assertInternalCall fails closed.
// ---------------------------------------------------------------------------

describe("assertInternalCall (internal-only capability)", () => {
  it("passes only when handed the exact INTERNAL_CALL symbol", () => {
    expect(() => assertInternalCall(INTERNAL_CALL)).not.toThrow();
  });

  it("throws for every value a network Server-Action caller could send", () => {
    // These are the shapes JSON deserialization can produce. None is the
    // module-private Symbol.
    for (const forged of [
      undefined,
      null,
      "INTERNAL_CALL",
      "leasestack.internal-call",
      0,
      1,
      true,
      {},
      { token: "INTERNAL_CALL" },
      [],
      Symbol("leasestack.internal-call"), // same description, different symbol
      Symbol.for("leasestack.internal-call"), // global registry ≠ module symbol
    ]) {
      expect(() => assertInternalCall(forged as unknown)).toThrow(/Forbidden/);
    }
  });

  it("INTERNAL_CALL is a unique symbol, not reconstructable by description", () => {
    expect(typeof INTERNAL_CALL).toBe("symbol");
    expect(INTERNAL_CALL).not.toBe(Symbol("leasestack.internal-call"));
    expect(INTERNAL_CALL).not.toBe(Symbol.for("leasestack.internal-call"));
  });
});
