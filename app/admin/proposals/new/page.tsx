import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProposalCadence, ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { generateProposalNumber } from "@/lib/proposals/numbering";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { ProspectPicker } from "./prospect-picker";

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
  const scope = await requireAgency();

  // Brief → Proposal bridge. If query params arrived, auto-seed the
  // draft with the prospect identity from the brief and redirect into
  // the composer. Operator never sees the picker — they go straight to
  // a draft pre-populated with the prospect's name, company, and a
  // public-message stub that links back to the brief.
  //
  // Implementation note: we insert the Proposal row directly here
  // instead of calling the createDraft() server action, because Next 16
  // disallows revalidatePath() during render-time server components.
  // createDraft() is the right tool for client-triggered insertion;
  // here we own the agency check + prisma insert inline.
  const params = (await searchParams) ?? {};
  const domain = first(params.domain).trim();
  const brand = first(params.brand).trim();
  const email = first(params.email).trim();
  const briefToken = first(params.briefToken).trim();

  if (domain || brand || briefToken) {
    const company = brand || domain || "Untitled prospect";
    const prospectName = brand || "Decision-maker";
    const publicMessage = briefToken
      ? `Following up on the AI search visibility brief we shared earlier. The full report and verbatim AI engine responses live at https://www.leasestack.co/brief/${briefToken}.\n\nThis proposal scopes the implementation work to close the gap.`
      : null;
    const internalNotes = briefToken
      ? `Built from /brief/${briefToken}`
      : null;

    // Retry once on a P2002 race against the proposal-number unique
    // index — same shape as createDraft() uses.
    let proposalId: string | null = null;
    for (let attempt = 0; attempt < 2 && !proposalId; attempt++) {
      const number = await generateProposalNumber();
      try {
        const created = await prisma.proposal.create({
          data: {
            number,
            status: ProposalStatus.DRAFT,
            prospectName,
            prospectEmail: email,
            prospectCompany: company,
            cadence: ProposalCadence.MONTHLY,
            createdById: scope.userId,
            publicMessage,
            internalNotes,
          },
          select: { id: true },
        });
        proposalId = created.id;
      } catch (err) {
        const isUnique =
          err != null &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "P2002";
        if (!isUnique) throw err;
        // race on number — loop again with a fresh allocation
      }
    }
    if (!proposalId) {
      throw new Error("Failed to allocate proposal number after retry");
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
