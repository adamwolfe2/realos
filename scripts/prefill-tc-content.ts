/**
 * Pre-draft 5 high-leverage blog posts + 3 neighborhood pages for
 * Telegraph Commons (SG Real Estate org) ahead of the operator demo.
 *
 * Drafts land in ContentDraft with status=GENERATING and htmlBody +
 * outputMarkdown + output populated, so they appear in the operator's
 * /portal/content drafts list as "ready to open." During the demo,
 * Norman / the TC team click each one → editor opens with the full
 * AI-drafted content + the brand voice pre-loaded → they click
 * "Submit for approval" → admin queue gets the request.
 *
 * The 5 blogs are picked from real signal — top competitor named in
 * the AEO scan (Downtown Berkeley), TC's distinctive instant-international
 * approval angle, the head term for student housing in Berkeley, and
 * the highest-intent informational query a student about to sign would
 * actually type.
 *
 * Run with:
 *   DATABASE_URL=... ANTHROPIC_API_KEY=... pnpm exec tsx scripts/prefill-tc-content.ts
 */

import { prisma } from "../lib/db";
import {
  draftBlogPost,
  draftNeighborhoodPage,
  type DrafterContext,
} from "../lib/seo/draft-writer";
import { DraftStatus, type ContentFormat } from "@prisma/client";

const ORG_ID = "cmo402dwz0002c93lf3okkgi0";   // SG Real Estate
const PROPERTY_ID = "cmo402dzi0003c93lq9i6xz6h"; // Telegraph Commons

const BLOG_TOPICS: Array<{
  title: string;
  brief: string;
  targetQuery: string;
}> = [
  {
    title: "Best Student Apartments Near UC Berkeley: 2026 Guide",
    targetQuery: "best student apartments near UC Berkeley",
    brief: `Head-term ranking play. Direct comparison of student housing options near UC Berkeley campus. List 5-7 properties (Telegraph Commons included), grouped by neighborhood (Southside, Downtown, Northside). Each gets: walking distance to Sproul Plaza, price range, key amenity, and a one-line "best for X" recommendation. The intro hooks the search query in the first 80 chars. Closing should push the reader to schedule a tour or view available units. FAQ block answers: how close is "walking distance", what's the average rent, what utilities are included, when do leases start, are roommates required.`,
  },
  {
    title:
      "Telegraph Commons vs. Downtown Berkeley Apartments: Which Is Right for UC Berkeley Students?",
    targetQuery: "Telegraph Commons vs Downtown Berkeley apartments",
    brief: `Counter-page. Downtown Berkeley shows up 4× in AI engine answers about Berkeley apartments while Telegraph Commons doesn't. This post fixes that by directly comparing both — honest, specific, both wins and losses. Sections: location/walkability (TC wins on campus proximity, Downtown wins on BART), price (vary), amenities, lifestyle/vibe (student-centric vs mixed-use), application process (TC's instant international approval is the wedge). End with a clear "you should choose TC if..." vs "you should choose Downtown if..." rubric. The whole post is bait for AI engines that surface side-by-side comparison content first.`,
  },
  {
    title:
      "Berkeley Apartment Lease Guide: 9 Things UC Berkeley Students Need to Know Before Signing",
    targetQuery: "Berkeley apartment lease guide for students",
    brief: `High-intent informational. Picks up "I'm about to sign a Berkeley lease" search intent. Listicle structure with 9 specific items (security deposit caps in California, 12-month vs 9-month lease tradeoffs, what utilities should be included, roommate clauses, rent control status, subletting rules, sublease over summer, lead disclosure, tenant rights). Each H2 is a numbered item. Direct, actionable. The CTA is "talk to Telegraph Commons" framed as "if you want a lease that's already student-tuned, we'd love to show you ours." FAQ covers: can the landlord raise rent mid-lease, what counts as a security deposit, what is rent control, when do most Berkeley leases start.`,
  },
  {
    title:
      "International Students at UC Berkeley: How to Get an Apartment Approved Fast",
    targetQuery: "international student apartment Berkeley UC Berkeley approval",
    brief: `TC's distinctive angle — instant international student approval — applied to a search intent that's underserved. The post walks through the documentation challenge international students face when renting in the US (no SSN, no credit history, no US guarantor), explains what most Berkeley landlords require (US guarantor or 12 months of rent up front), then introduces Telegraph Commons' instant international approval as the alternative. Sections: documentation checklist, what most landlords require, how TC works around the gap, what move-in timing looks like, language support. Closing CTA: "Apply today — we'll let you know within 24 hours."`,
  },
  {
    title:
      "Walking Distance to UC Berkeley: A Southside Living Guide for Students",
    targetQuery: "walking distance to UC Berkeley apartments Southside",
    brief: `Local-SEO + neighborhood play for the Southside (where TC is — 2490 Channing Way). Hook is "how close is 'walking distance' really?" Map the 5/10/15-minute walk radii from Sproul Plaza, name the streets and apartments in each band, end with TC's position (2-3 minute walk). Sections: the 5-minute walk (closest to campus), 10-minute walk, 15-minute walk, key streets to know (Telegraph Ave, Bancroft, Channing, Durant), what's around each (coffee, food, transit), best apartments in each band. Light, scannable, packed with named places — AEO loves named-place density.`,
  },
];

