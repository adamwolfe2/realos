import { describe, it, expect } from "vitest";
import { intakeFormSchema } from "@/lib/site-engine/intake-schema";

// ---------------------------------------------------------------------------
// Regression: the site-request intake schema accepted `blobUrl: z.string().url()`
// on an UNAUTHENTICATED endpoint. z.string().url() accepts `javascript:...`
// and arbitrary hosts, which enabled:
//   - readable SSRF: the build-packet route fetches each blobUrl and returns
//     the bytes to an agency admin (e.g. http://169.254.169.254/... metadata).
//   - stored XSS: the admin console renders blobUrl as <a href>/<img src>.
// blobUrl is now pinned to the Vercel PUBLIC blob host, where all legitimate
// uploads land.
// ---------------------------------------------------------------------------

const BASE = {
  submittedByName: "Alex Agent",
  submittedByEmail: "alex@example.com",
  brandName: "Telegraph Commons",
};

function withAsset(blobUrl: string) {
  return intakeFormSchema.safeParse({
    ...BASE,
    assets: [
      {
        type: "LOGO",
        filename: "logo.png",
        mimeType: "image/png",
        size: 1234,
        blobUrl,
      },
    ],
  });
}

describe("intake schema blobUrl host pinning", () => {
  it("accepts a real Vercel public-blob URL", () => {
    const r = withAsset(
      "https://abc123store.public.blob.vercel-storage.com/site-engine/intake/x/logo.png",
    );
    expect(r.success).toBe(true);
  });

  it("rejects internal / cloud-metadata SSRF targets", () => {
    for (const url of [
      "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
      "http://127.0.0.1:8080/",
      "http://10.0.0.5/internal",
      "https://attacker.example.com/exfil",
      "http://evil.com/pixel.png",
    ]) {
      expect(withAsset(url).success, url).toBe(false);
    }
  });

  it("rejects non-https and non-http schemes (javascript:/data:)", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "http://xyz.public.blob.vercel-storage.com/x.png", // right host, wrong scheme
    ]) {
      expect(withAsset(url).success, url).toBe(false);
    }
  });

  it("rejects look-alike hosts that merely contain the blob domain", () => {
    for (const url of [
      "https://public.blob.vercel-storage.com.attacker.com/x.png",
      "https://evil-public.blob.vercel-storage.com.example.com/x.png",
    ]) {
      expect(withAsset(url).success, url).toBe(false);
    }
  });
});
