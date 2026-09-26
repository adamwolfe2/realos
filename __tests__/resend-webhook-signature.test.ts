import { afterEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "svix";
import { verifySignature } from "@/lib/email/resend-webhook-signature";

// Resend signs with Svix. The secret is "whsec_<base64>"; using the literal
// string as the HMAC key rejected every genuine event.
const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

function signed(body: string) {
  const id = "msg_1";
  const ts = new Date();
  const sig = new Webhook(SECRET).sign(id, ts, body);
  return new Headers({
    "svix-id": id,
    "svix-timestamp": String(Math.floor(ts.getTime() / 1000)),
    "svix-signature": sig,
  });
}

describe("verifySignature (Resend/Svix)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a genuine Svix signature", () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", SECRET);
    const body = JSON.stringify({ type: "email.bounced" });
    expect(verifySignature(body, signed(body))).toBe(true);
  });

  it("rejects a tampered body", () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", SECRET);
    const headers = signed('{"a":1}');
    expect(verifySignature('{"a":2}', headers)).toBe(false);
  });

  it("fails closed without a secret", () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    const body = "{}";
    expect(verifySignature(body, signed(body))).toBe(false);
  });
});
