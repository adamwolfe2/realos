import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { PageHeader } from "@/components/admin/page-header";
import { getSiteUrl } from "@/lib/brand";
import { KIT_SECTIONS } from "@/lib/sales-kit/kit";
import { KitClient } from "./kit-client";

// Inherits the admin layout's Clerk gate + `robots: noindex`.
export const metadata: Metadata = { title: "Sales kit" };

export const dynamic = "force-dynamic";

/** Rep slug for link attribution. Falls back to a neutral tag. */
function repSlug(firstName: string | null | undefined): string {
  const cleaned = (firstName ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned || "team";
}

export default async function SalesKitPage() {
  // currentUser() is unreliable in some RSC contexts (see lib/tenancy/scope.ts)
  // — the ref tag is cosmetic, so degrade to "team" rather than fail the page.
  const user = await currentUser().catch(() => null);
  const calUrl = process.env.NEXT_PUBLIC_CAL_BOOK_URL?.trim() || null;

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <PageHeader
        eyebrow="Sales"
        title="Sales kit"
        description="Every link worth sending, with the words to send it."
      />
      <KitClient
        sections={KIT_SECTIONS}
        siteUrl={getSiteUrl()}
        repRef={repSlug(user?.firstName)}
        calUrl={calUrl}
      />
    </div>
  );
}
