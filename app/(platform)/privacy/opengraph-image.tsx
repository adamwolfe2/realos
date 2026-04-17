import { buildOgImage, ogSize, ogContentType } from "@/lib/og-image";

export const runtime = "edge";
export const alt = "Privacy Policy | Wholesail";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OGImage() {
  return buildOgImage({
    eyebrow: "Legal",
    headline: "Privacy Policy",
    subline: "How Wholesail collects, uses, and protects your information.",
  });
}
