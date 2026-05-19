import {
  Bot,
  Eye,
  TrendingUp,
  BarChart3,
  Globe,
  Star,
  Share2,
  Brush,
  Sparkles,
  Users,
  Mail,
  Send,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Modules — visual grid of every module the user could turn on.
//
// We deliberately keep this static + dependency-free (no marketplace
// catalog import) because the homepage is a tight overview, not a
// marketplace browser. Detail lives at /pricing and /portal/marketplace.
// ---------------------------------------------------------------------------

type ModuleCard = {
  icon: LucideIcon;
  name: string;
  copy: string;
  tier: string;
};

const MODULES: ModuleCard[] = [
  {
    icon: Globe,
    name: "Marketing site",
    copy: "Per-property site with live AppFolio listings, lead capture, and tour booking.",
    tier: "Foundation",
  },
  {
    icon: Bot,
    name: "AI leasing chatbot",
    copy: "Trained on your property data. Books tours, captures leads, syncs to your CRM.",
    tier: "Foundation",
  },
  {
    icon: Users,
    name: "Lead capture",
    copy: "Forms, public ingest API, and inbox routing — every lead sourced and deduped.",
    tier: "Foundation",
  },
  {
    icon: Star,
    name: "Reputation monitoring",
    copy: "Google, Reddit, Yelp, and the open web in one inbox per property.",
    tier: "Foundation",
  },
  {
    icon: Eye,
    name: "Visitor pixel",
    copy: "Identify anonymous prospects on your site — name, email, employer, intent score.",
    tier: "Growth",
  },
  {
    icon: BarChart3,
    name: "Ads campaign builder",
    copy: "Google and Meta campaigns launched from the platform. Spend tied back to leases.",
    tier: "Growth",
  },
  {
    icon: TrendingUp,
    name: "SEO + AI discovery",
    copy: "Neighborhood pages built to rank in Google AND get cited by ChatGPT, Claude, Perplexity.",
    tier: "Growth",
  },
  {
    icon: Brush,
    name: "Creative studio",
    copy: "On-brand static and motion creative for ads, social, and email — 48-hour turnaround.",
    tier: "Growth",
  },
  {
    icon: Mail,
    name: "Email nurture",
    copy: "Drip campaigns for leads, no-shows, and renewals. Personalized by property and unit.",
    tier: "Scale",
  },
  {
    icon: Send,
    name: "Outbound email",
    copy: "Cold outbound to ICP lists with domain warmup and deliverability monitoring.",
    tier: "Scale",
  },
  {
    icon: Share2,
    name: "Resident referrals",
    copy: "Per-property trackable links. Every referred lead attributed back to source.",
    tier: "Scale",
  },
  {
    icon: Sparkles,
    name: "Embeddable popups",
    copy: "Exit-intent, scroll-depth, and time-on-page popups for any external site.",
    tier: "Add-on",
  },
];

export function LandingModules() {
  return (
    <section
      style={{
        backgroundColor: "#0B1220",
        color: "#FFFFFF",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-24 md:py-32">
        <div className="max-w-2xl mb-16 md:mb-20">
          <p
            className="eyebrow mb-4"
            style={{ color: "#60A5FA" }}
          >
            Inside the platform
          </p>
          <h2
            style={{
              color: "#FFFFFF",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(32px, 4.5vw, 48px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.022em",
            }}
          >
            Every module you can turn on.
          </h2>
          <p
            className="mt-5"
            style={{
              color: "#94A3B8",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.55,
            }}
          >
            Each module activates with one click. Free during trial. Pick
            only what you need.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px"
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.name}
                style={{
                  backgroundColor: "#0B1220",
                  padding: "28px 28px 28px",
                }}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="inline-flex items-center justify-center rounded-lg"
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: "rgba(96,165,250,0.12)",
                      color: "#60A5FA",
                    }}
                  >
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <span
                    style={{
                      color: "#94A3B8",
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      fontWeight: 500,
                    }}
                  >
                    {m.tier}
                  </span>
                </div>
                <h3
                  className="mt-5"
                  style={{
                    color: "#FFFFFF",
                    fontFamily: "var(--font-sans)",
                    fontSize: "17px",
                    fontWeight: 600,
                    letterSpacing: "-0.008em",
                    lineHeight: 1.3,
                  }}
                >
                  {m.name}
                </h3>
                <p
                  className="mt-2"
                  style={{
                    color: "#94A3B8",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    lineHeight: 1.55,
                  }}
                >
                  {m.copy}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
