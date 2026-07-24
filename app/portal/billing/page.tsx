import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { BillingPortalButton } from "./billing-portal-button";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";
import { ADDONS, TIERS } from "@/lib/billing/plans";
import { getEffectiveFeatureCatalog } from "@/lib/billing/feature-prices";
import type Stripe from "stripe";
import { TrialActivationCard } from "./trial-activation-card";
// WebsiteBuildCard import removed per Norman bug #106 — replaced with a
// quiet link to /portal/marketplace. The card is still available for
// other surfaces (marketplace, onboarding) where the full pitch belongs.
import { WebsiteBuildTracker } from "./website-build-tracker";

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
      chosenTier: true,
      trialStartedAt: true,
      trialEndsAt: true,
      mrrCents: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
      buildFeePaidCents: true,
      adSpendMarkupPct: true,
      stripeCustomerId: true,
      // Feature flags drive per-feature conversion pricing — the operator pays
      // for exactly what's enabled, not a tier default.
      moduleChatbot: true,
      modulePixel: true,
      moduleSEO: true,
      moduleReputation: true,
      moduleGoogleAds: true,
      moduleMetaAds: true,
      modulePopups: true,
      moduleCreativeStudio: true,
      moduleEmail: true,
      moduleOutboundEmail: true,
      moduleReferrals: true,
      moduleInsights: true,
      moduleMarketIntelligence: true,
      moduleAttribution: true,
      _count: { select: { properties: true } },
    },
  });
  if (!org) return null;

  // Per-feature conversion pricing: which features are enabled + the effective
  // (admin-set) per-property monthly total for exactly those features.
  const { features: effectiveFeatures, basePlatformCents } =
    await getEffectiveFeatureCatalog();
  const enabledFeatureKeys = effectiveFeatures
    .filter((f) => (org as Record<string, unknown>)[f.key] === true)
    .map((f) => f.key as string);
  const activationPerPropertyCents =
    basePlatformCents +
    effectiveFeatures
      .filter((f) => enabledFeatureKeys.includes(f.key))
      .reduce((acc, f) => acc + f.monthlyCents, 0);

  // Property count drives trial-activation pricing. Match the
  // dashboard's "marketable" filter so we don't quote a price that
  // counts excluded sub-records.
  const marketablePropertyCount = await prisma.property
    .count({
      where: { orgId: scope.orgId, lifecycle: { in: ["IMPORTED", "ACTIVE"] } },
    })
    .catch(() => 0);

  // Active website-build requests for this org. Shown above the
  // billing details so customers can see fulfillment status at a
  // glance. Cancelled / live builds drop out of the list once 30
  // days have passed since the terminal status was reached.
  const websiteBuilds = await prisma.websiteBuildRequest.findMany({
    where: { orgId: scope.orgId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      amountPaidCents: true,
      calBookingUrl: true,
      calBookedAt: true,
      kickoffCallAt: true,
      launchedAt: true,
      createdAt: true,
      property: { select: { name: true } },
    },
  });

  const adCampaigns = await prisma.adCampaign.findMany({
    where: { orgId: scope.orgId, status: "active" },
    select: { spendToDateCents: true, monthlyBudgetCents: true },
  });
  const monthlySpendCents = adCampaigns.reduce(
    (sum, c) => sum + (c.monthlyBudgetCents ?? 0),
    0
  );

  // Pull live subscription details from Stripe so the billing page can
  // show the actual line items (tier + add-ons + property quantity),
  // not just our cached MRR figure. Failure is non-fatal — if Stripe
  // is down or unreachable we degrade gracefully to the Prisma view.
  let activeSubscription: Stripe.Subscription | null = null;
  if (org.stripeCustomerId && isStripeConfigured()) {
    try {
      const subs = await getStripeClient().subscriptions.list({
        customer: org.stripeCustomerId,
        status: "all",
        limit: 5,
        expand: ["data.items.data.price.product"],
      });
      activeSubscription =
        subs.data.find((s) =>
          ["active", "trialing", "past_due", "paused"].includes(s.status),
        ) ?? null;
    } catch {
      // Non-fatal; surface cached fields only.
    }
  }

  // Build a flat list of line items from the active subscription so the
  // UI shows the operator exactly what they're paying for. Reads the
  // catalog for nice labels rather than Stripe's raw product names.
  type LineItem = {
    label: string;
    detail: string;
    monthlyCents: number;
    quantity: number;
    isAddon: boolean;
    isMetered: boolean;
  };
  const lineItems: LineItem[] = [];
  if (activeSubscription) {
    for (const item of activeSubscription.items.data) {
      const price = item.price;
      const productMeta =
        typeof price.product === "object" && !("deleted" in price.product)
          ? (price.product as Stripe.Product).metadata
          : null;
      const productLookupKey = productMeta?.lookup_key ?? "";
      const isMetered = price.recurring?.usage_type === "metered";
      // Tier match? Match against the graduated price lookup keys too
      // since live customers run on those after the catalog refactor.
      const tier = TIERS.find(
        (t) =>
          t.monthly.lookupKey === price.lookup_key ||
          t.annual.lookupKey === price.lookup_key ||
          t.graduatedMonthly.lookupKey === price.lookup_key ||
          t.graduatedAnnual.lookupKey === price.lookup_key,
      );
      if (tier) {
        const isGraduated =
          price.lookup_key === tier.graduatedMonthly.lookupKey ||
          price.lookup_key === tier.graduatedAnnual.lookupKey;
        const qty = item.quantity ?? 1;
        const cycleLabel =
          price.recurring?.interval === "year" ? "annual" : "monthly";
        lineItems.push({
          label: isGraduated
            ? `${tier.productName} (${qty} ${qty === 1 ? "property" : "properties"})`
            : tier.productName,
          detail: `${cycleLabel}${isGraduated ? " · graduated pricing" : ""}`,
          // For tiered prices `price.unit_amount` is null (Stripe
          // computes from the tiers array). Best-effort show the
          // headline base rate × quantity here, knowing the real
          // invoice will reflect bracket discounts. Falls back to 0
          // for tiered until we fetch the upcoming invoice.
          monthlyCents:
            (price.unit_amount ?? 0) *
            qty *
            (price.recurring?.interval === "year" ? 1 / 12 : 1),
          quantity: qty,
          isAddon: false,
          isMetered: false,
        });
        continue;
      }
      const addon = ADDONS.find(
        (a) =>
          a.priceLookupKey === price.lookup_key ||
          a.productLookupKey === productLookupKey,
      );
      if (addon) {
        lineItems.push({
          label: addon.uiLabel,
          detail: isMetered
            ? `metered · $${(addon.unitAmountCents / 100).toFixed(2)} per ${addon.meteredUnit}`
            : addon.billingMode === "recurring_monthly"
              ? "monthly"
              : "one-time",
          monthlyCents: isMetered
            ? 0
            : (price.unit_amount ?? 0) * (item.quantity ?? 1),
          quantity: item.quantity ?? 1,
          isAddon: true,
          isMetered,
        });
      }
    }
  }
  const subscriptionMrrCents = lineItems
    .filter((l) => !l.isMetered)
    .reduce((sum, l) => sum + Math.round(l.monthlyCents), 0);

  // Detect a brand-new tenant where Stripe billing hasn't been wired up
  // yet. We previously rendered "—" across every tile which read as
  // unfinished software; instead now show an honest "Onboarding"
  // headline + a single "Provisioning" tile that points at the right
  // CTA. Once Stripe customer is connected the full grid renders.
  const billingNotConfigured =
    !org.stripeCustomerId &&
    !org.subscriptionTier &&
    !org.subscriptionStatus;

  // Partially-provisioned: tier picked (e.g. SCALE) but subscription
  // status not yet set by the AM. Surface this honestly above the
  // tile grid so the operator doesn't read "—" tiles as bugs.
  const billingStatusPending =
    !billingNotConfigured &&
    !!org.subscriptionTier &&
    !org.subscriptionStatus;

  const isTrialing = org.subscriptionStatus === "TRIALING";
  const cancelAtPeriodEnd = org.cancelAtPeriodEnd ?? false;
  const currentPeriodEnd = org.currentPeriodEnd ?? null;
  const trialEndsAt = org.trialEndsAt ?? null;
  const tierForActivation =
    (org.chosenTier ?? org.subscriptionTier ?? null) as
      | "STARTER"
      | "GROWTH"
      | "SCALE"
      | "CUSTOM"
      | null;
  const activationTierId =
    tierForActivation === "STARTER"
      ? "starter"
      : tierForActivation === "GROWTH"
        ? "growth"
        : tierForActivation === "SCALE"
          ? "scale"
          : null;

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Billing"
        // Norman bug #106: the previous description read like a SaaS
        // feature checklist ("Subscription tier, monthly recurring
        // modules, ad spend, and Stripe portal access"). Reworded to
        // be calmer and more institutional — the page is for review,
        // not selling.
        description="Review your current plan, line items, and Stripe portal access."
      />

      {/* Trial activation card. Renders when subscriptionStatus is
          TRIALING. Shows the property count, the tier the trial
          unlocked, and a CTA that creates a Stripe Checkout session
          for the actual conversion. */}
      {isTrialing && activationTierId ? (
        <TrialActivationCard
          tierId={activationTierId}
          propertyCount={Math.max(1, marketablePropertyCount)}
          trialEndsAt={trialEndsAt}
          selectedModuleKeys={enabledFeatureKeys}
          perPropertyCents={activationPerPropertyCents}
        />
      ) : null}

      {/* Only render when the subscription is still active-ish (pending
          cancel, not yet deleted), cancelAtPeriodEnd is set, and the period
          end is actually in the future. After handleSubscriptionDeleted fires
          the org's cancelAtPeriodEnd resets to false, so a churned org never
          shows this banner. */}
      {cancelAtPeriodEnd &&
      currentPeriodEnd !== null &&
      org.subscriptionStatus !== "CANCELED" &&
      org.subscriptionStatus !== null &&
      new Date(currentPeriodEnd) > new Date() ? (
        <section className="ls-alert ls-alert-warning">
          <p className="text-sm font-semibold text-foreground">
            Cancels on{" "}
            {new Date(currentPeriodEnd).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Your subscription will not renew after this date. Reactivate from the Stripe portal if this was unintended.
          </p>
        </section>
      ) : null}

      {billingStatusPending ? (
        <section className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5">
          <p className="text-[10px] tracking-widest uppercase font-semibold text-primary">
            Action needed
          </p>
          <h2 className="text-base font-semibold mt-1.5">
            Subscription status pending
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg leading-snug">
            Your{" "}
            <span className="font-semibold text-foreground">
              {humanizeEnum(org.subscriptionTier)}
            </span>{" "}
            tier is provisioned, but your account manager still needs to
            activate the Stripe subscription before billing runs. The
            portal is fully usable in the meantime.
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Contact{" "}
            <a
              href="mailto:team@leasestack.co"
              className="font-semibold text-foreground underline underline-offset-2 hover:no-underline"
            >
              team@leasestack.co
            </a>{" "}
            to activate.
          </p>
        </section>
      ) : null}

      {billingNotConfigured ? (
        <section className="rounded-xl border border-dashed border-border bg-muted/30 p-6">
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
              href="mailto:team@leasestack.co"
              className="font-semibold text-foreground underline underline-offset-2 hover:no-underline"
            >
              team@leasestack.co
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
            value={
              org.subscriptionStatus
                ? humanizeEnum(org.subscriptionStatus)
                : "Pending"
            }
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

      {/* Line items panel — shows exactly what's on the subscription
          (tier, additional properties, add-ons) so the operator never
          has to dig into Stripe to see what they're paying for. */}
      {lineItems.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Subscription line items</h2>
            <p className="text-xs text-muted-foreground">
              ${(subscriptionMrrCents / 100).toLocaleString()} /mo
            </p>
          </div>
          <ul className="divide-y divide-border">
            {lineItems.map((item, idx) => (
              <li
                key={idx}
                className="py-2.5 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.label}
                    {item.isAddon ? (
                      <span className="ml-2 text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
                        add-on
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-foreground shrink-0">
                  {item.isMetered
                    ? "usage-based"
                    : `$${(Math.round(item.monthlyCents) / 100).toLocaleString()}`}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Metered items (pixel overage, email overage, ad spend
            management) are billed in arrears against your actual usage —
            not included in the recurring subtotal above.
          </p>
        </section>
      ) : null}

      {/* Customer's live website build queue. Hidden when they
          haven't purchased one yet. */}
      {websiteBuilds.length > 0 ? (
        <WebsiteBuildTracker
          builds={websiteBuilds.map((b) => ({
            id: b.id,
            status: b.status as
              | "requested"
              | "scoping"
              | "designing"
              | "building"
              | "review"
              | "live"
              | "cancelled",
            amountPaidCents: b.amountPaidCents,
            calBookingUrl: b.calBookingUrl,
            calBookedAt: b.calBookedAt?.toISOString() ?? null,
            kickoffCallAt: b.kickoffCallAt?.toISOString() ?? null,
            launchedAt: b.launchedAt?.toISOString() ?? null,
            createdAt: b.createdAt.toISOString(),
            propertyName: b.property?.name ?? null,
          }))}
        />
      ) : null}

      {/* Website-build offer — Norman bug #106: the previous dual-card
          tiered upsell with gold crown badges and "Recommended"
          ribbons read as salesy on a billing page that's meant for
          plan review. Replaced with a single quiet line that links
          out to the marketplace for the full offer. The card itself
          (components/billing/website-build-card.tsx) is unchanged for
          surfaces where the full pitch belongs (marketplace,
          onboarding). */}
      <section className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Want a custom marketing site built for you?
          </p>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            One-time engagement covering design, build, and launch on
            your domain. Detailed scope + pricing on the marketplace.
          </p>
        </div>
        <a
          href="/portal/marketplace"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          View options
          <span aria-hidden="true">→</span>
        </a>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
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
        ? "text-[#8a6d00]"
        : "text-foreground";
  return (
    <div className="ls-card p-4">
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
