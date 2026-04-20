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
      eyebrow: "For multifamily and student housing operators",
      headline: "Fill your units without running five vendors.",
      highlight: "without running five vendors.",
      subhead:
        "We build your marketing site, ads, chatbot, and CRM into one managed platform, live on your domain in fourteen days. You review a weekly report. We do the rest.",
      primaryCta: "Book a demo",
      primaryHref: "/onboarding",
      secondaryCta: "See it live",
      secondaryHref: "/#live",
      microProof: "Built for residential and commercial portfolios.",
    },
    whatYouGet: {
      eyebrow: "What you get",
      headline: "One platform. Seven deliverables. Live in fourteen days.",
      body:
        "Nothing to wire up. Nothing to log into twice. We own the build, the campaigns, and the reporting.",
      items: [
        "A custom marketing site on your domain",
        "PMS listing sync, updated hourly",
        "AI chatbot trained on your properties",
        "Google and Meta ads, managed weekly",
        "Names and emails on your anonymous site traffic, with a CRM that nurtures them",
        "Weekly performance report",
        "48-hour creative turnaround on every request",
      ],
      timeline: [
        { day: "Day 1",  title: "Intake call",   body: "Thirty minutes. We audit your current marketing stack live." },
        { day: "Day 7",  title: "Site preview",  body: "Your custom site on a staging URL. You comment, we iterate." },
        { day: "Day 14", title: "Live on your domain", body: "DNS flipped, pixel firing, chatbot answering, ads running." },
      ],
    },
    comparison: {
      eyebrow: "The shift",
      headline: "The current marketing stack vs. one that ships.",
      body:
        "Most operators are paying for five tools that don't talk to each other, plus a retainer for the people stitching them together. Here's what changes when the stack is a product.",
      leftLabel: "The current stack",
      rightLabel: "With RealEstaite",
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
          old: "Creative turnaround measured in weeks and revision rounds.",
          new: "Creative ships in 48 hours. No retainer, no change-order form.",
        },
        {
          old: "Most of your site traffic stays anonymous forever.",
          new: "Names and emails on a meaningful share of the visitors who land.",
        },
        {
          old: "The chatbot is a glorified FAQ, or there isn't one at all.",
          new: "An AI chatbot trained on your properties, capturing leads at 2am.",
        },
      ],
    },
    weekly: {
      eyebrow: "Your week with us",
      headline: "What operating on the platform actually feels like.",
      body:
        "No war rooms, no status meetings, no quarterly reviews. A few touchpoints that fit inside the rest of your job.",
      items: [
        {
          day: "Monday",
          time: "7:00 AM",
          title: "Weekly performance report lands in your inbox.",
          body:
            "Leases attributed to sources, spend summary, anomalies flagged, recommended tests for the week. One page, readable over coffee.",
        },
        {
          day: "Tuesday",
          time: "Rolling",
          title: "Tour requests auto-create in the portal from every channel.",
          body:
            "Site form, chatbot, pixel-identified visitors, inbound calls, scheduling links, all land in one pipeline with source attribution attached.",
        },
        {
          day: "Thursday",
          time: "By EOD",
          title: "Creative refresh ships.",
          body:
            "The studio delivers new ad concepts, email subject variants, and landing-block copy within 48 hours of request. No retainer to unlock it.",
        },
        {
          day: "Ongoing",
          time: "Overnight",
          title: "The AI chatbot works the nightshift.",
          body:
            "Prospects and families asking questions at 2am get a useful conversation, not a contact form. Hot leads get handed to your team with the thread attached.",
        },
      ],
    },
    liveExample: {
      eyebrow: "In production",
      headline: "See the platform running in production.",
      body:
        "A resident-facing site on the client's own domain, live listings synced hourly, AI chatbot grounded in property facts, visitor identification firing, leads flowing into the operator portal. Click through both surfaces exactly as a prospective resident or a portfolio operator would.",
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
          "Custom-built on your domain. Fast, search-friendly, updated by live listing sync.",
      },
      {
        title: "PMS listing sync",
        body:
          "Every unit on your site matches the source of truth within the hour.",
      },
      {
        title: "Visitor identification",
        body:
          "Names and emails on a significant share of your anonymous site traffic.",
      },
      {
        title: "AI chatbot",
        body:
          "Answers in five seconds, captures leads around the clock, hands hot ones to your team.",
      },
      {
        title: "Google and Meta ads",
        body:
          "Geo-fenced campaigns, retargeting, creative refreshed weekly.",
      },
      {
        title: "Search and AI discovery",
        body:
          "Rank in Google. Get recommended by ChatGPT and Perplexity. Per-location pages.",
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
    faq: {
      eyebrow: "Common questions",
      headline: "What operators ask before they sign.",
      items: [
        {
          q: "What property management systems do you support?",
          a: "Every major PMS. We sync units, pricing, and availability through standard APIs, and run a nightly backfill for edge cases. If your PMS is unusual, say so on the intake call and we'll confirm on the spot.",
        },
        {
          q: "Who owns the site if we part ways?",
          a: "You do. The domain stays yours throughout. On exit, we hand over a static export of the site plus your full lead history. No hostage data, no transition fee.",
        },
        {
          q: "Are you fair-housing compliant?",
          a: "Every creative we ship, ads, landing copy, email, goes through a vertical-specific compliance check before it runs. Student housing, multifamily, and senior living each have their own rules, and we keep audit trails for each.",
        },
        {
          q: "Do we own our data?",
          a: "Yes. Leads, conversations, visitor records, and site analytics are yours. Export to CSV from the portal at any time.",
        },
        {
          q: "What's the timeline from intake to live?",
          a: "Fourteen days. Day 1 is your intake call. Day 7 is a site preview on a staging URL. Day 14 we flip DNS, the pixel starts firing, the chatbot goes live, and ads begin running. No phase-two surprises.",
        },
        {
          q: "Can you work alongside our existing vendors?",
          a: "Yes, during transition. Most operators run us in parallel for the first month, then consolidate once the dashboards make the comparison obvious.",
        },
        {
          q: "Do you require a long contract?",
          a: "No. After launch, engagement is month-to-month. If we're not moving lease velocity, you cancel. The platform stays on your domain through the following cycle.",
        },
        {
          q: "What if we already have a site we like?",
          a: "Bring-your-own-site mode installs the chatbot and visitor identification into your existing site without rebuilding it. You keep the design, we add the intelligence layer.",
        },
      ],
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
