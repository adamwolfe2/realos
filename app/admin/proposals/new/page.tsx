import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { ProspectPicker } from "./prospect-picker";

export const metadata: Metadata = { title: "New proposal" };
export const dynamic = "force-dynamic";

export default async function NewProposalPage() {
  await requireAgency();

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/admin/proposals"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <span aria-hidden="true">←</span> Proposals
          </Link>
        }
        title="New proposal"
        description="Pick a prospect to start drafting. You can also start blank and fill the prospect in later."
      />

      <SectionCard
        label="Pick a prospect"
        description="Search across intake submissions, leads, and existing client orgs."
      >
        <ProspectPicker />
      </SectionCard>
    </div>
  );
}
