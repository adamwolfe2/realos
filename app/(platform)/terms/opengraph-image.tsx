import { buildOgImage, ogSize, ogContentType } from "@/lib/og-image";

export const runtime = "edge";
export const alt = "Terms of Service | Wholesail";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OGImage() {
  return buildOgImage({
    eyebrow: "Legal",
    headline: "Terms of Service",
    subline: "Terms governing use of the Wholesail wholesale platform.",
  });
}
