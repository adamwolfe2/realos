import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAgency } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { ProspectPicker } from "./prospect-picker";
import { createDraft } from "../actions";

export const metadata: Metadata = { title: "New proposal" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    /** Auto-seed: prospect domain (used as company fallback). */
    domain?: string | string[];
    /** Auto-seed: brand / prospect name. */
    brand?: string | string[];
    /** Auto-seed: contact email. */
    email?: string | string[];
    /** Auto-seed: brief share token; surfaced in the public message
     *  so the prospect can re-open the brief from inside the proposal. */
    briefToken?: string | string[];
  }>;
};

function first(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

export default async function NewProposalPage({ searchParams }: PageProps) {
  await requireAgency();

  // Brief → Proposal bridge. If query params arrived, auto-seed the
  // draft with the prospect identity from the brief and redirect into
  // the composer. Operator never sees the picker — they go straight to
  // a draft pre-populated with the prospect's name, company, and a
  // public-message stub that links back to the brief.
  const params = (await searchParams) ?? {};
  const domain = first(params.domain).trim();
  const brand = first(params.brand).trim();
  const email = first(params.email).trim();
  const briefToken = first(params.briefToken).trim();

  if (domain || brand || briefToken) {
    const company = brand || domain || "Untitled prospect";
    const prospectName = brand || "Decision-maker";
    const { proposalId } = await createDraft({
      prospect: {
        name: prospectName,
        email,
        company,
      },
    });
    // If a brief is paired with this prospect, drop a link to the
    // brief in the internal notes so the operator can deep-link
    // back during composing. Best-effort write — failure here doesn't
    // block the redirect.
    if (briefToken) {
      try {
        const { prisma } = await import("@/lib/db");
        await prisma.proposal.update({
          where: { id: proposalId },
          data: {
            internalNotes: `Built from /brief/${briefToken}`,
            publicMessage: `Following up on the AI search visibility brief we shared earlier. The full report and verbatim AI engine responses live at https://www.leasestack.co/brief/${briefToken}.\n\nThis proposal scopes the implementation work to close the gap.`,
          },
        });
      } catch {
        /* non-fatal */
      }
    }
    redirect(`/admin/proposals/${proposalId}?edit=1`);
  }

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
