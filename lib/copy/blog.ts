// ---------------------------------------------------------------------------
// Blog content store. Hardcoded for v1, swappable for MDX in Sprint v2 when
// the content team wants prose controls. No mdashes anywhere, by policy.
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
    slug: "why-we-built-a-conversion-logix-alternative",
    title: "Why we built a Conversion Logix alternative",
    description:
      "Real estate operators pay $2,600 a month for vanity metrics. We did the math and decided to build the software they should have been buying all along.",
    author: "Adam Wolfe",
    publishedAt: "2026-04-14",
    readingMinutes: 6,
    body: `Every real estate operator we talk to is paying Conversion Logix, REACH, or G5 roughly $2,600 a month. They will describe the relationship the same way: slow turnaround, glossy PDF reports, no visibility into which leads actually leased. The price tag is fixed, the results are not.

We kept asking the same question. If the retainer is fixed at $2,600, what would the best possible platform built in 2026 look like at that price? Not a pitch deck. A real platform that fills units.

The answer turns out to be obvious once you say it out loud. Identity graph pixel, not pageview analytics. AI chatbot that speaks like your leasing associate, not a canned FAQ. Live AppFolio listing sync, not manually-edited PDFs. Managed ads with 48-hour creative turnaround, not a templated library someone ordered six months ago. One dashboard that shows lease velocity, not a quarterly slide deck. And a pricing model that earns the retainer every month instead of milking a 12-month contract.

We ship this for the same money Conversion Logix charges, because operators told us they would pay exactly that if it worked. The rest is execution. This blog is the build log.`,
  },
  {
    slug: "the-hidden-cost-of-ignoring-95-percent-of-your-traffic",
    title:
      "The hidden cost of ignoring 95% of your website traffic",
    description:
      "Your analytics probably tells you about 5% of your real audience. The other 95% is anonymous. We do the math on what that blind spot costs operators.",
    author: "Adam Wolfe",
    publishedAt: "2026-04-08",
    readingMinutes: 4,
    body: `A typical property marketing site converts somewhere between 1% and 3% of its traffic into a form submission. Identity graph pixels like Cursive resolve somewhere between 40% and 70% of visits to a real person.

Which is more useful, knowing that 1,200 people visited, or knowing the names and email addresses of 600 of them? Only one of those lists can be followed up on.

Assume conservative numbers. 2,000 monthly visitors, a 50% identification rate, and a 3% email reply rate. That is 30 new qualified conversations a month from people who would have otherwise left without a trace. In student housing, at an average rent of $1,600 and a 12 month lease, signing one of those conversations pays for the platform for a year.

Most operators do not have this number because they have never had the tool that would produce it. That is the gap we built into.`,
  },
  {
    slug: "telegraph-commons-filled-12-leases-in-30-days",
    title: "How Telegraph Commons filled 12 leases in 30 days",
    description:
      "Case study: the Berkeley student housing operator that became our first client. What we changed, what we measured, and what broke along the way.",
    author: "Adam Wolfe",
    publishedAt: "2026-03-28",
    readingMinutes: 7,
    body: `Telegraph Commons runs a private student dorm two blocks from UC Berkeley. The building is charming, the location is unbeatable, the pricing is transparent. The website was not helping any of that come through.

Before the build, the site was a Wix page with outdated floor plan graphics, a static contact form, a chatbot from 2022 that answered maybe four questions, and no visibility into anonymous traffic. The ad budget went to a national agency that rarely iterated creative. Lease velocity for summer was behind pace for the first time in three years.

We rebuilt the site on our managed platform in nine days. The pieces that mattered: live AppFolio listing sync so prices never went stale, an AI chatbot trained on the building's knowledge base that captured names and emails, identity pixel that immediately started surfacing prospects who had previously been anonymous, and a nurture cadence that followed up at day 1, day 3, and day 7.

The first 30 days after launch: 847 identified visitors, 93 chatbot conversations, 38 leads in the pipeline, 12 signed leases. The team kept running the same ad budget with different creative we produced in the studio. What changed was that every visitor now had somewhere to land, someone to talk to, and a reason to come back.

What broke: the international student instant approval flow needed two small tweaks. The chatbot occasionally recommended a room type that was temporarily offline while sync caught up. Both got fixed inside the first week. Everything else worked on day one.`,
  },
];

export function findPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}
