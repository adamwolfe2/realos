import type { Metadata } from "next";
import { SeoSelectPage } from "@/components/portal/connect/seo-select-page";

// The account-picker server action runs the connect-time backfill in
// after(), which shares this function's duration budget.
export const maxDuration = 300;

export const metadata: Metadata = { title: "Choose a Search Console property" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string | string[] }>;
}) {
  const { propertyId } = await searchParams;
  return (
    <SeoSelectPage
      provider="GSC"
      propertyId={typeof propertyId === "string" && propertyId ? propertyId : null}
    />
  );
}
