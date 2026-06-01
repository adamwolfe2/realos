// ---------------------------------------------------------------------------
// Single source of truth for platform marketing copy.
//
// Voice: operator-credible, direct, quietly confident. Outcome-first.
// Specific over general. Operator-to-operator. No buzzwords. No em dashes.
// No named competitors. Never claim to replace property managers or leasing
// staff. LeaseStack does NOT manage or produce creative — it tracks ad
// performance.
// ---------------------------------------------------------------------------

export const MARKETING = {
  brand: {
    tagline: "Leasing intelligence for real estate operators.",
  },
  home: {
    // Norman brief v2 (2026-06-01) — repositioning pass.
    // Eyebrow: "Leasing intelligence" → "Data intelligence" (SD2).
    // Headline: dropped "Replace your marketing stack" (G5 — passive
    //   displacement is a byproduct, not the message).
    // Sub-header: dropped feature list, leading with centralization +
    //   month-to-month flexibility instead (H3).
    // Primary CTA: "Start a free pilot" → "Request pilot" (G1).
    hero: {
      eyebrow: "Data intelligence platform",
      headline: "Take control of your online leasing.",
      highlight: "online leasing.",
      subhead:
        "Centralize your tech stack on one platform with one login. Month-to-month contract flexibility.",
      primaryCta: "Request pilot",
      primaryHref: "/onboarding",
      secondaryCta: "See it on a real property",
      secondaryHref: "/demo",
      microProof: "Live on a real student-housing lease-up. Built for multifamily, senior living, and commercial.",
    },
    comparison: {
      eyebrow: "Why operators switch",
      headline: "Your current setup vs. full visibility.",
      body:
        "Your digital infrastructure is your second most valuable asset after the physical real estate itself — online brand, reputation, website function, and traffic-to-lease conversion. Today it lives across five vendors and a spreadsheet. LeaseStack platform brings it under one dashboard.",
      leftLabel: "Your current setup",
      rightLabel: "Full visibility with LeaseStack platform",
      rows: [
        {
          old: "Six vendors. Six invoices. A spreadsheet to tie it together.",
          new: "One dashboard tying ad spend to signed leases.",
        },
        {
          old: "Quarterly decks counting impressions, clicks, and reach.",
          new: "Weekly insights counting leads, tours, and signed leases.",
        },
        {
          old: "Most of your website traffic stays anonymous forever.",
          new: "Names and emails on the visitors your forms missed.",
        },
        {
          old: "A chatbot that answers one question, then forgets you.",
          new: "An AI assistant trained on your property that books tours at 2am.",
        },
        {
          old: "Reputation buried across Google, Reddit, Yelp, and the open web.",
          new: "Every public mention in one feed, sentiment-classified, one-click reply.",
        },
      ],
    },
    liveExample: {
      eyebrow: "Live proof",
      headline: "Running on a real property right now.",
      body:
        "Click through the resident site and the operator dashboard. Both are live. Listings sync hourly. The chatbot answers from real unit data.",
      siteLabel: "Resident-facing site",
      siteHref: "/demo",
      siteCaption:
        "A live student-housing deployment on the client's domain. Fourteen days from intake to live.",
      portalLabel: "Operator dashboard",
      portalHref: "#product-tour",
      portalCaption:
        "The dashboard your team logs into. Real tenant insights, real signals.",
    },
    faq: {
      eyebrow: "Common questions",
      headline: "What operators ask before they sign.",
      items: [
        {
          q: "What property management systems do you support?",
          a: "Every major PMS. We sync units, pricing, and availability through standard APIs, with a nightly backfill for edge cases. If your PMS is unusual, say so on the intake call and we'll confirm on the spot.",
        },
        {
          q: "Who owns the site if we part ways?",
          a: "You do. The domain stays yours throughout. On exit, we hand over a static export of the site plus your full lead history. No transition fee.",
        },
        {
          q: "Are you fair-housing compliant?",
          a: "Every ad and landing page goes through a vertical-specific compliance check before it runs. Student housing, multifamily, and senior living each have their own rules. We keep audit trails for each.",
        },
        {
          q: "Do we own our data?",
          a: "Yes. Leads, conversations, visitor records, and analytics are yours. Export to CSV from the dashboard at any time.",
        },
        {
          q: "How long from intake to live?",
          a: "Fourteen days. Day 1 intake call. Day 7 site preview. Day 14 we flip DNS, the pixel fires, the chatbot goes live, and ads start running.",
        },
        {
          q: "Can you work alongside our existing vendors?",
          a: "Yes, during transition. Most operators run us in parallel for the first month, then consolidate once the dashboards make the comparison obvious.",
        },
        {
          q: "Do you require a long contract?",
          a: "No. Month-to-month after launch.",
        },
        {
          q: "Does LeaseStack replace our leasing team?",
          a: "No. LeaseStack saves your team manual work for tasks that would otherwise fall off the table — reporting, channel reconciliation, after-hours lead capture. Your team gets back the hours.",
        },
      ],
    },
    final: {
      heading: "Free pilot. No commitment.",
      body:
        "We connect to your existing stack, show you what we see in your dashboard, and you decide if it's useful. No deck. No sales pitch.",
      primaryCta: "Start a free pilot",
      primaryHref: "/onboarding",
    },
    // Operating Rhythm — back on the homepage per Norman brief (2026-05-28).
    weekly: {
      eyebrow: "Operating rhythm",
      headline: "What operating on LeaseStack platform actually feels like.",
      body:
        "No war rooms. No status meetings. A few purpose-built touchpoints that fit inside your existing workflow.",
      items: [
        {
          day: "Monday",
          time: "7:00 AM",
          title: "Weekly insights in your inbox.",
          body: "",
          outcome: "3 actions, every Monday",
        },
        {
          day: "Tuesday",
          time: "Rolling",
          title: "Every tour, one pipeline.",
          body: "",
          outcome: "100% of tours sourced",
        },
        {
          day: "Thursday",
          time: "By EOD",
          title: "Optimization push.",
          body: "Triggered by AI signals + operator input.",
          outcome: "48-hour turnaround",
        },
        {
          day: "Ongoing",
          time: "Overnight",
          title: "Chatbot works the nightshift.",
          body: "",
          outcome: "1 in 4 leads after hours",
        },
      ],
    },
  },

} as const;

export type MarketingCopy = typeof MARKETING;
