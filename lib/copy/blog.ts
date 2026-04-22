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
  category?: string;
  body: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "real-estate-marketing-attribution",
    title: "The black box problem: why real estate marketing attribution is broken",
    description:
      "Most independent operators are spending $2,000 to $5,000 a month on marketing with no clear line from that spend to a signed lease. Here is why the attribution gap exists and what it looks like when it actually works.",
    author: "LeaseStack Team",
    publishedAt: "2026-04-15",
    readingMinutes: 4,
    category: "Marketing",
    body: `There is a specific operator we talk to often. They are spending around $3,000 a month on marketing: paid search, a listing portal, social ads, maybe a chatbot or lead form on their website. The invoices come in and get paid. Leases get signed. But ask them which channel drove the signed leases, and you get a shrug. "Probably Google," they say. Probably.

That shrug is expensive.

Real estate marketing attribution refers to the ability to connect a specific dollar of marketing spend to a specific signed lease. Most operators do not have it. They have Google Analytics, which tells them how many sessions their site got and where visitors came from. They have lead counts from each vendor. But those data streams never connect. The listing portal does not know the applicant also came from a paid search ad two weeks earlier. The CRM does not know the lead found the property through organic search before they called. Nobody knows which source actually closed.

The eight-vendor stack problem makes this worse. A typical independent operator's marketing infrastructure looks like this: a paid search agency managing Google Ads, a separate SEO contractor, a social media vendor for Instagram and Facebook ads, one or two listing portals, a website from a third-party provider, a chatbot widget bolted on from yet another company, a contact form that emails leads to a generic inbox, and an email nurture sequence running out of a basic CRM. Every one of those vendors reports their own numbers using their own definitions of a "lead." None of them talk to each other. The paid search agency shows you click volume and cost per click. The listing portal shows you "inquiries." The chatbot shows you conversations. None of them show you leases.

What attribution looks like when it works is simple to describe but hard to build. A prospect finds your property from a Google ad. They visit your site, browse the floor plans, and chat with your chatbot. They fill out a contact form two days later. They schedule a tour. They submit an application. They sign. At every step, the source is captured and carried forward. When the lease is signed, you can trace it back to the original Google ad, the specific campaign, the specific keyword. You know the cost of that conversion because you know exactly what you spent on that campaign. The math is not complicated. $3,000 in spend, 12 signed leases attributable to paid search, $250 per lease. Is that worth it? Now you can answer the question.

The math changes completely when you can see it. The operator who finally gets clean attribution data almost always discovers the same thing: one or two channels are driving the vast majority of their signed leases, and two or three channels are spending money with almost nothing to show for it. The listing portal that costs $800 a month has not driven a verified lease in four months. The paid search campaign targeting one specific keyword is responsible for 40 percent of signed leases at a cost per lease that pencils out easily. Without attribution, both channels look the same on the invoice. With attribution, one gets cut and one gets doubled.

This is not theoretical. It is the consistent finding when operators switch from a fragmented stack to a platform where the site, the chatbot, the lead forms, and the ad spend all report into the same place. The first dashboard view is often a surprise. Dollars are moving to places that are not working. And the fix is not complicated: stop spending where it does not convert, put more into what does.

The barrier has never been that operators do not want attribution. They do. The barrier has been that getting it required stitching together a dozen tools, building custom integrations, and hiring someone to maintain the whole thing. Most independent operators do not have that capacity. A platform that builds attribution in from the start, because all the components were designed together, removes the barrier entirely.

If you are spending more than $2,000 a month on marketing and cannot answer which channel drove your last ten signed leases, you are flying blind. That is the problem worth solving first.`,
  },
  {
    slug: "apartment-leasing-velocity",
    title: "Leasing velocity: the metric your lease-up needs before it is too late",
    description:
      "Most student housing operators find out they are behind on a lease-up when it is already too late to fix it. Tracking leasing velocity weekly, not monthly, changes your response time from \"we missed the season\" to \"we caught the dip in week three.\"",
    author: "LeaseStack Team",
    publishedAt: "2026-04-08",
    readingMinutes: 4,
    category: "Operations",
    body: `The call nobody wants to have happens in late June. You are tracking toward a property opening in August, you pull the numbers, and you realize occupancy is sitting at 65 percent with six weeks left. You have missed the window to hit full occupancy for the fall semester. The marketing campaign that would have moved the needle needed to launch in April. It is June. You lost the season.

That call is almost always preventable. The operator who made it was not checking the right numbers at the right interval.

Leasing velocity is the weekly rate of movement through your leasing funnel. Not the total count of leads or the percentage of units leased as of today. The rate. Specifically: how many new leads came in this week, how many tours were scheduled, how many applications were submitted. The direction those numbers are moving is more important than where they are in absolute terms.

Here is why the distinction matters. An operator checking monthly occupancy reports in the spring is looking at a lagging indicator. By the time monthly numbers show a problem, you have already lost two to four weeks of potential leasing activity. In student housing, where the majority of leases for an August move-in are signed between February and May, losing three weeks in March is not recoverable by June. The window is that tight.

Weekly velocity tracking changes the signal. If your leads per week were running at 18 in February and drop to 9 in the first week of March with no obvious explanation, that is a warning sign you can act on immediately. It might be a paid search campaign that stopped running. It might be a listing portal that removed your property from featured placement. It might be that a competitor dropped pricing and is pulling prospects away. Whatever the cause, you see it in week one and have time to respond.

The warning signs are consistent across lease-up cycles. Leads plateau first, usually because a marketing channel has saturated or pricing has gotten out of range for the market. Tours drop next, either because leads are lower quality or because the leasing team response time has slipped. Application conversion flattens last, which is often a qualification issue or a friction problem in the application process itself. When all three are declining at the same time, you have a funnel problem, not just a marketing problem.

What you do when velocity drops depends on which stage is falling. If leads are down, the fix is usually upstream: increase ad spend, refresh creative, check that listing portal placement is active, review organic search rankings. If leads are stable but tours are down, the problem is response time or follow-up cadence. A chatbot that is capturing leads but not triggering a fast follow-up from a human leasing agent is a common culprit. If tours are happening but applications are not converting, look at pricing relative to comparable properties and friction in the application process itself.

The seasonality of student housing makes velocity tracking even more critical than in conventional multifamily. Most UC Berkeley, USC, or similar university students are making their housing decisions for the following fall between January and April. A lease-up that is running on track through February with strong weekly velocity can absorb a slow week in early March. A lease-up that has not been tracking velocity at all might not notice the slow week until the monthly report comes out, by which point it is late March, the best prospects have signed elsewhere, and the remainder of the cycle is spent trying to backfill with whoever is left in the market.

The January renewal cycle adds another dimension. Properties with significant returning resident populations are making renewal decisions in December and January. If renewal velocity is weak in December, the operator who notices in early January can run a targeted renewal incentive campaign while residents are still deciding. The operator who does not notice until February is too late.

None of this requires sophisticated infrastructure to start. A simple spreadsheet tracking leads, tours, and applications by week, compared to the same week in the prior year, gives you the signal. The goal is to make that tracking automatic, visible at a glance, and tied to the upstream marketing data so you can see not just that velocity dropped but why.

If you are running a student housing lease-up and looking at your numbers monthly, you are one slow March away from a difficult August. Velocity is the number that tells you early enough to do something about it.`,
  },
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
