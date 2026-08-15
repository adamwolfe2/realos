import { describe, it, expect, afterEach, vi } from "vitest";
import { chatbotOriginBypassEnabled } from "@/lib/tenancy/origin-guard";

// ---------------------------------------------------------------------------
// Regression: CHATBOT_ALLOW_ANY_ORIGIN disables the tenant origin binding —
// the primary anti-abuse control on the public chatbot/popup endpoints. It is
// a local/preview dev convenience and must NEVER take effect in production,
// even if the env var is set by mistake. Mirrors DEMO_MODE's prod refusal.
//
// vi.stubEnv is used (not direct assignment) because NODE_ENV is a readonly
// property under the project's TS config.
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("chatbotOriginBypassEnabled", () => {
  it("is disabled by default (flag unset)", () => {
    vi.stubEnv("CHATBOT_ALLOW_ANY_ORIGIN", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");
    expect(chatbotOriginBypassEnabled()).toBe(false);
  });

  it("is enabled in development when the flag is 'true'", () => {
    vi.stubEnv("CHATBOT_ALLOW_ANY_ORIGIN", "true");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");
    expect(chatbotOriginBypassEnabled()).toBe(true);
  });

  it("is FORCED OFF in Vercel production even if the flag is 'true'", () => {
    vi.stubEnv("CHATBOT_ALLOW_ANY_ORIGIN", "true");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(chatbotOriginBypassEnabled()).toBe(false);
  });

  it("is FORCED OFF when NODE_ENV is production even if the flag is 'true'", () => {
    vi.stubEnv("CHATBOT_ALLOW_ANY_ORIGIN", "true");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");
    expect(chatbotOriginBypassEnabled()).toBe(false);
  });
});
