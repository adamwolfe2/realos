import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
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
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Sales kit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every link worth sending a prospect, with the words to send it. Copy,
          paste, move on.
        </p>
      </header>

      <KitClient
        sections={KIT_SECTIONS}
        siteUrl={getSiteUrl()}
        repRef={repSlug(user?.firstName)}
        calUrl={calUrl}
      />
    </div>
  );
}
