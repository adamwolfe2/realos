import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// SSRF guard for operator-supplied outbound URLs (Funnel integration base URL).
// A free-form URL must never reach localhost, an internal service, or the
// cloud metadata endpoint. DNS is mocked so hostname-resolution paths are
// deterministic.
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

const mockLookup = vi.fn();
vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => mockLookup(...args),
}));

const { assertPublicHttpUrl, safeFetchFollowingRedirects, SsrfError } =
  await import("@/lib/security/ssrf-guard");

beforeEach(() => {
  mockLookup.mockReset();
});

describe("assertPublicHttpUrl — literal IP hosts (no DNS)", () => {
  const blocked = [
    "http://127.0.0.1/api/v2/clients",
    "http://169.254.169.254/latest/meta-data", // cloud metadata
    "http://10.0.0.5",
    "http://192.168.1.1",
    "http://172.16.9.9",
    "http://100.64.0.1", // CGNAT
    "http://[::1]", // IPv6 loopback
    "http://[::ffff:127.0.0.1]", // IPv4-mapped loopback
    "http://0.0.0.0",
  ];
  for (const url of blocked) {
    it(`blocks ${url}`, async () => {
      await expect(assertPublicHttpUrl(url)).rejects.toBeInstanceOf(SsrfError);
      expect(mockLookup).not.toHaveBeenCalled();
    });
  }

  it("allows a public literal IP", async () => {
    await expect(assertPublicHttpUrl("http://8.8.8.8/x")).resolves.toBeInstanceOf(
      URL,
    );
    expect(mockLookup).not.toHaveBeenCalled();
  });
});

describe("assertPublicHttpUrl — IPv6 numeric-form regression coverage", () => {
  const blocked = [
    "http://[0:0:0:0:0:0:0:1]", // uncompressed loopback — no "::" for a regex to match
    "http://[::127.0.0.1]", // IPv4-compatible (deprecated) loopback embed
    "http://[64:ff9b::7f00:1]", // NAT64 well-known prefix embedding 127.0.0.1
  ];
  for (const url of blocked) {
    it(`blocks ${url}`, async () => {
      await expect(assertPublicHttpUrl(url)).rejects.toBeInstanceOf(SsrfError);
      expect(mockLookup).not.toHaveBeenCalled();
    });
  }
});

describe("assertPublicHttpUrl — trailing-dot FQDN hostnames", () => {
  const blocked = [
    "http://localhost./",
    "http://metadata.google.internal./",
  ];
  for (const url of blocked) {
    it(`blocks ${url}`, async () => {
      await expect(assertPublicHttpUrl(url)).rejects.toBeInstanceOf(SsrfError);
      expect(mockLookup).not.toHaveBeenCalled();
    });
  }
});

describe("assertPublicHttpUrl — protocol + parse guards", () => {
  it("rejects non-http protocols", async () => {
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toBeInstanceOf(
      SsrfError,
    );
    await expect(assertPublicHttpUrl("gopher://x/")).rejects.toBeInstanceOf(
      SsrfError,
    );
  });

  it("rejects an unparseable URL", async () => {
    await expect(assertPublicHttpUrl("not a url")).rejects.toBeInstanceOf(
      SsrfError,
    );
  });
});

describe("assertPublicHttpUrl — hostname resolution", () => {
  it("blocks a host that resolves to a private address", async () => {
    mockLookup.mockResolvedValue([{ address: "10.1.2.3", family: 4 }]);
    await expect(
      assertPublicHttpUrl("https://api.funnelleasing.com/api/v2/clients"),
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("blocks a host with a mixed public/private DNS answer", async () => {
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "169.254.169.254", family: 4 },
    ]);
    await expect(
      assertPublicHttpUrl("https://evil.example.com"),
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("allows a host that resolves to a public address", async () => {
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(
      assertPublicHttpUrl("https://api.funnelleasing.com/api/v2/clients"),
    ).resolves.toBeInstanceOf(URL);
  });

  it("blocks when the host does not resolve", async () => {
    mockLookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(
      assertPublicHttpUrl("https://nope.invalid"),
    ).rejects.toBeInstanceOf(SsrfError);
  });
});

describe("safeFetchFollowingRedirects", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockLookup.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws SsrfError instead of following a redirect to a private target", async () => {
    // The guard for this hop never reaches DNS — 169.254.169.254 is a
    // literal-IP block, same as the assertPublicHttpUrl coverage above.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      safeFetchFollowingRedirects("https://example.com/"),
    ).rejects.toBeInstanceOf(SsrfError);
    // Only the initial hop should have been fetched — the disallowed
    // redirect target must never be requested.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows a redirect to an allowed public target and returns the final response", async () => {
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://final.example.com/" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await safeFetchFollowingRedirects("https://start.example.com/");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Every fetch call must force manual redirect handling — the caller
    // never gets to opt back into `redirect: "follow"`.
    for (const call of fetchMock.mock.calls) {
      expect(call[1]).toMatchObject({ redirect: "manual" });
    }
  });

  it("stops (without throwing) once the hop cap is reached", async () => {
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://start.example.com/" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await safeFetchFollowingRedirects(
      "https://start.example.com/",
      {},
      { maxHops: 2 },
    );
    expect(res.status).toBe(302); // gave up mid-redirect, same as the old hand-rolled loops
    expect(fetchMock).toHaveBeenCalledTimes(3); // hop 0, 1, 2
  });
});