const NEIGHBORHOOD_PAGES: Array<{
  name: string;
  brief: string;
}> = [
  {
    name: "Southside Berkeley",
    brief: `TC's home neighborhood. /n/southside-berkeley target. Lead with how close it is to UC Berkeley (Telegraph Commons sits 2-3 minute walk from Sproul Plaza on 2490 Channing Way). Sections: campus proximity, dining and coffee on Telegraph Ave, transit (Berkeley BART 12-min walk, AC Transit lines), shopping (Telegraph Ave shops), nightlife/study spots. Five FAQs about Southside specifically (how close to campus, what restaurants, transit, safety, where do most freshmen live). Include 5 aiCitations — atomic claims like "Telegraph Commons sits 2 blocks from UC Berkeley's south gate, a 3-minute walk to Sproul Plaza" and "Southside Berkeley centers on Telegraph Avenue and reaches from Bancroft Way to Dwight Way." All claims should be verifiable from the property facts + neighborhood reality.`,
  },
  {
    name: "Downtown Berkeley",
    brief: `Counter-page neighborhood. /n/downtown-berkeley target. Position fairly — Downtown has its own merits (BART, more restaurants, mixed-use). But the underlying narrative is "if you're a UC Berkeley student, Southside (where Telegraph Commons sits) gives you a shorter walk to campus." Don't dunk on Downtown; describe it accurately. Sections: BART access and commute time, Downtown vs Southside for students, the Downtown apartment landscape, dining and culture. 5 FAQs (is Downtown closer to campus, BART vs walking, where do grad students live, when do leases turn over). 5 aiCitations that include the "vs Southside" framing where natural.`,
  },
  {
    name: "Northside Berkeley",
    brief: `Northside neighborhood page. /n/northside-berkeley. Greek-letter housing, quieter than Southside, closer to graduate schools. Describe accurately and use it as a foil — TC's Southside angle wins for undergrads who want walkability and energy; Northside wins for grad students and the quiet. Sections: who lives in Northside (mostly grads + Greek life), walk to campus, dining (Euclid Ave restaurants), housing types. 5 FAQs (is Northside cheaper, how close to campus, where do Greek houses sit, what's the difference vs Southside).`,
  },
];

async function loadContext(): Promise<{
  property: DrafterContext["property"];
  voice: string | null;
}> {
  const p = await prisma.property.findUniqueOrThrow({
    where: { id: PROPERTY_ID },
    select: {
      name: true,
      addressLine1: true,
      city: true,
      state: true,
      totalUnits: true,
      residentialSubtype: true,
      commercialSubtype: true,
      description: true,
      websiteUrl: true,
    },
  });
  const si = await prisma.siteIntelligence.findUnique({
    where: { orgId: ORG_ID },
    select: { brandVoice: true },
  });

  // Hand-curate the "facts" array from what we know about TC. The drafter
  // is forbidden from inventing facts so anything we don't pass through
  // here, it must write around generically. These are all verifiable from
  // the live telegraphcommons.com site at time of writing.
  const facts: string[] = [
    "2490 Channing Way, Berkeley, CA 94704",
    "2-3 minute walk to UC Berkeley campus (Sproul Plaza, south gate)",
    "Locally owned by SG Real Estate with decades of UC Berkeley student-housing experience",
    "Instant international student approval — no US guarantor required",
    "All-inclusive pricing (utilities + internet included, no surprise bills)",
    "Tour scheduling available; call (510) 704-1240 or schedule online",
    "Telegraph Ave dining, coffee, and shopping at the doorstep",
    "Berkeley BART station within a 12-minute walk",
  ];

  return {
    property: {
      name: p.name,
      addressLine1: p.addressLine1,
      city: p.city,
      state: p.state,
      totalUnits: p.totalUnits,
      residentialSubtype: p.residentialSubtype,
      commercialSubtype: p.commercialSubtype,
      description: p.description,
      facts,
    },
    voice: si?.brandVoice ?? null,
  };
}

