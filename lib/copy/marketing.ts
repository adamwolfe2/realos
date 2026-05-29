// ---------------------------------------------------------------------------
// Single source of truth for platform marketing copy.
//
// Voice: operator-credible, data-forward, direct, quietly confident.
// Outcome-first. Specific over general. Operator-to-operator.
// No buzzwords. No em dashes. No named competitors.
// Never claim to replace property managers or leasing staff.
// ---------------------------------------------------------------------------

export const MARKETING = {
  brand: {
    tagline: "Leasing intelligence for real estate operators.",
  },
  home: {
    hero: {
      eyebrow: "Leasing intelligence platform",
      headline: "Replace your marketing stack. See leases sourced in 14 days.",
      highlight: "See leases sourced in 14 days.",
      subhead:
        "Site, ads, AI chatbot, visitor pixel, reputation, and weekly report in one portal. Live on your domain in fourteen days. Cancel any month.",
      primaryCta: "Start a free pilot",
      primaryHref: "/onboarding",
      secondaryCta: "See it on a real property",
      secondaryHref: "/demo",
      microProof: "Live on a real student-housing lease-up. Built for multifamily, senior living, and commercial.",
    },
    comparison: {
      eyebrow: "Why operators switch",
      headline: "Six vendors vs. one platform.",
      body:
        "Five tools that don't talk to each other plus a retainer to stitch them together. Here's what changes when the stack ships as one product.",
      leftLabel: "Today",
      rightLabel: "With LeaseStack",
      rows: [
        {
          old: "Six vendors. Six invoices. A spreadsheet to tie it together.",
          new: "One platform. One login. One weekly report tying spend to leases.",
        },
        {
          old: "Quarterly decks counting impressions, clicks, and reach.",
          new: "Weekly report counting leads, tours, and signed leases.",
        },
        {
          old: "You find out the lease-up is behind when occupancy slips.",
          new: "Pacing alerts four to eight weeks before occupancy slips.",
        },
        {
          old: "Most of your website traffic stays anonymous forever.",
          new: "Names and emails on the visitors your forms missed.",
        },
        {
          old: "A chatbot that answers one question, then forgets you.",
          new: "An AI assistant trained on your units that books tours at 2am.",
        },
      ],
    },
    liveExample: {
      eyebrow: "Live proof",
      headline: "Running on a real property right now.",
      body:
        "Click through the resident site and the operator portal. Both are live. Listings sync hourly. The chatbot answers from real unit data.",
      siteLabel: "Resident-facing site",
      siteHref: "/demo",
      siteCaption:
        "A live student-housing deployment on the client's domain. Fourteen days from intake to live.",
      portalLabel: "Operator portal",
      portalHref: "#product-tour",
      portalCaption:
        "The dashboard your team logs into. Real tenant data, real pacing signals.",
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
          a: "Yes. Leads, conversations, visitor records, and analytics are yours. Export to CSV from the portal at any time.",
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
          a: "No. Month-to-month after launch. If pacing doesn't move, you cancel.",
        },
        {
          q: "Does LeaseStack replace our leasing team?",
          a: "No. We remove the manual work that slows your team down: reporting, channel reconciliation, creative production, after-hours lead capture. Your team gets back the hours, not the seat.",
        },
      ],
    },
    final: {
      heading: "Free pilot. No commitment.",
      body:
        "We connect to your existing stack, show you what we see in your data, and you decide if it's useful. No deck. No sales pitch.",
      primaryCta: "Start a free pilot",
      primaryHref: "/onboarding",
    },
    // Dormant — Weekly section was cut from the homepage during the
    // 2026-05-28 copy audit (operating rhythm overlapped CapabilitiesRail
    // #1 and Comparison rows 1-2). The component file is preserved per
    // CEO direction in case we bring it back; this data keeps it
    // compiling without re-shipping it on the homepage.
    weekly: {
      eyebrow: "Operating rhythm",
      headline: "What operating on LeaseStack actually feels like.",
      body:
        "No war rooms. No status meetings. A few touchpoints that fit inside the rest of your job.",
      items: [
        {
          day: "Monday",
          time: "7:00 AM",
          title: "Weekly report in your inbox.",
          body: "Leases by source, pacing, anomalies, and three actions for the week.",
          outcome: "3 actions, every Monday",
        },
        {
          day: "Tuesday",
          time: "Rolling",
          title: "Every tour, one pipeline.",
          body: "Forms, chatbot, identified visitors, calls. One view, source attached.",
          outcome: "100% of tours sourced",
        },
        {
          day: "Thursday",
          time: "By EOD",
          title: "Creative refresh ships.",
          body: "New ad concepts, email variants, landing copy within 48 hours.",
          outcome: "48-hour turnaround",
        },
        {
          day: "Ongoing",
          time: "Overnight",
          title: "Chatbot works the nightshift.",
          body: "Prospects asking at 2am get a real conversation. Hot leads by morning.",
          outcome: "1 in 4 leads after hours",
        },
      ],
    },
  },

} as const;

export type MarketingCopy = typeof MARKETING;
