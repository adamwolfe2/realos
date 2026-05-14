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
      eyebrow: "Leasing intelligence platform",
      headline: "Your leasing data. Working for you.",
      highlight: "Working for you.",
      subhead:
        "LeaseStack tells real estate operators exactly what their digital marketing is doing, and exactly what to do about it. One platform, every signal, on your domain.",
      primaryCta: "Book a demo",
      primaryHref: "/onboarding",
      secondaryCta: "See the data",
      secondaryHref: "/demo",
      microProof: "Built for student housing. Tailored for multifamily, senior living, and commercial.",
    },
    whatYouGet: {
      eyebrow: "What you get",
      headline: "Full visibility. Zero extra work.",
      body:
        "Every lead source, every channel, every conversion. Tracked, aggregated, and reported automatically. No spreadsheets. No agency black boxes.",
      items: [
        "Know which channel drove your last twelve lease signings",
        "Know who visited your website, not just how many",
        "Know your lease-up is falling behind before it shows up in occupancy",
        "Your monthly marketing report writes itself and lands in your inbox",
        "Turn every current tenant into a leasing agent with one link",
        "An AI chatbot trained on your units, capturing leads at 2am",
        "Ads, listings, and pages on your domain, managed for you",
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
        "Most operators are paying for five tools that do not talk to each other, plus a retainer for the people stitching them together. Here is what changes when the stack is a product.",
      leftLabel: "The current stack",
      rightLabel: "With LeaseStack",
      rows: [
        {
          old: "Six vendors, six invoices, and a dashboard you stitch together yourself.",
          new: "One platform, one login, one weekly report that ties spend to leases.",
        },
        {
          old: "Agency decks show activity: impressions, clicks, reach.",
          new: "Your report shows outcomes: leads, tours booked, leases signed.",
        },
        {
          old: "You find out the lease-up is behind when occupancy slips.",
          new: "You get a pacing alert four to eight weeks before it shows up in occupancy.",
        },
        {
          old: "Most of your site traffic stays anonymous forever.",
          new: "Names and emails on a meaningful share of the visitors who land.",
        },
        {
          old: "The chatbot is a glorified FAQ, or there is not one at all.",
          new: "An AI chatbot trained on your properties, capturing leads at 2am.",
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
          title: "Weekly performance report lands in your inbox.",
          body:
            "Leases attributed to source, spend summary, pacing vs. last cycle, anomalies flagged, and the three actions to take this week. One page, readable over coffee.",
        },
        {
          day: "Tuesday",
          time: "Rolling",
          title: "Tour requests land in one pipeline, with source attached.",
          body:
            "Site form, chatbot, pixel-identified visitors, inbound calls, scheduling links. Every channel funnels into the same view, attribution intact.",
        },
        {
          day: "Thursday",
          time: "By EOD",
          title: "Creative refresh ships.",
          body:
            "New ad concepts, email subject variants, and landing-block copy within 48 hours of request. No retainer to wait on. No change-order form.",
        },
        {
          day: "Ongoing",
          time: "Overnight",
          title: "The AI chatbot works the nightshift.",
          body:
            "Prospects asking questions at 2am get a useful conversation, not a contact form. Hot leads land with your team the next morning, thread attached.",
        },
      ],
    },
    liveExample: {
      eyebrow: "Live proof of concept",
      headline: "The platform, running on a real property right now.",
      body:
        "A resident-facing site on the operator's own domain. Live listings synced hourly. AI chatbot grounded in property facts. Visitor identification firing. Leads flowing into the operator portal. Click through both surfaces exactly as a prospective resident or a portfolio operator would.",
      siteLabel: "The resident-facing site",
      siteHref: "/demo",
      siteCaption:
        "A production student-housing deployment rendered on the client's domain, fourteen days from intake to live.",
      portalLabel: "The operator portal",
      portalHref: "#product-tour",
      portalCaption:
        "The same operator dashboard we would build you, populated with live tenant data and real pacing signals.",
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
          "You see the traffic. You cannot see who. The prospects you wanted go dark.",
      },
    ],
    howItWorks: [
      {
        step: "01",
        title: "Twenty minute call",
        body:
          "Bring your current marketing setup. We audit it live and tell you what we would change.",
      },
      {
        step: "02",
        title: "Free pilot",
        body:
          "We connect to your existing stack and show you what we see in your data. No commitment.",
      },
      {
        step: "03",
        title: "Live in two weeks",
        body:
          "Site, pixel, chatbot, search, and ads ship together. Your domain, our stack.",
      },
      {
        step: "04",
        title: "Earn the seat every month",
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
          "Every unit on your site matches the source of truth in your PMS within the hour.",
      },
      {
        title: "Visitor identification",
        body:
          "Know who visited your website, not just how many. Names and emails fed into your CRM.",
      },
      {
        title: "AI chatbot",
        body:
          "Trained on your units, pricing rules, and application process. Captures leads at 2am so your team does not have to.",
      },
      {
        title: "Managed ads",
        body:
          "Google and Meta. Geo-fenced campaigns, retargeting, creative refreshed weekly, attribution back to lease signings.",
      },
      {
        title: "Search and AI discovery",
        body:
          "Pages written to rank in Google and to be quoted by ChatGPT, Perplexity, and Claude. Per-location.",
      },
      {
        title: "Creative refresh",
        body:
          "New ad creative, email variants, and landing copy in 48 hours. No retainer. No templates.",
      },
      {
        title: "Lead capture and CRM",
        body:
          "Forms, exit intent, chat, calls. Every channel funnels into one pipeline with source attached.",
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