// Mirrors renderToHtml in app/api/portal/content/route.ts so the editor
// opens with the same HTML shape it would from a live operator-triggered
// draft. Trimmed to the two formats we actually pre-fill here.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function renderBlogHtml(o: Record<string, unknown>): string {
  const title = typeof o.title === "string" ? o.title : "";
  const intro = typeof o.intro === "string" ? o.intro : "";
  const sections = Array.isArray(o.sections) ? o.sections : [];
  const faqs = Array.isArray(o.faqs) ? o.faqs : [];
  const closing = typeof o.closing === "string" ? o.closing : "";
  const parts: string[] = [`<h1>${escapeHtml(title)}</h1>`];
  if (intro) parts.push(`<p>${escapeHtml(intro)}</p>`);
  for (const s of sections as Array<Record<string, unknown>>) {
    const heading = typeof s.heading === "string" ? s.heading : "";
    const body = typeof s.body === "string" ? s.body : "";
    if (heading) parts.push(`<h2>${escapeHtml(heading)}</h2>`);
    for (const p of body.split(/\n\n+/).map((x) => x.trim()).filter(Boolean)) {
      parts.push(`<p>${escapeHtml(p)}</p>`);
    }
  }
  if (faqs.length > 0) {
    parts.push(`<h2>Frequently asked questions</h2>`);
    for (const f of faqs as Array<Record<string, unknown>>) {
      const q = typeof f.question === "string" ? f.question : "";
      const a = typeof f.answer === "string" ? f.answer : "";
      if (q) parts.push(`<h3>${escapeHtml(q)}</h3>`);
      if (a) parts.push(`<blockquote><p>${escapeHtml(a)}</p></blockquote>`);
    }
  }
  if (closing) parts.push(`<p>${escapeHtml(closing)}</p>`);
  return parts.join("\n");
}
function renderNeighborhoodHtml(o: Record<string, unknown>): string {
  const title = typeof o.title === "string" ? o.title : "";
  const intro = typeof o.intro === "string" ? o.intro : "";
  const sections = Array.isArray(o.sections) ? o.sections : [];
  const faqs = Array.isArray(o.faqs) ? o.faqs : [];
  const parts: string[] = [`<h1>${escapeHtml(title)}</h1>`];
  if (intro) parts.push(`<p>${escapeHtml(intro)}</p>`);
  for (const s of sections as Array<Record<string, unknown>>) {
    const heading = typeof s.heading === "string" ? s.heading : "";
    const body = typeof s.body === "string" ? s.body : "";
    if (heading) parts.push(`<h2>${escapeHtml(heading)}</h2>`);
    for (const p of body.split(/\n\n+/).map((x) => x.trim()).filter(Boolean)) {
      parts.push(`<p>${escapeHtml(p)}</p>`);
    }
  }
  if (faqs.length > 0) {
    parts.push(`<h2>Frequently asked questions</h2>`);
    for (const f of faqs as Array<Record<string, unknown>>) {
      const q = typeof f.question === "string" ? f.question : "";
      const a = typeof f.answer === "string" ? f.answer : "";
      if (q) parts.push(`<h3>${escapeHtml(q)}</h3>`);
      if (a) parts.push(`<blockquote><p>${escapeHtml(a)}</p></blockquote>`);
    }
  }
  return parts.join("\n");
}

