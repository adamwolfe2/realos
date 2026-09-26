import { afterEach, describe, expect, it, vi } from "vitest";
import { isPlatformBrowserHost } from "@/lib/tenancy/platform-host";

// Gates LeaseStack's own analytics/chat/demo embed off customer tenant sites.
describe("isPlatformBrowserHost", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("platform apex, www, previews and localhost are platform", () => {
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN", "leasestack.co");
    for (const h of ["leasestack.co", "www.leasestack.co", "x-git-main.vercel.app", "localhost"]) {
      expect(isPlatformBrowserHost(h)).toBe(true);
    }
  });

  it("tenant subdomains and custom domains are not", () => {
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN", "leasestack.co");
    expect(isPlatformBrowserHost("telegraph-commons.leasestack.co")).toBe(false);
    expect(isPlatformBrowserHost("telegraphcommons.com")).toBe(false);
  });

  it("falls back to NEXT_PUBLIC_APP_URL and strips www", () => {
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.leasestack.co");
    expect(isPlatformBrowserHost("leasestack.co")).toBe(true);
    expect(isPlatformBrowserHost("someproperty.com")).toBe(false);
  });
});
