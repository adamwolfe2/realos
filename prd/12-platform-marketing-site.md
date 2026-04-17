# Sprint 12 — Platform Marketing Site

**Duration:** 1 day
**Dependencies:** Sprint 02, 03
**Goal:** The public marketing site at `{platformdomain}.com` that sells the product. Homepage, pricing, vertical pages, competitor comparison, consultation booking CTA. This is how new real estate operators discover us.

---

## Strategic framing

Every page has one goal: get qualified real estate operators to book a consultation call. No self-serve signup, no free trial. The CTA everywhere is "Book a demo" which routes to `/onboarding` (Sprint 03's intake wizard).

### Copy direction
- Primary positioning: "Conversion Logix delivered poorly, for the price of a competent agency" — we are the replacement, not a supplement
- Pain-driven headlines: "Tired of paying $2,600/mo for leads that never tour?"
- Proof-driven subheads: AppFolio integration, pixel with 70% ID rate, 24/7 AI chatbot, real follow-up
- Never use the word "snapshot" — this is a managed SaaS platform

### Secondary audiences (separate vertical pages)
- Student housing operators (primary wedge)
- Multifamily property managers
- Senior living communities

Commercial pages are scaffolded but gated with "coming soon" in v1.

---

## Fork from Wholesail

**Rename route group:**
```bash
mv app/\(marketing\) app/\(platform\)
```

**Keep and rewrite:**
- `app/(platform)/page.tsx` — homepage (rewrite entirely for real estate)
- `app/(platform)/about/page.tsx` — about page
- `app/(platform)/terms/page.tsx`, `privacy/page.tsx` — keep, update entity name
- Nav and footer components in `components/marketing-header.tsx`, `components/footer.tsx` — update nav items

**Create new:**
- `app/(platform)/pricing/page.tsx`
- `app/(platform)/demo/page.tsx` — marketing demo (separate from intake)
- `app/(platform)/residential/page.tsx`
- `app/(platform)/commercial/page.tsx` — v1 stub, "coming Q3"
- `app/(platform)/student-housing/page.tsx`
- `app/(platform)/multifamily/page.tsx`
- `app/(platform)/senior-living/page.tsx`
- `app/(platform)/compare/conversion-logix/page.tsx`
- `app/(platform)/features/pixel/page.tsx`
- `app/(platform)/features/chatbot/page.tsx`
- `app/(platform)/features/seo-aeo/page.tsx`
- `app/(platform)/features/ads/page.tsx`
- `app/(platform)/tools/` — lead magnet tools folder (v2 — stub for now)
- `app/(platform)/blog/` — blog scaffold (content added over time)

---

## Step-by-step

### 1. Homepage

`app/(platform)/page.tsx` — key sections in order:

1. **Hero**
   - Headline: "Marketing infrastructure for real estate operators"
   - Subhead: "Stop paying Conversion Logix $2,600 a month for underperforming ads. Replace your entire marketing stack with one managed platform."
   - CTA: "Book a demo" → `/onboarding`
   - Visual: dashboard screenshot or animated mock

2. **Pain-point strip** (3 columns)
   - "Current agency shows vanity metrics but no leases"
   - "Chatbot is a glorified FAQ, never captures leads"
   - "No idea who's visiting your site"

3. **How it works** (4 steps)
   - Book a 30-min demo
   - We audit your current stack for free
   - Launch in 2 weeks
   - Measurable results or cancel anytime

4. **Platform at a glance** (module grid)
   - Hosted marketing site, AppFolio-synced listings, identity graph pixel, AI chatbot, Google + Meta ads, SEO/AEO, creative studio, referral tracking, CRM, multi-property dashboard

5. **Who it's for** (vertical links)
   - Student housing
   - Multifamily
   - Senior living
   - "We tailor services to each vertical"

6. **Proof** (client logos + stats or testimonials)
   - Start with Telegraph Commons case study

7. **Comparison** (vs Conversion Logix table)
   - Link to `/compare/conversion-logix`

8. **Pricing teaser**
   - "Starter from $1,497/mo. Growth $2,997. Scale $4,997. Build fees vary by scope. Ad spend at 15% markup."
   - "See pricing details →" `/pricing`

9. **Founder quote**
   - Brief line from Adam about why this product exists

10. **Final CTA**
    - "Book a demo" large button

### 2. Pricing page

`app/(platform)/pricing/page.tsx` — 3 tier cards + add-ons + FAQ:

**Starter — $1,497/mo**
- Hosted marketing site
- AppFolio listings sync
- Lead capture forms + exit intent
- Basic CRM
- 1 property
- Email support

**Growth — $2,997/mo** (most popular)
- Everything in Starter
- Identity graph pixel
- AI chatbot with lead capture
- Automated nurture sequences
- SEO + AEO landing pages
- Up to 3 properties
- Slack support

**Scale — $4,997/mo**
- Everything in Growth
- Google + Meta ads management (+15% of spend)
- Ad creative studio (unlimited requests)
- Student referral program
- Dedicated account manager
- Unlimited properties
- Weekly strategy calls

**Add-ons**: outbound cold email ($697/mo), SEO premium ($597/mo)

**Build fees**: $5K (1 property, clean backend) to $15K (multi-property, complex integration). Quoted on the consultation call.

CTA under each card: "Book a demo" → `/onboarding?tier=growth`.

### 3. Vertical pages

Each vertical page (`student-housing`, `multifamily`, `senior-living`) is a focused landing page:

- Hero speaking directly to that audience
- Specific pain points ("graduation turnover", "fair housing compliance", "waitlist management")
- Features most relevant to that vertical
- Case study or testimonial from that vertical
- CTA

Content pattern — build one component `<VerticalLanding />` that accepts props:
```tsx
<VerticalLanding
  vertical="student-housing"
  headline="..."
  painPoints={[...]}
  featuredModules={["chatbot", "referrals", "seo"]}
  caseStudy={{ client: "Telegraph Commons", result: "..." }}
/>
```

### 4. Feature pages

Deep dive per module: `features/pixel`, `features/chatbot`, `features/seo-aeo`, `features/ads`. Each explains what it is, how it works, what results to expect, who it's for. Each ends with "Book a demo".

### 5. Competitor comparison

`app/(platform)/compare/conversion-logix/page.tsx` — side-by-side table:

| Feature | Conversion Logix | {{PRODUCT_NAME}} |
|---|---|---|
| Monthly cost | $2,600+ | From $1,497 |
| Chatbot | Scripted FAQ | AI with real lead capture |
| Pixel | None | Cursive identity graph |
| Listings sync | Manual | AppFolio API live sync |
| Creative turnaround | 2–3 weeks | 48 hours |
| Reporting | PDF reports | Live dashboard + cross-property views |
| Ad creative | Template-based | Custom on demand |
| Student referrals | Not supported | Native module |
| AppFolio integration | No | Yes |

Follow with detailed paragraphs expanding each row. End with a Book a Demo CTA.

Write a **similar-but-softer page** for any other named competitor (REACH, G5, etc.) using the same pattern — never say anything false, stick to factual feature comparisons.

### 6. Demo page

`app/(platform)/demo/page.tsx` — two options:

**A. Live demo video** (pre-recorded by Adam, 3–5 minutes)
**B. Interactive demo** — drop in a URL, see a mock dashboard with their property "converted"

For v1 ship option A, with Option B as a Sprint v2 feature. Option B idea:
- Enter your current property website URL
- We scrape it (web_fetch)
- Generate a mock tenant site + mock stats + mock AppFolio sync
- "This is what your marketing could look like in 2 weeks — want to make it real?" CTA

### 7. Blog scaffold

`app/(platform)/blog/page.tsx` — list of posts (read from MDX files in `content/blog/`). `app/(platform)/blog/[slug]/page.tsx` — post detail. Ship 3 initial posts:

- "Why we built a Conversion Logix alternative"
- "The hidden cost of ignoring 95% of your website traffic"
- "How Telegraph Commons filled 12 leases in 30 days with an AI chatbot"

### 8. Tools scaffold (v2 placeholder)

`app/(platform)/tools/page.tsx` — stub listing:
- Property marketing audit (coming soon)
- Rent price analyzer (coming soon)
- Move-in checklist generator (coming soon)
- Campus distance calculator (coming soon)

Each card links to a "Join the waitlist" email capture. Don't build the tools themselves; just capture interest signal.

### 9. Nav + footer

Nav items:
- Product (dropdown: Pixel, Chatbot, SEO, Ads, Creative studio)
- Solutions (dropdown: Student housing, Multifamily, Senior living, Commercial (soon))
- Pricing
- Compare (dropdown: vs Conversion Logix, vs REACH, etc.)
- Tools
- Blog
- Book a demo (CTA)

Footer:
- Company: About, Blog, Careers, Contact
- Product: Pricing, Demo, Tools, Compare
- Legal: Privacy, Terms
- Social: LinkedIn, Twitter, YouTube

### 10. SEO infrastructure

- `app/sitemap.xml/route.ts` — dynamically generate sitemap from static routes + blog posts
- `app/robots.txt/route.ts` — allow all on platform domain
- Per-page `metadata` exports with unique title, description, OG image
- Schema.org markup on:
  - Homepage (Organization)
  - Pricing (Product/Offer)
  - Blog posts (Article)
  - Features (Service)

### 11. Lead capture on platform site

Footer email signup, exit-intent popup, and "Book a demo" are the 3 conversion points. All route through:

```typescript
// Footer email → EmailSubscriber with orgId null (platform-level)
// Exit intent on platform site → same
// "Book a demo" → /onboarding
```

### 12. Conversion tracking

Install our own Cursive pixel on the platform site. Yes, we drink our own champagne. This gives Adam identified visitor data from our prospects, plus serves as a live demo when clients ask "does the pixel really work?"

Also install:
- Google Ads conversion tracking (for when we run ads to the platform)
- Meta pixel
- PostHog or Plausible for product analytics

### 13. Copy maintenance

Every string goes in `lib/copy/marketing.ts` so when the product name changes or pricing shifts we edit one file. Pattern:

```typescript
// lib/copy/marketing.ts
export const COPY = {
  home: {
    hero: {
      headline: "Marketing infrastructure for real estate operators",
      subhead: "Stop paying Conversion Logix...",
      cta: "Book a demo",
    },
    pains: [
      { headline: "...", body: "..." },
      // ...
    ],
  },
  pricing: {
    tiers: [
      { name: "Starter", priceMonthly: 1497, features: [...] },
      // ...
    ],
  },
  // ...
};
```

### 14. Pre-launch checklist

- [ ] All pages mobile responsive
- [ ] Lighthouse > 90 across homepage, pricing, verticals
- [ ] Open Graph images render for each page
- [ ] Favicon + app icons
- [ ] Cal.com booking embed works
- [ ] Formspree/intake wizard reachable from every CTA
- [ ] Analytics firing
- [ ] Our own Cursive pixel installed
- [ ] 404 page branded

---

## Done when

- [ ] Platform domain serves complete marketing site
- [ ] All CTAs route to `/onboarding` (or `/onboarding?tier=X` for tier-specific)
- [ ] Pricing page clearly stated, consultation required
- [ ] At least 3 vertical pages live (student housing, multifamily, senior living)
- [ ] Conversion Logix comparison page live
- [ ] 3 blog posts shipped
- [ ] Cursive pixel on platform site fires correctly (we track our own prospects)
- [ ] Lighthouse > 90
- [ ] OG images render for social sharing
- [ ] Sitemap + robots.txt + schema.org markup in place

## Launch

After Sprint 12, the platform is feature-complete for v1. Next steps outside this PRD:

1. Migrate Norman / Telegraph Commons onto the new platform
2. Onboard 2-3 additional paying clients to validate the sales motion
3. Refine the intake-to-close funnel based on real conversations
4. Start v2 sprints: commercial vertical UI, lead magnet tools library, referral attribution, AI creative generation in the studio