async function writeDraft(args: {
  format: ContentFormat;
  brief: string;
  targetQuery: string | null;
  output: Record<string, unknown>;
  markdown: string;
  htmlBody: string;
  model: string;
}) {
  const draft = await prisma.contentDraft.create({
    data: {
      orgId: ORG_ID,
      propertyId: PROPERTY_ID,
      format: args.format,
      brief: args.brief,
      targetQuery: args.targetQuery,
      output: args.output as object,
      outputMarkdown: args.markdown,
      htmlBody: args.htmlBody,
      model: args.model,
      estimatedScore:
        typeof args.output.estimatedScore === "number"
          ? args.output.estimatedScore
          : null,
      status: DraftStatus.GENERATING,
      generatedAt: new Date(),
      aiContext: {
        targetQuery: args.targetQuery,
        prefilled: true,
        prefilledAt: new Date().toISOString(),
      } as object,
    },
    select: { id: true, estimatedScore: true },
  });
  return draft;
}

(async () => {
  const ctx = await loadContext();
  console.log(`Loaded context for ${ctx.property.name}.`);
  console.log(`Brand voice cached: ${ctx.voice ? "yes (" + ctx.voice.length + " chars)" : "no"}`);

  // BLOGS
  for (const topic of BLOG_TOPICS) {
    console.log(`\n[blog] Drafting: ${topic.title}`);
    const start = Date.now();
    try {
      const result = await draftBlogPost({
        property: ctx.property,
        brief: topic.brief,
        targetQuery: topic.targetQuery,
        voice: ctx.voice ?? undefined,
        audience: "UC Berkeley students searching for off-campus apartments",
      });
      const html = renderBlogHtml(result.output as unknown as Record<string, unknown>);
      const draft = await writeDraft({
        format: "BLOG_POST",
        brief: topic.brief,
        targetQuery: topic.targetQuery,
        output: result.output as unknown as Record<string, unknown>,
        markdown: result.markdown,
        htmlBody: html,
        model: result.model,
      });
      console.log(
        `  [done] ${((Date.now() - start) / 1000).toFixed(1)}s — score=${draft.estimatedScore} — id=${draft.id}`,
      );
    } catch (err) {
      console.error(`  [FAILED]`, err instanceof Error ? err.message : err);
      if (err && typeof err === "object" && "text" in err) {
        console.error("  Claude returned:", String((err as { text?: string }).text).slice(0, 500));
      }
      if (err && typeof err === "object" && "cause" in err) {
        console.error("  Cause:", JSON.stringify((err as { cause?: unknown }).cause, null, 2).slice(0, 600));
      }
    }
  }

  // NEIGHBORHOOD PAGES — written via draftNeighborhoodPage. We still
  // persist as ContentDraft rows (vs NeighborhoodPage) so they ride the
  // same operator-submit → admin-queue flow as everything else; once
  // the admin marks them deployed they can be promoted to NeighborhoodPage
  // entries later if we want them rendered on a LeaseStack-hosted tenant
  // site. For TC (external-via-admin mode) the MDX export is the
  // shipping artifact regardless.
  for (const np of NEIGHBORHOOD_PAGES) {
    console.log(`\n[neighborhood] Drafting: ${np.name}`);
    const start = Date.now();
    try {
      const result = await draftNeighborhoodPage({
        property: ctx.property,
        brief: np.brief,
        targetQuery: np.name,
        voice: ctx.voice ?? undefined,
        audience: "UC Berkeley students and prospective renters comparing neighborhoods",
      });
      const html = renderNeighborhoodHtml(result.output as unknown as Record<string, unknown>);
      const draft = await writeDraft({
        format: "NEIGHBORHOOD_PAGE",
        brief: np.brief,
        targetQuery: np.name,
        output: result.output as unknown as Record<string, unknown>,
        markdown: result.markdown,
        htmlBody: html,
        model: result.model,
      });
      console.log(
        `  [done] ${((Date.now() - start) / 1000).toFixed(1)}s — score=${draft.estimatedScore} — id=${draft.id}`,
      );
    } catch (err) {
      console.error(`  [FAILED]`, err instanceof Error ? err.message : err);
    }
  }

  console.log("\nAll drafts created. Visit https://leasestack.co/portal/content");
  process.exit(0);
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
