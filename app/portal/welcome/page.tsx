import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Sparkles,
  MessageSquare,
  Radar,
  Calendar,
  Link2,
} from "lucide-react";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { FEATURE_CATALOG, type FeatureKey } from "@/lib/billing/features";
import { PageHeader } from "@/components/admin/page-header";
import { applyGoLive } from "@/lib/billing/go-live-trial";
import { formatChargeDate } from "@/lib/billing/trial-quote";

// ---------------------------------------------------------------------------
// /portal/welcome — first-run landing for a freshly-trialing user.
//
// Norman feedback (2026-06-02): "Start free trial" dropped users
// directly into /portal, which for a brand-new tenant is mostly empty
// states. Operators got no signal about what just happened (a trial
// started!), what they got (which modules are live), or what to do next
// (connect AppFolio, add a property photo, book a walkthrough). This
// page answers all three questions before the dashboard takes over.
//
// Renders when:
//   - The org is TRIALING (post-start-trial transition)
//   - The query is reached via /portal?welcome=1 → middleware (or the
//     wizard's router.push) rewrites to this URL
//   - The user hasn't dismissed it yet (cookie-based; not stored on the
//     org because re-trial scenarios should surface the welcome again)
//
// On dismiss → /portal. On "Book a walkthrough" → opens the Cal.com
// modal via BookDemoLink. On "Connect AppFolio" → /portal/connect (the
// canonical get-connected spine).
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Welcome to LeaseStack",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const INK = "var(--color-foreground)";
const MUTED = "var(--color-muted-foreground)";
const BORDER = "var(--color-border)";
const ACCENT = "var(--color-primary)";

