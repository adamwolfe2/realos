import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { collectBriefData } from "@/lib/brief/collect";

describe("lib/brief/collect rawFetch SSRF guard", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    for (const k of [
      "FIRECRAWL_API_KEY",
      "DATAFORSEO_LOGIN",
      "DATAFORSEO_PASSWORD",
    ]) {
      vi.stubEnv(k, "");
    }
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("refuses to fetch a private/metadata address and reports the error", async () => {
    const data = await collectBriefData({ domain: "169.254.169.254", prompts: [] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(data.firecrawl.ok).toBe(false);
    expect(data.firecrawl.error).toMatch(/raw fetch failed/);
  });

  it("does not follow a redirect to an internal host", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/admin" },
      }),
    );
    const data = await collectBriefData({ domain: "8.8.8.8", prompts: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
    expect(data.firecrawl.error).toMatch(/Redirect target is not allowed/);
  });
});
