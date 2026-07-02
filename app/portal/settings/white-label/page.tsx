import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { WhiteLabelFormClient } from "./form-client";

export const metadata: Metadata = { title: "White-label" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/settings/white-label
//
// Operator-facing settings surface for the $499/mo White-label add-on.
//
// Two states:
//   * whiteLabel === false  → upsell card linking to the marketplace
//                             and billing surfaces. We deliberately do
//                             NOT render the form fields here so a
//                             non-paying operator can't stage branding
//                             that quietly applies the moment the
//                             add-on lands on their subscription.
//   * whiteLabel === true   → editable form (brand name + logo upload
//                             + primary color). Saving goes through
//                             lib/actions/white-label.ts which re-checks
//                             the entitlement server-side.
//
// Activation is wired through Stripe — see app/api/webhooks/stripe/route.ts.
// ---------------------------------------------------------------------------

export default async function WhiteLabelPage() {
  const scope = await requireScope();

  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: {
      whiteLabel: true,
      whiteLabelBrandName: true,
      whiteLabelLogoUrl: true,
      whiteLabelPrimaryColor: true,
      name: true,
    },
  });

  if (!org) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/portal/settings"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <span aria-hidden="true">←</span> Settings
          </Link>
        }
        title="White-label workspace"
        description="Strip LeaseStack branding from the portal, your public tenant marketing site, and outbound email display name + footer. Your sending mailbox stays the same for deliverability."
      />

      {org.whiteLabel ? (
        <WhiteLabelFormClient
          initial={{
            brandName: org.whiteLabelBrandName,
            logoUrl: org.whiteLabelLogoUrl,
            primaryColor: org.whiteLabelPrimaryColor,
          }}
          orgName={org.name}
        />
      ) : (
        <UpsellCard />
      )}
    </div>
  );
}

function UpsellCard() {
  return (
    <SectionCard
      label="Activate the white-label add-on"
      description="$499/mo. Removes the LeaseStack mark from every operator-facing surface in your workspace."
    >
      <div className="space-y-4">
        <ul className="space-y-2 text-[13.5px] text-muted-foreground">
          <li className="flex items-start gap-2">
            <Sparkles className="size-4 mt-0.5 shrink-0 text-foreground" />
            <span>Portal chrome carries your wordmark and accent color.</span>
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="size-4 mt-0.5 shrink-0 text-foreground" />
            <span>
              Public tenant marketing site renders without the LeaseStack
              favicon or attribution.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="size-4 mt-0.5 shrink-0 text-foreground" />
            <span>
              Outbound emails show your brand in the From name and footer
              (sending mailbox stays as ours for DKIM/DMARC alignment).
            </span>
          </li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            href="/portal/marketplace?focus=white-label"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium rounded bg-foreground text-background hover:opacity-90 transition"
          >
            Open the marketplace
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="/portal/billing"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium rounded border border-border text-foreground hover:bg-muted transition"
          >
            Manage billing
          </Link>
        </div>
      </div>
    </SectionCard>
  );
}
