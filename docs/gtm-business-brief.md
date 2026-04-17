# Wholesail — Business Brief & GTM Plan

## Executive Summary

Wholesail is a **white-label B2B wholesale ordering portal platform**. You build a custom-branded client portal for a distribution company in under 2 weeks — replacing their phone orders, spreadsheets, QuickBooks invoicing, and ERP with a single unified system. Features include online ordering, SMS/iMessage ordering (Bloo.io), standing orders, client analytics, net-terms billing, loyalty programs, and an AI order parser.

**Business model:**
- $25K+ one-time build fee
- $5K+/mo recurring retainer (support, changes, hosting)

This is high-margin, sticky, recurring revenue. Clients who deploy their portal cannot easily leave — their clients are using it daily.

---

## Cost Per Deployed Portal (COGS)

### One-time build costs
| Item | Cost |
|------|------|
| Claude Haiku (config generation) | ~$0.01 |
| Claude Sonnet (research synthesis) | ~$0.05 |
| Tavily web searches (4x) | ~$0.04 |
| GitHub repo creation | $0 |
| Vercel project provisioning | $0 |
| Neon Postgres setup | $0 |
| **Total AI/infra build cost** | **~$0.10** |

The build pipeline is essentially free to run. The only cost is time.

### Monthly infrastructure per deployed portal
| Service | Cost/mo |
|---------|---------|
| Vercel (Pro, custom domain) | $20 |
| Neon Postgres (Launch tier) | $19 |
| Clerk Auth (up to 10K MAU) | $25 |
| Upstash Redis | $0–10 |
| Resend (50K emails) | $20 |
| Sentry (error tracking) | $26 |
| **Total infra per portal** | **~$110–120/mo** |

### Variable per-user costs (negligible)
- Email sends: ~$0.0004/email
- AI order parsing (SMS): ~$0.0004/order (Haiku)
- Analytics queries: $0 (Prisma/Postgres)

### Gross margin math
| Revenue | COGS | Gross Margin |
|---------|------|-------------|
| $25K build | ~$0 (automated) | ~99% |
| $5K/mo retainer | ~$120/mo infra | **97.6%** |

At scale with 20 clients: **$100K MRR, ~$97.6K gross profit monthly.**

---

## Five High-Leverage ICPs

### ICP 1: Regional Food & Beverage Distributors
**Who:** Family-owned or PE-backed distributors with 50–500 accounts, $5M–$75M revenue, selling specialty food, produce, meat, or dairy to restaurants, hotels, and grocers. Currently running on QuickBooks, spreadsheets, and phone orders.

**Why they buy:** Their clients are texting orders at 7am. They're manually entering those into QuickBooks. Their AR team is chasing net-30 invoices by phone. One wrong delivery kills a client relationship.

**Budget:** $25K build is 0.05% of $5M revenue. Easy yes. $5K/mo is cheaper than one FTE.

**Where to find them:** IFDA member directory, regional food industry associations, LinkedIn (VP Operations, Owner/CEO at distribution companies). Trade shows: IFDA Distribution Solutions Conference, PMA Fresh Summit.

---

### ICP 2: Specialty/Artisan Food Importers
**Who:** Companies importing and distributing premium products — A5 Wagyu, artisan cheese, charcuterie, truffles, premium spirits, Japanese seafood. Selling to Michelin-starred restaurants, private clubs, luxury hotels. $2M–$20M revenue, 50–200 clients, very high AOV ($500–$5K/order).

**Why they buy:** Their clients are high-end chefs who expect a premium experience. A phone call or fax to order Wagyu is embarrassing. They want a branded portal that matches their product prestige.

**Budget:** Even easier yes. $25K is nothing relative to their margins.

**Where to find them:** Specialty Food Association, LinkedIn, Instagram. The TBGC demo is literally this ICP.

---

### ICP 3: Packaging & Industrial Supply Distributors
**Who:** Regional distributors of corrugated boxes, packaging materials, industrial MRO supplies, janitorial/facilities. Selling to manufacturers, e-commerce fulfillment centers, 3PLs. $10M–$100M revenue. Complex per-account contract pricing, large SKU counts.

