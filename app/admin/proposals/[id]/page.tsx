import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ProposalStatus } from "@prisma/client";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import type { BadgeTone } from "@/lib/format";
import { Composer } from "../_components/composer";
import { normalizeTimeline } from "@/lib/proposals/types";

export const metadata: Metadata = { title: "Proposal" };
export const dynamic = "force-dynamic";

function statusTone(s: ProposalStatus): BadgeTone {
  switch (s) {
    case ProposalStatus.ACCEPTED:
      return "success";
    case ProposalStatus.SENT:
    case ProposalStatus.VIEWED:
      return "warning";
    case ProposalStatus.DECLINED:
    case ProposalStatus.CANCELED:
      return "danger";
    case ProposalStatus.EXPIRED:
      return "muted";
    case ProposalStatus.DRAFT:
    default:
      return "info";
  }
}

function statusLabel(s: ProposalStatus): string {
  switch (s) {
    case ProposalStatus.ACCEPTED:
      return "Accepted";
    case ProposalStatus.SENT:
      return "Sent";
    case ProposalStatus.VIEWED:
      return "Viewed";
    case ProposalStatus.DECLINED:
      return "Declined";
    case ProposalStatus.CANCELED:
      return "Canceled";
    case ProposalStatus.EXPIRED:
      return "Expired";
    case ProposalStatus.DRAFT:
    default:
      return "Draft";
  }
}

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAgency();
  const { id } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      acceptance: true,
      createdBy: { select: { id: true, email: true } },
      shareTokens: {
        where: { revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!proposal) notFound();

  let catalog: Awaited<
    ReturnType<typeof prisma.proposalCatalogItem.findMany>
  > = [];
  try {
    const mod = await import("@/lib/proposals/catalog");
    if (typeof mod.getCatalog === "function") {
      catalog = await mod.getCatalog();
    } else {
      catalog = await prisma.proposalCatalogItem.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      });
    }
  } catch {
    catalog = await prisma.proposalCatalogItem.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
  }

  const isAccepted = proposal.status === ProposalStatus.ACCEPTED;
  const isSent =
    proposal.status === ProposalStatus.SENT ||
    proposal.status === ProposalStatus.VIEWED;

  const shareToken = proposal.shareTokens[0]?.token ?? null;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://www.leasestack.co";
  const shareUrl = shareToken
    ? `${baseUrl.replace(/\/+$/, "")}/proposal/${shareToken}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/admin/proposals"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <span aria-hidden="true">←</span> Proposals
          </Link>
        }
        title={
          <span className="inline-flex items-baseline gap-3">
            <span className="font-mono text-[18px] md:text-[22px] text-muted-foreground">
              {proposal.number}
            </span>
            <span>{proposal.prospectCompany || proposal.prospectName}</span>
          </span>
        }
        description={
          <span className="flex items-center gap-2 flex-wrap">
            <StatusBadge tone={statusTone(proposal.status)}>
              {statusLabel(proposal.status)}
            </StatusBadge>
            <span className="text-muted-foreground/60">·</span>
            <span>
              {proposal.prospectName}, {proposal.prospectEmail || "(no email)"}
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span>Created {formatDistanceToNow(proposal.createdAt)} ago</span>
            {proposal.createdBy ? (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span>by {proposal.createdBy.email}</span>
              </>
            ) : null}
          </span>
        }
      />

      {isAccepted && proposal.acceptance ? (
        <SectionCard
          label="Acceptance"
          description="Read-only — this proposal has been paid and provisioned."
        >
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Accepted at</dt>
              <dd>
                {new Date(proposal.acceptance.acceptedAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Amount paid</dt>
              <dd className="tabular-nums">
                {(proposal.acceptance.amountPaidCents / 100).toLocaleString(
                  "en-US",
                  { style: "currency", currency: proposal.currency },
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Stripe customer</dt>
              <dd className="font-mono text-xs">
                {proposal.acceptance.stripeCustomerId}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Subscription</dt>
              <dd className="font-mono text-xs">
                {proposal.acceptance.stripeSubscriptionId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Provisioned org</dt>
              <dd>
                {proposal.acceptance.provisionedOrgId ? (
                  <Link
                    href={`/admin/clients/${proposal.acceptance.provisionedOrgId}`}
                    className="text-primary hover:underline"
                  >
                    Open client →
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Pending</span>
                )}
              </dd>
            </div>
          </dl>
        </SectionCard>
      ) : null}

      <Composer
        proposal={{
          id: proposal.id,
          number: proposal.number,
          status: proposal.status,
          cadence: proposal.cadence,
          trialDays: proposal.trialDays,
          currency: proposal.currency,
          publicMessage: proposal.publicMessage,
          internalNotes: proposal.internalNotes,
          expiresAt: proposal.expiresAt
            ? proposal.expiresAt.toISOString()
            : null,
          discountAmountCents: proposal.discountAmountCents,
          discountReason: proposal.discountReason,
          discountScope: proposal.discountScope,
          prospectName: proposal.prospectName,
          prospectEmail: proposal.prospectEmail,
          prospectCompany: proposal.prospectCompany,
          scopeNarrative: proposal.scopeNarrative,
          // Normalize on read so a stored shape drift (or a hand-rolled
          // JSON edit) doesn't crash the composer.
          timeline: normalizeTimeline(proposal.timeline),
        }}
        lines={proposal.lineItems.map((l) => ({
          id: l.id,
          kind: l.kind,
          catalogItemId: l.catalogItemId,
          label: l.label,
          description: l.description,
          unitPriceCents: l.unitPriceCents,
          quantity: l.quantity,
          recurring: l.recurring,
          sortOrder: l.sortOrder,
        }))}
        catalog={catalog.map((c) => ({
          id: c.id,
          slug: c.slug,
          kind: c.kind,
          label: c.label,
          description: c.description,
          defaultPriceCents: c.defaultPriceCents,
          cadence: c.cadence,
          active: c.active,
          sortOrder: c.sortOrder,
        }))}
        shareUrl={shareUrl}
        readOnly={isAccepted}
        softReadOnly={isSent}
      />
    </div>
  );
}
