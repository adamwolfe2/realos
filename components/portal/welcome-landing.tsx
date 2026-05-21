import Link from "next/link";
import { ArrowRight, Layers, Plug, Sparkles } from "lucide-react";
import {
  groupModulesByCategory,
  type CatalogEntry,
} from "@/lib/marketplace/catalog";
import {
  WelcomeMarketplaceGrid,
  type WelcomeEntryVM,
} from "@/components/portal/welcome-marketplace-grid";

// ---------------------------------------------------------------------------
// WelcomeLanding — server component
//
// First-run replacement for the operator dashboard. Renders:
//   1. Title row: "Welcome to LeaseStack" + a short orienting sub-line that
//      points to the agency-supported angle when an agency is impersonating.
//   2. Three-step quick-start strip — Pick modules → Connect data sources →
//      Start capturing leads. Each is a sign-posted destination link, not a
//      checklist that can drift out of sync with reality (we don't persist
//      "completed" state; the user lands on the dashboard organically as
//      soon as they activate ANYTHING per first-run.ts).
//   3. The marketplace grid itself — same catalog, same activation endpoint.
//      Categories from groupModulesByCategory() so the visual order matches
//      /portal/marketplace exactly.
//
// Design tone: Apple-clean, single LeaseStack blue accent, generous
// whitespace, no rainbow status colors. No serif marketing voice — this is
// product chrome.
// ---------------------------------------------------------------------------

type Props = {
  orgName: string;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  /** True when an agency user is viewing a brand-new client via
   *  impersonation. Sub-line copy adapts so the agency operator sees
   *  "Get %name% set up" instead of "Get set up". */
  isImpersonating: boolean;
};

const SETUP_STEPS = [
  {
    id: "modules",
    icon: Layers,
    title: "Pick modules",
    description:
      "Activate the surfaces your team actually needs. Everything is free during your trial (excluding Pro add-ons).",
  },
  {
    id: "connect",
    icon: Plug,
    title: "Connect data sources",
    description:
      "Wire in AppFolio, GA4, Search Console, Google Ads, or Meta — whatever you already use.",
    href: "/portal/connect",
    hrefLabel: "Open Connect Hub",
  },
  {
    id: "capture",
    icon: Sparkles,
    title: "Start capturing leads",
    description:
      "Drop in the visitor pixel, share your forms, or import historic leads via CSV.",
    href: "/portal/leads",
    hrefLabel: "Open Leads",
  },
] as const;

// Map catalog icon names to the string keys the client grid resolves.
// Keep in sync with components/portal/marketplace/page.tsx#iconNameFor.
function iconNameFor(key: string): string {
  switch (key) {
    case "modulePixel":
      return "Eye";
    case "moduleChatbot":
      return "Bot";
    case "moduleSEO":
      return "TrendingUp";
    case "moduleGoogleAds":
    case "moduleMetaAds":
      return "BarChart3";
    case "moduleEmail":
      return "Mail";
    case "moduleOutboundEmail":
      return "Send";
    case "moduleCreativeStudio":
      return "Brush";
    case "moduleReferrals":
      return "Share2";
    case "moduleWebsite":
      return "Globe";
    case "moduleLeadCapture":
      return "Users";
    case "reputation-monitoring":
      return "Star";
    case "ls_addon_reputation_pro":
    case "ls_addon_white_label":
      return "Sparkles";
    default:
      return "Sparkles";
  }
}

function toVm(m: CatalogEntry): WelcomeEntryVM {
  return {
    key: m.key,
    kind: m.kind,
    slug: m.slug,
    name: m.name,
    tagline: m.tagline,
    monthlyPriceCents: m.monthlyPriceCents,
    setupHref: m.setupHref,
    popular: m.popular ?? false,
    setupEffort: m.setupEffort ?? null,
    iconName: iconNameFor(m.key),
  };
}

export function WelcomeLanding({
  orgName,
  isTrialing,
  trialDaysLeft,
  isImpersonating,
}: Props) {
  const grouped = groupModulesByCategory();

  // Flatten to a single ordered list for the welcome surface. The
  // dedicated /portal/marketplace page keeps the category headers; the
  // first-run grid intentionally drops them — first-run users don't yet
  // know what "Acquisition vs Engagement" means and the headers add noise
  // when the goal is "click one thing."
  const allModules = grouped.flatMap((g) => g.modules).map(toVm);

  const trialCopy = isTrialing
    ? trialDaysLeft != null && trialDaysLeft > 0
      ? `Everything is free for the next ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} (excluding Pro add-ons).`
      : "Everything is free during your trial (excluding Pro add-ons)."
    : "Activate any module — billed monthly, cancel anytime.";

  const subline = isImpersonating
    ? `Get ${orgName} set up. ${trialCopy}`
    : `Welcome${orgName ? ` to ${orgName}` : ""} on LeaseStack. ${trialCopy}`;

  return (
    <div className="space-y-10 ls-page-fade">
      {/* Header — generous whitespace, no PageHeader chrome so the welcome
          surface feels distinct from the rest of the portal. */}
      <header className="space-y-3 pt-2">
        <h1 className="text-[28px] md:text-[32px] font-semibold tracking-tight text-foreground leading-tight">
          Welcome to LeaseStack
        </h1>
        <p className="text-[15px] text-muted-foreground max-w-2xl leading-relaxed">
          {subline}
        </p>
      </header>

      {/* Three-step quick-start strip. Not a checklist — there's no
          persisted "completed" state. As soon as the user activates a
          module, connects a source, or captures a lead, the first-run
          signal flips and they land on the regular dashboard. */}
      <section
        aria-label="Quick start"
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        {SETUP_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const hasLink = "href" in step && !!step.href;
          return (
            <div
              key={step.id}
              className="ls-card relative p-5 flex flex-col gap-3 min-h-[148px]"
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg ring-1 ring-inset ring-border"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(37,99,235,0.10), rgba(37,99,235,0.04))",
                    color: "var(--primary, #2563EB)",
                  }}
                >
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                    Step {idx + 1}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
              {hasLink ? (
                <Link
                  href={step.href!}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:text-primary-dark transition-colors"
                >
                  {step.hrefLabel} <ArrowRight className="w-3 h-3" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
                  Choose modules below
                </span>
              )}
            </div>
          );
        })}
      </section>

      {/* Marketplace grid */}
      <section aria-label="Available modules" className="space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-foreground">
              Available modules
            </h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground max-w-xl">
              Each module is a standalone surface — turn one on and the rest of
              the portal lights up around it.
            </p>
          </div>
          <Link
            href="/portal/marketplace"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:text-primary-dark transition-colors"
          >
            See full marketplace <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <WelcomeMarketplaceGrid
          isTrialing={isTrialing}
          trialDaysLeft={trialDaysLeft}
          modules={allModules}
        />
      </section>
    </div>
  );
}
