import { buildOgImage, ogSize, ogContentType } from "@/lib/og-image";
import { BRAND_NAME } from "@/lib/brand";

export const runtime = "edge";
export const alt = `About ${BRAND_NAME}, managed marketing for real estate operators`;
export const size = ogSize;
export const contentType = ogContentType;

export default async function OGImage() {
  return buildOgImage({
    eyebrow: `About ${BRAND_NAME}`,
    headline: [
      "We build the infrastructure",
      "independent operators never had.",
    ],
    subline: "Managed marketing for real estate. Live in two weeks.",
  });
}
