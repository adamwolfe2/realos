import { describe, it, expect, vi, beforeEach } from "vitest";

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

const { assertPublicHttpUrl, SsrfError } = await import(
  "@/lib/security/ssrf-guard"
);

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
