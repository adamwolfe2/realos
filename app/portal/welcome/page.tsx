import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Sparkles,
  Calendar,
  Link2,
} from "lucide-react";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";

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
        trialStartedAt: true,
        trialEndsAt: true,
        moduleChatbot: true,
        modulePixel: true,
        moduleGoogleAds: true,
        moduleMetaAds: true,
        moduleSEO: true,
        moduleCreativeStudio: true,
        moduleReferrals: true,
        moduleEmail: true,
        moduleOutboundEmail: true,
        properties: {
          where: { lifecycle: { in: ["IMPORTED", "ACTIVE"] } },
          take: 1,
          select: { id: true, name: true },
        },
      },
    })
    .catch(() => null);

  if (!org) redirect("/portal");

  // Compute days remaining on the trial — null when no trial active.
  const trialDaysLeft = org.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (org.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  const activeModules: Array<{ key: string; label: string }> = [
    org.moduleChatbot && { key: "chatbot", label: "AI leasing chatbot" },
    org.modulePixel && { key: "pixel", label: "Visitor pixel" },
    org.moduleGoogleAds && { key: "google-ads", label: "Google Ads" },
    org.moduleMetaAds && { key: "meta-ads", label: "Meta Ads" },
    org.moduleSEO && { key: "seo", label: "SEO + AI discovery" },
    org.moduleCreativeStudio && { key: "creative", label: "Creative studio" },
    org.moduleReferrals && { key: "referrals", label: "Resident referrals" },
    org.moduleEmail && { key: "email", label: "Email" },
    org.moduleOutboundEmail && { key: "outbound", label: "Outbound email" },
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  const firstProperty = org.properties[0] ?? null;

  return (
    <div className="max-w-[800px] mx-auto px-4 md:px-8 py-12 md:py-16">
      <header className="mb-8">
        <p
          style={{
            color: ACCENT,
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Welcome to LeaseStack
        </p>
        <h1
          className="mt-2 leading-tight"
          style={{
            color: INK,
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 3.8vw, 38px)",
            fontWeight: 600,
            letterSpacing: "0",
          }}
        >
          {org.name}, you&rsquo;re in.
        </h1>
        <p
          className="mt-3 max-w-xl"
          style={{
            color: MUTED,
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            lineHeight: 1.6,
          }}
        >
          Your workspace is live and your free trial is running. Here&rsquo;s
          what just happened and where to go next.
        </p>
      </header>

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
            No card required
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
              Core platform is on — pick modules to test from{" "}
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
                ? `Open your property — ${firstProperty.name}`
                : "Add your first property"
            }
            description="Where AppFolio sync, marketing site, and reporting all start."
          />
          <NextStepLink
            href="/portal/connect"
            icon={Link2}
            label="Connect AppFolio (or your PMS)"
            description="Pulls residents, leases, and listings every hour. Skip if you've already connected."
          />
          <NextStepLink
            href="/portal/site-builder"
            icon={Sparkles}
            label="Build your marketing site"
            description="A per-property site goes live as soon as you pick a style and add basics."
          />
          <NextStepLink
            href={`mailto:team@leasestack.co?subject=Walkthrough%20for%20${encodeURIComponent(org.name)}`}
            icon={Calendar}
            label="Book a 30-min walkthrough"
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
