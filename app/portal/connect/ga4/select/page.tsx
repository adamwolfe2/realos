import type { Metadata } from "next";
import { SeoSelectPage } from "@/components/portal/connect/seo-select-page";

export const metadata: Metadata = { title: "Choose a Google Analytics property" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <SeoSelectPage provider="GA4" />;
}
