import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
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

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="font-serif text-3xl font-bold">Billing</h1>
        <p className="text-sm opacity-60 mt-1">
          Subscription tier, monthly recurring modules, ad spend, and Stripe
          portal access.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Mini
          label="Subscription tier"
          value={org.subscriptionTier ?? "—"}
        />
        <Mini
          label="Subscription status"
          value={org.subscriptionStatus ?? "—"}
        />
        <Mini
          label="Subscription started"
          value={
            org.subscriptionStartedAt
              ? new Date(org.subscriptionStartedAt).toLocaleDateString()
              : "—"
          }
        />
        <Mini
          label="Monthly retainer"
          value={
            org.mrrCents != null
              ? `$${Math.round(org.mrrCents / 100).toLocaleString()}`
              : "—"
          }
        />
        <Mini
          label="One-time build fee paid"
          value={
            org.buildFeePaidCents != null
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
        />
      </section>

      <section className="border rounded-md p-5 space-y-3">
        <h2 className="font-serif text-lg font-bold">Stripe Customer Portal</h2>
        <p className="text-sm opacity-70">
          Update payment method, download invoices, and view upcoming charges.
          Opens a Stripe-hosted session and returns to this page when you're done.
        </p>
        <BillingPortalButton />
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-4">
      <div className="text-[10px] tracking-widest uppercase opacity-60">
        {label}
      </div>
      <div className="font-serif text-lg font-bold mt-2 truncate">{value}</div>
    </div>
  );
}
