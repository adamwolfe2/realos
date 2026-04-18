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
      secondaryCta: "See pricing",
      secondaryHref: "/pricing",
      microProof: "Built for residential and commercial portfolios.",
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
        title: "Thirty minute demo",
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
      heading: "Book a demo.",
      body:
        "Thirty minutes on a call. We show you exactly what your marketing could look like in two weeks.",
      primaryCta: "Start now",
      primaryHref: "/onboarding",
    },
  },

  pricing: {
    eyebrow: "Pricing",
    heading: "Simple monthly retainers. No long contracts.",
    subhead:
      "Every engagement starts with a 30 minute demo and a fixed-fee build proposal. Retainer starts the month you go live.",
    tiers: [
      {
        name: "Starter",
        price: 1497,
        cadence: "/mo",
        tagline: "Single property, simple stack.",
        features: [
          "Managed marketing site on your domain",
          "Listing sync from your PMS",
          "Lead capture forms and exit intent",
          "Basic CRM and email sequences",
          "One property",
          "Email support",
        ],
        ctaHref: "/onboarding?tier=starter",
        highlight: false as boolean,
      },
      {
        name: "Growth",
        price: 2997,
        cadence: "/mo",
        tagline: "Most chosen. For single-site operators ready to compound.",
        features: [
          "Everything in Starter",
          "Identity graph pixel",
          "AI chatbot with lead capture",
          "Automated nurture sequences",
          "SEO and AEO landing pages",
          "Up to three properties",
          "Slack support",
        ],
        ctaHref: "/onboarding?tier=growth",
        highlight: true as boolean,
      },
      {
        name: "Scale",
        price: 4997,
        cadence: "/mo",
        tagline: "Portfolios, paid ads, dedicated creative.",
        features: [
          "Everything in Growth",
          "Google and Meta ads (plus 15% of spend)",
          "Creative studio, unlimited requests",
          "Referral program",
          "Dedicated account manager",
          "Unlimited properties",
          "Weekly strategy calls",
        ],
        ctaHref: "/onboarding?tier=scale",
        highlight: false as boolean,
      },
    ],
    addons: [
      {
        name: "Outbound cold email",
        price: 697,
        cadence: "/mo",
        body:
          "Managed inbox purchase, warming, and outbound campaigns to external lists.",
      },
      {
        name: "SEO premium",
        price: 597,
        cadence: "/mo",
        body:
          "Adds per-location SEO, AEO monitoring, quarterly content drops.",
      },
    ],
    buildFees: {
      heading: "Build fees",
      body:
        "$5,000 for a single-property launch. $10,000 to $15,000 for multi-property portfolios or complex integrations. We scope this on the consultation call. No surprises.",
    },
    faq: [
      {
        q: "What's the contract length?",
        a:
          "Month to month after your build. Cancel anytime with 30 days notice.",
      },
      {
        q: "Do you take over our existing property-management system?",
        a:
          "Never. We integrate with your PMS via API or embed feed. You stay in full control of leases, applications, and payments.",
      },
      {
        q: "Can we keep our current website?",
        a:
          "Yes. Bring-your-own-site mode installs just the pixel and chatbot. Most operators eventually migrate to the managed site once they see what's possible.",
      },
      {
        q: "What about ad spend?",
        a:
          "Ad spend is separate and runs through your accounts. We manage campaigns at 15% of spend. No minimums.",
      },
      {
        q: "Do you do one-time projects?",
        a:
          "No. Every engagement is a build plus monthly retainer. The platform needs the retainer to keep the pixel, chatbot, and automations alive.",
      },
      {
        q: "What if we already use another vendor?",
        a:
          "Bring them. We've run alongside existing vendors during the first month. Most operators eventually consolidate once our dashboards make the comparison obvious.",
      },
    ],
  },
} as const;

export type MarketingCopy = typeof MARKETING;
