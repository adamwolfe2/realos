import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { BillingPortalButton } from "./billing-portal-button";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const scope = await requireScope();
  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: {
      id: true,
      name: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      subscriptionStartedAt: true,
      mrrCents: true,
      buildFeePaidCents: true,
      adSpendMarkupPct: true,
      stripeCustomerId: true,
    },
  });
  if (!org) return null;

  const adCampaigns = await prisma.adCampaign.findMany({
    where: { orgId: scope.orgId, status: "active" },
    select: { spendToDateCents: true, monthlyBudgetCents: true },
  });
  const monthlySpendCents = adCampaigns.reduce(
    (sum, c) => sum + (c.monthlyBudgetCents ?? 0),
    0
  );

  // Detect a brand-new tenant where Stripe billing hasn't been wired up
  // yet. We previously rendered "—" across every tile which read as
  // unfinished software; instead now show an honest "Onboarding"
  // headline + a single "Provisioning" tile that points at the right
  // CTA. Once Stripe customer is connected the full grid renders.
  const billingNotConfigured =
    !org.stripeCustomerId &&
    !org.subscriptionTier &&
    !org.subscriptionStatus;

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Billing"
        description="Subscription tier, monthly recurring modules, ad spend, and Stripe portal access."
      />

      {billingNotConfigured ? (
        <section className="rounded-lg border border-dashed border-border bg-muted/30 p-6">
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Onboarding
          </p>
          <h2 className="text-base font-semibold mt-1.5">
            Billing isn&apos;t set up yet
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg leading-snug">
            Your account manager will provision your Stripe subscription
            when your contract is countersigned. Once that&apos;s done,
            this page will show your tier, retainer, and let you manage
            payment methods directly from Stripe.
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Questions?{" "}
            <a
              href="mailto:hello@leasestack.co"
              className="font-semibold text-foreground underline underline-offset-2 hover:no-underline"
            >
              hello@leasestack.co
            </a>
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Mini
            label="Subscription tier"
            value={humanizeEnum(org.subscriptionTier)}
          />
          <Mini
            label="Subscription status"
            value={humanizeEnum(org.subscriptionStatus)}
            tone={
              org.subscriptionStatus === "ACTIVE"
                ? "success"
                : org.subscriptionStatus === "PAST_DUE"
                  ? "warn"
                  : undefined
            }
          />
          <Mini
            label="Subscription started"
            value={
              org.subscriptionStartedAt
                ? new Date(org.subscriptionStartedAt).toLocaleDateString()
                : "Not yet"
            }
          />
          <Mini
            label="Monthly retainer"
            value={
              org.mrrCents != null && org.mrrCents > 0
                ? `$${Math.round(org.mrrCents / 100).toLocaleString()}`
                : "—"
            }
          />
          <Mini
            label="One-time build fee paid"
            value={
              org.buildFeePaidCents != null && org.buildFeePaidCents > 0
                ? `$${Math.round(org.buildFeePaidCents / 100).toLocaleString()}`
                : "—"
            }
          />
          <Mini
            label="Ad spend markup"
            value={`${Math.round((org.adSpendMarkupPct ?? 0) * 100)}%`}
          />
          <Mini
            label="Active ad budgets"
            value={`$${Math.round(monthlySpendCents / 100).toLocaleString()}/mo`}
          />
          <Mini
            label="Stripe customer"
            value={org.stripeCustomerId ? "Connected" : "Not connected"}
            tone={org.stripeCustomerId ? "success" : undefined}
          />
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold">Stripe Customer Portal</h2>
        <p className="text-sm text-muted-foreground">
          Update payment method, download invoices, and view upcoming charges.
          Opens a Stripe-hosted session and returns to this page when you're done.
        </p>
        <BillingPortalButton />
      </section>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warn";
}) {
  const valueClass =
    tone === "success"
      ? "text-primary"
      : tone === "warn"
        ? "text-amber-700"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs tracking-widest uppercase text-muted-foreground">
        {label}
      </div>
      <div className={`text-sm font-semibold mt-2 truncate ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

// Pretty-print a Prisma enum value (ACTIVE → Active, PAST_DUE → Past due).
// Falls back to a clean dash placeholder when null/undefined so the tile
// never renders an empty string.
function humanizeEnum(v: string | null | undefined): string {
  if (!v) return "—";
  return v
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
