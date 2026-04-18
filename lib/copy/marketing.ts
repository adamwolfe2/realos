// ---------------------------------------------------------------------------
// Single source of truth for platform marketing copy. Every string on the
// public .com lives here so pricing tweaks or product rename stay to one
// file.
//
// Brand voice: direct, operator-to-operator. Short sentences. No em dashes.
// Use commas, colons, or periods.
// ---------------------------------------------------------------------------

export const MARKETING = {
  brand: {
    tagline: "Managed marketing for real estate operators",
  },
  home: {
    hero: {
      eyebrow: "For real estate operators",
      headline: "Marketing infrastructure that actually fills units.",
      subhead:
        "Stop paying $2,600 a month for ads that don't convert. Replace your entire marketing stack with one managed platform. Custom site on your domain, live listings, identity pixel, AI chatbot, and follow-up that actually runs.",
      primaryCta: "Book a demo",
      primaryHref: "/onboarding",
      secondaryCta: "See pricing",
      secondaryHref: "/pricing",
      microProof:
        "Built with Berkeley's Telegraph Commons. Expanding to multifamily and senior living now.",
    },
    pains: [
      {
        title: "Your agency reports activity, not outcomes.",
        body:
          "Impressions are up. Leases are flat. The quarterly PDF never explains why.",
      },
      {
        title: "Your chatbot is a glorified FAQ.",
        body:
          "It answers one question, forgets the visitor, captures zero leads at 2 a.m.",
      },
      {
        title: "95% of your site visitors are ghosts.",
        body:
          "You see traffic. You can't see who. The prospects you wanted went dark.",
      },
    ],
    howItWorks: [
      {
        step: "01",
        title: "30 minute demo",
        body:
          "Bring your current marketing invoice. We audit it line by line on the call.",
      },
      {
        step: "02",
        title: "Fixed scope, fixed fee",
        body:
          "Proposal within 24 hours. Build fee and monthly retainer with no surprises.",
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
        title: "AppFolio listing sync",
        body:
          "Every unit on your site matches the AppFolio truth within the hour.",
      },
      {
        title: "Identity graph pixel",
        body:
          "Put names and emails on 40 to 70 percent of your anonymous site visitors.",
      },
      {
        title: "AI chatbot",
        body:
          "Fires in five seconds, captures leads around the clock, hands hot ones to your team.",
      },
      {
        title: "Google and Meta ads",
        body:
          "Geo-fenced campaigns, pixel retargeting, creative swapped weekly. 15% of spend.",
      },
      {
        title: "SEO plus AEO",
        body:
          "Rank in Google. Get named in ChatGPT. Per-campus and per-neighborhood pages.",
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
        title: "Student referral tracking",
        body:
          "Native referral program for current residents. Track, pay out, repeat.",
      },
    ],
    proof: {
      heading: "Built with operators, for operators.",
      body:
        "We ship alongside real estate operators every day. Telegraph Commons at UC Berkeley was the pilot. Multifamily and senior living operators are live in build now.",
      caseStudy: {
        client: "Telegraph Commons",
        stat: "12 signed leases",
        window: "in the 30 days after launch",
        city: "Berkeley, California",
      },
    },
    comparison: {
      heading: "A Conversion Logix alternative that pays its own invoice.",
      body:
        "Conversion Logix is the default choice for operators who don't know there's an alternative. Same price. We ship software you log into instead of PDFs.",
      cta: "See the full comparison",
      href: "/compare/conversion-logix",
    },
    final: {
      heading: "Book a demo.",
      body:
        "30 minutes on Zoom. Bring the receipts. We show you what your marketing could look like in two weeks.",
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
          "AppFolio listing sync",
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
          "Student referral program",
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
          "Adds per-campus SEO, AEO monitoring, quarterly content drops.",
      },
    ],
    buildFees: {
      heading: "Build fees",
      body:
        "$5,000 for a single-property launch on AppFolio. $10,000 to $15,000 for multi-property portfolios or complex integrations. We scope this on the consultation call. No surprises.",
    },
    faq: [
      {
        q: "What's the contract length?",
        a:
          "Month to month after your build. Cancel anytime with 30 days notice. We earn the retainer every month by hitting your lease velocity targets.",
      },
      {
        q: "Do you take over our existing AppFolio account?",
        a:
          "Never. We integrate with your AppFolio via API (Plus plan) or the embed feed. You stay in full control of leases, applications, and payments.",
      },
      {
        q: "Can we keep our current website?",
        a:
          "Yes. Bring-your-own-site mode installs just the pixel and chatbot scripts. Most clients eventually migrate to the managed site once they see what's possible.",
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
        q: "What if I already use another agency?",
        a:
          "Bring them. We've run alongside existing agencies during the first month. Most clients eventually consolidate because our dashboards make comparison obvious.",
      },
    ],
  },

  compareCLX: {
    eyebrow: "Conversion Logix alternative",
    heading: "Same price. Software instead of PDFs.",
    subhead:
      "Conversion Logix is the incumbent for a reason, they got to operators first. We're the alternative you didn't know existed.",
    rows: [
      { feature: "Monthly cost", clx: "$2,600 and up", ours: "From $1,497" },
      { feature: "Chatbot", clx: "Scripted FAQ", ours: "AI with real lead capture" },
      { feature: "Pixel", clx: "None", ours: "Cursive identity graph" },
      { feature: "Listings sync", clx: "Manual updates", ours: "AppFolio API, live" },
      { feature: "Creative turnaround", clx: "Two to three weeks", ours: "48 hours" },
      {
        feature: "Reporting",
        clx: "Quarterly PDF reports",
        ours: "Live dashboard across all properties",
      },
      { feature: "Ad creative", clx: "Template library", ours: "Custom on demand" },
      { feature: "Student referrals", clx: "Not supported", ours: "Native module" },
      { feature: "AppFolio integration", clx: "No", ours: "Yes" },
      { feature: "Contract length", clx: "12 months minimum", ours: "Month to month" },
    ],
    footerCopy:
      "We'll never say anything untrue about Conversion Logix. The comparison above reflects their publicly listed features and our v1 capabilities. If you're on a CLX contract right now, bring the invoice to the demo. Most clients find the switch saves them money in month one.",
  },
} as const;

export type MarketingCopy = typeof MARKETING;
