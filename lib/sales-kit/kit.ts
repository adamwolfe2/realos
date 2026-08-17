// Sales collateral catalogue for /admin/kit — the internal page a rep
// (Norman) opens to grab the right link + the right words, fast.
//
// This is deliberately a flat data file, not a CMS: every entry points at a
// page that already ships in this repo, so the catalogue changes only when
// the site does.

export interface KitLink {
  /** Site-relative path. Rendered absolute + ref-tagged at read time. */
  href: string;
  label: string;
  /** One line: when a rep should reach for this instead of the others. */
  whenToSend: string;
  /** Paste-ready outreach copy. `{{first}}` / `{{link}}` interpolated. */
  snippet?: string;
}

export interface KitSection {
  title: string;
  blurb: string;
  links: readonly KitLink[];
}

export const KIT_SECTIONS: readonly KitSection[] = [
  {
    title: "Lead magnets",
    blurb:
      "Free, no-account tools. Prospect gets real output about their own property, we get a named lead in /admin/intakes.",
    links: [
      {
        href: "/ai-visibility",
        label: "AI visibility audit",
        whenToSend:
          "Property or portfolio that cares about being found — the strongest cold opener.",
        snippet:
          "{{first}} — I ran the same check on three properties near yours this week. ChatGPT recommends a competitor when renters ask about your submarket. Two-minute scan of your building, no call needed: {{link}}",
      },
      {
        href: "/audit",
        label: "Full marketing audit",
        whenToSend:
          "Company-level or multi-property conversations where the AI angle is too narrow.",
        snippet:
          "{{first}} — put your site in here and it'll come back with the specific gaps costing you leases, ranked: {{link}}",
      },
      {
        href: "/reputation-report",
        label: "Reputation report",
        whenToSend:
          "They have visible review problems, or ORA/reputation is already on their radar.",
        snippet:
          "{{first}} — renters read every review before they tour. This pulls what's being said about your property across Google, Yelp and Reddit in one page: {{link}}",
      },
      {
        href: "/build-a-chatbot",
        label: "Build-a-chatbot",
        whenToSend:
          "The demo-in-a-link. Best for skeptics — they get a working leasing agent on their own site content in 60 seconds.",
        snippet:
          "{{first}} — drop your property URL in here and you'll have a leasing chatbot trained on your own site in under a minute. No account, no call: {{link}}",
      },
      {
        href: "/lost-leads",
        label: "Lost-lead calculator",
        whenToSend:
          "Pixel / visitor-identification pitch. Good for anyone quoting their traffic numbers.",
        snippet:
          "{{first}} — you said you get real traffic but not enough tours. This does the math on how many of those visitors leave unnamed: {{link}}",
      },
    ],
  },
  {
    title: "Proof",
    blurb: "Send after interest, before the call. These do the convincing.",
    links: [
      {
        href: "/sample-report",
        label: "Sample report",
        whenToSend:
          "They want to see the deliverable before handing over their URL.",
      },
      {
        href: "/demo/aeo",
        label: "Live AEO demo",
        whenToSend:
          "On a screen-share, or when someone asks what 'AI search' actually means.",
      },
      {
        href: "/features/seo-aeo",
        label: "SEO + AEO feature page",
        whenToSend: "Technical buyer who wants the how, not the what.",
      },
      {
        href: "/manifesto",
        label: "Manifesto",
        whenToSend:
          "Founder-to-founder, or anyone asking why we exist. Sets us apart from agencies.",
      },
    ],
  },
  {
    title: "Close",
    blurb: "Booking, pricing, and the paperwork.",
    links: [
      {
        href: "/book-demo",
        label: "Book a demo (qualification wizard)",
        whenToSend:
          "Default booking link. Qualifies them before they hit the calendar, so the call is warm.",
        snippet:
          "{{first}} — grab any 15 minutes here and I'll walk you through what we found: {{link}}",
      },
      {
        href: "/pricing",
        label: "Pricing",
        whenToSend: "Only after they've seen output. Never lead with it.",
      },
      {
        href: "/onboarding",
        label: "Client intake / start onboarding",
        whenToSend: "They said yes. This starts the build.",
      },
    ],
  },
] as const;

/** Absolute, rep-tagged URL for a kit link. */
export function kitUrl(href: string, siteUrl: string, ref: string): string {
  const url = new URL(href, siteUrl);
  url.searchParams.set("ref", ref);
  return url.toString();
}

/** Fill a snippet's placeholders. `first` falls back to a neutral greeting. */
export function fillSnippet(
  snippet: string,
  link: string,
  first?: string,
): string {
  return snippet
    .replaceAll("{{link}}", link)
    .replaceAll("{{first}}", first?.trim() || "Hi there");
}