**Why they buy:** A packaging order by phone can take 45 minutes. Account-specific pricing means every manually-adjusted invoice is an error risk. ROI is immediate and measurable.

**Budget:** These are larger businesses. $25K–$50K build easily justified. Monthly retainer up to $10K.

**Where to find them:** ISSA (janitorial), AICC (independent packaging converters), Thomas Net, LinkedIn.

---

### ICP 4: Restaurant Supply & Equipment Distributors
**Who:** Companies distributing commercial kitchen equipment, small wares, and restaurant supplies to independent restaurants, chains, and hotel groups. $5M–$50M revenue. Orders are high-value, semi-recurring, and require quote workflows.

**Why they buy:** Their clients (restaurant owners, exec chefs, hotel F&B directors) want to reorder supplies online, not call a rep. Standing orders for recurring supplies are a massive time saver.

**Where to find them:** NAFEM (foodservice equipment), IRE (independent restaurant expo), LinkedIn, state restaurant associations.

---

### ICP 5: Alcohol & Beverage Distributors (Three-Tier)
**Who:** State-licensed alcohol distributors (wine, spirits, craft beer) selling to on-premise accounts (bars/restaurants) and off-premise (retail). Highly regulated, complex per-account allocation management. $10M–$500M revenue.

**Why they buy:** Sales reps currently drive routes and take paper orders. Digital ordering is a competitive moat — the distributor with a portal gets more share-of-wallet because it's just easier to reorder. Standing orders for weekly allocations are critical.

**Budget:** Often large, cash-rich businesses. $50K+ builds, $10K+/mo retainers are realistic.

**Where to find them:** WSWA (Wine & Spirits Wholesalers of America), NBWA (National Beer Wholesalers), state distributor associations.

---

## Dream 100 — Audience Owners to Partner With

The core insight: don't sell to 100 distributors one at a time. Find the 10 people who each talk to 1,000 distributors.

### Tier 1 — Direct audience access (podcast, newsletter, community)

**1. Distribution Strategy Group** (distributor.com)
Mark Dancer and team. Newsletter + podcast serving distribution executives. Audience is exactly the ICP — distribution company owners and ops leaders.
- Play: Sponsor the podcast ($2–5K/episode), contribute a "B2B digital ordering" piece to their content.

**2. Modern Distribution Management** (mdm.com)
Trade publication and community for distribution executives.
- Play: Sponsored content, webinar partnership, case study placement.

**3. The Produce Industry Podcast / Fresh Talk (PMA)**
Reaches produce distributors and fresh food supply chain.
- Play: Guest appearance, sponsor an episode with a specific food distribution angle.

**4. Joe Lynch — The Logistics of Logistics Podcast**
Logistics and supply chain LinkedIn audience + podcast.
- Play: Guest episode on "how distributors are modernizing B2B ordering."

**5. IFDA (International Foodservice Distributors Association)**
They run events, publish research, and email their entire member base.
- Play: Become an associate member or technology partner. Get into their annual conference. One speaking slot = 500 qualified prospects.

### Tier 2 — LinkedIn/newsletter influencers

**6. Food & beverage distribution LinkedIn creators**
Search LinkedIn for "food distribution" + 10K+ followers. These micro-influencers post daily to exactly your ICP.
- Play: Sponsor a post, or offer a revenue share for any closed deal they refer.

**7. AICC / TAPPI** (packaging industry associations)
Same play for ICP #3 (packaging distributors).

**8. CPG founder community (Kara Goldin, Hint Water tier)**
These are distributors' customers. If CPG founders push their distributors to use portals, demand flows down.
- Play: "Your distributor should have a portal" content targeting CPG brands.

---

## Unit Economics

| Metric | Value |
|--------|-------|
| ACV (Year 1) | $25K build + $60K retainer = **$85K** |
| ACV (Year 2+) | $60K/yr retainer only |
| Gross margin | 97.6% |
| CAC (with cold email) | ~$2K–5K |
| LTV (3-year client) | $25K + $180K = **$205K** |
| LTV:CAC ratio | **~50:1** |
| Payback period | **< 2 weeks** |

