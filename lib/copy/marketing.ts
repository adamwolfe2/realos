// ---------------------------------------------------------------------------
// Single source of truth for platform marketing copy.
//
// Voice: operator-credible, data-forward, direct, quietly confident.
// Outcome-first. Specific over general. Operator-to-operator.
// No buzzwords (no "leverage", "unlock", "synergy", "revolutionize",
// "transform", "AI-powered insights"). No em dashes. No named competitors.
// Never claim to replace property managers or leasing staff. Never position
// LeaseStack as a digital marketing agency.
// ---------------------------------------------------------------------------

export const MARKETING = {
  brand: {
    tagline: "Your leasing data. Working for you.",
  },
  home: {
    hero: {
      eyebrow: "Your leasing data, working for you",
      headline: "Replace your marketing retainer. Cancel if pacing does not move.",
      highlight: "Cancel if pacing does not move.",
      subhead:
        "One platform for your site, ads, chatbot, visitor identification, and weekly report. Live on your domain in fourteen days.",
      primaryCta: "Book a 20 min call",
      primaryHref: "/onboarding",
      secondaryCta: "See it on a real property",
      secondaryHref: "/demo",
      microProof: "Built for student housing. Running for multifamily, senior living, and commercial.",
    },
    whatYouGet: {
      eyebrow: "What you get",
      headline: "Every signal. One platform. Zero extra work.",
      body:
        "Every lead source, every channel, every conversion in one place. No spreadsheets. No agency black boxes.",
      items: [
        "Know which channel drove your last twelve lease signings",
        "See names and emails on the visitors your forms missed",
        "Catch a slipping lease-up four to eight weeks before occupancy does",
        "Get a one-page report in your inbox every Monday morning",
        "Turn every current tenant into a leasing agent with one link",
        "Capture after-hours leads with a chatbot trained on your units",
        "Ship a new ad, email, or landing page in 48 hours",
      ],
      timeline: [
        { day: "Day 1",  title: "Intake call",   body: "Thirty minutes. We audit your current marketing stack live." },
        { day: "Day 7",  title: "Site preview",  body: "Your custom site on a staging URL. You comment, we iterate." },
        { day: "Day 14", title: "Live on your domain", body: "DNS flipped, pixel firing, chatbot answering, ads running." },
      ],
    },
    comparison: {
      eyebrow: "The shift",
      headline: "The current stack vs. one that tells you what to do next.",
      body:
        "Five tools that do not talk to each other, plus a retainer to stitch them together. Here is what changes when the stack ships as one product.",
      leftLabel: "The current stack",
      rightLabel: "With LeaseStack",
      rows: [
        {
          old: "Six vendors. Six invoices. A spreadsheet to tie it together.",
          new: "One platform. One login. One weekly report tying spend to leases.",
        },
        {
          old: "Quarterly decks counting impressions, clicks, and reach.",
          new: "Weekly report counting leads, tours, and leases.",
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
          new: "A chatbot trained on your units that captures leads at 2am.",
        },
      ],
    },
    weekly: {
      eyebrow: "Operating rhythm",
      headline: "What operating on LeaseStack actually feels like.",
      body:
        "No war rooms. No status meetings. No quarterly reviews. A few touchpoints that fit inside the rest of your job.",
      items: [
        {
          day: "Monday",
          time: "7:00 AM",
          title: "Weekly report in your inbox.",
          body:
            "Leases by source, spend, pacing, anomalies, and three actions for the week. One page, read over coffee.",
          outcome: "3 actions, every Monday",
        },
        {
          day: "Tuesday",
          time: "Rolling",
          title: "Every tour, one pipeline.",
          body:
            "Forms, chatbot, identified visitors, calls, scheduling links — one view, source attached.",
          outcome: "100% of tours sourced",
        },
        {
          day: "Thursday",
          time: "By EOD",
          title: "Creative refresh ships.",
          body:
            "New ad concepts, email variants, and landing copy within 48 hours. No retainer. No change order.",
          outcome: "48-hour turnaround",
        },
        {
          day: "Ongoing",
          time: "Overnight",
          title: "Chatbot works the nightshift.",
          body:
            "Prospects asking at 2am get a real conversation. Hot leads land with your team by morning.",
          outcome: "1 in 4 leads after hours",
        },
      ],
    },
    liveExample: {
      eyebrow: "Live proof of concept",
      headline: "Running on a real property right now.",
      body:
        "Click the resident site and the operator portal. Both are live. Listings sync hourly. The chatbot answers from real unit data. Identified visitors land in the pipeline you can see.",
      siteLabel: "The resident-facing site",
      siteHref: "/demo",
      siteCaption:
        "A live student-housing deployment on the client's domain. Fourteen days from intake to live.",
      portalLabel: "The operator portal",
      portalHref: "#product-tour",
      portalCaption:
        "The dashboard your team would use. Real tenant data, real pacing signals.",
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
          "One question answered, visitor forgotten, zero leads captured after hours.",
      },
      {
        title: "Most site visitors stay anonymous.",
        body:
          "You see the traffic. You cannot see who. The prospects you wanted go dark.",
      },
    ],
    howItWorks: [
      {
        step: "01",
        title: "Twenty minute call",
        body:
          "Walk us through your current marketing setup. We audit it live and tell you what we would change.",
      },
      {
        step: "02",
        title: "Free pilot",
        body:
          "Start setup now. We connect to your stack and show you what we see in your data, at no cost.",
      },
      {
        step: "03",
        title: "Live in fourteen days",
        body:
          "Day 1 intake. Day 7 site preview. Day 14 DNS flipped, pixel firing, chatbot answering, ads running.",
      },
      {
        step: "04",
        title: "Cancel any month",
        body:
          "Month to month after launch. If pacing does not move, you cancel.",
      },
    ],
    modules: [
      {
        title: "Managed marketing site",
        body:
          "Custom-built on your domain. Fast, search-friendly, updated by live listing sync.",
      },
      {
        title: "Listing sync",
        body:
          "Every unit on your site matches your PMS within the hour.",
      },
      {
        title: "Visitor identification",
        body:
          "Names and emails on the visitors your forms missed, fed into your CRM.",
      },
      {
        title: "AI chatbot",
        body:
          "Trained on your units, pricing, and application flow. Captures leads at 2am.",
      },
      {
        title: "Managed ads",
        body:
          "Google and Meta. Geo-fenced, retargeted, refreshed weekly, attributed to leases.",
      },
      {
        title: "Search and AI discovery",
        body:
          "Per-location pages written to rank in Google and to be quoted by ChatGPT, Perplexity, and Claude.",
      },
      {
        title: "Creative refresh",
        body:
          "New ad, email, or landing page in 48 hours. No retainer. No templates.",
      },
      {
        title: "Lead capture and CRM",
        body:
          "Forms, exit intent, chat, calls. One pipeline, source attached to every lead.",
      },
      {
        title: "Referral program",
        body:
          "Turn every current tenant into a leasing agent with one link. Track, pay out, repeat.",
      },
    ],
    proof: {
      heading: "A product, not a retainer.",
      body:
        "Same platform, every operator. The brand, the listings, and the playbook are yours. The technology, the operations, and the weekly intelligence are ours.",
    },
    faq: {
      eyebrow: "Common questions",
      headline: "What operators ask before they sign.",
      items: [
        {
          q: "What property management systems do you support?",
          a: "Every major PMS. We sync units, pricing, and availability through standard APIs, and run a nightly backfill for edge cases. If your PMS is unusual, say so on the intake call and we will confirm on the spot.",
        },
        {
          q: "Who owns the site if we part ways?",
          a: "You do. The domain stays yours throughout. On exit, we hand over a static export of the site plus your full lead history. No hostage data. No transition fee.",
        },
        {
          q: "Are you fair-housing compliant?",
          a: "Every creative we ship (ads, landing copy, email) goes through a vertical-specific compliance check before it runs. Student housing, multifamily, and senior living each have their own rules, and we keep audit trails for each.",
        },
        {
          q: "Do we own our data?",
          a: "Yes. Leads, conversations, visitor records, and site analytics are yours. Export to CSV from the portal at any time.",
        },
        {
          q: "What is the timeline from intake to live?",
          a: "Fourteen days. Day 1 is your intake call. Day 7 is a site preview on a staging URL. Day 14 we flip DNS, the pixel starts firing, the chatbot goes live, and ads begin running. No phase-two surprises.",
        },
        {
          q: "Can you work alongside our existing vendors?",
          a: "Yes, during transition. Most operators run us in parallel for the first month, then consolidate once the dashboards make the comparison obvious.",
        },
        {
          q: "Do you require a long contract?",
          a: "No. After launch, engagement is month-to-month. If pacing does not move, you cancel. The platform stays on your domain through the following cycle.",
        },
        {
          q: "Does LeaseStack replace our leasing team?",
          a: "No. LeaseStack removes the manual work that slows your team down (reporting, channel reconciliation, creative production, after-hours lead capture). It does not replace property managers or leasing staff. Your team gets back the hours, not the seat.",
        },
      ],
    },
    final: {
      heading: "Free pilot. No commitment.",
      body:
        "We connect to your existing stack, show you what we see in your data, and you decide if it is useful. No deck. No feature list. No sales pitch.",
      primaryCta: "Book a demo",
      primaryHref: "/onboarding",
    },
  },

} as const;

export type MarketingCopy = typeof MARKETING;
