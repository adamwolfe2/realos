// Pure pixel-install detector (Slice 1b). No server imports so it is unit-
// testable in isolation and reusable by the check-install route.

export type PixelInstallStatus =
  | "DETECTED_OK"
  | "DETECTED_WRONG_PIXEL"
  | "NOT_DETECTED";

export interface PixelInstallDetection {
  ok: boolean;
  status: PixelInstallStatus;
  message: string;
  detectedPixelId: string | null;
}

/**
 * Look for a `cdn.idpixel.app` `idp-analytics-<id>` loader script tag in the
 * page HTML. When `expectedPixelId` is known, distinguishes a correct install
 * from a wrong-pixel paste error.
 */
export function detectPixelInstall(
  html: string,
  expectedPixelId: string | null,
): PixelInstallDetection {
  const scriptMatch = html.match(
    /<script[^>]+src=["'][^"']*cdn\.idpixel\.app\/[^"']*idp-analytics-([a-z0-9]+)[^"']*["'][^>]*>/i,
  );
  if (!scriptMatch) {
    return {
      ok: false,
      status: "NOT_DETECTED",
      message:
        "The pixel snippet isn't on this page. Paste your Cursive install snippet into your site's <head> (or the equivalent CMS hook), then re-check.",
      detectedPixelId: null,
    };
  }
  const detectedPixelId = scriptMatch[1] ?? null;
  if (expectedPixelId && detectedPixelId && detectedPixelId !== expectedPixelId) {
    return {
      ok: false,
      status: "DETECTED_WRONG_PIXEL",
      message: `A pixel snippet is on the site but for a different pixel ("${detectedPixelId}"). Replace it with your snippet (pixel "${expectedPixelId}").`,
      detectedPixelId,
    };
  }
  return {
    ok: true,
    status: "DETECTED_OK",
    message:
      "Pixel snippet detected and live on your site. Named visitors will appear in your portal within a few minutes of the first pageview.",
    detectedPixelId,
  };
}
