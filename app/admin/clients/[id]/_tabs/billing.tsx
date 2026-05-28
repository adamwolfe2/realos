import { SectionCard } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { humanSubscriptionTier, type BadgeTone } from "@/lib/format";
import { formatDistanceToNow, format } from "date-fns";
import type { SubscriptionStatus, SubscriptionTier } from "@prisma/client";

type Billing = {
  stripeCustomerId: string | null;
  subscriptionTier: SubscriptionTier | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionStartedAt: Date | null;
  trialEndsAt: Date | null;
  mrrCents: number | null;
  buildFeePaidCents: number | null;
  adSpendMarkupPct: number | null;
};

const STATUS_TONES: Record<SubscriptionStatus, BadgeTone> = {
  ACTIVE: "success",
  TRIALING: "info",
  PAST_DUE: "danger",
  CANCELED: "neutral",
  PAUSED: "warning",
};

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function humanStatus(s: SubscriptionStatus | null): string {
  if (!s) return "Unknown";
  return s
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

export function BillingClientTab({ billing }: { billing: Billing }) {
  const status = billing.subscriptionStatus;
  const isDunning = status === "PAST_DUE";
  const trialActive =
    status === "TRIALING" &&
    billing.trialEndsAt &&
    billing.trialEndsAt.getTime() > Date.now();

  return (
    <div className="space-y-5">
      <SectionCard
        label="Subscription"
        description="Source of truth is Stripe; values here mirror the latest webhook."
      >
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs font-medium text-muted-foreground">
              Status
            </dt>
            <dd>
              {status ? (
                <StatusBadge tone={STATUS_TONES[status]}>
                  {humanStatus(status)}
                </StatusBadge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs font-medium text-muted-foreground">Tier</dt>
            <dd className="text-foreground">
              {billing.subscriptionTier
                ? humanSubscriptionTier(billing.subscriptionTier)
                : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs font-medium text-muted-foreground">
              MRR
            </dt>
            <dd className="text-foreground tabular-nums">
              {formatCents(billing.mrrCents)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs font-medium text-muted-foreground">
              Build fee paid
            </dt>
            <dd className="text-foreground tabular-nums">
              {formatCents(billing.buildFeePaidCents)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs font-medium text-muted-foreground">
              Subscription started
            </dt>
            <dd className="text-foreground">
              {billing.subscriptionStartedAt
                ? format(billing.subscriptionStartedAt, "MMM d, yyyy")
                : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs font-medium text-muted-foreground">
              Ad spend markup
            </dt>
            <dd className="text-foreground tabular-nums">
              {billing.adSpendMarkupPct != null
                ? `${(billing.adSpendMarkupPct * 100).toFixed(1)}%`
                : "—"}
            </dd>
          </div>
        </dl>

        {trialActive && billing.trialEndsAt ? (
          <p className="mt-4 text-xs text-muted-foreground rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
            Trial ends{" "}
            {formatDistanceToNow(billing.trialEndsAt, { addSuffix: true })}.
          </p>
        ) : null}

        {isDunning ? (
          <p className="mt-4 text-xs rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
            Subscription is past due. Stripe is retrying the invoice on its
            standard dunning cadence. Confirm the customer&apos;s card status
            from the Stripe dashboard.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        label="Stripe customer"
        description="Open in Stripe to view invoices, payment methods, and dunning history."
      >
        {billing.stripeCustomerId ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <code className="font-mono text-[12px] text-muted-foreground break-all">
              {billing.stripeCustomerId}
            </code>
            <a
              href={`https://dashboard.stripe.com/customers/${billing.stripeCustomerId}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary text-xs font-medium hover:underline shrink-0"
            >
              View in Stripe →
            </a>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No Stripe customer linked yet. A customer is created automatically
            on the first paid checkout.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
