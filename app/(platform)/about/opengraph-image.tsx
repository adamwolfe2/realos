import { buildOgImage, ogSize, ogContentType } from "@/lib/og-image";

export const runtime = "edge";
export const alt = "About Wholesail — Wholesale Distribution Automation";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OGImage() {
  return buildOgImage({
    eyebrow: "About Wholesail",
    headline: ["We build the infrastructure", "independent distributors never had."],
    subline: "Custom AI-powered ordering portals. Live in under 2 weeks.",
  });
}