---

## Go-to-Market — Revenue This Week

### Day 1–2: Build your lead list in Cursive

**Search criteria:**
- Industry: Food & Beverage Wholesale, Specialty Food Distribution, Industrial Distribution
- Employee count: 20–250
- Revenue: $5M–$75M
- Geography: US
- Job titles: CEO, President, Owner, VP Operations, Director of Operations, Co-Founder
- Exclude: Retailers, restaurants (they're the customers), publicly traded companies

Pull 500 leads. This is your first campaign list.

### Day 2–3: Launch 3 cold email sequences in Email Bison

**Sequence A — Pain-led (food & bev distributors)**
> Subject: Your clients are still ordering by phone?
>
> Hey [First Name] —
>
> Quick question: what percentage of your orders still come in via text, phone, or email?
>
> For most regional distributors I talk to, it's 60–80%. That means 5–10 hours/week of manual entry, and one wrong order away from a lost account.
>
> We built a white-label ordering portal for [similar company in their region/industry] that cut manual order entry by 90% in the first month.
>
> Worth a 15-minute call to see if it fits? [Cal link]

**Sequence B — Demo-led (specialty food)**
> Subject: [Company Name] — saw your product line
>
> Hey [First Name] —
>
> Found [Company Name] while looking at premium [food category] distributors in [region]. Really impressive product selection.
>
> Question: do your restaurant clients have a dedicated ordering portal, or are they still calling/texting orders in?
>
> We built exactly this for a specialty food distributor — branded portal, standing orders for recurring accounts, AI-powered order parsing from iMessage. Their clients love it.
>
> I can show you a live demo in 15 minutes. [Cal link]

**Sequence C — ROI-led (packaging/industrial)**
> Subject: Eliminating your manual invoice corrections
>
> Hey [First Name] —
>
> If you're managing contract pricing across 50+ accounts, your team is probably adjusting invoices manually at least a few times a week when the wrong tier gets applied.
>
> We built a B2B ordering portal that enforces per-account pricing at checkout — no manual adjustments, no post-invoice corrections.
>
> Happy to show you a working demo this week. [Cal link]

### Day 3–5: Warm outreach (higher close rate)

1. Every distribution company in your personal network — send personal messages, not sequences
2. Your existing clients in other businesses — do any of them have distribution company contacts?
3. LinkedIn DMs to 20 people who match ICP #1 or #2 — short personalized note, link to the demo portal

### Day 5–7: The demo close

Sales call structure:
1. 5 min — understand their current process ("how do your clients order today?")
2. 10 min — walk the live demo portal (TBGC is perfect for specialty food)
3. 5 min — show the build pipeline ("we can have yours live in 2 weeks")
4. 5 min — close: "$25K build, $5K/mo retainer, cancel anytime"

---

## Hiring Plan

**Right now (pre-revenue):** Do everything yourself. You have Cursive + Email Bison. Run 500-lead cold email campaigns solo. Your only constraint is time on sales calls.

**At $20K MRR (4 clients):** Hire a part-time SDR to run outbound so you can focus on closing and delivery. $3–5K/mo fully loaded.

**At $50K MRR (10 clients):** Hire a full-time AE to run your sales process. You focus on product, key client relationships, and Dream 100 partnerships. $8–12K/mo.

**At $100K MRR (20 clients):** Hire a CS person to manage retainer clients so churn stays near zero. $5–7K/mo.

Never hire before you need to. With 97% gross margins, get to 10 clients first — that's $50K MRR and $600K ARR. Everything else follows from there.

---

## This Week's Checklist

- [ ] Pull 500 leads from Cursive (ICP #1 and #2 first)
- [ ] Write 3 email sequences, set up in Email Bison
- [ ] Launch 200-lead test batch (A/B test subjects)
- [ ] Send 20 warm LinkedIn DMs personally
- [ ] Book 5+ demos this week
- [ ] Record a 3-minute Loom walkthrough of the TBGC demo portal
- [ ] Set up Cal.com link for "30-min Wholesail Demo"
- [ ] Get one client on a verbal commitment by Friday
