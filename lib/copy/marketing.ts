// ---------------------------------------------------------------------------
// Single source of truth for platform marketing copy. Every string on the
// public .com lives here so pricing tweaks or product rename stay to one
// file.
//
// Voice: professional, operator-to-operator, product-first. No named
// competitors. No named reference customers. Specifics and claims stay
// platform-generic.
// ---------------------------------------------------------------------------

export const MARKETING = {
  brand: {
    tagline: "Managed marketing for real estate operators",
  },
  home: {
    hero: {
      eyebrow: "For real estate operators",
      headline: "Marketing infrastructure that fills units.",
      subhead:
        "Replace your entire marketing stack with one managed platform. A custom site on your domain, live listings, identity pixel, AI chatbot, and follow-up that actually runs.",
      primaryCta: "Book a demo",
      primaryHref: "/onboarding",
      secondaryCta: "See it live",
      secondaryHref: "https://www.telegraphcommons.com",
      microProof: "Built for residential and commercial portfolios.",
    },
    liveExample: {
      eyebrow: "In production",
      headline: "See the platform running in production.",
      body:
        "Custom resident-facing site on the client's domain, live PMS listings, AI chatbot grounded in their property facts, identity pixel running, leads flowing into the operator portal. Click through both surfaces exactly as a prospective resident or a portfolio operator would.",
      siteLabel: "The resident-facing site",
      siteHref: "https://www.telegraphcommons.com",
      siteCaption:
        "A production student-housing deployment rendered on the client's domain, under fourteen days from intake.",
      portalLabel: "The operator portal",
      portalHref: "#product-tour",
      portalCaption:
        "The same operator dashboard we'd build you, populated with live tenant data.",
    },
    pains: [
      {
        title: "Agency reports show activity, not outcomes.",
        body:
          "Impressions go up. Leases stay flat. The quarterly PDF never explains why.",
      },
      {
        title: "Your chatbot is a glorified FAQ.",
        body:
          "It answers one question, forgets the visitor, and captures zero leads after hours.",
      },
      {
        title: "Most site visitors never identify themselves.",
        body:
          "You see the traffic. You can't see who. The prospects you wanted go dark.",
      },
    ],
    howItWorks: [
      {
        step: "01",
        title: "Twenty minute demo",
        body:
          "Bring your current marketing setup. We audit it live on the call.",
      },
      {
        step: "02",
        title: "Fixed scope, fixed fee",
        body:
          "Proposal within 24 hours. Build fee and monthly retainer, no surprises.",
      },
      {
        step: "03",
        title: "Live in two weeks",
        body:
          "Site, pixel, chatbot, SEO, and ads ship together. Your domain, our stack.",
      },
      {
        step: "04",
        title: "Earn the retainer every month",
        body:
          "Month to month after launch. If we don't move lease velocity, you cancel.",
      },
    ],
    modules: [
      {
        title: "Managed marketing site",
        body:
          "Custom-built on your domain. Fast, SEO-ready, updated by live listing sync.",
      },
      {
        title: "PMS listing sync",
        body:
          "Every unit on your site matches the source of truth within the hour.",
      },
      {
        title: "Identity graph pixel",
        body:
          "Put names and emails on a significant share of your anonymous site traffic.",
      },
      {
        title: "AI chatbot",
        body:
          "Fires in five seconds, captures leads around the clock, hands hot ones to your team.",
      },
      {
        title: "Google and Meta ads",
        body:
          "Geo-fenced campaigns, pixel retargeting, creative refreshed weekly.",
      },
      {
        title: "SEO plus AEO",
        body:
          "Rank in Google. Get named in ChatGPT. Per-location and per-neighborhood pages.",
      },
      {
        title: "Creative studio",
        body:
          "On-demand ad creative. 48 hour turnaround. No retainers, no templates.",
      },
      {
        title: "Lead capture and CRM",
        body:
          "Forms, exit intent, chat, all flowing into one pipeline with automated nurture.",
      },
      {
        title: "Referral program",
        body:
          "Native referral tracking for current residents or tenants. Track, pay out, repeat.",
      },
    ],
    proof: {
      heading: "A product, not a retainer.",
      body:
        "Every customer logs into the same platform. Same modules, same dashboards, same weekly report. What changes is the brand, the listings, and the playbook.",
    },
    final: {
      heading: "Twenty minutes on a call. Two weeks to live.",
      body:
        "We show you exactly what your marketing could look like, on your domain, by the end of the month.",
      primaryCta: "Book a demo",
      primaryHref: "/onboarding",
    },
  },

} as const;

export type MarketingCopy = typeof MARKETING;