export default async function PortalWelcomePage() {
  const scope = await requireScope();
  const org = await prisma.organization
    .findUnique({
      where: { id: scope.orgId },
      select: {
        name: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        moduleWebsite: true,
        bringYourOwnSite: true,
        trialStartedAt: true,
        trialEndsAt: true,
        ...(Object.fromEntries(
          FEATURE_CATALOG.map((f) => [f.key, true]),
        ) as Record<FeatureKey, true>),
        properties: {
          where: { lifecycle: { in: ["IMPORTED", "ACTIVE"] } },
          take: 1,
          select: { id: true, name: true },
        },
      },
    })
    .catch(() => null);

  if (!org) redirect("/portal");

  // The 14-day clock starts at go-live (same source the layout banner uses),
  // so only show a countdown once live; before that, show the setup deadline.
  const trial =
    org.subscriptionStatus === "TRIALING"
      ? await applyGoLive(scope.orgId).catch((err: unknown) => {
          console.error("[portal/welcome] applyGoLive failed:", err);
          return null;
        })
      : null;
  const live = trial?.goLiveAt != null;
  const trialEndsAt = trial?.trialEndsAt ?? org.trialEndsAt;
  const trialDaysLeft =
    live && trialEndsAt
      ? Math.max(
          0,
          Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        )
      : null;
  const setupDeadline =
    !live && org.subscriptionStatus === "TRIALING" && trialEndsAt
      ? formatChargeDate(trialEndsAt)
      : null;

  const activeModules = FEATURE_CATALOG.filter((f) => org[f.key]).map((f) => ({
    key: f.key,
    label: f.name,
  }));

  const hasSite = org.moduleWebsite && !org.bringYourOwnSite;
  const firstProperty = org.properties[0] ?? null;

  return (
    <div className="max-w-[800px] mx-auto px-4 md:px-8 py-12 md:py-16">
      <PageHeader
        eyebrow="Welcome to LeaseStack"
        title={<>{org.name}, you&rsquo;re in.</>}
        description={
          live
            ? "Your workspace is live and your free trial is running. Here\u2019s what just happened and where to go next."
            : "Your workspace is set up. Your 14-day trial starts when your chatbot, pixel, or AppFolio produces data. Here\u2019s where to go next."
        }
      />

      {/* Trial status strip */}
      {trialDaysLeft != null ? (
        <section
          className="mb-6 rounded-[2px] flex items-center gap-3"
          style={{
            padding: "14px 16px",
            border: `1px solid ${BORDER}`,
            backgroundColor: "var(--color-accent)",
          }}
        >
          <Clock
            className="w-4 h-4 shrink-0"
            strokeWidth={1.75}
            style={{ color: ACCENT }}
            aria-hidden="true"
          />
          <span
            style={{
              color: INK,
              fontFamily: "var(--font-sans)",
              fontSize: "13.5px",
              fontWeight: 600,
              letterSpacing: "-0.008em",
            }}
          >
            {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left in your
            free trial
          </span>
          <span
            className="ml-auto"
            style={{
              color: MUTED,
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            $0 today
          </span>
        </section>
      ) : setupDeadline ? (
        <section
          className="mb-6 rounded-[2px] flex items-center gap-3"
          style={{
            padding: "14px 16px",
            border: `1px solid ${BORDER}`,
            backgroundColor: "var(--color-accent)",
          }}
        >
          <Clock
            className="w-4 h-4 shrink-0"
            strokeWidth={1.75}
            style={{ color: ACCENT }}
            aria-hidden="true"
          />
          <span
            style={{
              color: INK,
              fontFamily: "var(--font-sans)",
              fontSize: "13.5px",
              fontWeight: 600,
              letterSpacing: "-0.008em",
            }}
          >
            Your trial starts when you go live. Set up by {setupDeadline}.
          </span>
        </section>
      ) : null}

      {/* What's live */}
      <section className="mb-8">
        <p
          style={{
            color: INK,
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Activated for you
        </p>
        <ul className="mt-3 space-y-1.5">
          {activeModules.length === 0 ? (
            <li
              style={{
                color: MUTED,
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
              }}
            >
              Core platform is on. Pick modules to test from{" "}
              <Link
                href="/portal/marketplace"
                style={{ color: ACCENT, textDecoration: "underline" }}
              >
                the marketplace
              </Link>
              .
            </li>
          ) : (
            activeModules.map((m) => (
              <li
                key={m.key}
                className="flex items-center gap-2"
                style={{
                  color: INK,
                  fontFamily: "var(--font-sans)",
                  fontSize: "13.5px",
                  fontWeight: 500,
                }}
              >
                <CheckCircle2
                  className="w-4 h-4 shrink-0"
                  strokeWidth={1.5}
                  style={{ color: "var(--color-success)" }}
                  aria-hidden="true"
                />
                {m.label}
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Next steps */}
      <section>
        <p
          className="mb-3"
          style={{
            color: INK,
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Next steps
        </p>

        <div className="space-y-2.5">
          <NextStepLink
            href={firstProperty ? `/portal/properties/${firstProperty.id}` : "/portal/properties"}
            icon={Building2}
            label={
              firstProperty
                ? `Open your property: ${firstProperty.name}`
                : "Add your first property"
            }
            description="Where AppFolio sync, your chatbot and pixel, and reporting all start."
          />
          <NextStepLink
            href="/portal/connect"
            icon={Link2}
            label="Connect AppFolio (or your PMS)"
            description="Pulls residents, leases, and listings every hour. Skip if you've already connected."
          />
          {hasSite ? (
            <NextStepLink
              href="/portal/site-builder"
              icon={Sparkles}
              label="Build your marketing site"
              description="A per-property site goes live as soon as you pick a style and add basics."
            />
          ) : (
            <>
              <NextStepLink
                href="/portal/chatbot"
                icon={MessageSquare}
                label="Install your chatbot"
                description="Answers prospects around the clock and turns conversations into leads."
              />
              <NextStepLink
                href="/portal/connect"
                icon={Radar}
                label="Install the visitor pixel"
                description="Identifies who is visiting your site so you can follow up."
              />
            </>
          )}
          <NextStepLink
            href={process.env.NEXT_PUBLIC_CAL_BOOK_URL || "/book-demo"}
            icon={Calendar}
            label="Book a walkthrough"
            description="Our team walks you through what's most valuable for your portfolio."
            external
          />
        </div>
      </section>

      <footer className="mt-10">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5"
          style={{
            color: MUTED,
            fontFamily: "var(--font-mono)",
            fontSize: "11.5px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Skip to dashboard
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
        </Link>
      </footer>
    </div>
  );
}

function NextStepLink({
  href,
  icon: Icon,
  label,
  description,
  external,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  description: string;
  external?: boolean;
}) {
  const inner = (
    <span className="flex items-start gap-3 p-4 rounded-[2px] border transition-colors hover:bg-secondary"
      style={{ borderColor: BORDER, backgroundColor: "var(--color-card)" }}
    >
      <Icon
        className="w-4.5 h-4.5 shrink-0 mt-0.5"
        strokeWidth={1.75}
      />
      <span className="flex-1 min-w-0">
        <span
          className="block"
          style={{
            color: INK,
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: 600,
            letterSpacing: "-0.008em",
          }}
        >
          {label}
        </span>
        <span
          className="mt-0.5 block"
          style={{
            color: MUTED,
            fontFamily: "var(--font-sans)",
            fontSize: "12.5px",
            lineHeight: 1.45,
          }}
        >
          {description}
        </span>
      </span>
      <ArrowRight
        className="w-4 h-4 shrink-0 mt-1"
        strokeWidth={1.75}
        style={{ color: MUTED }}
        aria-hidden="true"
      />
    </span>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return <Link href={href}>{inner}</Link>;
}
