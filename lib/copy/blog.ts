// ---------------------------------------------------------------------------
// Blog content store. Hardcoded for v1, swappable for MDX later. No em-dashes.
// Posts are product-focused and vendor-neutral. No named competitors, no
// named reference customers.
// ---------------------------------------------------------------------------

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  author: string;
  publishedAt: string;
  readingMinutes: number;
  body: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "building-a-managed-marketing-platform",
    title: "Building a managed marketing platform for real estate",
    description:
      "Why a single-vendor, software-first platform outperforms the stitched-together agency + tools model that most operators are running today.",
    author: "LeaseStack team",
    publishedAt: "2026-04-14",
    readingMinutes: 6,
    body: `Most real estate operators are running their marketing across five to eight vendors: an agency for paid spend, a website they can't edit, a chatbot vendor, a listing portal, a designer for ad creative, a CRM, and a few spreadsheets stitching the whole thing together. The monthly cost is high. The visibility is low. The attribution is non-existent.

We wanted to build the platform those operators should have been buying all along. One login. One dashboard. Every module owned by the same team that built the others, so the handoffs between site, pixel, chatbot, ads, and CRM all work because they were designed to work together.

The result is a single managed platform: a custom site on your domain, live listings synced from your PMS, an identity graph pixel that names a meaningful share of your anonymous visitors, an AI chatbot that captures leads around the clock, managed ads with 48 hour creative turnaround, and a lead pipeline that shows lease velocity instead of vanity metrics.

Operators get software that pays its own invoice. We earn the retainer every month, or the contract ends. This blog is the build log.`,
  },
  {
    slug: "the-hidden-cost-of-anonymous-website-traffic",
    title: "The hidden cost of anonymous website traffic",
    description:
      "Most of the people looking at your property never fill out a form. Your current analytics treats that traffic as noise. We think of it as the actual pipeline.",
    author: "LeaseStack team",
    publishedAt: "2026-04-08",
    readingMinutes: 4,
    body: `The vast majority of visitors to a property marketing site never fill out a form. Standard analytics tells you how many, which pages they looked at, and where they came from, but nothing about who they are. An identity graph pixel changes the question from "how much traffic did we get" to "who visited that we can follow up with."

Which is more useful, knowing that a thousand people visited, or having a shortlist of named prospects from that thousand that your leasing team can actually email? Only one of those can be worked.

Even modest assumptions make the math stark. A few thousand monthly visitors, a meaningful identification rate, and a reasonable reply rate turn into dozens of qualified conversations a month with prospects who would otherwise have left without a trace. At an average rent and typical lease term, signing one of those conversations pays for the platform for a year.

Most operators do not have this number because they have never had the tool that would produce it. That is the gap we built into.`,
  },
  {
    slug: "what-a-real-estate-ai-chatbot-should-actually-do",
    title: "What a real estate AI chatbot should actually do",
    description:
      "The first generation of property chatbots was a glorified FAQ. Here's what the second generation needs to look like to earn a place on the site.",
    author: "LeaseStack team",
    publishedAt: "2026-03-28",
    readingMinutes: 5,
    body: `Most property chatbots in production today are a search box with a smile. You ask about pet policy, the bot pastes three sentences from an FAQ page, the conversation ends, and the visitor leaves without a lead captured. Worst case, it handed the visitor to a human who was off the clock and never got back to them.

The platform chatbot is different. It is grounded in your live unit inventory, rent ranges, tour calendar, and amenity list, so it answers accurately without being brittle. It captures a name and email in the first two to three exchanges, naturally, as part of a helpful conversation rather than a form wall. It hands hot leads to your leasing team in the platform's CRM, scored and routed. And it runs 24/7, which is when most prospective residents are actually browsing.

Behind the chatbot is the rest of the platform. The same lead that came in through the chatbot shows up next to form fills, pixel-identified visitors, and any PMS applicants in one pipeline. Follow-up runs automatically. The chatbot is not a widget, it is one surface of the same product.`,
  },
];

export function findPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}
